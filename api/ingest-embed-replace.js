// /api/ingest-embed-replace.js
export const config = {
  runtime: 'nodejs',             // ✅ valid value
};

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.SUPABASE_URL || '';
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_EMBED_URL = 'https://openrouter.ai/api/v1/embeddings';
const EMBED_MODEL = 'openai/text-embedding-3-small';

function send(res, status, payload) {
  res.status(status).setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}
function err(res, status, stage, detail) { send(res, status, { error: 'server_error', status, stage, detail }); }
function ok(res, payload) { send(res, 200, payload); }

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function chunk(text, maxLen = 1200) {
  const out = [];
  for (let i = 0; i < text.length; i += maxLen) out.push(text.slice(i, i + maxLen));
  return out;
}
async function embedBatch(inputs) {
  const resp = await fetch(OPENROUTER_EMBED_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://alan-chat-proxy.vercel.app',
      'X-Title': 'alan-chat-proxy',
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
  });
  const raw = await resp.text();
  let data; try { data = JSON.parse(raw); } catch { throw new Error(`Embedding non-JSON (status ${resp.status}): ${raw.slice(0,400)}`); }
  if (!resp.ok) throw new Error(`Embedding error ${resp.status}: ${JSON.stringify(data)}`);
  if (!data?.data?.length) throw new Error(`Embedding empty: ${JSON.stringify(data)}`);
  return data.data.map(d => d.embedding);
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

    const missing = [];
    if (!SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!SUPABASE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!OPENROUTER_API_KEY) missing.push('OPENROUTER_API_KEY');
    if (missing.length) return err(res, 500, 'env_missing', { missing });

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const url = (body.url || '').trim();
    const title = (body.title || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) return err(res, 400, 'validate_input', 'Missing or invalid url');

    let html;
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
      });
      if (!r.ok) return err(res, 502, 'fetch_page', { status: r.status, body: (await r.text()).slice(0,400) });
      html = await r.text();
    } catch (e) { return err(res, 502, 'fetch_page', String(e)); }

    const text = htmlToText(html);
    if (text.length < 50) return err(res, 422, 'extract_text', 'Page has too little text');

    const chunks = chunk(text, 1200).slice(0, 100);
    if (!chunks.length) return err(res, 422, 'chunk_text', 'No chunks produced');

    let vectors = [];
    try {
      const B = 16;
      for (let i = 0; i < chunks.length; i += B) {
        const part = chunks.slice(i, i + B);
        const embs = await embedBatch(part);
        vectors.push(...embs);
      }
    } catch (e) { return err(res, 502, 'embed', String(e)); }
    if (vectors.length !== chunks.length) return err(res, 500, 'embed_mismatch', { chunks: chunks.length, vectors: vectors.length });

    try {
      const del = await supabase.from('page_chunks').delete().eq('url', url);
      if (del.error) throw del.error;
    } catch (e) { return err(res, 500, 'db_delete', e?.message || String(e)); }

    let inserted = 0;
    try {
      const rows = chunks.map((t, i) => ({ url, title: title || null, chunk_text: t, embedding: vectors[i] }));
      const S = 100;
      for (let i = 0; i < rows.length; i += S) {
        const ins = await supabase.from('page_chunks').insert(rows.slice(i, i + S));
        if (ins.error) throw ins.error;
        inserted += Math.min(S, rows.length - i);
      }
    } catch (e) { return err(res, 500, 'db_insert', e?.message || String(e)); }

    return ok(res, { ok: true, url, inserted, info: { chunks: chunks.length } });
  } catch (e) {
    return err(res, 500, 'unhandled', e?.message || String(e));
  }
}
