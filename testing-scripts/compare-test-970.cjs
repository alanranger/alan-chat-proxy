#!/usr/bin/env node

/**
 * Compare test #970 (after fixes) against master baseline
 */

const fs = require('fs');
const path = require('path');

// Try multiple env file locations
const envFiles = ['.env.local', '.env', '.env.production'];
for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    require('dotenv').config({ path: envFile });
    break;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getMasterBaseline() {
  const { data, error } = await supabase
    .from('regression_test_results')
    .select('id, test_phase, created_at, question_set_version')
    .eq('is_fixed_baseline', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error || !data) {
    console.error('❌ Error fetching master baseline:', error);
    return null;
  }
  
  return data;
}

async function getTestResults(testId) {
  const { data, error } = await supabase
    .from('regression_test_results')
    .select('results')
    .eq('id', testId)
    .single();
  
  if (error || !data) {
    console.error(`❌ Error fetching test ${testId}:`, error);
    return null;
  }
  
  return data.results;
}

function extractCounts(response) {
  if (!response) return { articles: 0, services: 0, events: 0, products: 0 };
  const structured = response.structured || {};
  return {
    articles: (structured.articles || []).length,
    services: (structured.services || []).length,
    events: (structured.events || []).length,
    products: (structured.products || []).length
  };
}

function classifyChange(baseline, after) {
  const baselineCounts = extractCounts(baseline);
  const afterCounts = extractCounts(after);
  
  const baselineTotal = baselineCounts.articles + baselineCounts.services + baselineCounts.events + baselineCounts.products;
  const afterTotal = afterCounts.articles + afterCounts.services + afterCounts.events + afterCounts.products;
  
  // Check if articles were removed (good for queries that shouldn't have articles)
  const articlesRemoved = baselineCounts.articles > 0 && afterCounts.articles === 0;
  const articlesAdded = baselineCounts.articles === 0 && afterCounts.articles > 0;
  
  // Check if correct services/landing pages were added
  const servicesImproved = afterCounts.services > baselineCounts.services;
  const eventsImproved = afterCounts.events > baselineCounts.events;
  
  if (articlesRemoved && (servicesImproved || eventsImproved)) {
    return 'better';
  }
  if (articlesAdded && baselineCounts.articles === 0) {
    return 'worse';
  }
  if (afterTotal > baselineTotal) {
    return 'better';
  }
  if (afterTotal < baselineTotal) {
    return 'worse';
  }
  return 'same';
}

async function compareTests() {
  console.log('📊 Comparing Test #970 against Master Baseline\n');
  
  const baseline = await getMasterBaseline();
  if (!baseline) {
    console.error('❌ Could not find master baseline');
    process.exit(1);
  }
  
  console.log(`📌 Master Baseline: Test #${baseline.id} (${baseline.test_phase}, created ${baseline.created_at})`);
  console.log(`📌 After Test: Test #970\n`);
  
  const baselineResults = await getTestResults(baseline.id);
  const afterResults = await getTestResults(970);
  
  if (!baselineResults || !afterResults) {
    console.error('❌ Could not fetch test results');
    process.exit(1);
  }
  
  console.log(`\n🔍 Debug: Baseline results type: ${typeof baselineResults}, isArray: ${Array.isArray(baselineResults)}`);
  console.log(`🔍 Debug: After results type: ${typeof afterResults}, isArray: ${Array.isArray(afterResults)}`);
  
  if (Array.isArray(baselineResults)) {
    console.log(`🔍 Debug: Baseline results length: ${baselineResults.length}`);
    if (baselineResults.length > 0) {
      console.log(`🔍 Debug: First baseline result keys: ${Object.keys(baselineResults[0]).join(', ')}`);
    }
  }
  
  if (Array.isArray(afterResults)) {
    console.log(`🔍 Debug: After results length: ${afterResults.length}`);
    if (afterResults.length > 0) {
      console.log(`🔍 Debug: First after result keys: ${Object.keys(afterResults[0]).join(', ')}`);
    }
  }
  
  const baselineMap = new Map();
  if (Array.isArray(baselineResults)) {
    baselineResults.forEach(r => {
      const question = r.question || r.query || r.text || 'Unknown';
      baselineMap.set(question, r);
    });
  }
  
  const afterMap = new Map();
  if (Array.isArray(afterResults)) {
    afterResults.forEach(r => {
      const question = r.question || r.query || r.text || 'Unknown';
      afterMap.set(question, r);
    });
  }
  
  const changes = {
    better: [],
    worse: [],
    same: [],
    missing: []
  };
  
  let totalConfidenceBaseline = 0;
  let totalConfidenceAfter = 0;
  let confidenceCount = 0;
  
  // Compare questions that exist in both
  afterMap.forEach((after, question) => {
    const baseline = baselineMap.get(question);
    if (!baseline) {
      changes.missing.push({ 
        question, 
        reason: 'New question in 68Q set',
        after: extractCounts(after.response),
        afterConfidence: after.response?.confidence || 0
      });
      return;
    }
    
    const change = classifyChange(baseline.response, after.response);
    changes[change].push({
      question,
      baseline: extractCounts(baseline.response),
      after: extractCounts(after.response),
      baselineConfidence: baseline.response?.confidence || 0,
      afterConfidence: after.response?.confidence || 0
    });
    
    if (baseline.response?.confidence !== undefined && after.response?.confidence !== undefined) {
      totalConfidenceBaseline += baseline.response.confidence;
      totalConfidenceAfter += after.response.confidence;
      confidenceCount++;
    }
  });
  
  console.log('='.repeat(80));
  console.log('COMPARISON RESULTS');
  console.log('='.repeat(80));
  console.log(`\n✅ Better: ${changes.better.length}`);
  console.log(`❌ Worse: ${changes.worse.length}`);
  console.log(`➖ Same: ${changes.same.length}`);
  console.log(`🆕 New questions (not in baseline): ${changes.missing.length}`);
  
  if (confidenceCount > 0) {
    const avgBaseline = totalConfidenceBaseline / confidenceCount;
    const avgAfter = totalConfidenceAfter / confidenceCount;
    console.log(`\n📊 Average Confidence:`);
    console.log(`   Baseline: ${(avgBaseline * 100).toFixed(1)}%`);
    console.log(`   After: ${(avgAfter * 100).toFixed(1)}%`);
    console.log(`   Change: ${((avgAfter - avgBaseline) * 100).toFixed(1)}%`);
  }
  
  if (changes.better.length > 0) {
    console.log(`\n✅ BETTER (${changes.better.length}):`);
    changes.better.slice(0, 10).forEach(({ question, baseline: b, after: a, baselineConfidence, afterConfidence }) => {
      const q = question || 'Unknown question';
      console.log(`   "${q.length > 60 ? q.substring(0, 60) + '...' : q}"`);
      console.log(`      Baseline: ${b.articles}A ${b.services}S ${b.events}E | Confidence: ${(baselineConfidence * 100).toFixed(0)}%`);
      console.log(`      After:    ${a.articles}A ${a.services}S ${a.events}E | Confidence: ${(afterConfidence * 100).toFixed(0)}%`);
    });
    if (changes.better.length > 10) {
      console.log(`   ... and ${changes.better.length - 10} more`);
    }
  }
  
  if (changes.worse.length > 0) {
    console.log(`\n❌ WORSE (${changes.worse.length}):`);
    changes.worse.slice(0, 10).forEach(({ question, baseline: b, after: a, baselineConfidence, afterConfidence }) => {
      const q = question || 'Unknown question';
      console.log(`   "${q.length > 60 ? q.substring(0, 60) + '...' : q}"`);
      console.log(`      Baseline: ${b.articles}A ${b.services}S ${b.events}E | Confidence: ${(baselineConfidence * 100).toFixed(0)}%`);
      console.log(`      After:    ${a.articles}A ${a.services}S ${a.events}E | Confidence: ${(afterConfidence * 100).toFixed(0)}%`);
    });
    if (changes.worse.length > 10) {
      console.log(`   ... and ${changes.worse.length - 10} more`);
    }
  }
  
  if (changes.missing.length > 0 && changes.missing.length <= 30) {
    console.log(`\n🆕 NEW QUESTIONS (${changes.missing.length}):`);
    changes.missing.forEach(({ question, after: a, afterConfidence }) => {
      const q = question || 'Unknown question';
      console.log(`   "${q.length > 70 ? q.substring(0, 70) + '...' : q}"`);
      console.log(`      After: ${a.articles}A ${a.services}S ${a.events}E | Confidence: ${(afterConfidence * 100).toFixed(0)}%`);
    });
  } else if (changes.missing.length > 30) {
    console.log(`\n🆕 NEW QUESTIONS (${changes.missing.length} - showing first 10):`);
    changes.missing.slice(0, 10).forEach(({ question, after: a, afterConfidence }) => {
      const q = question || 'Unknown question';
      console.log(`   "${q.length > 70 ? q.substring(0, 70) + '...' : q}"`);
      console.log(`      After: ${a.articles}A ${a.services}S ${a.events}E | Confidence: ${(afterConfidence * 100).toFixed(0)}%`);
    });
    console.log(`   ... and ${changes.missing.length - 10} more new questions`);
  }
  
  console.log(`\n📋 Total questions: ${baselineMap.size} in baseline (40Q), ${afterMap.size} in after test (68Q)`);
  console.log(`📋 Overlapping questions compared: ${changes.better.length + changes.worse.length + changes.same.length}`);
  
  console.log('\n' + '='.repeat(80));
}

compareTests().catch(console.error);

