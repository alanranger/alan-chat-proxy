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

async function fetchOnce(url, ua, referer, method = 'GET', lang, cookie) {
  return fetch(url, {
    method,
    redirect: 'follow',
    headers: {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': lang || 'en-GB,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Origin': 'https://www.alanranger.com',
      // Browser-like fetch hints
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not=A?Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      ...(cookie ? { 'Cookie': cookie } : {}),
      ...(referer ? { 'Referer': referer } : {})
    }
  });
}

async function fetchPage(url) {
  // Preflight HEAD with retry/backoff; then GET with UA fallbacks
  const maxAttempts = 3;
  const baseDelay = 400; // ms
  let lastError = null;
  const attempts = [];
  let warmedCookie = '';

  // Cookie warm-up: hit homepage to receive Set-Cookie and reuse
  try {
    const base = 'https://www.alanranger.com';
    const warm = await fetchOnce(base, PRIMARY_UA, base, 'GET');
    const setCookie = warm.headers.get('set-cookie') || '';
    if (setCookie) warmedCookie = setCookie.split('\n').map(s => s.split(';')[0]).join('; ');
    attempts.push({ method: 'GET', ua: 'primary', url: base, warmup: true, status: warm.status, hasCookie: !!warmedCookie });
  } catch (e) {
    attempts.push({ method: 'GET', ua: 'primary', url: 'https://www.alanranger.com', warmup: true, error: e.message });
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Try with original URL and with trailing slash as fallback
      // Prefer blog listing referer for blog articles
      const isBlogArticle = /\/blog-on-photography\//.test(url);
      const isWorkshopEvent = /\/photographic-workshops-near-me(\/|$)/.test(url);
      const isCourseEvent = /\/beginners-photography-lessons(\/|$)/.test(url);
      const referer = isBlogArticle ? 'https://www.alanranger.com/blog-on-photography' : url;
      const eventReferer = isWorkshopEvent ? 'https://www.alanranger.com/photographic-workshops-near-me'
                          : isCourseEvent ? 'https://www.alanranger.com/beginners-photography-lessons'
                          : referer;

      // For events, skip HEAD (Squarespace sometimes 404s HEAD). Try GET primary first
      if (isWorkshopEvent || isCourseEvent) {
        let res = await fetchOnce(url, PRIMARY_UA, eventReferer, 'GET', undefined, warmedCookie);
        attempts.push({ method: 'GET', ua: 'primary', referer: eventReferer, status: res.status });
        if (!res.ok && (res.status === 404 || res.status === 429 || (res.status >= 500 && res.status <= 599))) {
          // Retry with secondary UA
          res = await fetchOnce(url, SECONDARY_UA, eventReferer, 'GET', undefined, warmedCookie);
          attempts.push({ method: 'GET', ua: 'secondary', referer: eventReferer, status: res.status });
          // If still failing 404, try with/without trailing slash and homepage referer
          if (!res.ok && res.status === 404) {
            const altUrl = url.endsWith('/') ? url.slice(0,-1) : (url + '/');
            const altReferer = url.split('/').slice(0,3).join('/');
            res = await fetchOnce(altUrl, SECONDARY_UA, altReferer, 'GET', undefined, warmedCookie);
            attempts.push({ method: 'GET', ua: 'secondary', referer: altReferer, urlVariant: 'slash_toggle', status: res.status });
            // Final language-tuned attempt if still 404
            if (!res.ok && res.status === 404) {
              await sleep(150);
              const lang = 'en-GB,en;q=0.8,en-US;q=0.7';
              res = await fetchOnce(url, SECONDARY_UA, eventReferer, 'GET', lang, warmedCookie);
              attempts.push({ method: 'GET', ua: 'secondary', referer: eventReferer, lang, status: res.status, note: 'final_lang_retry' });
            }
          }
        }
        if (res.ok) return res;
        lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
      } else {
        const head = await fetchOnce(url, PRIMARY_UA, referer, 'HEAD', undefined, warmedCookie);
        attempts.push({ method: 'HEAD', ua: 'primary', referer, status: head.status });
        if (head.ok || head.status === 405 /* method not allowed */) {
          // Proceed to GET with primary UA
          let res = await fetchOnce(url, PRIMARY_UA, referer, 'GET', undefined, warmedCookie);
          attempts.push({ method: 'GET', ua: 'primary', referer, status: res.status });
          if (!res.ok && (res.status === 404 || res.status === 429 || (res.status >= 500 && res.status <= 599))) {
            // Retry with secondary UA
            res = await fetchOnce(url, SECONDARY_UA, referer, 'GET', undefined, warmedCookie);
            attempts.push({ method: 'GET', ua: 'secondary', referer, status: res.status });
            // If still failing 404, try with/without trailing slash and homepage referer
            if (!res.ok && res.status === 404) {
              const altUrl = url.endsWith('/') ? url.slice(0,-1) : (url + '/');
              const altReferer = url.split('/').slice(0,3).join('/');
              res = await fetchOnce(altUrl, SECONDARY_UA, altReferer, 'GET', undefined, warmedCookie);
              attempts.push({ method: 'GET', ua: 'secondary', referer: altReferer, urlVariant: 'slash_toggle', status: res.status });
              // Final language-tuned attempt if still 404
              if (!res.ok && res.status === 404) {
                await sleep(150);
                const lang = 'en-GB,en;q=0.8,en-US;q=0.7';
                res = await fetchOnce(url, SECONDARY_UA, referer, 'GET', lang, warmedCookie);
                attempts.push({ method: 'GET', ua: 'secondary', referer, lang, status: res.status, note: 'final_lang_retry' });
              }
            }
          }
          if (res.ok) return res;
          lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
        } else {
          lastError = new Error(`HEAD ${head.status}`);
        }
      }
    } catch (e) {
      lastError = e;
    }
    // Backoff with jitter
    const jitter = Math.floor(Math.random() * 250);
    await sleep(baseDelay * attempt + jitter);
  }
  const err = lastError || new Error('fetch_failed');
  err.attempts = attempts;
  throw err;
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

// Normalize JSON-LD @type to allowed page_entities.kind values
function normalizeKind(item, url) {
  const rawType = (item && (item['@type'] || item['@type[]'])) || '';
  const t = Array.isArray(rawType) ? String(rawType[0] || '').toLowerCase() : String(rawType || '').toLowerCase();
  const u = String(url || '').toLowerCase();
  // Map common schema.org types to our compact set
  if (t.includes('event') || t === 'course' || t === 'educationevent') return 'event';
  if (t === 'product' || t === 'offer' || t === 'aggregateoffer') return 'product';
  if (t === 'article' || t === 'blogposting' || t === 'newsarticle' || t === 'creativework') return 'article';
  if (t === 'service' || t === 'organization' || t === 'localbusiness' || t === 'person') return 'service';
  if (t === 'website' || t === 'webpage') return 'article';
  // Fallback by URL context
  if (u.includes('/photographic-workshops-near-me') || u.includes('/photo-workshops-uk') || u.includes('/beginners-photography-lessons')) return 'event';
  if (u.includes('/blog') || u.includes('/blog-on-photography') || u.includes('/news')) return 'article';
  if (u.includes('/photography-services-near-me') || u.includes('/service') || u.includes('/mentoring')) return 'service';
  // Safe default to 'article' to satisfy DB constraint
  return 'article';
}

/* ========== single URL ingestion ========== */
async function ingestSingleUrl(url, supa, options = {}) {
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
    
    if (!options.dryRun) {
      // Delete existing chunks for this URL
      await supa.from('page_chunks').delete().eq('url', url);
      // Insert new chunks
      if (chunkInserts.length > 0) {
        const { error: chunkError } = await supa.from('page_chunks').insert(chunkInserts);
        if (chunkError) throw new Error(`Chunk insert failed: ${chunkError.message}`);
      }
    }
    
    stage = 'store_entities';
    if (jsonLd) {
      const entities = jsonLd.map((item, idx) => ({
        url: url,
        kind: normalizeKind(item, url),
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
      
      if (!options.dryRun) {
        // Merge strategy: always update existing entity for same (url, kind)
        // Rationale: event pages get rescheduled with same URL; dates/times must refresh
        for (const e of entities) {
          // Fetch by natural key (url + kind); assume one primary entity per page
          let existing = null;
          try {
            const resSel = await supa
              .from('page_entities')
              .select('*')
              .eq('url', e.url)
              .eq('kind', e.kind)
              .limit(1)
              .maybeSingle();
            existing = resSel?.data || null;
          } catch {}

          if (existing) {
            const merged = { ...existing };
            // Fields that should refresh if new data present
            const overwriteFields = e.kind === 'event'
              ? ['title','description','date_start','date_end','location','price','price_currency','availability','sku','provider','raw']
              : ['title','description','location','price','price_currency','availability','sku','provider','raw'];
            for (const k of overwriteFields) {
              if (e[k] !== undefined && e[k] !== null && e[k] !== '') merged[k] = e[k];
            }
            merged.last_seen = e.last_seen;
            const { error: updErr } = await supa.from('page_entities').update(merged).eq('id', existing.id);
            if (updErr) throw new Error(`Entity update failed: ${updErr.message}`);
          } else {
            // Try insert; if unique constraint blocks, fallback to update existing natural key
            const { error: insErr } = await supa.from('page_entities').insert([e]);
            if (insErr) {
              // Fallback: update by (url, kind)
              const { error: updErr } = await supa
                .from('page_entities')
                .update({
                  title: e.title,
                  description: e.description,
                  date_start: e.date_start,
                  date_end: e.date_end,
                  location: e.location,
                  price: e.price,
                  price_currency: e.price_currency,
                  availability: e.availability,
                  sku: e.sku,
                  provider: e.provider,
                  raw: e.raw,
                  last_seen: e.last_seen
                })
                .eq('url', e.url)
                .eq('kind', e.kind);
              if (updErr) throw new Error(`Entity upsert failed: ${updErr.message}`);
            }
          }
        }
      }
    }
    
    return {
      url,
      chunks: chunkInserts.length,
      entities: jsonLd ? jsonLd.length : 0,
      jsonLdFound: !!jsonLd
    };
    
  } catch (err) {
    const diag = (err && err.attempts) ? ` attempts=${JSON.stringify(err.attempts)}` : '';
    throw new Error(`${stage}: ${err.message}${diag}`);
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
    const { url, csvUrls, dryRun } = req.body || {};
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
          const r = await ingestSingleUrl(u, supa, { dryRun: !!dryRun });
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
    const result = await ingestSingleUrl(url, supa, { dryRun: !!dryRun });
    return sendJSON(res, 200, { ok: true, ...result });
    
  } catch (err) {
    return sendJSON(res, 500, { error: 'server_error', detail: asString(err), stage });
  }
}
