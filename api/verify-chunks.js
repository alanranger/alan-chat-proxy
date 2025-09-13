// /api/verify-chunks.js — FULL FILE (ESM)
// Verify DB chunk count & total_len for a given URL
// GET /api/verify-chunks?url=...  (or POST { url })
// Auth: same Bearer INGEST_TOKEN
// Returns: { ok, url, chunks, total_len }

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

export default async function handler(req, res) {
  try {
    // method + auth
    if (!['GET', 'POST'].includes(req.method)) {
      return sendJSON(res, 405, { error: 'method_not_allowed' });
    }
    const token = req.headers['authorization']?.trim();
    if (token !== `Bearer ${need('INGEST_TOKEN')}`) {
      return sendJSON(res, 401, { error: 'unauthorized' });
    }

    // get url
    let url = '';
    if (req.method === 'GET') {
      url = (req.query?.url || '').toString().trim();
    } else {
      url = (req.body?.url || '').toString().trim();
    }
    if (!url) return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide "url"' });

    // supabase
    const supa = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));

    // query counts
    const { data, error } = await supa
      .from('page_chunks')
      .select('content', { count: 'exact', head: true })
      .eq('url', url);

    if (error) {
      return sendJSON(res, 500, { error: 'supabase_error', detail: error.message });
    }

    // exact count comes from count; need total_len via a lightweight aggregate query
    const { data: agg, error: aggErr } = await supa
      .rpc('sql', { query: `select coalesce(sum(length(content)),0) as total_len from page_chunks where url = $1`, params: [url] });

    // Fallback if RPC is unavailable in your Supabase: do a normal select and sum client-side (cheap for a single URL)
    let total_len = 0;
    if (aggErr || !agg || !Array.isArray(agg) || typeof agg[0]?.total_len !== 'number') {
      const { data: rows, error: rowsErr } = await supa
        .from('page_chunks')
        .select('content')
        .eq('url', url)
        .limit(5000); // plenty for one URL
      if (rowsErr) return sendJSON(res, 500, { error: 'supabase_error', detail: rowsErr.message });
      total_len = (rows || []).reduce((s, r) => s + (r?.content?.length || 0), 0);
      return sendJSON(res, 200, { ok: true, url, chunks: data?.length ?? (rows?.length || 0), total_len });
    }

    total_len = agg[0].total_len || 0;
    // Note: when using 'head: true', supabase-js returns count but no data array.
    const chunks = typeof data?.length === 'number' ? data.length : (data ?? 0);
    return sendJSON(res, 200, { ok: true, url, chunks, total_len });
  } catch (e) {
    return sendJSON(res, 500, { error: 'server_error', detail: String(e?.message || e) });
  }
}
