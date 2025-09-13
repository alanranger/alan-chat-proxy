// /api/ingest-embed-replace.js
// ESM file (your package.json has "type":"module")

export const config = { runtime: 'nodejs' };

import crypto from 'node:crypto';
import { htmlToText } from 'html-to-text';
import { createClient } from '@supabase/supabase-js';

// ---------- helpers ----------
const env = (k, req = true) => {
  const v = process.env[k];
  if (req && (!v || v.trim() === '')) throw new Error(`missing_env:${k}`);
  return v || '';
};

function json(res, status, obj) {
  // Always respond as JSON
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).send(JSON.stringify(obj));
}

function chunkText(txt, targetChars = 3500, overlap = 300) {
  // Simple char-based chunker (approx token chunks)
  const chunks = [];
  let i = 0;
  while (i < txt.length) {
    const end = Math.min(i + targetChars, txt.length);
    let chunk = txt.slice(i, end);
    // trim boundaries a bit
    chunk = chunk.replace(/^\s+|\s+$/g, '');
    if (chunk) chunks.push(chunk);
    i = end - overlap;
    if (i < 0) i = 0;
  }
  return chunks;
}

async function getEmbeddings(inputs) {
  // Prefer OpenRouter; fall back to OpenAI if present
  const orKey = process.env.OPENROUTER_API_KEY;
  const oaKey = process.env.OPENAI_API_KEY;

  if (!orKey && !oaKey) {
    throw new Error('no_embedding_provider_configured (set OPENROUTER_API_KEY or OPENAI_API_KEY)');
  }

  if (orKey) {
    const resp = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${orKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // 1536-dim, matches your DB schema
        model: 'text-embedding-3-small',
        input: inputs
      })
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`openrouter_error status=${resp.status} ${t}`);
    }
    const j = await resp.json();
    const out = (j?.data || []).map(d => d?.embedding);
    if (!out.length) throw new Error('openrouter_empty_embeddings');
    return out;
  }

  // Fallback: OpenAI
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${oaKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: inputs
    })
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`openai_error status=${resp.status} ${t}`);
  }
  const j = await resp.json();
  const out = (j?.data || []).map(d => d?.embedding);
  if (!out.length) throw new Error('openai_empty_embeddings');
  return out;
}

function sha1(s) {
  return crypto.createHash('sha1').update(s).digest('hex');
}

async function fetchPage(url) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`fetch_failed status=${r.status}`);
  const html = await r.text();
  const text = htmlToText(html, {
    selectors: [
      { selector: 'nav', format: 'skip' },
      { selector: 'footer', format: 'skip' },
      { selector: 'script', format: 'skip' },
      { selector: 'style', format: 'skip' }
    ],
    wordwrap: false
  }).trim();
  return { html, text };
}

// ---------- main handler ----------
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return json(res, 405, { error: 'method_not_allowed' });
    }

    const bearer = (req.headers['authorization'] || '').trim();
    const ingestToken = env('INGEST_TOKEN', true);
    if (bearer !== `Bearer ${ingestToken}`) {
      return json(res, 401, { error: 'unauthorized' });
    }

    const { url } = (req.body || {});
    if (!url || typeof url !== 'string') {
      return json(res, 400, { error: 'bad_request', detail: 'Provide "url"' });
    }

    const SUPABASE_URL = env('SUPABASE_URL', true);
    const SUPABASE_SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY', true);
    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // fetch + extract
    const { text } = await fetchPage(url);
    if (!text || text.length < 10) {
      return json(res, 422, { error: 'empty_content', detail: 'Page extracted no usable text' });
    }

    const totalLen = text.length;
    const chunks = chunkText(text); // array of strings
    const emb = await getEmbeddings(chunks);

    // Upsert rows; unique on hash so we replace existing
    const rows = [];
    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i];
      const embedding = emb[i];
      const tokens = Math.ceil(content.length / 4); // rough estimate
      const hash = sha1(`${url}#${i}:${content.slice(0, 128)}`);
      rows.push({ url, title: null, content, embedding, tokens, hash });
    }

    // Use Supabase upsert on unique hash
    const { data, error } = await supa
      .from('page_chunks')
      .upsert(rows, { onConflict: 'hash' })
      .select('id')
      .order('id', { ascending: false });

    if (error) {
      // Surface a clean error
      return json(res, 500, { error: 'supabase_upsert_failed', detail: error.message || String(error) });
    }

    const firstId = data && data.length ? data[0].id : null;
    return json(res, 200, { ok: true, id: firstId, len: totalLen, chunks: rows.length });
  } catch (err) {
    // This catches EVERYTHING and always returns JSON
    const msg = err?.message || String(err);
    return json(res, 500, { error: 'server_error', detail: msg });
  }
}
