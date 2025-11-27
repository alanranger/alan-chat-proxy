const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

// Simulate findServices logic
async function testFindServices() {
  console.log('\n=== Testing findServices with keywords: about, ethics, testimonials ===\n');
  
  const keywords = ['about', 'ethics', 'testimonials'];
  
  // Try the primary query
  let q = client
    .from('page_entities')
    .select('*, csv_metadata!inner(kind, title)')
    .eq('csv_type', 'landing_service_pages')
    .eq('csv_metadata.kind', 'service')
    .order('last_seen', { ascending: false });
  
  // Apply keyword filtering (simplified)
  if (keywords && keywords.length > 0) {
    const conditions = keywords.map(k => `title.ilike.%${k}%,page_url.ilike.%${k}%,url.ilike.%${k}%`).join(',');
    q = q.or(conditions);
  }
  
  const { data, error } = await q.limit(10);
  
  if (error) {
    console.log('Error:', error);
  } else {
    console.log('Found services:', data?.length || 0);
    if (data && data.length > 0) {
      data.forEach(s => {
        console.log(`  - ${s.title} | ${s.page_url || s.url}`);
      });
    }
  }
  
  console.log('\n=== END TEST ===\n');
}

testFindServices().catch(console.error);


