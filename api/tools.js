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
    // Action routing (determine early so we can allow public export if toggled)
    const action = (req.query?.action || req.query?.a || '').toString().toLowerCase();

    // Optional public export toggle: allow unauthenticated CSV export when explicitly enabled
    const isExportAction = req.method === 'GET' && (action === 'export' || action === 'export_unmapped');
    const publicExportEnabled = process.env.PUBLIC_EXPORT_ENABLED === '1' || (req.query?.public === '1');
    const allowPublicExport = isExportAction && publicExportEnabled;

    // Auth (skip when public export is explicitly allowed)
    if (!allowPublicExport) {
      const token = req.headers['authorization']?.trim();
      const ingest = `Bearer ${need('INGEST_TOKEN')}`;
      const adminUi = process.env.ADMIN_UI_TOKEN ? `Bearer ${process.env.ADMIN_UI_TOKEN}` : null;
      // Temporary compatibility for existing admin UI hardcoded token
      const legacyAdmin = 'Bearer b6c3f0c9e6f44cce9e1a4f3f2d3a5c76';
      const ok = token === ingest || (adminUi && token === adminUi) || token === legacyAdmin;
      if (!ok) return sendJSON(res, 401, { error: 'unauthorized' });
    }

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

        // --- counts: mapping totals from v_event_product_final_enhanced (proper lineage view with all fields) ---
        if (req.method === 'GET' && action === 'counts') {
          const { count: total, error: e1 } = await supa
            .from('v_event_product_final_enhanced')
            .select('*', { head: true, count: 'exact' });
          if (e1) return sendJSON(res, 500, { error: 'supabase_error', detail: e1.message });
          const { count: mapped, error: e2 } = await supa
            .from('v_event_product_final_enhanced')
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

    // --- cron_status: surface basic status and related counters (no direct pg_cron access via REST) ---
    if (req.method === 'GET' && action === 'cron_status') {
      try {
        // Reuse existing counters for a useful dashboard snapshot
        let counts;
        try {
          const resp = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : ''}/api/tools?action=counts`, {
            headers: { Authorization: `Bearer ${need('INGEST_TOKEN')}` }
          });
          const j = await resp.json();
          if (resp.ok && j && j.ok) counts = { total: j.total, mapped: j.mapped };
        } catch {}
        if (!counts) {
          // Fallback to view counts directly
          const { count: total } = await supa
            .from('v_event_product_final_enhanced')
            .select('*', { head: true, count: 'exact' });
          const { count: mapped } = await supa
            .from('v_event_product_final_enhanced')
            .select('*', { head: true, count: 'exact' })
            .not('product_url', 'is', null);
          counts = { total: total || 0, mapped: mapped || 0 };
        }

        // Parity snapshot
        let parity = null;
        try {
          const { data: entW } = await supa
            .from('page_entities').select('url').ilike('url', '*photographic-workshops-near-me*').limit(2000);
          const { data: chkW } = await supa
            .from('page_chunks').select('url').ilike('url', '*photographic-workshops-near-me*').limit(2000);
          const { data: entC } = await supa
            .from('page_entities').select('url').ilike('url', '*beginners-photography-lessons*').limit(2000);
          const { data: chkC } = await supa
            .from('page_chunks').select('url').ilike('url', '*beginners-photography-lessons*').limit(2000);
          parity = {
            entitiesWorkshops: new Set((entW||[]).map(r=>r.url)).size,
            chunksWorkshops: new Set((chkW||[]).map(r=>r.url)).size,
            entitiesCourses: new Set((entC||[]).map(r=>r.url)).size,
            chunksCourses: new Set((chkC||[]).map(r=>r.url)).size
          };
        } catch {}

        // We cannot read cron.job via REST; expose configured schedule note
        const schedule = '23:00 daily';
        const tz = 'Europe/London (assumed)';
        return sendJSON(res, 200, { ok: true, schedule, tz, counts, parity });
      } catch (e) {
        return sendJSON(res, 500, { error: 'server_error', detail: String(e?.message||e) });
      }
    }

    // --- finalize: run mapping refresh and warm common views/tables ---
    if (req.method === 'POST' && action === 'finalize') {
      try {
        const token = need('INGEST_TOKEN');
        const base = process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : '';
        let before = null, after = null;
        try {
          const r1 = await fetch(`${base}/api/refresh-mappings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ preview: true })
          });
          before = await r1.json();
        } catch {}
        try {
          const r2 = await fetch(`${base}/api/refresh-mappings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({})
          });
          after = await r2.json();
        } catch {}

        // Warm critical views/tables with cheap head selects
        const warm = {};
        try {
          const { count } = await supa.from('v_event_product_mappings').select('*', { head: true, count: 'estimated' }).limit(1);
          warm.v_event_product_mappings = count ?? null;
        } catch {}
        try {
          const { count } = await supa.from('page_chunks').select('id', { head: true, count: 'estimated' }).limit(1);
          warm.page_chunks = count ?? null;
        } catch {}

        return sendJSON(res, 200, { ok: true, before, after, warm });
      } catch (e) {
        return sendJSON(res, 500, { error: 'server_error', detail: String(e?.message||e) });
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

        // --- export: CSV of v_event_product_final_enhanced (proper lineage view with all fields) ---
        if (req.method === 'GET' && action === 'export') {
          try{
            const headerWith = ['event_url','subtype','product_url','product_title','price_gbp','availability','date_start','date_end','start_time','end_time','event_location','map_method','confidence','participants','fitness_level','event_title','json_price','json_availability','price_currency'];
            const headerBase = ['event_url','subtype','product_url','product_title','price_gbp','availability','date_start','date_end','start_time','end_time','event_location','map_method','participants','fitness_level','event_title','json_price','json_availability','price_currency'];

            async function fetchRows(selectStr){
            const { data, error } = await supa
              .from('v_event_product_mappings')
                .select(selectStr)
                .order('event_url', { ascending: true })
                .limit(5000);
              return { data, error };
            }

        // Try with confidence first; if the column doesn't exist yet, fall back
        let rows = [];
        let header = headerWith;
        let r = await fetchRows('event_url,subtype,product_url,product_title,price_gbp,availability,date_start,date_end,start_time,end_time,event_location,map_method,confidence');
        if (r.error) {
          // fallback without confidence
          header = headerBase;
          r = await fetchRows('event_url,subtype,product_url,product_title,price_gbp,availability,date_start,date_end,start_time,end_time,event_location,map_method');
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

    // --- export_unmapped: CSV of events with no product mapping ---
    if (req.method === 'GET' && action === 'export_unmapped') {
      try{
        const sel = 'event_url,subtype,date_start,date_end,event_location,price_gbp,availability';
        const { data: allEvents, error: e1 } = await supa
          .from('v_events_for_chat')
          .select(sel)
          .or('event_url.ilike."https://www.alanranger.com/photographic-workshops-near-me/%",event_url.ilike."https://www.alanranger.com/beginners-photography-lessons/%"')
          .limit(5000);
        if (e1) return sendJSON(res, 500, { error:'supabase_error', detail:e1.message });
        const { data: mapped, error: e2 } = await supa
          .from('v_events_for_chat')
          .select('event_url')
          .limit(5000);
        if (e2) return sendJSON(res, 500, { error:'supabase_error', detail:e2.message });
        const mappedSet = new Set((mapped||[]).map(r=>r.event_url));
        const rows = (allEvents||[]).filter(r => !mappedSet.has(r.event_url));
        const header = ['event_url','subtype','date_start','date_end','event_location','price_gbp','availability'];
        const esc = (v) => { const s=(v==null?'':String(v)); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; };
        const csv = [header.join(',')].concat(rows.map(r => header.map(k => esc(r[k])).join(','))).join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="unmapped_events.csv"');
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
