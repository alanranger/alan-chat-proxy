#!/usr/bin/env node

/**
 * Compare current live /api/chat responses against baseline test #964
 * Shows better/worse/same status for each question
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';
const API_ENDPOINT = process.env.API_ENDPOINT || 'https://alan-chat-proxy.vercel.app/api/chat';
const BASELINE_TEST_ID = 878; // Nov 21 baseline (before our fixes)

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  let body = null;
  try {
    body = await res.json();
  } catch {
    // ignore JSON parse error
  }
  if (!res.ok) {
    const msg = body && body.error ? body.error : res.statusText;
    throw new Error(`HTTP ${res.status} for ${url}: ${msg}`);
  }
  return body;
}

function extractCountsFromResponse(resp) {
  if (!resp) {
    return {
      type: null,
      status: null,
      confidence: null,
      counts: { articles: 0, services: 0, events: 0, products: 0 }
    };
  }
  const structured = resp.structured || {};
  const sources = resp.sources || {};

  const articles = (Array.isArray(sources.articles) ? sources.articles : Array.isArray(structured.articles) ? structured.articles : []).length;
  const services = (Array.isArray(sources.services) ? sources.services : Array.isArray(structured.services) ? structured.services : []).length;
  const events = (Array.isArray(sources.events) ? sources.events : Array.isArray(structured.events) ? structured.events : []).length;
  const products = (Array.isArray(sources.products) ? sources.products : Array.isArray(structured.products) ? structured.products : []).length;

  return {
    type: resp.type || null,
    status: resp.status ?? null,
    confidence: typeof resp.confidence === 'number' ? resp.confidence : null,
    counts: { articles, services, events, products }
  };
}

function classifyVsBaseline(baseline, current) {
  const b = baseline.counts;
  const c = current.counts;
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

async function loadBaselineResults(testId) {
  const url = new URL('/rest/v1/regression_test_results', SUPABASE_URL);
  url.searchParams.set('id', `eq.${testId}`);
  url.searchParams.set('select', 'results');

  const data = await fetchJson(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.results) {
    throw new Error(`No results found for regression_test_results id=${testId}`);
  }
  return row.results;
}

async function callChatApi(query, idx) {
  const body = {
    query,
    sessionId: `compare-964-${Date.now()}-${idx}`
  };
  const res = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // ignore parse error
  }
  return { status: res.status, response: json || {} };
}

async function main() {
  console.log(`Comparing live API against baseline test #${BASELINE_TEST_ID} (Nov 21 - BEFORE fixes)`);
  console.log(`Live endpoint: ${API_ENDPOINT}\n`);

  const baselineResults = await loadBaselineResults(BASELINE_TEST_ID);
  console.log(`Loaded ${baselineResults.length} baseline results from test #${BASELINE_TEST_ID}\n`);

  const baselineMap = new Map();
  for (const r of baselineResults) {
    if (r && r.query) {
      baselineMap.set(String(r.query).toLowerCase(), r);
    }
  }

  const results = [];
  let betterCount = 0;
  let worseCount = 0;
  let sameCount = 0;
  let mixedCount = 0;

  for (let i = 0; i < baselineResults.length; i += 1) {
    const baseRow = baselineResults[i];
    const query = baseRow.query;
    const key = String(query || '').toLowerCase();

    const baselineSummary = extractCountsFromResponse(baseRow.response);
    
    // Call live API
    let liveRow = null;
    try {
      liveRow = await callChatApi(query, i + 1);
    } catch (e) {
      console.error(`Live call failed for Q${i + 1}: ${query}`, e.message);
    }

    const liveSummary = extractCountsFromResponse(liveRow?.response);
    const status = classifyVsBaseline(baselineSummary, liveSummary);

    if (status === 'better') betterCount++;
    else if (status === 'worse') worseCount++;
    else if (status === 'mixed') mixedCount++;
    else sameCount++;

    const statusIcon = status === 'better' ? '✅' : status === 'worse' ? '❌' : status === 'mixed' ? '⚠️' : '➖';
    console.log(`Q${i + 1} ${statusIcon} [${status.toUpperCase()}] "${query}"`);
    console.log(`  Baseline: A${baselineSummary.counts.articles} S${baselineSummary.counts.services} E${baselineSummary.counts.events} P${baselineSummary.counts.products}`);
    console.log(`  Live:     A${liveSummary.counts.articles} S${liveSummary.counts.services} E${liveSummary.counts.events} P${liveSummary.counts.products}\n`);

    results.push({
      index: i + 1,
      query,
      status,
      baseline: baselineSummary,
      live: liveSummary
    });

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY:');
  console.log(`  Better: ${betterCount}`);
  console.log(`  Worse:  ${worseCount}`);
  console.log(`  Mixed:  ${mixedCount}`);
  console.log(`  Same:   ${sameCount}`);
  console.log(`  Total:  ${baselineResults.length}`);
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

