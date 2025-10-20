#!/usr/bin/env node
/**
 * Ingest Phase Baseline Test Script
 * Tests current system state before making changes
 * Run this before and after each change to validate
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testBaseline() {
  console.log('🧪 INGEST PHASE BASELINE TEST');
  console.log('================================');
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  try {
    // Test 1: Database Record Counts
    console.log('\n📊 Test 1: Database Record Counts');
    const { data: counts } = await supabase
      .from('page_entities')
      .select('kind')
      .then(result => {
        const counts = { total: result.data?.length || 0 };
        result.data?.forEach(row => {
          counts[row.kind] = (counts[row.kind] || 0) + 1;
        });
        return { data: counts };
      });
    
    results.tests.recordCounts = counts;
    console.log('✅ Record counts:', counts);

    // Test 2: Category Distribution
    console.log('\n🏷️ Test 2: Category Distribution');
    const { data: categories } = await supabase
      .from('page_entities')
      .select('categories')
      .eq('kind', 'event')
      .not('categories', 'is', null);
    
    const categoryStats = {};
    categories?.forEach(row => {
      if (row.categories && Array.isArray(row.categories)) {
        row.categories.forEach(cat => {
          categoryStats[cat] = (categoryStats[cat] || 0) + 1;
        });
      }
    });
    
    results.tests.categoryDistribution = categoryStats;
    console.log('✅ Category distribution:', categoryStats);

    // Test 3: CSV Metadata Categories
    console.log('\n📋 Test 3: CSV Metadata Categories');
    const { data: csvCategories } = await supabase
      .from('csv_metadata')
      .select('csv_type, categories')
      .not('categories', 'is', null);
    
    const csvCategoryStats = {};
    csvCategories?.forEach(row => {
      if (row.categories && Array.isArray(row.categories)) {
        row.categories.forEach(cat => {
          const key = `${row.csv_type}:${cat}`;
          csvCategoryStats[key] = (csvCategoryStats[key] || 0) + 1;
        });
      }
    });
    
    results.tests.csvCategoryDistribution = csvCategoryStats;
    console.log('✅ CSV category distribution:', csvCategoryStats);

    // Test 4: Event-Product Mapping Issues
    console.log('\n🔗 Test 4: Event-Product Mapping Issues');
    const { data: mappingIssues } = await supabase
      .from('page_entities')
      .select('url, title, price_gbp')
      .eq('kind', 'event')
      .ilike('title', '%fairy glen%')
      .ilike('title', '%betws%');
    
    results.tests.mappingIssues = mappingIssues;
    console.log('✅ Fairy Glen mapping issues:', mappingIssues);

    // Test 5: Missing Categories
    console.log('\n❌ Test 5: Missing Categories');
    const { data: missingCategories } = await supabase
      .from('page_entities')
      .select('url, title, categories')
      .eq('kind', 'event')
      .or('categories.is.null,categories.eq.[]');
    
    results.tests.missingCategories = missingCategories?.length || 0;
    console.log('✅ Events with missing categories:', missingCategories?.length || 0);

    // Test 6: Complexity Check (if available)
    console.log('\n🔍 Test 6: Complexity Check');
    try {
      const { execSync } = await import('child_process');
      const complexityOutput = execSync('npx eslint api/ingest.js --format=json', { encoding: 'utf8' });
      const complexityData = JSON.parse(complexityOutput);
      const complexityIssues = complexityData[0]?.messages?.filter(msg => 
        msg.ruleId === 'sonarjs/cognitive-complexity' && msg.severity === 1
      ) || [];
      
      results.tests.complexityIssues = complexityIssues.length;
      console.log('✅ Complexity issues found:', complexityIssues.length);
    } catch (error) {
      results.tests.complexityIssues = 'Error checking complexity';
      console.log('⚠️ Could not check complexity:', error.message);
    }

    // Save results
    const fs = await import('fs');
    const resultsFile = `results/ingest-baseline-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${resultsFile}`);

    console.log('\n✅ BASELINE TEST COMPLETE');
    return results;

  } catch (error) {
    console.error('❌ Baseline test failed:', error);
    results.error = error.message;
    return results;
  }
}

// Run the test
testBaseline().then(results => {
  console.log('\n📋 SUMMARY:');
  console.log('- Record counts:', results.tests.recordCounts);
  console.log('- Category distribution:', Object.keys(results.tests.categoryDistribution || {}).length, 'categories');
  console.log('- CSV categories:', Object.keys(results.tests.csvCategoryDistribution || {}).length, 'CSV categories');
  console.log('- Missing categories:', results.tests.missingCategories);
  console.log('- Complexity issues:', results.tests.complexityIssues);
  
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});




