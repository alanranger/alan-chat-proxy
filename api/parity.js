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

  async function distinctCount(table, pathPattern) {
    const { data, error } = await supabase
      .from(table)
      .select('url', { count: 'exact' })
      .ilike('url', `*${pathPattern}*`);
    if (error) throw error;
    const urls = new Set((data || []).map(r => r.url));
    return urls.size;
  }

  try {
    const entitiesWorkshops = await distinctCount('page_entities', 'photographic-workshops-near-me');
    const chunksWorkshops   = await distinctCount('page_chunks',    'photographic-workshops-near-me');
    const entitiesCourses   = await distinctCount('page_entities', 'beginners-photography-lessons');
    const chunksCourses     = await distinctCount('page_chunks',    'beginners-photography-lessons');
    return res.status(200).json({ ok:true, entitiesWorkshops, chunksWorkshops, entitiesCourses, chunksCourses });
  } catch (e) {
    return res.status(500).json({ ok:false, error:'server_error', detail:String(e?.message||e) });
  }
}


