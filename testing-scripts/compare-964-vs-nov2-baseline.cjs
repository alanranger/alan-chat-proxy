#!/usr/bin/env node

/**
 * Compare test #964 (after fixes) against November 2nd temporary baseline
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';
const BASELINE_TEST_ID = 964;
const NOV2_BASELINE_FILE = path.join(__dirname, 'test results', 'baseline-40-question-interactive-subset-2025-11-02T09-16-08.122Z.json');

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${body.error || res.statusText}`);
  }
  return body;
}

function extractCountsFromResponse(resp) {
  if (!resp) {
    return { articles: 0, services: 0, events: 0, products: 0 };
  }
  
  // Handle both old format (sources) and new format (structured)
  const sources = resp.sources || {};
  const structured = resp.structured || {};

  const articles = (Array.isArray(sources.articles) ? sources.articles : Array.isArray(structured.articles) ? structured.articles : []).length;
  const services = (Array.isArray(sources.services) ? sources.services : Array.isArray(structured.services) ? structured.services : []).length;
  const events = (Array.isArray(sources.events) ? sources.events : Array.isArray(structured.events) ? structured.events : []).length;
  const products = (Array.isArray(sources.products) ? sources.products : Array.isArray(structured.products) ? structured.products : []).length;

  return { articles, services, events, products };
}

function classifyVsBaseline(baseline, current) {
  const b = baseline;
  const c = current;
  const baseTotal = b.articles + b.services + b.events + b.products;
  const currentTotal = c.articles + c.services + c.events + c.products;

  if (baseTotal === 0 && currentTotal === 0) return 'same';
  if (baseTotal === 0 && currentTotal > 0) return 'better';
  if (baseTotal > 0 && currentTotal === 0) return 'worse';

  if (b.events > 0 && c.events === 0) return 'worse';
  if (b.articles > 0 && c.articles === 0) return 'worse';
  if (b.services > 0 && c.services === 0) return 'worse';

  if (currentTotal > baseTotal * 1.2) return 'better';
  if (currentTotal < baseTotal * 0.8) return 'worse';

  const deltas = [
    c.articles - b.articles,
    c.services - b.services,
    c.events - b.events,
    c.products - b.products
  ];
  const hasUp = deltas.some((d) => d > 0);
  const hasDown = deltas.some((d) => d < 0);
  if (hasUp && hasDown) return 'mixed';

  return 'same';
}

async function loadTest964() {
  const url = new URL('/rest/v1/regression_test_results', SUPABASE_URL);
  url.searchParams.set('id', `eq.${BASELINE_TEST_ID}`);
  url.searchParams.set('select', 'results');

  const data = await fetchJson(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.results) {
    throw new Error(`No results found for regression_test_results id=${BASELINE_TEST_ID}`);
  }
  return row.results;
}

async function main() {
  console.log(`Comparing test #${BASELINE_TEST_ID} (after fixes) vs Nov 2 baseline\n`);

  // Load Nov 2 baseline
  const nov2Baseline = JSON.parse(fs.readFileSync(NOV2_BASELINE_FILE, 'utf8'));
  const nov2Results = nov2Baseline.results || [];
  console.log(`Loaded ${nov2Results.length} results from Nov 2 baseline\n`);

  // Load test #964
  const test964Results = await loadTest964();
  console.log(`Loaded ${test964Results.length} results from test #${BASELINE_TEST_ID}\n`);

  // Create maps for comparison
  const nov2Map = new Map();
  for (const r of nov2Results) {
    if (r && r.query) {
      nov2Map.set(String(r.query).toLowerCase(), r);
    }
  }

  const test964Map = new Map();
  for (const r of test964Results) {
    if (r && r.query) {
      test964Map.set(String(r.query).toLowerCase(), r);
    }
  }

  const results = [];
  let betterCount = 0;
  let worseCount = 0;
  let sameCount = 0;
  let mixedCount = 0;

  // Compare each question
  for (let i = 0; i < nov2Results.length; i += 1) {
    const nov2Row = nov2Results[i];
    const query = nov2Row.query;
    const key = String(query || '').toLowerCase();

    const test964Row = test964Map.get(key);
    if (!test964Row) {
      console.log(`Q${i + 1} ⚠️  [MISSING] "${query}" - not found in test #${BASELINE_TEST_ID}`);
      continue;
    }

    const nov2Counts = extractCountsFromResponse(nov2Row.response);
    const test964Counts = extractCountsFromResponse(test964Row.response);
    const status = classifyVsBaseline(nov2Counts, test964Counts);

    if (status === 'better') betterCount++;
    else if (status === 'worse') worseCount++;
    else if (status === 'mixed') mixedCount++;
    else sameCount++;

    const statusIcon = status === 'better' ? '✅' : status === 'worse' ? '❌' : status === 'mixed' ? '⚠️' : '➖';
    console.log(`Q${i + 1} ${statusIcon} [${status.toUpperCase()}] "${query}"`);
    console.log(`  Nov 2:   A${nov2Counts.articles} S${nov2Counts.services} E${nov2Counts.events} P${nov2Counts.products}`);
    console.log(`  Test 964: A${test964Counts.articles} S${test964Counts.services} E${test964Counts.events} P${test964Counts.products}\n`);

    results.push({
      index: i + 1,
      query,
      status,
      nov2: nov2Counts,
      test964: test964Counts
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY: Test #964 (after fixes) vs Nov 2 baseline');
  console.log(`  Better: ${betterCount}`);
  console.log(`  Worse:  ${worseCount}`);
  console.log(`  Mixed:  ${mixedCount}`);
  console.log(`  Same:   ${sameCount}`);
  console.log(`  Total:  ${nov2Results.length}`);
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

