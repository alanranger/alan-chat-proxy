// /api/light-refresh.js
// Lightweight hourly refresh: read URLs from repo CSV and re-ingest changed content (simple mode: re-ingest all), then finalize mappings.
// GET /api/light-refresh?action=run
// GET /api/light-refresh?action=urls

export const config = { runtime: 'nodejs' };

import fs from 'node:fs/promises';

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

async function readUrlsFromRepo(){
  const buf = await fs.readFile(CSV_PATH, 'utf8');
  const rows = parseCSV(buf);
  if(rows.length<2) return [];
  const headers = rows[0].map(h=>h.toLowerCase());
  const urlIdx = headers.findIndex(h=>h.includes('url'));
  if(urlIdx===-1) return [];
  const urls = rows.slice(1).map(r=>r[urlIdx]).filter(Boolean);
  return [...new Set(urls)];
}

export default async function handler(req, res){
  try{
    const action = String(req.query.action||'').toLowerCase();
    if(!action) return send(res, 400, { ok:false, error:'bad_request', detail:'missing action' });

    if(action==='urls'){
      const urls = await readUrlsFromRepo();
      return send(res, 200, { ok:true, count:urls.length, sample:urls.slice(0,10) });
    }

    if(action==='run'){
      const urls = await readUrlsFromRepo();
      const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:3000`;
      const token = process.env.INGEST_TOKEN || '';
      const chunks = [];
      const batchSize = 40; // safe for function time
      let ingested = 0;
      for(let i=0;i<urls.length;i+=batchSize){
        const part = urls.slice(i, i+batchSize);
        const r = await fetch(`${base}/api/ingest`, {
          method:'POST',
          headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
          body: JSON.stringify({ csvUrls: part })
        });
        const j = await r.json().catch(()=>({}));
        if (r.ok && j && j.ok){ ingested += (j.ingested || part.length); chunks.push({ idx:i, count: part.length, ok:true }); }
        else { chunks.push({ idx:i, count: part.length, ok:false, error: j?.error || await r.text() }); }
      }
      // finalize
      try{
        await fetch(`${base}/api/tools?action=finalize`, { method:'POST', headers:{ Authorization:`Bearer ${token}` } });
      }catch{}
      return send(res, 200, { ok:true, urls: urls.length, ingested, batches: chunks });
    }

    return send(res, 400, { ok:false, error:'bad_request', detail:'unknown action' });
  }catch(e){
    return send(res, 500, { ok:false, error:'server_error', detail: String(e?.message||e) });
  }
}


