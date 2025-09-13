// api/ingest-embed-replace.js
// Crawl → chunk → embed → upsert (replace-per-URL)
// Accepts URL via JSON, x-www-form-urlencoded, querystring, or plain text body
// Runtime: Node so env vars work normally on Vercel

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

const EMBED_MODEL_OPENROUTER = 'openai/text-embedding-3-small'; // 1536 dims on OR
const EMBED_MODEL_OPENAI = 'text-embedding-3-small';            // 1536 dims on OA

// ───────────────────────────────────────────────────────────────────────────────
// Utils
// ───────────────────────────────────────────────────────────────────────────────

function json(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  return res.status(status).json(body);
}
const ok = (res, body) => json(res, 200, body);
const bad = (res, msg) => json(res, 400, { error: 'bad_request', detail: msg });
const boom = (res, msg) => json(res, 500, { error: 'server_error', detail: msg });

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

  const ct = (resp.headers.get('content-type') || '').toLowerCase();
  const isJson = ct.includes('application/json');

  if (!isJson) {
    const snippet = (await resp.text()).slice(0, 500);
    const e = new Error('embedding_non_json');
    e.code = 'embedding_non_json';
    e.status = resp.status;
    e.snippet = snippet;
    throw e;
  }

  const data = await resp.json();
  if (!resp.ok) {
    const e = new Error('embedding_error');
    e.code = 'embedding_error';
    e.status = resp.status;
    e.response = data;
    throw e;
  }

  if (!Array.isArray(data?.data)) {
    const e = new Error('embedding_shape_unexpected');
    e.code = 'embedding_shape_unexpected';
    e.response = data;
    throw e;
  }
  return data.data.map((d) => d.embedding);
}

async function upsertChunks({ supa, rows, replaceUrl }) {
  const url = rows[0]?.url;
  if (!url) return;
  if (replaceUrl) {
    await supa.from('page_chunks').delete().eq('url', url);
  }
  const { error } = await supa.from('page_chunks').upsert(rows, {
    onConflict: 'chunk_hash',
  });
  if (error) throw error;
}

// Read full raw request body (Buffer → string)
async function readRawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return '';
  return Buffer.concat(chunks).toString('utf8');
}

// Try to parse URL from anything: query, JSON, form, or plain text
async function getUrlTitleReplace(req) {
  // 1) querystring (always available)
  try {
    // Vercel passes path+query in req.url
    const u = new URL(req.url, 'http://local');
    const qUrl = u.searchParams.get('url');
    const qTitle = u.searchParams.get('title');
    const qReplace = u.searchParams.get('replace');
    if (qUrl) return { url: qUrl, title: qTitle || null, replace: qReplace === 'true' };
  } catch {}

  // 2) body, depending on content-type
  const ctype = (req.headers['content-type'] || '').toLowerCase();
  const raw = await readRawBody(req);
  if (!raw) return { url: null, title: null, replace: false };

  // JSON
  if (ctype.includes('application/json')) {
    try {
      const obj = JSON.parse(raw);
      return {
        url: obj?.url ?? null,
        title: obj?.title ?? null,
        replace: !!obj?.replace,
      };
    } catch {}
  }

  // x-www-form-urlencoded
  if (ctype.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(raw);
    const u = params.get('url');
    const t = params.get('title');
    const r = params.get('replace');
    return { url: u, title: t || null, replace: r === 'true' };
  }

  // Fallback: if the body is just a URL
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

    // Bearer token check
    const auth = req.headers.authorization || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!INGEST_TOKEN || bearer !== INGEST_TOKEN) {
      return bad(res, 'Invalid or missing ingest token');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return boom(res, 'Supabase env (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) not set');
    }

    const { url, title, replace } = await getUrlTitleReplace(req);
    if (!url) return bad(res, 'Provide "url"');

    // Fetch page
    const page = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (IngestBot)' },
    });
    if (!page.ok) return boom(res, `Fetch failed (${page.status}) for ${url}`);
    const html = await page.text();

    // Extract text
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

    // Embed
    let vectors;
    try {
      vectors = await embedTexts({ texts: pieces });
    } catch (e) {
      if (e?.code === 'no_embedding_provider_configured') {
        return boom(res, 'Error: no_embedding_provider_configured (set OPENROUTER_API_KEY or OPENAI_API_KEY)');
      }
      if (e?.code === 'embedding_non_json') {
        return boom(res, `Error: embedding_non_json (status ${e.status}) :: ${e.snippet || ''}`.trim());
      }
      return boom(res, `Error embedding: ${e?.message || String(e)}`);
    }

    // Prepare rows
    const now = new Date().toISOString();
    const rows = pieces.map((content, i) => ({
      url,
      title,
      content,               // canonical text
      chunk_text: content,   // backfill for older views
      embedding: vectors[i],
      tokens: Math.ceil(content.length / 4),
      chunk_hash: sha256(`${url}::${i}::${sha256(content)}`),
      created_at: now,
    }));

    // Upsert
    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    await upsertChunks({ supa, rows, replaceUrl: replace });

    return ok(res, {
      ok: true,
      url,
      chunks: rows.length,
      provider: OPENROUTER_API_KEY ? 'openrouter' : (OPENAI_API_KEY ? 'openai' : 'none'),
      model: OPENROUTER_API_KEY ? EMBED_MODEL_OPENROUTER : EMBED_MODEL_OPENAI,
    });
  } catch (err) {
    return boom(res, err?.message ?? String(err));
  }
}
