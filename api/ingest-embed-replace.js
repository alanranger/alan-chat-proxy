// api/ingest-embed-replace.js
// ESM module (package.json has "type":"module")

import { createClient } from '@supabase/supabase-js';
import { convert } from 'html-to-text';
import crypto from 'crypto';

// ---------- CONFIG ----------
export const config = { runtime: 'nodejs' }; // <- IMPORTANT: Vercel requires 'nodejs' now

const MODEL = 'text-embedding-3-small'; // 1536 dims
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/embeddings';

// Rough chunking targets (characters ~4 chars per token)
const MAX_CHARS = 4000;     // per chunk (≈ 1k tokens)
const OVERLAP_CHARS = 500;  // overlap between chunks

// ---------- helpers ----------
const bad = (res, code, error, detail) => {
  // Unified error shape so the UI can show it cleanly
  return res.status(code).json({
    ok: false,
    error,                 // short machine-readable code
    detail: detail ?? '',  // human-friendly (keep it a string)
  });
};

const ok = (res, payload) => res.status(200).json({ ok: true, ...payload });

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function chunkByChars(text) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + MAX_CHARS, text.length);
    const slice = text.slice(i, end).trim();
    if (slice.length) chunks.push(slice);
    if (end === text.length) break;
    i = end - OVERLAP_CHARS; // overlap
    if (i < 0) i = 0;
  }
  return chunks;
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim() : null;
}

// ---------- OpenRouter embeddings ----------
async function embedAll(chunks, apiKey) {
  // Embeds in a single call. If it errors, return explicit message.
  const r = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: chunks,
    }),
  });

  let body;
  try {
    body = await r.json();
  } catch (e) {
    throw new Error(`embedding_non_json (status ${r.status})`);
  }

  if (!r.ok) {
    const msg = body?.error?.message || JSON.stringify(body);
    throw new Error(`embedding_error: ${msg}`);
  }

  const embeddings = body.data?.map(d => d.embedding);
  if (!embeddings || embeddings.length !== chunks.length) {
    throw new Error('embedding_mismatch');
  }
  return embeddings;
}

// ---------- main handler ----------
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return bad(res, 405, 'method_not_allowed', 'Use POST with JSON { url, title? }');
  }

  const { url, title: titleOverride } = (req.body ?? {});
  if (!url || typeof url !== 'string') {
    return bad(res, 400, 'bad_request', 'Missing "url" string in JSON body.');
  }

  // env
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return bad(res, 500, 'server_env', 'Supabase env vars missing.');
  }
  if (!OPENROUTER_API_KEY) {
    return bad(res, 500, 'server_env', 'OPENROUTER_API_KEY is missing.');
  }

  const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    console.log('[ingest] start', { url });

    // 1) Fetch HTML
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; alan-chat-proxy/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    const html = await resp.text();
    if (!resp.ok) {
      console.error('[ingest] fetch_failed', resp.status, html?.slice(0, 120));
      return bad(res, 502, 'fetch_failed', `Status ${resp.status}`);
    }

    // 2) Extract text & title
    const title = titleOverride ?? extractTitle(html) ?? '';
    const text = convert(html, {
      selectors: [
        { selector: 'script', format: 'skip' },
        { selector: 'style', format: 'skip' },
        { selector: 'noscript', format: 'skip' },
      ],
      wordwrap: false,
    }).trim();

    if (!text || text.length < 30) {
      return bad(res, 422, 'no_content', 'Page had no extractable text.');
    }

    // 3) Chunk
    const chunks = chunkByChars(text);
    if (!chunks.length) {
      return bad(res, 422, 'no_chunks', 'Unable to split page into chunks.');
    }

    // 4) Embed all
    const embeddings = await embedAll(chunks, OPENROUTER_API_KEY);

    // 5) Replace rows for this URL
    const { error: delErr } = await supa
      .from('page_chunks')
      .delete()
      .eq('url', url);

    if (delErr) {
      console.error('[ingest] supabase_delete_error', delErr);
      return bad(res, 500, 'db_delete_error', delErr.message || String(delErr));
    }

    // Build rows
    const nowIso = new Date().toISOString();
    const rows = chunks.map((content, idx) => ({
      url,
      title,
      content,
      embedding: embeddings[idx],
      chunk_hash: sha256(url + '::' + idx + '::' + content.slice(0, 64)),
      created_at: nowIso,
    }));

    const { data: inserted, error: insErr } = await supa
      .from('page_chunks')
      .insert(rows)
      .select('id');

    if (insErr) {
      console.error('[ingest] supabase_insert_error', insErr);
      return bad(res, 500, 'db_insert_error', insErr.message || String(insErr));
    }

    console.log('[ingest] done', { url, inserted: inserted?.length ?? 0 });

    return ok(res, {
      url,
      title,
      inserted: inserted?.length ?? 0,
      chunks: chunks.length,
    });
  } catch (err) {
    console.error('[ingest] server_error', err);
    return bad(res, 500, 'server_error', err?.message || String(err));
  }
}
