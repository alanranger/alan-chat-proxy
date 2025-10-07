// /api/ingest.js
// Consolidated ingestion endpoint
// Handles both single URL ingestion and bulk NDJSON streaming
// Replaces: bulk-upload.js, ingest-embed-replace.js

export const config = { runtime: 'nodejs' };

import crypto from 'node:crypto';
import { htmlToText } from 'html-to-text';
import { createClient } from '@supabase/supabase-js';

const SELF_BASE = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:3000`;
const EXPECTED_TOKEN = process.env.INGEST_TOKEN || "";

/* ========== utils ========== */
const need = (k) => {
  const v = process.env[k];
  if (!v || !String(v).trim()) throw new Error(`missing_env:${k}`);
  return v;
};
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

const asString = (e) => {
  if (!e) return '(unknown)';
  if (typeof e === 'string') return e;
  if (e.message && typeof e.message === 'string') return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
};

const sendJSON = (res, status, obj) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (obj && 'detail' in obj) obj.detail = asString(obj.detail);
  res.status(status).send(JSON.stringify(obj));
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chunkText = (txt, size = 3500, overlap = 300) => {
  const out = [];
  for (let i = 0; i < txt.length; i += (size - overlap)) {
    out.push(txt.slice(i, Math.min(i + size, txt.length)).trim());
  }
  return out.filter(Boolean);
};

/* ========== multipart parsing ========== */
async function readRawBody(req) {
  const chunks = [];
  for await (const ch of req) chunks.push(ch);
  return Buffer.concat(chunks);
}

function parseMultipart(bodyBuf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  if (!m) throw new Error("Multipart boundary not found.");
  const boundary = m[1] || m[2];
  const parts = bodyBuf.toString("utf8").split(`--${boundary}`);
  const out = {};
  for (const part of parts) {
    const idx = part.indexOf("\r\n\r\n");
    if (idx === -1) continue;
    const header = part.slice(0, idx);
    let data = part.slice(idx + 4);
    if (data.endsWith("\r\n")) data = data.slice(0, -2);
    if (data.endsWith("--")) data = data.slice(0, -2);
    const nameMatch = /name="([^"]+)"/i.exec(header);
    const filenameMatch = /filename="([^"]+)"/i.exec(header);
    const name = nameMatch ? nameMatch[1] : undefined;
    if (!name) continue;
    out[name] = filenameMatch ? data : data.trim();
  }
  return out;
}

function parseCSV(csvText) {
  const s = csvText.replace(/\r/g, "");
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* ========== page fetch (HTML + plain text) ========== */
const PRIMARY_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SECONDARY_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchOnce(url, ua, referer) {
  return fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      ...(referer ? { 'Referer': referer } : {})
    }
  });
}

async function fetchPage(url) {
  // Pass referer to reduce chances of anti-bot responses and get correct JSON-LD
  let res = await fetchOnce(url, PRIMARY_UA, url);
  if (!res.ok) {
    res = await fetchOnce(url, SECONDARY_UA, url);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res;
}

/* ========== JSON-LD extraction ========== */
function extractJSONLD(html) {
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
  if (!jsonLdMatches) return null;
  
  const jsonLdObjects = [];
  for (const match of jsonLdMatches) {
    let jsonContent = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    // Harden: strip HTML comments, CDATA, and try to repair common issues
    jsonContent = jsonContent
      .replace(/<!--([\s\S]*?)-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '')
      .trim();

    const attempts = [];
    attempts.push(jsonContent);
    // If raw content isn't valid JSON, try to isolate the main object/array
    const firstBrace = jsonContent.indexOf('{');
    const firstBracket = jsonContent.indexOf('[');
    const start = (firstBracket !== -1 && (firstBracket < firstBrace || firstBrace === -1)) ? firstBracket : firstBrace;
    if (start !== -1) {
      const lastBrace = jsonContent.lastIndexOf('}');
      const lastBracket = jsonContent.lastIndexOf(']');
      const end = Math.max(lastBrace, lastBracket);
      if (end > start) {
        let sliced = jsonContent.slice(start, end + 1);
        // Remove trailing commas before } or ]
        sliced = sliced.replace(/,\s*([}\]])/g, '$1');
        attempts.push(sliced);
      }
    }

    let parsedOk = false;
    for (const candidate of attempts) {
      try {
        const parsed = JSON.parse(candidate);
        if (Array.isArray(parsed)) {
          jsonLdObjects.push(...parsed);
        } else {
          jsonLdObjects.push(parsed);
        }
        parsedOk = true;
        break;
      } catch (e) {
        // keep trying next strategy
      }
    }
    if (!parsedOk) {
      console.warn('Failed to parse JSON-LD block after repairs. First 80 chars:', jsonContent.slice(0, 80));
    }
  }
  
  return jsonLdObjects.length > 0 ? jsonLdObjects : null;
}

/* ========== single URL ingestion ========== */
async function ingestSingleUrl(url, supa) {
  let stage = 'fetch';
  try {
    const res = await fetchPage(url);
    const html = await res.text();
    
    stage = 'extract_text';
    const text = htmlToText(html, {
      wordwrap: false,
      selectors: [
        { selector: 'script', format: 'skip' },
        { selector: 'style', format: 'skip' },
        { selector: 'nav', format: 'skip' },
        { selector: 'footer', format: 'skip' },
        { selector: 'header', format: 'skip' }
      ]
    });
    
    stage = 'extract_jsonld';
    const jsonLd = extractJSONLD(html);
    
    stage = 'chunk_text';
    const chunks = chunkText(text);
    
    stage = 'store_chunks';
    const chunkInserts = chunks.map(chunk => ({
      url: url,
      title: null,
      chunk_text: chunk,
      embedding: null,
      chunk_hash: sha1(chunk),
      content: chunk,
      hash: sha1(url + chunk),
      tokens: Math.ceil(chunk.length / 4)
    }));
    
    // Delete existing chunks for this URL
    await supa.from('page_chunks').delete().eq('url', url);
    
    // Insert new chunks
    if (chunkInserts.length > 0) {
      const { error: chunkError } = await supa.from('page_chunks').insert(chunkInserts);
      if (chunkError) throw new Error(`Chunk insert failed: ${chunkError.message}`);
    }
    
    stage = 'store_entities';
    if (jsonLd) {
      const entities = jsonLd.map((item, idx) => ({
        url: url,
        kind: item['@type']?.toLowerCase() || 'unknown',
        title: item.name || item.headline || item.title || null,
        description: item.description || null,
        date_start: item.datePublished || item.startDate || null,
        date_end: item.endDate || null,
        location: item.location?.name || item.location?.address || null,
        price: item.offers?.price || null,
        price_currency: item.offers?.priceCurrency || null,
        availability: item.offers?.availability || null,
        sku: item.sku || null,
        provider: item.provider?.name || item.publisher?.name || 'Alan Ranger Photography',
        source_url: url,
        raw: item,
        entity_hash: sha1(url + JSON.stringify(item) + idx),
        last_seen: new Date().toISOString()
      }));
      
      // Delete existing entities for this URL
      await supa.from('page_entities').delete().eq('url', url);
      
      // Insert new entities
      if (entities.length > 0) {
        const { error: entityError } = await supa.from('page_entities').insert(entities);
        if (entityError) throw new Error(`Entity insert failed: ${entityError.message}`);
      }
    }
    
    return {
      url,
      chunks: chunkInserts.length,
      entities: jsonLd ? jsonLd.length : 0,
      jsonLdFound: !!jsonLd
    };
    
  } catch (err) {
    throw new Error(`${stage}: ${err.message}`);
  }
}

/* ========== bulk processing ========== */
async function processBulkUpload(req, res) {
  let stage = 'parse_multipart';
  try {
    const bodyBuf = await readRawBody(req);
    const parts = parseMultipart(bodyBuf, req.headers['content-type']);
    
    const token = parts.token;
    if (token !== EXPECTED_TOKEN) {
      return sendJSON(res, 401, { error: 'unauthorized' });
    }
    
    const csvData = parts.csv;
    if (!csvData) {
      return sendJSON(res, 400, { error: 'bad_request', detail: 'No CSV data provided' });
    }
    
    stage = 'parse_csv';
    const rows = parseCSV(csvData);
    if (rows.length < 2) {
      return sendJSON(res, 400, { error: 'bad_request', detail: 'CSV must have at least header + 1 row' });
    }
    
    const headers = rows[0].map(h => h.toLowerCase());
    const urlIdx = headers.findIndex(h => h.includes('url'));
    if (urlIdx === -1) {
      return sendJSON(res, 400, { error: 'bad_request', detail: 'CSV must have a URL column' });
    }
    
    stage = 'db_client';
    const supa = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));
    
    stage = 'process_urls';
    const results = [];
    const urls = rows.slice(1).map(row => row[urlIdx]).filter(Boolean);
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        const result = await ingestSingleUrl(url, supa);
        results.push({ url, success: true, ...result });
        
        // Rate limiting
        if (i < urls.length - 1) {
          await sleep(1000);
        }
      } catch (err) {
        results.push({ url, success: false, error: err.message });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const totalChunks = results.reduce((sum, r) => sum + (r.chunks || 0), 0);
    const totalEntities = results.reduce((sum, r) => sum + (r.entities || 0), 0);
    
    return sendJSON(res, 200, {
      ok: true,
      processed: urls.length,
      successful: successCount,
      failed: urls.length - successCount,
      total_chunks: totalChunks,
      total_entities: totalEntities,
      results: results
    });
    
  } catch (err) {
    return sendJSON(res, 500, { error: 'server_error', detail: asString(err), stage });
  }
}

/* ========== main handler ========== */
export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method_not_allowed' });
  
  // Check for bulk upload (multipart form data)
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    return processBulkUpload(req, res);
  }
  
  // Single URL ingestion
  let stage = 'auth';
  try {
    const token = req.headers['authorization']?.trim();
    if (token !== `Bearer ${need('INGEST_TOKEN')}`) {
      return sendJSON(res, 401, { error: 'unauthorized', stage });
    }
    
    stage = 'parse_body';
    const { url, csvUrls } = req.body || {};
    if (!url && !csvUrls) return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide "url" or "csvUrls"', stage });
    
    stage = 'db_client';
    const supa = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));
    
    // New mode: ingest multiple URLs from CSV files (array of URL strings)
    if (Array.isArray(csvUrls) && csvUrls.length) {
      stage = 'ingest_bulk_urls';
      const results = [];
      for (let i = 0; i < csvUrls.length; i++) {
        const u = csvUrls[i];
        try {
          const r = await ingestSingleUrl(u, supa);
          results.push({ url: u, ok: true, ...r });
          // small delay to be polite
          await sleep(500);
        } catch (e) {
          results.push({ url: u, ok: false, error: asString(e) });
        }
      }
      const ok = results.filter(r=>r.ok).length;
      return sendJSON(res, 200, { ok: true, ingested: ok, total: results.length, results });
    }
    
    stage = 'ingest_single';
    const result = await ingestSingleUrl(url, supa);
    return sendJSON(res, 200, { ok: true, ...result });
    
  } catch (err) {
    return sendJSON(res, 500, { error: 'server_error', detail: asString(err), stage });
  }
}
