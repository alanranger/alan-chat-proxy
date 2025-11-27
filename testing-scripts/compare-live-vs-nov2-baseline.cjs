#!/usr/bin/env node

/**
 * Compare current live /api/chat responses against November 2nd baseline
 * This shows the actual impact of our fixes
 */

const fs = require('fs');
const path = require('path');

const API_ENDPOINT = process.env.API_ENDPOINT || 'https://alan-chat-proxy.vercel.app/api/chat';
const NOV2_BASELINE_FILE = path.join(__dirname, 'test results', 'baseline-40-question-interactive-subset-2025-11-02T09-16-08.122Z.json');

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

async function callChatApi(query, idx) {
  const body = {
    query,
    sessionId: `compare-nov2-${Date.now()}-${idx}`
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
  console.log(`Comparing LIVE API (after fixes) vs Nov 2 baseline (before fixes)`);
  console.log(`Live endpoint: ${API_ENDPOINT}\n`);

  // Load Nov 2 baseline
  const nov2Baseline = JSON.parse(fs.readFileSync(NOV2_BASELINE_FILE, 'utf8'));
  const nov2Results = nov2Baseline.results || [];
  console.log(`Loaded ${nov2Results.length} results from Nov 2 baseline\n`);

  const results = [];
  let betterCount = 0;
  let worseCount = 0;
  let sameCount = 0;
  let mixedCount = 0;
  
  // Track confidence scores
  const nov2Confidences = [];
  const liveConfidences = [];

  // Compare each question
  for (let i = 0; i < nov2Results.length; i += 1) {
    const nov2Row = nov2Results[i];
    const query = nov2Row.query;

    const nov2Counts = extractCountsFromResponse(nov2Row.response);
    const nov2Confidence = typeof nov2Row.response?.confidence === 'number' ? nov2Row.response.confidence : null;
    if (nov2Confidence !== null) nov2Confidences.push(nov2Confidence);
    
    // Call live API
    let liveRow = null;
    try {
      liveRow = await callChatApi(query, i + 1);
    } catch (e) {
      console.error(`Live call failed for Q${i + 1}: ${query}`, e.message);
      continue;
    }

    const liveCounts = extractCountsFromResponse(liveRow?.response);
    const liveConfidence = typeof liveRow?.response?.confidence === 'number' ? liveRow.response.confidence : null;
    if (liveConfidence !== null) liveConfidences.push(liveConfidence);
    
    const status = classifyVsBaseline(nov2Counts, liveCounts);

    if (status === 'better') betterCount++;
    else if (status === 'worse') worseCount++;
    else if (status === 'mixed') mixedCount++;
    else sameCount++;

    const statusIcon = status === 'better' ? '✅' : status === 'worse' ? '❌' : status === 'mixed' ? '⚠️' : '➖';
    const confStr = nov2Confidence !== null && liveConfidence !== null 
      ? ` (Conf: ${(nov2Confidence * 100).toFixed(0)}% → ${(liveConfidence * 100).toFixed(0)}%)`
      : '';
    console.log(`Q${i + 1} ${statusIcon} [${status.toUpperCase()}] "${query}"${confStr}`);
    console.log(`  Nov 2:   A${nov2Counts.articles} S${nov2Counts.services} E${nov2Counts.events} P${nov2Counts.products}`);
    console.log(`  Live:    A${liveCounts.articles} S${liveCounts.services} E${liveCounts.events} P${liveCounts.products}\n`);

    results.push({
      index: i + 1,
      query,
      status,
      nov2: nov2Counts,
      live: liveCounts,
      nov2Confidence,
      liveConfidence
    });

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Calculate average confidence
  const nov2AvgConf = nov2Confidences.length > 0 
    ? nov2Confidences.reduce((a, b) => a + b, 0) / nov2Confidences.length 
    : null;
  const liveAvgConf = liveConfidences.length > 0
    ? liveConfidences.reduce((a, b) => a + b, 0) / liveConfidences.length
    : null;
  const confDelta = nov2AvgConf !== null && liveAvgConf !== null
    ? liveAvgConf - nov2AvgConf
    : null;

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY: Live API (after fixes) vs Nov 2 baseline (before fixes)');
  console.log(`  Better: ${betterCount}`);
  console.log(`  Worse:  ${worseCount}`);
  console.log(`  Mixed:  ${mixedCount}`);
  console.log(`  Same:   ${sameCount}`);
  console.log(`  Total:  ${nov2Results.length}`);
  if (nov2AvgConf !== null && liveAvgConf !== null) {
    console.log(`\n  CONFIDENCE SCORES:`);
    console.log(`  Nov 2 baseline avg: ${(nov2AvgConf * 100).toFixed(1)}%`);
    console.log(`  Live API avg:      ${(liveAvgConf * 100).toFixed(1)}%`);
    console.log(`  Difference:        ${confDelta >= 0 ? '+' : ''}${(confDelta * 100).toFixed(1)}%`);
  }
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

