import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const EXPECTED_TOKEN = (process.env.INGEST_TOKEN || '').trim() || 'b6c3f0c9e6f44cce9e1a4f3f2d3a5c76';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || token !== EXPECTED_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const { count: total, error: e1 } = await supabase
      .from('v_events_for_chat')
      .select('*', { count: 'exact', head: true });
    if (e1) throw e1;

    const { count: mapped, error: e2 } = await supabase
      .from('v_events_for_chat')
      .select('*', { count: 'exact', head: true })
      .not('product_url', 'is', null);
    if (e2) throw e2;

    return res.status(200).json({ ok: true, total: total || 0, mapped: mapped || 0 });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'server_error', detail: String(e?.message || e) });
  }
}


