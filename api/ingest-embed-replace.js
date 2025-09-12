// /api/ingest-embed-replace.js
// Serverless API: fetch a page, extract text, embed chunks, replace rows in Supabase.
// Runtime: Node.js (not Edge). Returns JSON **only** with clear errors.

export const config = { runtime: 'nodejs' };

const INGEST_TOKEN = process.env.INGEST_TOKEN || 'b6c30c9e6f44cce9e1a4f3f2d3a5c676';

// Supabase (REST) – service role key is required for delete/insert
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Embeddings via OpenRouter (OpenAI-compatible)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE    = process.env.OPENROUTER_BASE || 'https://openrouter.ai/api/v1';
const EMBEDDING_MODEL    = process.env.EMBEDDING_MODEL || 'text-embedding-3-large';

// ---------- small helpers ----------
const encoder = new TextEncoder();

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function isProbablyHtml(str = '') {
  const s = str.trim().toLowerCase();
  return s.startsWith('<!doctype html') || s.startsWith('<html');
}

function stripHtml(html) {
  // remove scripts/styles
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, '')
              .replace(/<style[\s\S]*?<\/style>/gi, '');
  // remove tags
  s = s.replace(/<\/?[a-z][^>]*>/gi, ' ');
  // decode entities (simple)
  s = s.replace(/&nbsp;/gi, ' ')
       .replace(/&amp;/gi, '&')
       .replace(/&lt;/gi, '<')
       .replace(/&gt;/gi, '>')
       .replace(/&quot;/gi, '"')
       .replace(/&#39;/gi, "'");
  // normalize whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function chunkText(text, maxLen = 1200, overlap = 200) {
  const chunks = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const end = Math.min(i + maxLen, n);
    const part = text.slice(i, end).trim();
    if (part) chunks.push(part);
    if (end === n) break;
    i = end - overlap; // move with overlap
    if (i < 0) i = 0;
  }
  return chunks;
}

async function httpJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  const text  = await res.text();

  if (!ctype.includes('application/json')) {
    const snippet = text.slice(0, 180).replace(/\s+/g, ' ');
    throw new Error(`Upstream non-JSON (status ${res.status}) — ${snippet}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    const snippet = text.slice(0, 180).replace(/\s+/g, ' ');
    throw new Error(`JSON parse failed (status ${res.status}) — ${snippet}`);
  }

  if (!res.ok) {
    const detail = data?.detail || data?.error || `HTTP ${res.status}`;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return data;
}

// ---------- embeddings ----------
async function embedTexts(texts) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('Missing OPENROUTER_API_KEY');
  }
  const url = `${OPENROUTER_BASE.replace(/\/+$/, '')}/embeddings`;
  const body = JSON.stringify({ model: EMBEDDING_MODEL, input: texts });

  const data = await httpJson(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body
  });

  if (!data?.data || !Array.isArray(data.data)) {
    throw new Error(`Embeddings response missing data array: ${JSON.stringify(data).slice(0,160)}…`);
  }
  return data.data.map(d => d.embedding);
}

// ---------- supabase (REST) ----------
async function supabaseDeleteByUrl(url) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  const rest = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/page_chunks?url=eq.${encodeURIComponent(url)}`;
  const res = await fetch(rest, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Accept': 'application/json',
      'Prefer': 'return=representation'
    }
  });
  // 204 No Content is fine, 200 ok as well
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`Supabase delete failed (${res.status}) — ${text.slice(0,180)}`);
  }
}

async function supabaseInsert(rows) {
  const rest = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/page_chunks`;
  const res = await fetch(rest, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(rows)
  });
  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  const txt = await res.text();
  if (!ctype.includes('application/json')) {
    throw new Error(`Supabase insert non-JSON (${res.status}) — ${txt.slice(0,180)}`);
  }
  const data = JSON.parse(txt);
  if (!res.ok) {
    throw new Error(`Supabase insert failed (${res.status}) — ${JSON.stringify(data).slice(0,180)}`);
  }
  return data;
}

// ---------- handler ----------
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return json(res, 405, { error: 'method_not_allowed' });
    }

    // auth
    const auth = req.headers['authorization'] || '';
    const got = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : '';
    if (!got || got !== INGEST_TOKEN) {
      return json(res, 401, { error: 'unauthorized' });
    }

    // body
    let body = {};
    try { body = req.body ?? {}; } catch { body = {}; }
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const url = (body.url || '').trim();
    const title = (body.title || '').trim();
    if (!url) {
      return json(res, 400, { error: 'validate_input', detail: 'Missing "url"' });
    }

    // fetch page
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (IngestBot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const pageText = await pageRes.text();
    if (!pageRes.ok) {
      return json(res, pageRes.status, {
        error: 'fetch_failed',
        detail: `HTTP ${pageRes.status} while fetching ${url}`
      });
    }
    if (isProbablyHtml(pageText) === false && pageText.length < 64) {
      return json(res, 400, { error: 'fetch_failed', detail: 'Fetched content appears empty' });
    }

    // extract & chunk
    const text = stripHtml(pageText);
    if (!text) {
      return json(res, 400, { error: 'extract_failed', detail: 'No text after stripping HTML' });
    }
    const chunks = chunkText(text, 1200, 200);
    if (!chunks.length) {
      return json(res, 400, { error: 'chunking_failed', detail: 'No chunks produced' });
    }

    // embed
    const embeddings = await embedTexts(chunks); // array of float arrays
    if (embeddings.length !== chunks.length) {
      return json(res, 500, { error: 'embedding_size_mismatch', detail: { chunks: chunks.length, embeddings: embeddings.length } });
    }

    // replace in supabase (delete by URL then insert)
    await supabaseDeleteByUrl(url);

    const now = new Date().toISOString();
    const rows = chunks.map((chunk_text, i) => ({
      url,
      title: title || null,
      chunk_text,
      embedding: embeddings[i],
      // If you have created a stored md5 column/trigger, you can omit chunk_hash here.
      // Otherwise, include a simple hash to support your unique(url, chunk_hash) index.
      chunk_hash: toHex(sha256(chunk_text)),
      created_at: now
    }));

    const inserted = await supabaseInsert(rows);

    return json(res, 200, {
      ok: true,
      url,
      chunks: rows.length,
      inserted: inserted.length || rows.length,
      model: EMBEDDING_MODEL
    });

  } catch (err) {
    return json(res, 500, { error: 'server_error', detail: String(err?.message || err || 'unknown') });
  }
}

// simple SHA-256 -> hex (no external deps)
function sha256(str) {
  // Node crypto subtle not guaranteed in all runtimes; small manual approach with Web Crypto if available
  if (globalThis.crypto?.subtle) {
    // not used here, keep compatibility without async
  }
  // fallback: tiny js implementation is overkill; use built-in crypto in Node 18 via createHash
  try {
    const { createHash } = require('crypto');
    return createHash('sha256').update(str).digest();
  } catch {
    // last resort: return text bytes
    return encoder.encode(str);
  }
}
function toHex(buf) {
  if (typeof buf === 'string') return buf;
  let hex = '';
  for (let i = 0; i < buf.length; i++) {
    const h = buf[i].toString(16).padStart(2, '0');
    hex += h;
  }
  return hex;
}
