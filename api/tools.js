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
    const isExportAction = req.method === 'GET' && (action === 'export' || action === 'export_unmapped' || action === 'export_reconcile' || action === 'event_debug');
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

        // --- get_urls: get URLs from csv_metadata table ---
        if (req.method === 'GET' && action === 'get_urls') {
          try {
            // Check if we should filter by recent imports (last 5 minutes)
            const recentOnly = req.query.recent === 'true';
            let query = supa
              .from('csv_metadata')
              .select('url, csv_type, import_session')
              .not('url', 'is', null);
            
            if (recentOnly) {
              // Only get URLs imported in the last 5 minutes
              const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
              query = query.gte('import_session', fiveMinutesAgo);
            }
            
            const { data: urls, error } = await query;
            
            if (error) throw error;
            
            return sendJSON(res, 200, { 
              ok: true, 
              urls: urls || [],
              count: (urls || []).length,
              recent_only: recentOnly
            });
          } catch (e) {
            return sendJSON(res, 500, { error: 'failed_to_get_urls', detail: e.message });
          }
        }

        // --- counts: comprehensive counts including CSV metadata ---
        if (req.method === 'GET' && action === 'counts') {
          const counts = {};
          
          // Get CSV metadata counts by type
          try {
            const { data: csvMetadata, error: csvError } = await supa
              .from('csv_metadata')
              .select('csv_type');
            
            if (!csvError && csvMetadata) {
              const csvCounts = {};
              csvMetadata.forEach(row => {
                csvCounts[row.csv_type] = (csvCounts[row.csv_type] || 0) + 1;
              });
              counts.csv_metadata = csvCounts;
            }
          } catch (e) {
            console.warn('Failed to get CSV metadata counts:', e.message);
          }
          
          // Get other table counts
          const tables = ['page_html', 'page_entities', 'page_chunks', 'event_product_links_auto'];
          for (const table of tables) {
            try {
              const { count, error } = await supa
                .from(table)
                .select('*', { head: true, count: 'exact' });
              if (!error) counts[table] = count || 0;
            } catch (e) {
              console.warn(`Failed to get ${table} count:`, e.message);
            }
          }
          
          // Get page_entities counts by kind
          try {
            const { data: pageEntities, error: peError } = await supa
              .from('page_entities')
              .select('kind');
            
            if (!peError && pageEntities) {
              const peCounts = {};
              pageEntities.forEach(row => {
                peCounts[row.kind] = (peCounts[row.kind] || 0) + 1;
              });
              counts.page_entities_articles = peCounts.article || 0;
              counts.page_entities_events = peCounts.event || 0;
              counts.page_entities_products = peCounts.product || 0;
              counts.page_entities_services = peCounts.service || 0;
            }
          } catch (e) {
            console.warn('Failed to get page_entities counts by kind:', e.message);
          }
          
          // Get enrichment views count (sum of all enrichment views)
          try {
            const views = ['v_blog_enrichment', 'v_course_event_enrichment', 'v_workshop_event_enrichment', 'v_course_product_enrichment', 'v_workshop_product_enrichment', 'v_metadata_enrichment'];
            let totalViews = 0;
            for (const view of views) {
              try {
                const { count, error } = await supa
                  .from(view)
                  .select('*', { head: true, count: 'exact' });
                if (!error) totalViews += (count || 0);
              } catch (e) {
                // View might not exist yet
              }
            }
            counts.enrichment_views = totalViews;
          } catch (e) {
            console.warn('Failed to get enrichment views count:', e.message);
          }
          
          // Legacy mapping counts for backward compatibility
          try {
            // Primary: use v_events_for_chat
            const { count: totalV, error: eV1 } = await supa
              .from('v_events_for_chat')
              .select('*', { head: true, count: 'exact' });
            if (!eV1) counts.total = totalV || 0;

            const { count: mappedV, error: eV2 } = await supa
              .from('v_events_for_chat')
              .select('*', { head: true, count: 'exact' })
              .not('product_url', 'is', null);
            if (!eV2) counts.mapped = mappedV || 0;

            // Fallback: legacy view if primary failed
            if ((counts.total ?? 0) === 0 && (counts.mapped ?? 0) === 0) {
              try {
                const { count: totalL } = await supa
                  .from('v_event_product_final_enhanced')
                  .select('*', { head: true, count: 'exact' });
                const { count: mappedL } = await supa
                  .from('v_event_product_final_enhanced')
                  .select('*', { head: true, count: 'exact' })
                  .not('product_url', 'is', null);
                if ((totalL ?? 0) > 0) counts.total = totalL || 0;
                if ((mappedL ?? 0) > 0) counts.mapped = mappedL || 0;
              } catch {}
            }
          } catch (e) {
            console.warn('Failed to get mapping counts:', e.message);
          }
          
          return sendJSON(res, 200, { ok: true, ...counts });
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
            .from('v_events_for_chat')
            .select('*', { head: true, count: 'exact' });
          const { count: mapped } = await supa
            .from('v_events_for_chat')
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

        // Check last cron run from light_refresh_runs table
        let lastRun = null;
        try {
          const { data: runs } = await supa
            .from('light_refresh_runs')
            .select('started_at, finished_at, ingested_count, failed_count, urls_changed')
            .order('started_at', { ascending: false })
            .limit(1);
          if (runs && runs.length > 0) {
            lastRun = {
              started_at: runs[0].started_at,
              finished_at: runs[0].finished_at,
              ingested: runs[0].ingested_count || 0,
              failed: runs[0].failed_count || 0,
              urls_changed: runs[0].urls_changed || 0
            };
          }
        } catch {}

        // Vercel cron schedule: every 4 hours (0 */4 * * *) - 3 batches covering all URLs daily
        const schedule = 'Every 4 hours (0 */4 * * *) - 3 rotating batches';
        const tz = 'UTC (Vercel default)';
        return sendJSON(res, 200, { ok: true, schedule, tz, counts, parity, lastRun });
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
        try {
          const { count } = await supa.from('csv_metadata').select('id', { head: true, count: 'estimated' }).limit(1);
          warm.csv_metadata = count ?? null;
        } catch {}
        try {
          const { count } = await supa.from('v_metadata_enrichment').select('*', { head: true, count: 'estimated' }).limit(1);
          warm.v_metadata_enrichment = count ?? null;
        } catch {}
        try {
          const { count } = await supa.from('v_blog_enrichment').select('*', { head: true, count: 'estimated' }).limit(1);
          warm.v_blog_enrichment = count ?? null;
        } catch {}
        try {
          const { count } = await supa.from('v_course_event_enrichment').select('*', { head: true, count: 'estimated' }).limit(1);
          warm.v_course_event_enrichment = count ?? null;
        } catch {}
        try {
          const { count } = await supa.from('v_workshop_event_enrichment').select('*', { head: true, count: 'estimated' }).limit(1);
          warm.v_workshop_event_enrichment = count ?? null;
        } catch {}
        try {
          const { count } = await supa.from('v_course_product_enrichment').select('*', { head: true, count: 'estimated' }).limit(1);
          warm.v_course_product_enrichment = count ?? null;
        } catch {}
        try {
          const { count } = await supa.from('v_workshop_product_enrichment').select('*', { head: true, count: 'estimated' }).limit(1);
          warm.v_workshop_product_enrichment = count ?? null;
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

    // --- event_debug: inspect a single event across sources ---
    if (req.method === 'GET' && action === 'event_debug') {
      const url = (req.query?.url || '').toString().trim();
      if (!url) return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide "url"' });
      const norm = (u) => (u||'').replace(/\/+$/,'');
      const u = norm(url);
      try {
        const [pe, vf, ve] = await Promise.all([
          supa.from('page_entities').select('url,kind,title,date_start,date_end,raw').eq('kind','event').eq('url', u).limit(1),
          supa.from('v_event_product_final_enhanced').select('event_url,date_start,date_end,start_time,end_time,product_url,product_title').eq('event_url', u).limit(5),
          supa.from('v_events_for_chat').select('event_url,date_start,date_end,start_time,end_time').eq('event_url', u).limit(1)
        ]);
        const peRow = pe.data?.[0] || null;
        const vfRows = vf.data || [];
        const veRow = ve.data?.[0] || null;
        return sendJSON(res, 200, { ok:true, url:u, page_entities: peRow, v_event_product_final_enhanced: vfRows, v_events_for_chat: veRow });
      } catch (e) {
        return sendJSON(res, 500, { error:'server_error', detail:String(e?.message||e) });
      }
    }

        // --- export: CSV of v_event_product_final_enhanced (proper lineage view with all fields) ---
        if (req.method === 'GET' && action === 'export') {
          try{
            // Base columns that should always exist
            const baseSelect = 'event_url,subtype,product_url,product_title,price_gbp,availability,date_start,date_end,start_time,end_time,event_location,map_method';
            // Extended columns that may not exist
            const extendedSelect = baseSelect + ',confidence,participants,fitness_level,event_title,json_price,json_availability,price_currency';
            
            const headerWith = ['event_url','subtype','product_url','product_title','price_gbp','availability','date_start','date_end','start_time','end_time','event_location','map_method','confidence','participants','fitness_level','event_title','json_price','json_availability','price_currency'];
            const headerBase = ['event_url','subtype','product_url','product_title','price_gbp','availability','date_start','date_end','start_time','end_time','event_location','map_method'];

            async function fetchRows(selectStr){
              try {
                const { data, error } = await supa
                  .from('v_events_for_chat')
                  .select(selectStr)
                  .order('event_url', { ascending: true })
                  .limit(5000);
                return { data, error };
              } catch (err) {
                return { data: null, error: { message: String(err?.message || err), code: 'FETCH_ERROR' } };
              }
            }

            // Try with extended columns first; if the columns don't exist yet, fall back
            let rows = [];
            let header = headerWith;
            let r = await fetchRows(extendedSelect);
            if (r.error) {
              console.error('Export error (extended):', r.error);
              // fallback without extended columns
              header = headerBase;
              r = await fetchRows(baseSelect);
              if (r.error) {
                console.error('Export error (base):', r.error);
                // Return detailed error as JSON so client can see it
                return sendJSON(res, 500, { 
                  error:'supabase_error', 
                  detail: r.error.message || String(r.error),
                  code: r.error.code || 'UNKNOWN',
                  hint: 'Check if v_events_for_chat view exists and has required columns'
                });
              }
            }
            rows = r.data || [];

        // Helper function to normalize date for deduplication key
        const normalizeDate = (date) => {
          if (!date) return '';
          // Convert to ISO string and take just the date part (YYYY-MM-DD)
          try {
            const d = new Date(date);
            return d.toISOString().split('T')[0];
          } catch {
            return String(date).split('T')[0];
          }
        };

        // Deduplicate rows: remove exact duplicates based on event_url + date_start + product_url
        // This fixes the issue where every event appears twice in the export
        const seen = new Set();
        rows = rows.filter(row => {
          const dateKey = normalizeDate(row.date_start);
          const key = `${row.event_url}|${dateKey}|${row.product_url || ''}`;
          if (seen.has(key)) {
            return false; // Skip duplicate
          }
          seen.add(key);
          return true;
        });

        // Overwrite date/time strictly from page_entities (CSV-derived), no tz conversion
        // FIX: Match on URL+date, not just URL, since same URL can have multiple dates
        try {
          const norm = (u) => (u||'').replace(/\/+$/,'');
          const normalizeDate = (date) => {
            if (!date) return '';
            try {
              const d = new Date(date);
              return d.toISOString().split('T')[0];
            } catch {
              return String(date).split('T')[0];
            }
          };
          const { data: eventRows, error: evErr } = await supa
            .from('page_entities')
            .select('url, date_start, date_end, raw, kind')
            .eq('kind','event')
            .limit(5000);
          if (!evErr && Array.isArray(eventRows)) {
            // Key by URL+date to handle multiple dates per URL
            const byUrlAndDate = new Map(eventRows.map(e => {
              const urlKey = norm(e.url);
              const dateKey = normalizeDate(e.date_start);
              return [`${urlKey}|${dateKey}`, e];
            }));
            rows = rows.map(row => {
              const urlKey = norm(row.event_url);
              const dateKey = normalizeDate(row.date_start);
              const ev = byUrlAndDate.get(`${urlKey}|${dateKey}`);
              if (ev) {
                row.date_start = ev.date_start;
                row.date_end = ev.date_end;
                // Prefer CSV-preserved times in raw
                const csvStart = ev.raw?._csv_start_time;
                const csvEnd = ev.raw?._csv_end_time;
                if (csvStart) row.start_time = csvStart;
                if (csvEnd) row.end_time = csvEnd;
                if (!row.start_time || !row.end_time) {
                  // derive HH:MM:SS from timestamp strings if needed
                  const ds = typeof ev.date_start === 'string' ? ev.date_start : (ev.date_start?.toString?.() || '');
                  const de = typeof ev.date_end === 'string' ? ev.date_end : (ev.date_end?.toString?.() || '');
                  const t1 = ds.includes('T') ? ds.split('T')[1].slice(0,8) : '';
                  const t2 = de.includes('T') ? de.split('T')[1].slice(0,8) : '';
                  if (!row.start_time && t1) row.start_time = t1;
                  if (!row.end_time && t2) row.end_time = t2;
                }
              }
              return row;
            });
          }
        } catch {}
        
        // Always deduplicate again after date update (in case date update created duplicates or changed formats)
        const seenAfter = new Set();
        rows = rows.filter(row => {
          const dateKey = normalizeDate(row.date_start);
          const key = `${row.event_url}|${dateKey}|${row.product_url || ''}`;
          if (seenAfter.has(key)) {
            return false;
          }
          seenAfter.add(key);
          return true;
        });

        const esc = (v) => {
          const s = (v==null || v===undefined ? '' : String(v));
          return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
        };
        
        // Ensure header only includes columns that exist in the data (if rows exist)
        let finalHeader = header;
        if (rows.length > 0) {
          const availableColumns = Object.keys(rows[0]);
          finalHeader = header.filter(col => availableColumns.includes(col));
        }
        
        const csv = [finalHeader.join(',')].concat(rows.map(r => finalHeader.map(k => esc(r[k] || '')).join(','))).join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="event_product_mappings.csv"');
        return res.status(200).send(csv);
      }catch(e){
        console.error('Export mappings error:', e);
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

    // --- aggregate_analytics: Run analytics aggregation for a specific date ---
    if (req.method === 'POST' && action === 'aggregate_analytics') {
      try {
        const { date } = req.body || {};
        const targetDate = date || new Date().toISOString().split('T')[0];

        console.log('Running analytics aggregation for date:', targetDate);
        
        const { data: aggData, error: aggError } = await supabase
          .rpc('aggregate_daily_analytics', { target_date: targetDate });

        if (aggError) {
          console.error('Error running analytics aggregation:', aggError);
          return sendJSON(res, 500, { 
            error: 'Failed to aggregate analytics', 
            detail: aggError.message 
          });
        }

        console.log('Analytics aggregation completed successfully');

        const { data: updateData, error: updateError } = await supabase
          .rpc('update_question_frequency');

        if (updateError) {
          console.error('Error updating question frequency:', updateError);
          return sendJSON(res, 500, { 
            error: 'Failed to update question frequency', 
            detail: updateError.message 
          });
        }

        return sendJSON(res, 200, {
          ok: true,
          message: 'Analytics aggregation completed successfully',
          date: targetDate,
          aggregationResult: aggData,
          frequencyUpdateResult: updateData
        });

      } catch (error) {
        console.error('Unexpected error in analytics aggregation:', error);
        return sendJSON(res, 500, { 
          error: 'Internal server error', 
          detail: error.message 
        });
      }
    }

    // --- reconcile_services: get list of missing service entities (for frontend processing) ---
    if (req.method === 'GET' && action === 'reconcile_services') {
      try {
        const { data: svcRows, error: svcErr } = await supa
          .from('csv_metadata')
          .select('id, url')
          .eq('csv_type', 'landing_service_pages')
          .eq('kind', 'service');
        if (svcErr) return sendJSON(res, 500, { error: 'supabase_error', detail: svcErr.message });

        const csvIds = (svcRows || []).map(r => r.id);
        if (csvIds.length === 0) {
          return sendJSON(res, 200, { ok: true, message: 'No service rows found in csv_metadata', urls: [], total: 0 });
        }

        const { data: existing, error: existErr } = await supa
          .from('page_entities')
          .select('csv_metadata_id')
          .eq('csv_type', 'landing_service_pages')
          .in('csv_metadata_id', csvIds);
        if (existErr) return sendJSON(res, 500, { error: 'supabase_error', detail: existErr.message });

        const present = new Set((existing || []).map(r => r.csv_metadata_id));
        const toCreate = (svcRows || []).filter(r => !present.has(r.id));
        
        const urls = toCreate.map(r => String(r.url || '').replace(/\/$/, '')).filter(u => u);
        
        return sendJSON(res, 200, {
          ok: true,
          urls: urls,
          total: urls.length,
          total_services: svcRows.length,
          already_existed: svcRows.length - toCreate.length,
          missing: toCreate.length
        });
      } catch (err) {
        return sendJSON(res, 500, { error: 'server_error', detail: err.message });
      }
    }

    // --- reconcile_services: ingest missing service entities from csv_metadata (legacy - processes all) ---
    if (req.method === 'POST' && action === 'reconcile_services') {
      try {
        // Import ingestSingleUrl function directly
        const { ingestSingleUrl } = await import('./ingest.js');
        
        const { data: svcRows, error: svcErr } = await supa
          .from('csv_metadata')
          .select('id, url')
          .eq('csv_type', 'landing_service_pages')
          .eq('kind', 'service');
        if (svcErr) return sendJSON(res, 500, { error: 'supabase_error', detail: svcErr.message });

        const csvIds = (svcRows || []).map(r => r.id);
        if (csvIds.length === 0) {
          return sendJSON(res, 200, { ok: true, message: 'No service rows found in csv_metadata', ingested: 0, total: 0 });
        }

        const { data: existing, error: existErr } = await supa
          .from('page_entities')
          .select('csv_metadata_id')
          .eq('csv_type', 'landing_service_pages')
          .in('csv_metadata_id', csvIds);
        if (existErr) return sendJSON(res, 500, { error: 'supabase_error', detail: existErr.message });

        const present = new Set((existing || []).map(r => r.csv_metadata_id));
        const toCreate = (svcRows || []).filter(r => !present.has(r.id));
        
        if (toCreate.length === 0) {
          return sendJSON(res, 200, { 
            ok: true, 
            message: 'All services already have entities', 
            ingested: 0, 
            total: svcRows.length,
            missing: 0
          });
        }

        // Process in batches to avoid timeout
        const batchSize = 5; // Smaller batches to avoid Vercel timeout
        const results = [];
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < toCreate.length; i += batchSize) {
          const batch = toCreate.slice(i, i + batchSize);
          const batchPromises = batch.map(async (r) => {
            const u = String(r.url || '').replace(/\/$/, '');
            try {
              const result = await ingestSingleUrl(u, supa, { dryRun: false });
              successCount++;
              return { url: u, ok: true, chunks: result.chunks, entities: result.entities };
            } catch (e) {
              failCount++;
              return { url: u, ok: false, error: e.message };
            }
          });
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);
          
          // Small delay between batches
          if (i + batchSize < toCreate.length) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        return sendJSON(res, 200, {
          ok: true,
          message: `Reconciliation complete: ${successCount} succeeded, ${failCount} failed`,
          ingested: successCount,
          failed: failCount,
          total: toCreate.length,
          total_services: svcRows.length,
          already_existed: svcRows.length - toCreate.length,
          results: results.slice(0, 20) // Return first 20 results as sample
        });
      } catch (err) {
        return sendJSON(res, 500, { error: 'server_error', detail: err.message });
      }
    }

    // --- export_reconcile: compare exported mappings vs event CSV view ---
    if (req.method === 'GET' && action === 'export_reconcile') {
      try {
        // Load mappings (events for chat view)
        const { data: mapRows, error: mapErr } = await supa
          .from('v_events_for_chat')
          .select('event_url,subtype,product_url,product_title,price_gbp,availability,date_start,date_end,start_time,end_time')
          .limit(5000);
        if (mapErr) return sendJSON(res, 500, { error: 'supabase_error', detail: mapErr.message });

        // Load event schedule directly from page_entities (CSV-origin values)
        const { data: evRows, error: evErr } = await supa
          .from('page_entities')
          .select('url,date_start,date_end,raw,kind')
          .eq('kind','event')
          .limit(5000);
        if (evErr) return sendJSON(res, 500, { error: 'supabase_error', detail: evErr.message });

        const norm = (u) => (u||'').replace(/\/+$/,'');
        const evByUrl = new Map((evRows||[]).map(r => {
          const csvStart = r.raw?._csv_start_time || '';
          const csvEnd = r.raw?._csv_end_time || '';
          let start_time = csvStart;
          let end_time = csvEnd;
          if (!start_time || !end_time) {
            const ds = typeof r.date_start === 'string' ? r.date_start : (r.date_start?.toString?.() || '');
            const de = typeof r.date_end === 'string' ? r.date_end : (r.date_end?.toString?.() || '');
            if (!start_time) start_time = ds.includes('T') ? ds.split('T')[1].slice(0,8) : '';
            if (!end_time) end_time = de.includes('T') ? de.split('T')[1].slice(0,8) : '';
          }
          return [norm(r.url), { ...r, start_time, end_time }];
        }));
        const header = [
          'event_url','subtype','product_url','product_title','price_gbp','availability',
          'export_date_start','export_date_end','export_start_time','export_end_time',
          'csv_date_start','csv_date_end','csv_start_time','csv_end_time',
          'date_mismatch','time_mismatch'
        ];
        function esc(v){
          const s = v==null?'':String(v);
          return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
        }
        const rows = (mapRows||[]).map(m => {
          const ev = evByUrl.get(norm(m.event_url)) || {};
          const dateMismatch = (String(m.date_start||'') !== String(ev.date_start||'')) || (String(m.date_end||'') !== String(ev.date_end||''));
          const timeMismatch = (String(m.start_time||'') !== String(ev.start_time||'')) || (String(m.end_time||'') !== String(ev.end_time||''));
          const r = [
            m.event_url, m.subtype, m.product_url, m.product_title, m.price_gbp, m.availability,
            m.date_start, m.date_end, m.start_time, m.end_time,
            ev.date_start||'', ev.date_end||'', ev.start_time||'', ev.end_time||'',
            dateMismatch ? '1' : '0', timeMismatch ? '1' : '0'
          ];
          return r.map(esc).join(',');
        });
        const csv = [header.join(',')].concat(rows).join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="reconcile-event-mapping.csv"');
        return res.status(200).send(csv);
      } catch (e) {
        return sendJSON(res, 500, { error: 'server_error', detail: String(e?.message||e) });
      }
    }

    // Unknown/unsupported
    return sendJSON(res, 404, { error: 'not_found', detail: 'Use action=health|verify|get_urls|counts|parity|cron_status|export|export_unmapped|export_reconcile|reconcile_services (GET) or action=search|finalize|aggregate_analytics|reconcile_services (POST)' });
  } catch (e) {
    return sendJSON(res, 500, { error: 'server_error', detail: String(e?.message || e) });
  }
}
