const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load env
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

const BASELINE_TEST_ID = 964;
const CURRENT_TEST_ID = 966;

function extractContentCounts(response) {
  if (!response || !response.structured) {
    return { articles: 0, services: 0, events: 0, products: 0 };
  }
  const s = response.structured;
  return {
    articles: Array.isArray(s.articles) ? s.articles.length : 0,
    services: Array.isArray(s.services) ? s.services.length : 0,
    events: Array.isArray(s.events) ? s.events.length : 0,
    products: Array.isArray(s.products) ? s.products.length : 0
  };
}

function classifyChange(baseline, current) {
  const baselineTotal = baseline.articles + baseline.services + baseline.events + baseline.products;
  const currentTotal = current.articles + current.services + current.events + current.products;
  
  // Check if articles were removed (improvement for Batch 1 fixes)
  const articlesRemoved = baseline.articles > 0 && current.articles === 0;
  const articlesAdded = baseline.articles === 0 && current.articles > 0;
  
  // For Batch 1, we expect articles to be removed for specific queries
  if (articlesRemoved && baselineTotal > currentTotal) {
    return 'better'; // Articles removed is good for these queries
  }
  
  if (articlesAdded && currentTotal > baselineTotal) {
    return 'worse'; // Articles added when they shouldn't be
  }
  
  if (baselineTotal === currentTotal && 
      baseline.articles === current.articles &&
      baseline.services === current.services &&
      baseline.events === current.events) {
    return 'same';
  }
  
  // Check if services/events improved
  const servicesImproved = current.services >= baseline.services && current.events >= baseline.events;
  if (servicesImproved && currentTotal >= baselineTotal) {
    return 'better';
  }
  
  if (currentTotal < baselineTotal && !articlesRemoved) {
    return 'worse';
  }
  
  return 'mixed';
}

async function compareTests() {
  console.log(`Comparing Test #${CURRENT_TEST_ID} (Batch 1 fixes) vs Baseline #${BASELINE_TEST_ID}\n`);
  console.log('='.repeat(80));
  
  // Load both tests
  const { data: baselineData, error: baselineError } = await supabase
    .from('regression_test_results')
    .select('results')
    .eq('id', BASELINE_TEST_ID)
    .single();
    
  if (baselineError) {
    console.error('❌ Error loading baseline:', baselineError);
    process.exit(1);
  }
  
  const { data: currentData, error: currentError } = await supabase
    .from('regression_test_results')
    .select('results')
    .eq('id', CURRENT_TEST_ID)
    .single();
    
  if (currentError) {
    console.error('❌ Error loading current test:', currentError);
    process.exit(1);
  }
  
  const baselineResults = baselineData.results || [];
  const currentResults = currentData.results || [];
  
  // Create maps
  const baselineMap = new Map();
  baselineResults.forEach(r => {
    if (r && r.query) {
      baselineMap.set(String(r.query).toLowerCase(), r);
    }
  });
  
  const currentMap = new Map();
  currentResults.forEach(r => {
    if (r && r.query) {
      currentMap.set(String(r.query).toLowerCase(), r);
    }
  });
  
  // Batch 1 target queries
  const batch1Queries = [
    'do you i get a certificate with the photography course',
    'is the online photography course really free',
    'what courses do you offer for complete beginners?',
    'how do i get personalised feedback on my images',
    'can i hire you as a professional photographer in coventry?',
    'how do i subscribe to the free online photography course?'
  ];
  
  console.log('\n📊 BATCH 1 TARGET QUERIES:\n');
  let better = 0, worse = 0, same = 0, mixed = 0;
  
  for (const query of batch1Queries) {
    const key = query.toLowerCase();
    const baseline = baselineMap.get(key);
    const current = currentMap.get(key);
    
    if (!baseline || !current) {
      console.log(`⚠️  ${query}: Missing data`);
      continue;
    }
    
    const baselineCounts = extractContentCounts(baseline.response);
    const currentCounts = extractContentCounts(current.response);
    const status = classifyChange(baselineCounts, currentCounts);
    
    if (status === 'better') better++;
    else if (status === 'worse') worse++;
    else if (status === 'same') same++;
    else mixed++;
    
    const icon = status === 'better' ? '✅' : status === 'worse' ? '❌' : status === 'same' ? '➖' : '⚠️';
    console.log(`${icon} ${query}`);
    console.log(`   Baseline: A${baselineCounts.articles} S${baselineCounts.services} E${baselineCounts.events}`);
    console.log(`   Current:  A${currentCounts.articles} S${currentCounts.services} E${currentCounts.events}`);
    console.log(`   Status: ${status.toUpperCase()}\n`);
  }
  
  console.log('='.repeat(80));
  console.log(`\nBATCH 1 SUMMARY: Better: ${better}, Worse: ${worse}, Same: ${same}, Mixed: ${mixed}`);
  
  // Check all 40 questions for regressions
  console.log('\n\n📊 ALL 40 QUESTIONS (Checking for regressions):\n');
  let allBetter = 0, allWorse = 0, allSame = 0, allMixed = 0;
  const regressions = [];
  
  for (const [key, baseline] of baselineMap.entries()) {
    const current = currentMap.get(key);
    if (!current) continue;
    
    const baselineCounts = extractContentCounts(baseline.response);
    const currentCounts = extractContentCounts(current.response);
    const status = classifyChange(baselineCounts, currentCounts);
    
    if (status === 'better') allBetter++;
    else if (status === 'worse') allWorse++;
    else if (status === 'same') allSame++;
    else allMixed++;
    
    // Flag regressions (worse changes on non-target queries)
    if (status === 'worse' && !batch1Queries.includes(key)) {
      regressions.push({
        query: baseline.query || key,
        baseline: baselineCounts,
        current: currentCounts
      });
    }
  }
  
  console.log(`OVERALL: Better: ${allBetter}, Worse: ${allWorse}, Same: ${allSame}, Mixed: ${allMixed}`);
  
  if (regressions.length > 0) {
    console.log(`\n⚠️  REGRESSIONS DETECTED (${regressions.length}):`);
    regressions.forEach(r => {
      console.log(`\n  ${r.query}`);
      console.log(`    Baseline: A${r.baseline.articles} S${r.baseline.services} E${r.baseline.events}`);
      console.log(`    Current:  A${r.current.articles} S${r.current.services} E${r.current.events}`);
    });
  } else {
    console.log('\n✅ No regressions detected on non-target queries!');
  }
}

compareTests().catch(console.error);

