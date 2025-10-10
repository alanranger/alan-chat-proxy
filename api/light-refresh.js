// /api/light-refresh.js
// Lightweight hourly refresh: read URLs from repo CSV and re-ingest changed content (simple mode: re-ingest all), then finalize mappings.
// GET /api/light-refresh?action=run
// GET /api/light-refresh?action=urls

export const config = { runtime: 'nodejs' };

import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const CSV_PATH = 'CSVSs from website/06 - site urls - Sheet1.csv';

function send(res, status, obj){
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).send(JSON.stringify(obj));
}

function parseCSV(csvText){
  const s = csvText.replace(/\r/g, '');
  const rows = []; let row=[], field='', inQ=false;
  for (let i=0;i<s.length;i++){
    const c=s[i];
    if(inQ){
      if(c==='"' && s[i+1]==='"'){ field+='"'; i++; }
      else if(c==='"'){ inQ=false; }
      else field+=c;
    }else{
      if(c==='"') inQ=true; else if(c===','){ row.push(field); field=''; }
      else if(c==='\n'){ row.push(field); rows.push(row); row=[]; field=''; }
      else field+=c;
    }
  }
  if(field||row.length){ row.push(field); rows.push(row); }
  return rows;
}

async function checkForChangedUrls(urls) {
  const changedUrls = [];
  const client = supa();
  
  // Process URLs in smaller batches to avoid timeout
  const batchSize = 50; // Smaller batches for HEAD requests
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    
    // Process batch concurrently with Promise.all
    const batchPromises = batch.map(async (url) => {
      try {
        // Get last processed timestamp for this URL
        const { data: existing } = await client
          .from('url_last_processed')
          .select('last_modified_header, last_processed_at')
          .eq('url', url)
          .single();
        
        // Make HEAD request to check Last-Modified header
        const response = await fetch(url, { method: 'HEAD' });
        const lastModifiedHeader = response.headers.get('last-modified');
        
        if (!lastModifiedHeader) {
          // If no Last-Modified header, assume it changed (first time or no header)
          return { url, changed: true };
        }
        
        const lastModified = new Date(lastModifiedHeader);
        const lastProcessed = existing ? new Date(existing.last_processed_at) : new Date(0);
        
        // If Last-Modified is newer than our last processed time, URL has changed
        const changed = lastModified > lastProcessed;
        
        // Update our tracking record
        await client
          .from('url_last_processed')
          .upsert({
            url,
            last_modified_header: lastModified.toISOString(),
            last_processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          
        return { url, changed };
        
      } catch (e) {
        // If we can't check, assume it changed to be safe
        return { url, changed: true };
      }
    });
    
    // Wait for batch to complete
    const batchResults = await Promise.all(batchPromises);
    
    // Add changed URLs to our result
    batchResults.forEach(result => {
      if (result.changed) {
        changedUrls.push(result.url);
      }
    });
  }
  
  return changedUrls;
}

async function readUrlsFromRepo(){
  let content = null;
  try {
    content = await fs.readFile(CSV_PATH, 'utf8');
  } catch (e) {
    // Fallback: fetch from GitHub raw if local path isn't packaged in the serverless bundle
    try {
      const rawUrl = 'https://raw.githubusercontent.com/alanranger/alan-chat-proxy/main/CSVSs%20from%20website/06%20-%20site%20urls%20-%20Sheet1.csv';
      const resp = await fetch(rawUrl);
      if (!resp.ok) throw new Error(`raw_fetch_http_${resp.status}`);
      content = await resp.text();
    } catch (e2) {
      throw e; // bubble original error to report ENOENT
    }
  }
  const rows = parseCSV(content);
  if(rows.length<2) return [];
  const headers = rows[0].map(h=>h.toLowerCase());
  const urlIdx = headers.findIndex(h=>h.includes('url'));
  if(urlIdx===-1) return [];
  const urls = rows.slice(1).map(r=>r[urlIdx]).filter(Boolean);
  return [...new Set(urls)];
}

function need(k){
  const v = process.env[k];
  if(!v || !String(v).trim()) throw new Error(`missing_env:${k}`);
  return v;
}

function supa(){
  return createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
}

export default async function handler(req, res){
  try{
    const action = String(req.query.action||'').toLowerCase();
    if(!action) return send(res, 400, { ok:false, error:'bad_request', detail:'missing action' });

    if(action==='urls'){
      const urls = await readUrlsFromRepo();
      return send(res, 200, { ok:true, count:urls.length, sample:urls.slice(0,10) });
    }

    if(action==='run' || action==='manual'){
      const startedAt = new Date().toISOString();
      let urls = [];
      let changedUrls = [];
      let chunks = [];
      let ingested = 0;
      let failed = 0;
      let error = null;

      try {
        urls = await readUrlsFromRepo();
        
        // Check which URLs have changed since last run
        changedUrls = await checkForChangedUrls(urls);
        
        const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:3000`;
        const token = process.env.INGEST_TOKEN || '';
        const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.VERCEL_PROTECTION_BYPASS || process.env.PROTECTION_BYPASS_TOKEN || '';

        if (protectionBypass && token && changedUrls.length > 0) {
          const batchSize = 20; // Process changed URLs in batches
          for(let i=0;i<changedUrls.length;i+=batchSize){
            const part = changedUrls.slice(i, i+batchSize);
            const r = await fetch(`${base}/api/ingest`, {
              method:'POST',
              headers:{
                'Content-Type':'application/json',
                Authorization:`Bearer ${token}`,
                'x-vercel-protection-bypass': protectionBypass
              },
              body: JSON.stringify({ csvUrls: part })
            });
            const bodyText = await r.text();
            let j = null; try { j = JSON.parse(bodyText); } catch {}
            if (r.ok && j && j.ok){ 
              ingested += (j.ingested || part.length); 
              chunks.push({ idx:i, count: part.length, ok:true, urls: part }); 
            } else { 
              failed += part.length; 
              chunks.push({ idx:i, count: part.length, ok:false, error: (j && (j.error||j.detail)) || bodyText, urls: part }); 
            }
          }
          // Finalize mappings after all batches
          try{
            await fetch(`${base}/api/tools?action=finalize`, { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'x-vercel-protection-bypass': protectionBypass } });
          }catch{}
        } else {
          chunks.push({ 
            note: `Bypass token: ${protectionBypass ? 'present' : 'missing'}, Ingest token: ${token ? 'present' : 'missing'}, Changed URLs: ${changedUrls.length}` 
          });
        }
      } catch (e) {
        error = String(e?.message || e);
        chunks.push({ error });
      }

      const finishedAt = new Date().toISOString();
      try{
        const client = supa();
        await client.from('light_refresh_runs').insert([{
          started_at: startedAt,
          finished_at: finishedAt,
          urls_total: urls.length,
          urls_changed: changedUrls.length,
          ingested_count: ingested,
          failed_count: failed,
          batches_json: chunks
        }]);
      }catch(e){}

      return send(res, 200, { 
        ok:true, 
        started_at: startedAt, 
        finished_at: finishedAt, 
        urls: urls.length, 
        ingested, 
        failed, 
        batches: chunks,
        error,
        mode: (process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.VERCEL_PROTECTION_BYPASS || process.env.PROTECTION_BYPASS_TOKEN) && (process.env.INGEST_TOKEN || '') ? 'ingest' : 'log-only'
      });
    }

    if(action==='status'){
      try{
        const client = supa();
        const { data, error } = await client
          .from('light_refresh_runs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(parseInt(req.query.limit || '10', 10));
        if (error) return send(res, 500, { ok:false, error: 'supabase_error', detail: error.message });
        return send(res, 200, { ok:true, rows: data||[] });
      }catch(e){
        return send(res, 500, { ok:false, error:'server_error', detail:String(e?.message||e) });
      }
    }

    return send(res, 400, { ok:false, error:'bad_request', detail:'unknown action' });
  }catch(e){
    return send(res, 500, { ok:false, error:'server_error', detail: String(e?.message||e) });
  }
}


