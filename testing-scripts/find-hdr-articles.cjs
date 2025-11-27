const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findHdrArticles() {
  console.log('\n=== Searching for HDR/Bracketing articles ===\n');
  
  const hdrTerms = ['hdr', 'bracketing', 'dynamic range', 'exposure bracket', 'histogram'];
  
  for (const term of hdrTerms) {
    const { data, error } = await client
      .from('articles')
      .select('id, title, page_url')
      .or(`title.ilike.%${term}%,page_url.ilike.%${term}%,description.ilike.%${term}%`)
      .limit(5);
    
    if (!error && data && data.length > 0) {
      console.log(`\nArticles with "${term}":`);
      data.forEach(a => {
        console.log(`  - ${a.title} | ${a.page_url}`);
      });
    }
  }
  
  console.log('\n=== END SEARCH ===\n');
}

findHdrArticles().catch(console.error);


