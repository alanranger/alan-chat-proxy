// /api/health.js  (ESM; no runtime config on purpose)
import { createClient } from '@supabase/supabase-js';

const safe = (v) => Boolean(v && String(v).trim());

export default async function handler(req, res) {
  try {
    const env = {
      has_ingest_token: safe(process.env.INGEST_TOKEN),
      has_supabase_url: safe(process.env.SUPABASE_URL),
      has_supabase_service_role_key: safe(process.env.SUPABASE_SERVICE_ROLE_KEY),
      has_supabase_anon_key: safe(process.env.SUPABASE_ANON_KEY),
      embed_provider: safe(process.env.OPENROUTER_API_KEY)
        ? 'openrouter'
        : safe(process.env.OPENAI_API_KEY)
        ? 'openai'
        : 'none'
    };

    let db = { reachable: false, page_chunks_count: null };
    if (env.has_supabase_url && env.has_supabase_service_role_key) {
      try {
        const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { count, error } = await supa
          .from('page_chunks')
          .select('id', { count: 'exact', head: true });
        if (!error) db = { reachable: true, page_chunks_count: count ?? 0 };
        else db = { reachable: false, error: String(error.message || error) };
      } catch (e) {
        db = { reachable: false, error: String(e?.message || e) };
      }
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(JSON.stringify({
      ok: true,
      env,
      db,
      missing: Object.entries(env)
        .filter(([k, v]) => k.startsWith('has_') && v === false)
        .map(([k]) => k.replace(/^has_/, '').toUpperCase())
    }));
  } catch (e) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(500).send(JSON.stringify({ ok:false, error:'health_failed', detail:String(e?.message || e) }));
  }
}
