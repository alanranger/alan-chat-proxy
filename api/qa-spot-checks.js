import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_KEY; // service key for server-side read
const EXPECTED_TOKEN = process.env.INGEST_TOKEN || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    { name: 'v_event_product_links_real', type: 'view', columns: '*', order: 'specificity', limit: 5 },
    { name: 'v_event_product_pricing_real', type: 'view', columns: '*', order: 'price_gbp', limit: 5 },

    { name: 'v_events_csv_source', type: 'view', columns: '*', order: 'date_start', limit: 5 },
    { name: 'v_products_scraped', type: 'view', columns: '*', order: 'last_seen', limit: 5 },

    { name: 'v_event_product_mappings', type: 'view', columns: 'event_url, product_url, method, specificity, score', order: 'score', limit: 10 },
    { name: 'v_event_product_pricing_combined', type: 'view', columns: '*', order: 'price_gbp', limit: 5 },

    { name: 'v_blog_content', type: 'view', columns: 'url, title, tags', order: 'url', limit: 5 },
    { name: 'v_workshop_content', type: 'view', columns: 'url, title, tags', order: 'url', limit: 5 },
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

  const results = {};
  for (const c of checks) {
    const entry = { name: c.name };
    entry.count = await safeCount(c.name);
    entry.sample = await safeSample(c.name, c.columns, c.order, c.limit);
    results[c.name] = entry;
  }

  return res.status(200).json({ ok: true, results });
}
