// /api/admin.js
// Consolidated admin utilities
// Handles QA spot checks and data refresh operations
// Replaces: qa-spot-checks.js, refresh-mappings.js

import { createClient } from '@supabase/supabase-js';

// Prefer environment variables set in the deployment; fall back only if missing
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
// Match the hardcoded UI token as a fallback so the button works
const EXPECTED_TOKEN = (process.env.INGEST_TOKEN || '').trim() || 'b6c3f0c9e6f44cce9e1a4f3f2d3a5c76';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Authentication
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || token !== EXPECTED_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { action } = req.query || {};

  // QA Spot Checks (GET /api/admin?action=qa)
  if (req.method === 'GET' && action === 'qa') {
    const checks = [
      { name: 'page_entities', type: 'table', columns: 'url, kind, title, date_start, date_end, location, price', order: 'date_start', limit: 5 },
      { name: 'page_chunks', type: 'table', columns: 'url, tokens', order: 'tokens', limit: 3 },
      { name: 'event_product_links_auto', type: 'table', columns: 'event_url, product_url, score, method', order: 'score', limit: 10 },

      // Views (some may not exist in every environment)
      { name: 'v_events_real_data', type: 'view', columns: '*', order: 'date_start', limit: 5 },
      { name: 'v_event_product_final', type: 'view', columns: 'event_url, product_url, product_title, price_gbp, availability, start_time, end_time', order: 'event_url', limit: 5 },
      { name: 'v_event_product_final_enhanced', type: 'view', columns: 'event_url, product_url, product_title, price_gbp, availability, start_time, end_time, event_location, participants, fitness_level, event_title', order: 'event_url', limit: 5 },
      { name: 'v_events_for_chat', type: 'view', columns: '*', order: 'date_start', limit: 5 },

      { name: 'v_events_csv_source', type: 'view', columns: '*', order: 'date_start', limit: 5 },
      { name: 'v_products_scraped', type: 'view', columns: '*', order: 'last_seen', limit: 5 },
      
      // Legacy or optional views (ignore if missing)
      { name: 'v_event_product_mappings', type: 'view', columns: 'event_url, product_url, method, specificity, score', order: 'score', limit: 10 },
      { name: 'v_event_product_pricing_combined', type: 'view', columns: '*', order: 'price_gbp', limit: 5 },

      { name: 'v_blog_content', type: 'view', columns: 'url, title, tags', order: 'url', limit: 5 },
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

  // Refresh Mappings (POST /api/admin?action=refresh)
  if (req.method === 'POST' && action === 'refresh') {
    try {
      // Attempt to raise statement timeout for this session (best-effort)
      try {
        await supabase.rpc('set_config', { parameter: 'statement_timeout', value: '120000', is_local: true });
      } catch {}

      // Get current count before refresh
      const { data: beforeData, error: beforeError } = await supabase
        .from('event_product_links_auto')
        .select('*', { count: 'exact', head: true });

      if (beforeError) {
        console.error('Error getting before count:', beforeError);
        return res.status(500).json({ 
          error: 'Failed to get before count', 
          detail: beforeError.message 
        });
      }

      const beforeCount = beforeData?.length || 0;

      // Call the refresh function directly
      console.log('Calling refresh_event_product_autolinks function...');
      const { data: refreshData, error: refreshError } = await supabase
        .rpc('refresh_event_product_autolinks');

      if (refreshError) {
        console.error('Error calling refresh function:', refreshError);
        return res.status(500).json({ 
          error: 'Failed to refresh mappings', 
          detail: refreshError.message,
          code: refreshError.code,
          hint: refreshError.hint
        });
      }

      console.log('Refresh function completed successfully');

      // Get count after refresh
      const { data: afterData, error: afterError } = await supabase
        .from('event_product_links_auto')
        .select('*', { count: 'exact', head: true });

      if (afterError) {
        console.error('Error getting after count:', afterError);
        return res.status(500).json({ 
          error: 'Failed to get after count', 
          detail: afterError.message 
        });
      }

      const afterCount = afterData?.length || 0;
      const mappingsCreated = afterCount - beforeCount;

      // Get some sample mappings to show what was created
      const { data: sampleMappings, error: sampleError } = await supabase
        .from('event_product_links_auto')
        .select('event_url, product_url, score, method')
        .order('score', { ascending: false })
        .limit(5);

      if (sampleError) {
        console.error('Error getting sample mappings:', sampleError);
      }

      return res.status(200).json({
        ok: true,
        message: 'Event-product mappings refreshed successfully',
        beforeCount,
        afterCount,
        mappingsCreated,
        sampleMappings: sampleMappings || []
      });

    } catch (error) {
      console.error('Unexpected error in refresh-mappings:', error);
      return res.status(500).json({ 
        error: 'Internal server error', 
        detail: error.message 
      });
    }
  } else if (action === 'cron_status') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed for cron_status action' });
    }
    try {
      const { data: cronJobs, error: cronError } = await supabase
        .rpc('get_cron_jobs');

      if (cronError) {
        console.error('Error getting cron jobs:', cronError);
        return res.status(500).json({ 
          error: 'Failed to get cron jobs', 
          detail: cronError.message 
        });
      }

      return res.status(200).json({
        ok: true,
        cron_jobs: cronJobs || []
      });

    } catch (error) {
      console.error('Unexpected error in cron status check:', error);
      return res.status(500).json({ 
        error: 'Internal server error', 
        detail: error.message 
      });
    }
  } else if (action === 'aggregate_analytics') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed for aggregate_analytics action' });
    }
    try {
      const { date } = req.body || {};
      const targetDate = date || new Date().toISOString().split('T')[0];

      console.log('Running analytics aggregation for date:', targetDate);
      
      const { data: aggData, error: aggError } = await supabase
        .rpc('aggregate_daily_analytics', { target_date: targetDate });

      if (aggError) {
        console.error('Error running analytics aggregation:', aggError);
        return res.status(500).json({ 
          error: 'Failed to aggregate analytics', 
          detail: aggError.message 
        });
      }

      console.log('Analytics aggregation completed successfully');

      const { data: updateData, error: updateError } = await supabase
        .rpc('update_question_frequency');

      if (updateError) {
        console.error('Error updating question frequency:', updateError);
        return res.status(500).json({ 
          error: 'Failed to update question frequency', 
          detail: updateError.message 
        });
      }

      return res.status(200).json({
        ok: true,
        message: 'Analytics aggregation completed successfully',
        date: targetDate,
        aggregationResult: aggData,
        frequencyUpdateResult: updateData
      });

    } catch (error) {
      console.error('Unexpected error in analytics aggregation:', error);
      return res.status(500).json({ 
        error: 'Internal server error', 
        detail: error.message 
      });
    }
  }

  // Default response
  return res.status(400).json({ 
    error: 'bad_request', 
    detail: 'Use ?action=qa for spot checks, ?action=refresh for mapping refresh, or ?action=aggregate_analytics for analytics aggregation' 
  });
}
