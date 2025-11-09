// /api/light-refresh.js
// Lightweight refresh: read URLs from repo CSV and re-ingest changed content (runs every 8 hours via Vercel Cron), then finalize mappings.
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

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

function handleQuotedField(ctx) {
  const { c, s, i, field } = ctx;
  if(c==='"' && s[i+1]==='"'){ 
    return { field: field + '"', skip: 1, inQ: true }; 
  }
  if(c==='"'){ 
    return { field, skip: 0, inQ: false }; 
  }
  return { field: field + c, skip: 0, inQ: true };
}

function handleUnquotedField(ctx) {
  const { c, field, row, rows } = ctx;
  if(c==='"') {
    return { field, row, rows, inQ: true };
  }
  if(c===',') {
    row.push(field);
    return { field: '', row, rows, inQ: false };
  }
  if(c==='\n') {
    row.push(field);
    rows.push(row);
    return { field: '', row: [], rows, inQ: false };
  }
  return { field: field + c, row, rows, inQ: false };
}

function processCSVRow(row, field, rows) {
  if(field || row.length) {
    row.push(field);
    rows.push(row);
  }
}

function parseCSV(csvText){
  const s = csvText.replace(/\r/g, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQ = false;
  
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const result = inQ 
      ? handleQuotedField({ c, s, i, field })
      : handleUnquotedField({ c, field, row, rows });
    field = result.field;
    i += result.skip || 0;
    row = result.row || row;
    inQ = result.inQ;
  }
  
  processCSVRow(row, field, rows);
  return rows;
}

async function checkSingleUrl(url, client) {
  try {
    const { data: existing } = await client
      .from('url_last_processed')
      .select('last_modified_header, last_processed_at')
      .eq('url', url)
      .single();
    
    const response = await fetch(url, { method: 'HEAD' });
    const lastModifiedHeader = response.headers.get('last-modified');
    
    if (!lastModifiedHeader) {
      return { url, changed: true };
    }
    
    const lastModified = new Date(lastModifiedHeader);
    const lastProcessed = existing ? new Date(existing.last_processed_at) : new Date(0);
    const changed = lastModified > lastProcessed;
    
    await client
      .from('url_last_processed')
      .upsert({
        url,
        last_modified_header: lastModified.toISOString(),
        last_processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    return { url, changed };
  } catch {
    return { url, changed: true };
  }
}

async function checkForChangedUrls(urls) {
  const changedUrls = [];
  const client = supabaseAdmin();
  const batchSize = 50;
  
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchPromises = batch.map(url => checkSingleUrl(url, client));
    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach(result => {
      if (result.changed) {
        changedUrls.push(result.url);
      }
    });
  }
  
  return changedUrls;
}

async function fetchCsvFromGitHub() {
  const rawUrl = 'https://raw.githubusercontent.com/alanranger/alan-chat-proxy/main/CSVSs%20from%20website/06%20-%20site%20urls%20-%20Sheet1.csv';
  const resp = await fetch(rawUrl);
  if (!resp.ok) throw new Error(`raw_fetch_http_${resp.status}`);
  return resp.text();
}

function extractUrlsFromCsv(content) {
  const rows = parseCSV(content);
  if(rows.length<2) return [];
  const headers = rows[0].map(h=>h.toLowerCase());
  const urlIdx = headers.findIndex(h=>h.includes('url'));
  if(urlIdx===-1) return [];
  const urls = rows.slice(1).map(r=>r[urlIdx]).filter(Boolean);
  return [...new Set(urls)];
}

async function readUrlsFromRepo(){
  let content = null;
  try {
    content = await fs.readFile(CSV_PATH, 'utf8');
  } catch {
    content = await fetchCsvFromGitHub();
  }
  return extractUrlsFromCsv(content);
}

function getBatchIndex() {
  // Calculate which batch we're on based on hour of day
  // Runs every 4 hours: 0-3 = batch 0, 4-7 = batch 1, 8-11 = batch 2, 12-15 = batch 0, etc.
  const hour = new Date().getUTCHours();
  return Math.floor((hour % 12) / 4); // Cycles through 0, 1, 2 every 12 hours
}

function buildUrlsToCheck(urls, cameraCourseUrl, batchIndex, totalBatches) {
  // Always include the camera course URL
  const urlsToCheck = [cameraCourseUrl];
  
  // Filter out the camera course URL from the main list
  const otherUrls = urls.filter(url => url !== cameraCourseUrl);
  
  // Calculate batch size (divide remaining URLs across batches)
  const batchSize = Math.ceil(otherUrls.length / totalBatches);
  const startIndex = batchIndex * batchSize;
  const endIndex = Math.min(startIndex + batchSize, otherUrls.length);
  
  // Add URLs for this batch
  for (let i = startIndex; i < endIndex; i++) {
    urlsToCheck.push(otherUrls[i]);
  }
  
  return urlsToCheck;
}

function parseIngestResponse(bodyText) {
  try {
    return JSON.parse(bodyText);
  } catch (parseErr) {
    console.warn('Failed to parse ingest response:', parseErr);
    return null;
  }
}

function createSuccessBatch(j, part, i) {
  const count = j.ingested || (j.results ? j.results.filter(r => r.ok).length : part.length);
  return {
    idx: i,
    count: part.length,
    ok: true,
    ingested: count,
    total: j.total || part.length,
    urls: part
  };
}

function createFailedBatch(batchData) {
  const { j, part, i, bodyText, status } = batchData;
  return {
    idx: i,
    count: part.length,
    ok: false,
    error: (j && (j.error || j.detail)) || bodyText || `HTTP ${status}`,
    urls: part
  };
}

function processIngestBatch(response) {
  const { r, j, part, i, bodyText } = response;
  if (r.ok && j && j.ok) {
    return createSuccessBatch(j, part, i);
  }
  return createFailedBatch({ j, part, i, bodyText, status: r.status });
}

async function processSingleBatch(part, i, config) {
  const { base, token, protectionBypass } = config;
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
  const j = parseIngestResponse(bodyText);
  return processIngestBatch({ r, j, part, i, bodyText });
}

async function processIngestBatches(config) {
  const { changedUrls, base, token, protectionBypass } = config;
  const chunks = [];
  let ingested = 0;
  let failed = 0;
  const batchSize = 20;
  
  for(let i = 0; i < changedUrls.length; i += batchSize) {
    const part = changedUrls.slice(i, i + batchSize);
    const batchResult = await processSingleBatch(part, i, { base, token, protectionBypass });
    
    if (batchResult.ok) {
      ingested += batchResult.ingested;
    } else {
      failed += batchResult.count;
    }
    chunks.push(batchResult);
  }
  
  return { chunks, ingested, failed };
}

async function finalizeMappings(config) {
  const { base, token, protectionBypass } = config;
  try {
    const finalizeResp = await fetch(`${base}/api/tools?action=finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-vercel-protection-bypass': protectionBypass
      }
    });
    if (!finalizeResp.ok) {
      const errorText = await finalizeResp.text().catch(() => '');
      console.warn('Finalize failed:', finalizeResp.status, errorText);
    }
  } catch (finalizeErr) {
    console.warn('Finalize error:', finalizeErr.message);
  }
}

function getConfig() {
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:3000`;
  const token = process.env.INGEST_TOKEN || '';
  const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.VERCEL_PROTECTION_BYPASS || process.env.PROTECTION_BYPASS_TOKEN || '';
  return { base, token, protectionBypass };
}

async function processIngestion(changedUrls, config) {
  const batchResults = await processIngestBatches({ ...config, changedUrls });
  await finalizeMappings(config);
  return batchResults;
}

function logRunResult(data) {
  try {
    const client = supabaseAdmin();
    return client.from('light_refresh_runs').insert([data]);
  } catch {
    return Promise.resolve();
  }
}

async function executeRunLogic(forceBatchIndex = null) {
  const urls = await readUrlsFromRepo();
  const cameraCourseUrl = 'https://www.alanranger.com/photography-services-near-me/beginners-photography-course';
  
  // Use rotating batch system: 3 batches, runs every 4 hours
  const totalBatches = 3;
  const batchIndex = forceBatchIndex !== null ? forceBatchIndex : getBatchIndex();
  const urlsToCheck = buildUrlsToCheck(urls, cameraCourseUrl, batchIndex, totalBatches);
  
  const changedUrls = await checkForChangedUrls(urlsToCheck);
  const config = getConfig();

  if (config.protectionBypass && config.token && changedUrls.length > 0) {
    return await processIngestion(changedUrls, config);
  }
  return {
    chunks: [{
      note: `Batch ${batchIndex + 1}/${totalBatches}: Bypass token: ${config.protectionBypass ? 'present' : 'missing'}, Ingest token: ${config.token ? 'present' : 'missing'}, URLs checked: ${urlsToCheck.length}, Changed URLs: ${changedUrls.length}`
    }],
    ingested: 0,
    failed: 0,
    urls: urls.length,
    urlsChecked: urlsToCheck.length,
    batchIndex: batchIndex,
    totalBatches: totalBatches,
    changedUrls: changedUrls.length
  };
}

function buildResponse(res, result, timestamps) {
  return send(res, 200, {
    ok: true,
    started_at: timestamps.startedAt,
    finished_at: timestamps.finishedAt,
    urls: result.urls,
    urlsChecked: result.urlsChecked || 0,
    batchIndex: result.batchIndex,
    totalBatches: result.totalBatches,
    ingested: result.ingested,
    failed: result.failed,
    batches: result.chunks,
    error: result.error,
    mode: getConfig().protectionBypass && getConfig().token ? 'ingest' : 'log-only'
  });
}

async function handleRunAction(req, res) {
  const startedAt = new Date().toISOString();
  let result = { chunks: [], ingested: 0, failed: 0, urls: 0, changedUrls: 0, error: null };

  try {
    // Allow forcing a specific batch via query parameter (for testing)
    const forceBatch = req.query.batch !== undefined ? parseInt(req.query.batch, 10) : null;
    const runResult = await executeRunLogic(forceBatch);
    result = { ...runResult, error: null };
  } catch (e) {
    result.error = String(e?.message || e);
    result.chunks.push({ error: result.error });
  }

  const finishedAt = new Date().toISOString();
  await logRunResult({
    started_at: startedAt,
    finished_at: finishedAt,
    urls_total: result.urls,
    urls_checked: result.urlsChecked || 0,
    batch_index: result.batchIndex,
    total_batches: result.totalBatches,
    urls_changed: result.changedUrls,
    ingested_count: result.ingested,
    failed_count: result.failed,
    batches_json: result.chunks
  });

  return buildResponse(res, result, { startedAt, finishedAt });
}

async function handleUrlsAction(req, res) {
  const urls = await readUrlsFromRepo();
  return send(res, 200, { ok: true, count: urls.length, sample: urls.slice(0, 10) });
}

async function handleStatusAction(req, res) {
  try {
    const client = supabaseAdmin();
    const { data, error } = await client
      .from('light_refresh_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(parseInt(req.query.limit || '10', 10));
    if (error) return send(res, 500, { ok: false, error: 'supabase_error', detail: error.message });
    return send(res, 200, { ok: true, rows: data || [] });
  } catch (e) {
    return send(res, 500, { ok: false, error: 'server_error', detail: String(e?.message || e) });
  }
}

function routeAction(action) {
  const ACTION_HANDLERS = {
    urls: handleUrlsAction,
    run: handleRunAction,
    manual: handleRunAction,
    status: handleStatusAction
  };
  return ACTION_HANDLERS[action];
}

export default async function handler(req, res) {
  try {
    const action = String(req.query.action || '').toLowerCase();
    if (!action) return send(res, 400, { ok: false, error: 'bad_request', detail: 'missing action' });

    const handlerFn = routeAction(action);
    if (handlerFn) {
      return await handlerFn(req, res);
    }

    return send(res, 400, { ok: false, error: 'bad_request', detail: 'unknown action' });
  } catch (e) {
    return send(res, 500, { ok: false, error: 'server_error', detail: String(e?.message || e) });
  }
}
