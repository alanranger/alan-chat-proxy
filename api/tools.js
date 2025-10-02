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

    // --- counts: mapping totals from v_events_for_chat ---
    if (req.method === 'GET' && action === 'counts') {
      const { count: total, error: e1 } = await supa
        .from('v_events_for_chat')
        .select('*', { head: true, count: 'exact' });
      if (e1) return sendJSON(res, 500, { error: 'supabase_error', detail: e1.message });
      const { count: mapped, error: e2 } = await supa
        .from('v_events_for_chat')
        .select('*', { head: true, count: 'exact' })
        .not('product_url', 'is', null);
      if (e2) return sendJSON(res, 500, { error: 'supabase_error', detail: e2.message });
      return sendJSON(res, 200, { ok: true, total: total || 0, mapped: mapped || 0 });
    }

    // --- parity: distinct URL counts by path using service role ---
    if (req.method === 'GET' && action === 'parity') {
      async function distinct(table, pattern){
        const { data, error } = await supa
          .from(table)
          .select('url')
          .ilike('url', `*${pattern}*`)
          .limit(2000);
        if (error) throw error;
        return new Set((data||[]).map(r=>r.url)).size;
      }
      try{
        const entitiesWorkshops = await distinct('page_entities','photographic-workshops-near-me');
        const chunksWorkshops   = await distinct('page_chunks','photographic-workshops-near-me');
        const entitiesCourses   = await distinct('page_entities','beginners-photography-lessons');
        const chunksCourses     = await distinct('page_chunks','beginners-photography-lessons');
        return sendJSON(res, 200, { ok:true, entitiesWorkshops, chunksWorkshops, entitiesCourses, chunksCourses });
      }catch(e){
        return sendJSON(res, 500, { error:'supabase_error', detail: String(e?.message||e) });
      }
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

    // --- export: CSV of v_events_for_chat ---
    if (req.method === 'GET' && action === 'export') {
      try{
        const headerWith = ['event_url','subtype','product_url','price_gbp','availability','date_start','date_end','event_location','map_method','confidence'];
        const headerBase = ['event_url','subtype','product_url','price_gbp','availability','date_start','date_end','event_location','map_method'];

        async function fetchRows(selectStr){
          const { data, error } = await supa
            .from('v_events_for_chat')
            .select(selectStr)
            .order('event_url', { ascending: true })
            .limit(5000);
          return { data, error };
        }

        // Try with confidence first; if the column doesn't exist yet, fall back
        let rows = [];
        let header = headerWith;
        let r = await fetchRows('event_url,subtype,product_url,price_gbp,availability,date_start,date_end,event_location,map_method,confidence');
        if (r.error) {
          // fallback without confidence
          header = headerBase;
          r = await fetchRows('event_url,subtype,product_url,price_gbp,availability,date_start,date_end,event_location,map_method');
          if (r.error) return sendJSON(res, 500, { error:'supabase_error', detail:r.error.message });
        }
        rows = r.data || [];

        const esc = (v) => {
          const s = (v==null?'':String(v));
          return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
        };
        const csv = [header.join(',')].concat(rows.map(r => header.map(k => esc(r[k])).join(','))).join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="event_product_mappings.csv"');
        return res.status(200).send(csv);
      }catch(e){
        return sendJSON(res, 500, { error:'server_error', detail:String(e?.message||e) });
      }
    }

    // Unknown/unsupported
    return sendJSON(res, 404, { error: 'not_found', detail: 'Use action=health|verify (GET) or action=search (POST)' });
  } catch (e) {
    return sendJSON(res, 500, { error: 'server_error', detail: String(e?.message || e) });
  }
}
