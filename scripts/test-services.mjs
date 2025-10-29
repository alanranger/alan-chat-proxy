import { createClient } from '@supabase/supabase-js';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const SUPABASE_URL = requireEnv('SUPABASE_URL');
  const SUPABASE_ANON_KEY = requireEnv('SUPABASE_ANON_KEY');
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

  const limit = 24;
  try {
    // Primary: landing_service_pages joined to csv_metadata.kind = 'service'
    let q = client
      .from('page_entities')
      .select('page_url, title, csv_type, kind, csv_metadata!inner(kind)')
      .eq('csv_type', 'landing_service_pages')
      .eq('csv_metadata.kind', 'service')
      .order('last_seen', { ascending: false })
      .range(0, limit - 1);

    const { data, error } = await q;
    if (error) throw error;

    const list = Array.isArray(data) ? data : [];
    console.log(JSON.stringify({ count: list.length, sample: list.slice(0, 5).map(r => ({ url: r.page_url, title: r.title })) }, null, 2));
  } catch (e) {
    console.error('Query failed:', e.message || e);
    process.exit(2);
  }
}

main();


