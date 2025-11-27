const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFiles = ['.env.local', '.env', '.env.production'];
for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    require('dotenv').config({ path: envFile });
    break;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkQueries() {
  const { data, error } = await supabase
    .from('regression_test_results')
    .select('results')
    .eq('id', 966)
    .single();
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  const results = data.results || [];
  console.log(`Found ${results.length} results in test 966\n`);
  
  // List all queries to find Batch 1 ones
  console.log('All queries in test 966:\n');
  results.forEach((r, idx) => {
    if (!r || !r.query) return;
    const q = String(r.query).toLowerCase();
    
    // Check if it's a Batch 1 query
    const isBatch1 = q.includes('certificate') || 
                     q.includes('really free') ||
                     q.includes('courses do you offer') ||
                     q.includes('personalised feedback') ||
                     q.includes('personalized feedback') ||
                     (q.includes('hire') && q.includes('photographer') && q.includes('coventry')) ||
                     (q.includes('subscribe') && q.includes('free') && q.includes('course'));
    
    const counts = {
      articles: (r.response?.structured?.articles || []).length,
      services: (r.response?.structured?.services || []).length,
      events: (r.response?.structured?.events || []).length
    };
    
    const marker = isBatch1 ? '🎯' : '  ';
    console.log(`${marker} ${idx + 1}. "${r.query}"`);
    console.log(`     A${counts.articles} S${counts.services} E${counts.events}\n`);
  });
}

checkQueries().catch(console.error);

