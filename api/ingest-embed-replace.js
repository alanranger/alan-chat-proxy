// api/ingest-embed-replace.js
// Crawl → chunk → embed → upsert (replace per URL) with rock-solid JSON error responses.

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { htmlToText } from 'html-to-text';

export const config = { runtime: 'nodejs' };

// ───────────────────────────────────────────────────────────────────────────────
// ENV
// ───────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY ||
  process.env.OPENROUTER_APIKEY ||
  process.env.OPENROUTER_KEY ||
  '';

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY || '';

const INGEST_TOKEN = process.env.INGEST_TOKEN || '';

const EMBED_MODEL_OPENROUTER = 'openai/text-embedding-3-small'; // 1536 dims @ OpenRouter
const EMBED_MODEL_OPENAI = 'text-embedding-3-small';            // 1536 dims @ OpenAI

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────

function sendJSON(res, status, body) {
  try {
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
  } catch {}
  res.status(status).end(JSON.stringify(body));
}

const ok = (res, body) => sendJSON(res, 200, body);
const bad = (res, msg) => sendJSON(res, 400, { error: 'bad_request', detail: String(msg || 'Bad request') });
const boom = (res, msg) => sendJSON(res, 500, { error: 'server_error', detail: String(msg || 'Server error') });

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function chunkPlainText(text, maxChars = 2000, overlap = 200) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + maxChars, text.length);
    const slice = text.slice(i, end).trim();
    if (slice) out.push(slice);
    i = end - overlap;
    if (i < 0) i = 0;
  }
  return out;
}

async function embedTexts({ texts }) {
  const useOpenRouter = !!OPENROUTER_API_KEY;
  const provider = useOpenRouter ? 'openrouter' : (OPENAI_API_KEY ? 'openai' : null);

  if (!provider) {
    const e = new Error('no_embedding_provider_configured');
    e.code = 'no_embedding_provider_configured';
    throw e;
  }

  const url = useOpenRouter
    ? 'https://openrouter.ai/api/v1/embeddings'
    : 'https://api.openai.com/v1/embeddings';

  const model = useOpenRouter ? EMBED_MODEL_OPENROUTER : EMBED_MODEL_OPENAI;
  const key = useOpenRouter ? OPENROUTER_API_KEY : OPENAI_API_KEY;

  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${key}`,
  };
  if (useOpenRouter) {
    headers['HTTP-Referer'] = 'https://alan-chat-proxy.vercel.app';
    headers['X-Title'] = 'AlanRanger Ingest';
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input: texts, model }),
  });

  const ct = String(resp.headers.get('content-type') || '').toLowerCase();
  const isJson = ct.includes('application/json');

  if (!isJson) {
    const snippet = (await resp.text()).slice(0, 400);
    const e = new Error('embedding_non_json');
    e.code = 'embedding_non_json';
    e.status = resp.status;
    e.snippet = snippet;
    throw e;
  }

  const data = await resp.json();
  if (!resp.ok) {
    // Provider returned JSON error — make sure we turn it into a string.
    const msg = typeof data?.error === 'string'
      ? data.error
      : (typeof data?.error?.message === 'string' ? data.error.message : JSON.stringify(data).slice(0, 400));
    const e = new Error(`embedding_error: ${msg}`);
    e.code = 'embedding_error';
    e.status = resp.status;
    throw e;
  }

  if (!Array.isArray(data?.data)) {
    const e = new Error('embedding_shape_unexpected');
    e.code = 'embedding_shape_unexpected';
    e.payload = data;
    throw e;
  }
  return data.data.map((d) => d.embedding);
}

async function upsertChunks({ supa, rows, replaceUrl }) {
  const url = rows[0]?.url;
  if (!url) return;
  if (replaceUrl) {
    const { error: delErr } = await supa.from('page_chunks').delete().eq('url', url);
    if (delErr) throw delErr;
  }
  const { error } = await supa.from('page_chunks').upsert(rows, { onConflict: 'chunk_hash' });
  if (error) throw error;
}

// Read raw request body safely
async function readRawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return '';
  return Buffer.concat(chunks).toString('utf8');
}

// Parse url/title/replace from query OR body (json, form, or plain text)
async function getUrlTitleReplace(req) {
  // query
  try {
    const u = new URL(req.url, 'http://local');
    const qUrl = u.searchParams.get('url');
    const qTitle = u.searchParams.get('title');
    const qReplace = u.searchParams.get('replace');
    if (qUrl) return { url: qUrl, title: qTitle || null, replace: qReplace === 'true' };
  } catch {}

  // body
  const ctype = (req.headers['content-type'] || '').toLowerCase();
  const raw = await readRawBody(req);
  if (!raw) return { url: null, title: null, replace: false };

  if (ctype.includes('application/json')) {
    try {
      const obj = JSON.parse(raw);
      return {
        url: obj?.url ?? null,
        title: obj?.title ?? null,
        replace: !!obj?.replace,
      };
    } catch {
      return { url: null, title: null, replace: false };
    }
  }

  if (ctype.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(raw);
    const u = params.get('url');
    const t = params.get('title');
    const r = params.get('replace');
    return { url: u, title: t || null, replace: r === 'true' };
  }

  const maybe = raw.trim();
  if (/^https?:\/\//i.test(maybe)) {
    return { url: maybe, title: null, replace: false };
  }

  return { url: null, title: null, replace: false };
}

// ───────────────────────────────────────────────────────────────────────────────
// Handler
// ───────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return bad(res, 'Use POST');

    // Bearer token
    const auth = String(req.headers.authorization || '');
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!INGEST_TOKEN || bearer !== INGEST_TOKEN) {
      return bad(res, 'Invalid or missing ingest token');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return boom(res, 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    }

    const { url, title, replace } = await getUrlTitleReplace(req);
    if (!url) return bad(res, 'Provide "url"');

    // Fetch page
    let html;
    try {
      const page = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (IngestBot)' } });
      if (!page.ok) return boom(res, `Fetch failed (${page.status}) for ${url}`);
      html = await page.text();
    } catch (e) {
      return boom(res, `Fetch exception for ${url}: ${e?.message || String(e)}`);
    }

    const text = htmlToText(html, {
      wordwrap: false,
      hideLinkHrefIfSameAsText: true,
      selectors: [
        { selector: 'script', format: 'skip' },
        { selector: 'style', format: 'skip' },
        { selector: 'noscript', format: 'skip' },
      ],
    }).trim();

    if (!text) return boom(res, 'No text extracted');

    // Chunk
    const pieces = chunkPlainText(text, 2000, 200);
    if (!pieces.length) return boom(res, 'No chunks produced');

    // Embed (strongly normalized errors)
    let vectors;
    try {
      vectors = await embedTexts({ texts: pieces });
    } catch (e) {
      if (e?.code === 'no_embedding_provider_configured') {
        return boom(res, 'no_embedding_provider_configured (set OPENROUTER_API_KEY or OPENAI_API_KEY)');
      }
      if (e?.code === 'embedding_non_json') {
        const s = (e?.snippet || '').replace(/\s+/g, ' ').slice(0, 200);
        return boom(res, `embedding_non_json status=${e?.status ?? '?'} snippet="${s}"`);
      }
      const msg = e?.message || String(e);
      return boom(res, msg);
    }

    const now = new Date().toISOString();
    const rows = pieces.map((content, i) => ({
      url,
      title,
      content,
      chunk_text: content,
      embedding: vectors[i],
      tokens: Math.ceil(content.length / 4),
      chunk_hash: sha256(`${url}::${i}::${sha256(content)}`),
      created_at: now,
    }));

    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    try {
      await upsertChunks({ supa, rows, replaceUrl: replace });
    } catch (e) {
      return boom(res, `supabase_upsert_error: ${e?.message || String(e)}`);
    }

    return ok(res, {
      ok: true,
      url,
      chunks: rows.length,
      provider: OPENROUTER_API_KEY ? 'openrouter' : (OPENAI_API_KEY ? 'openai' : 'none'),
      model: OPENROUTER_API_KEY ? EMBED_MODEL_OPENROUTER : EMBED_MODEL_OPENAI,
    });
  } catch (err) {
    // Final safety net — always string detail
    return boom(res, err?.message ?? String(err));
  }
}
