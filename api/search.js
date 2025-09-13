// /api/search.js — FULL FILE (ESM)
// POST { query, topK? }  ->  { matches: [{ id, url, content, score }] }
// Auth: Authorization: Bearer <INGEST_TOKEN>
// Uses OpenAI text-embedding-3-small (same as ingestion)

export const config = { runtime: 'nodejs' };

import { createClient } from '@supabase/supabase-js';

const need = (k) => {
  const v = process.env[k];
  if (!v || !String(v).trim()) throw new Error(`missing_env:${k}`);
  return v;
};
const sendJSON = (res, status, obj) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).send(JSON.stringify(obj));
};

async function embedQuery(text) {
  const key = need('OPENAI_API_KEY');
  const body = JSON.stringify({ model: 'text-embedding-3-small', input: text });

  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'alan-chat-proxy/ingest-search'
    },
    body
  });

  const ctype = (resp.headers.get('content-type') || '').toLowerCase();
  const raw = await resp.text();
  if (!resp.ok) throw new Error(`openai_error:${resp.status}:${raw.slice(0,300)}`);
  if (!ctype.includes('application/json')) throw new Error(`openai_bad_content_type:${ctype}`);

  const j = JSON.parse(raw);
  const emb = j?.data?.[0]?.embedding;
  if (!Array.isArray(emb) || emb.length !== 1536) throw new Error('openai_bad_embedding');
  return emb;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method_not_allowed' });

    // bearer auth
    const token = req.headers['authorization']?.trim();
    if (token !== `Bearer ${need('INGEST_TOKEN')}`) {
      return sendJSON(res, 401, { error: 'unauthorized' });
    }

    const { query, topK } = req.body || {};
    const q = (query || '').toString().trim();
    const k = Math.max(1, Math.min(32, parseInt(topK ?? 8, 10))); // clamp 1..32
    if (!q) return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide "query"' });

    // embed with OpenAI
    const queryEmbedding = await embedQuery(q);

    // search via Supabase RPC
    const supa = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));
    const { data, error } = await supa.rpc('match_page_chunks', {
      query_embedding: queryEmbedding,
      match_count: k
    });

    if (error) return sendJSON(res, 500, { error: 'supabase_search_failed', detail: error.message || String(error) });

    // shape: [{ id, url, content, score }]
    const matches = (data || []).map(r => ({
      id: r.id,
      url: r.url,
      content: r.content,
      score: typeof r.score === 'number' ? r.score : null
    }));

    return sendJSON(res, 200, { matches });
  } catch (e) {
    return sendJSON(res, 500, { error: 'server_error', detail: String(e?.message || e) });
  }
}
