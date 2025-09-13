// /api/tools.js — FULL FILE (ESM)
// Multi-action API to stay under Vercel Hobby 12-function limit.
// GET /api/tools?action=health
// GET /api/tools?action=verify&url=...
// POST /api/tools?action=search  { query, topK? }
// Auth: Authorization: Bearer <INGEST_TOKEN>

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

// ---------- OpenAI embedding (same model as ingestion) ----------
async function embedQuery(text) {
  const key = need('OPENAI_API_KEY');
  const body = JSON.stringify({ model: 'text-embedding-3-small', input: text });

  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'alan-chat-proxy/tools'
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
    // Auth
    const token = req.headers['authorization']?.trim();
    if (token !== `Bearer ${need('INGEST_TOKEN')}`) {
      return sendJSON(res, 401, { error: 'unauthorized' });
    }

    // Action routing
    const action = (req.query?.action || req.query?.a || '').toString().toLowerCase();

    // DB client
    const supa = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));

    // --- health ---
    if (req.method === 'GET' && action === 'health') {
      // simple checks
      const env = {
        has_ingest_token: !!process.env.INGEST_TOKEN,
        has_supabase_url: !!process.env.SUPABASE_URL,
        has_supabase_service_role_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        has_supabase_anon_key: !!process.env.SUPABASE_ANON_KEY,
        embed_provider: process.env.OPENAI_API_KEY ? 'openai' : '(none)'
      };
      let page_chunks_count = null;
      try {
        const { count, error } = await supa
          .from('page_chunks')
          .select('id', { head: true, count: 'exact' });
        if (!error) page_chunks_count = count ?? null;
      } catch {}
      return sendJSON(res, 200, { ok: true, env, db: { page_chunks_count } });
    }

    // --- verify: count chunks and sum lengths for URL ---
    if (req.method === 'GET' && action === 'verify') {
      const url = (req.query?.url || '').toString().trim();
      if (!url) return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide "url"' });

      // count
      const { count, error: cErr } = await supa
        .from('page_chunks')
        .select('id', { head: true, count: 'exact' })
        .eq('url', url);
      if (cErr) return sendJSON(res, 500, { error: 'supabase_error', detail: cErr.message });

      // total_len (client-side sum, cheap for one URL)
      const { data: rows, error: rErr } = await supa
        .from('page_chunks')
        .select('content')
        .eq('url', url)
        .limit(5000);
      if (rErr) return sendJSON(res, 500, { error: 'supabase_error', detail: rErr.message });

      const total_len = (rows || []).reduce((s, r) => s + (r?.content?.length || 0), 0);
      return sendJSON(res, 200, { ok: true, url, chunks: count ?? (rows?.length || 0), total_len });
    }

    // --- search: embed query, similarity search via RPC ---
    if (req.method === 'POST' && action === 'search') {
      const { query, topK } = req.body || {};
      const q = (query || '').toString().trim();
      const k = Math.max(1, Math.min(32, parseInt(topK ?? 8, 10)));
      if (!q) return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide "query"' });

      const embedding = await embedQuery(q);
      const { data, error } = await supa.rpc('match_page_chunks', {
        query_embedding: embedding,
        match_count: k
      });
      if (error) return sendJSON(res, 500, { error: 'supabase_search_failed', detail: error.message || String(error) });

      const matches = (data || []).map(r => ({
        id: r.id,
        url: r.url,
        content: r.content,
        score: typeof r.score === 'number' ? r.score : null
      }));
      return sendJSON(res, 200, { matches });
    }

    // Unknown/unsupported
    return sendJSON(res, 404, { error: 'not_found', detail: 'Use action=health|verify (GET) or action=search (POST)' });
  } catch (e) {
    return sendJSON(res, 500, { error: 'server_error', detail: String(e?.message || e) });
  }
}
