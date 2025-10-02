import { createClient } from '@supabase/supabase-js';

// Prefer server-side envs, with safe fallbacks so endpoint never 500s because of undefined env
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const EXPECTED_TOKEN = (process.env.INGEST_TOKEN || '').trim() || 'b6c3f0c9e6f44cce9e1a4f3f2d3a5c76';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || token !== EXPECTED_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const checks = [
    { name: 'page_entities', type: 'table', columns: 'url, kind, title, date_start, date_end, location, price', order: 'date_start', limit: 5 },
    { name: 'page_chunks', type: 'table', columns: 'url, tokens', order: 'tokens', limit: 3 },
    { name: 'event_product_links_auto', type: 'table', columns: 'event_url, product_url, score, method', order: 'score', limit: 10 },

    // Views (some may not exist in every environment)
    { name: 'v_events_real_data', type: 'view', columns: '*', order: 'date_start', limit: 5 },
    { name: 'v_event_product_final', type: 'view', columns: 'event_url, product_url, product_title, price_gbp, availability, start_time, end_time', order: 'event_url', limit: 5 },
    { name: 'v_event_product_final_enhanced', type: 'view', columns: 'event_url, product_url, product_title, price_gbp, availability, start_time, end_time, event_location, participants, fitness_level, event_title', order: 'event_url', limit: 5 },

    { name: 'v_events_csv_source', type: 'view', columns: '*', order: 'date_start', limit: 5 },
    { name: 'v_products_scraped', type: 'view', columns: '*', order: 'last_seen', limit: 5 },
    
    // Legacy or optional views (ignore if missing)
    { name: 'v_event_product_mappings', type: 'view', columns: 'event_url, product_url, method, specificity, score', order: 'score', limit: 10 },
    { name: 'v_event_product_pricing_combined', type: 'view', columns: '*', order: 'price_gbp', limit: 5 },

    { name: 'v_blog_content', type: 'view', columns: 'url, title, tags', order: 'url', limit: 5 },
    // { name: 'v_workshop_content', type: 'view', columns: 'url, title, tags', order: 'url', limit: 5 },
    { name: 'v_service_content', type: 'view', columns: 'url, title, tags', order: 'url', limit: 5 },
    { name: 'v_product_content', type: 'view', columns: 'url, title, tags', order: 'url', limit: 5 },
    { name: 'v_enriched_content_for_ai', type: 'view', columns: 'url, kind, title', order: 'url', limit: 10 }
  ];

  async function safeCount(name) {
    try {
      const { error, count } = await supabase.from(name).select('*', { count: 'exact', head: true });
      if (error) return { error: error.message };
      return { count: count ?? 0 };
    } catch (e) {
      return { error: String(e.message || e) };
    }
  }

  async function safeSample(name, columns, order, limit) {
    try {
      const q = supabase.from(name).select(columns).limit(limit);
      if (order) q.order(order, { ascending: true, nullsFirst: false });
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { sample: data || [] };
    } catch (e) {
      return { error: String(e.message || e) };
    }
  }

  const out = {};
  for (const c of checks) {
    const cnt = await safeCount(c.name);
    const sam = await safeSample(c.name, c.columns, c.order, c.limit);
    if (cnt.error) out[c.name] = { status: 'error', detail: cnt.error };
    else out[c.name] = { status: 'ok', count: cnt.count, sample: sam.sample || [] };
  }

  return res.status(200).json({ ok: true, checks: out });
}
