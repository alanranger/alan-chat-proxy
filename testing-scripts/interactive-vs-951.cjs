#!/usr/bin/env node

/**
 * Compare the last interactive-testing baseline (2025-11-02T09:16:08.122Z)
 * against:
 *   1) Live /api/chat responses now
 *   2) Regression test #951 stored in Supabase
 *
 * Outputs:
 *   - Console summary per question (status vs baseline)
 *   - Detailed JSON report in testing-scripts/test results/interactive-vs-951-<timestamp>.json
 *
 * You can run this locally with:
 *   cd "G:\Dropbox\alan ranger photography\Website Code\Chat AI Bot"
 *   node testing-scripts/interactive-vs-951.cjs
 *
 * Optional env overrides:
 *   API_ENDPOINT          - chat API endpoint (default: https://alan-chat-proxy.vercel.app/api/chat)
 *   SUPABASE_URL          - Supabase URL
 *   SUPABASE_ANON_KEY     - Supabase anon key
 *   REGRESSION_TEST_ID    - regression_test_results.id to compare against (default: 951)
 */

const fs = require('fs');
const path = require('path');

const API_ENDPOINT =
  process.env.API_ENDPOINT || 'https://alan-chat-proxy.vercel.app/api/chat';

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://igzvwbvgvmzvvzoclufx.supabase.co';

// This is the same anon key already used in regression-comparison.html
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const REGRESSION_TEST_ID = Number(
  process.env.REGRESSION_TEST_ID || '951'
);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY.');
  process.exit(1);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  let body = null;
  try {
    body = await res.json();
  } catch {
    // ignore JSON parse error here; caller will check res.ok
  }
  if (!res.ok) {
    const msg = body && body.error ? body.error : res.statusText;
    throw new Error(`HTTP ${res.status} for ${url}: ${msg}`);
  }
  return body;
}

function extractCountsFromWrapped(row) {
  if (!row) {
    return {
      type: null,
      status: null,
      confidence: null,
      counts: { articles: 0, services: 0, events: 0, products: 0 }
    };
  }
  const resp = row.response || {};
  const status = row.status ?? resp.status ?? null;

  const sources = resp.sources || {};
  const structured = resp.structured || {};

  const articles =
    (Array.isArray(sources.articles)
      ? sources.articles
      : Array.isArray(structured.articles)
      ? structured.articles
      : []
    ).length;
  const services =
    (Array.isArray(sources.services)
      ? sources.services
      : Array.isArray(structured.services)
      ? structured.services
      : []
    ).length;
  const events =
    (Array.isArray(sources.events)
      ? sources.events
      : Array.isArray(structured.events)
      ? structured.events
      : []
    ).length;
  const products =
    (Array.isArray(sources.products)
      ? sources.products
      : Array.isArray(structured.products)
      ? structured.products
      : []
    ).length;

  return {
    type: resp.type || null,
    status,
    confidence:
      typeof resp.confidence === 'number' ? resp.confidence : null,
    counts: { articles, services, events, products }
  };
}

function classifyVsBaseline(baseline, other) {
  const b = baseline.counts;
  const o = other.counts;
  const baseTotal =
    b.articles + b.services + b.events + b.products;
  const otherTotal =
    o.articles + o.services + o.events + o.products;

  // If both empty, treat as same
  if (baseTotal === 0 && otherTotal === 0) return 'same';

  // If baseline had nothing but now we have content, that's better
  if (baseTotal === 0 && otherTotal > 0) return 'better';

  // If baseline had content and now has nothing, that's clearly worse
  if (baseTotal > 0 && otherTotal === 0) return 'worse';

  // Strong signals per type (your main concern)
  if (b.events > 0 && o.events === 0) return 'worse';
  if (b.articles > 0 && o.articles === 0) return 'worse';
  if (b.services > 0 && o.services === 0) return 'worse';

  // Overall volume shifts
  if (otherTotal > baseTotal * 1.2) return 'better';
  if (otherTotal < baseTotal * 0.8) return 'worse';

  // If some types went up and some down, call it mixed
  const deltas = [
    o.articles - b.articles,
    o.services - b.services,
    o.events - b.events,
    o.products - b.products
  ];
  const hasUp = deltas.some((d) => d > 0);
  const hasDown = deltas.some((d) => d < 0);
  if (hasUp && hasDown) return 'mixed';

  // Otherwise treat as same
  return 'same';
}

async function loadRegressionResults(testId) {
  const url = new URL(
    '/rest/v1/regression_test_results',
    SUPABASE_URL
  );
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
    throw new Error(
      `No results found for regression_test_results id=${testId}`
    );
  }
  return row.results;
}

async function callChat(query, idx) {
  const body = {
    query,
    sessionId: `interactive-retake-${Date.now()}-${idx}`
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
    // ignore parse error; we still record status
  }
  return { status: res.status, response: json || {} };
}

async function main() {
  console.log(
    'Running interactive baseline vs regression',
    REGRESSION_TEST_ID,
    'using endpoint',
    API_ENDPOINT
  );

  const baselinePath = path.join(
    __dirname,
    'test results',
    'baseline-40-question-interactive-subset-2025-11-02T09-16-08.122Z.json'
  );
  const baselineRaw = JSON.parse(
    fs.readFileSync(baselinePath, 'utf8')
  );
  const baselineResults = baselineRaw.results || [];

  if (!baselineResults.length) {
    throw new Error(
      'No results found in interactive baseline JSON.'
    );
  }

  console.log(
    `Loaded ${baselineResults.length} baseline interactive results.`
  );

  const regressionResults = await loadRegressionResults(
    REGRESSION_TEST_ID
  );
  console.log(
    `Loaded ${regressionResults.length} regression results for id ${REGRESSION_TEST_ID}.`
  );

  const regressionMap = new Map();
  for (const r of regressionResults) {
    if (r && r.query) {
      regressionMap.set(String(r.query).toLowerCase(), r);
    }
  }

  const detailed = [];
  let worseCount = 0;

  for (let i = 0; i < baselineResults.length; i += 1) {
    const baseRow = baselineResults[i];
    const query = baseRow.query;
    const key = String(query || '').toLowerCase();
    const category = baseRow.category || null;

    const regressionRow = regressionMap.get(key) || null;

    // Live call to /api/chat
    let liveRow = null;
    try {
      liveRow = await callChat(query, i + 1);
    } catch (e) {
      console.error(
        `Live chat call failed for Q${i + 1}: ${query}`,
        e.message
      );
    }

    const baselineSummary = extractCountsFromWrapped({
    response: baseRow.response,
    status: baseRow.status
  });
    const regressionSummary =
      regressionRow != null
        ? extractCountsFromWrapped(regressionRow)
        : extractCountsFromWrapped(null);
    const liveSummary = extractCountsFromWrapped(liveRow);

    const statusVs951 = classifyVsBaseline(
      baselineSummary,
      regressionSummary
    );
    const statusVsLive = classifyVsBaseline(
      baselineSummary,
      liveSummary
    );

    if (statusVs951 === 'worse') {
      worseCount += 1;
    }

    console.log(
      `Q${i + 1} [${category || 'Uncategorised'}] "${query}":` +
        ` vs 951 = ${statusVs951}, vs live = ${statusVsLive}`
    );

    // Short answer previews (content quality signals)
    const baselineAnswer =
      baseRow.response && (baseRow.response.answer_markdown || baseRow.response.answer);
    const regressionAnswer =
      regressionRow &&
      regressionRow.response &&
      (regressionRow.response.answer_markdown || regressionRow.response.answer);
    const liveAnswer =
      liveRow &&
      liveRow.response &&
      (liveRow.response.answer_markdown || liveRow.response.answer);

    const truncate = (text) => {
      if (!text) return null;
      const s = String(text);
      return s.length > 500 ? `${s.slice(0, 500)}…` : s;
    };

    detailed.push({
      index: i + 1,
      query,
      category,
      baseline: baselineSummary,
      regression951: regressionSummary,
      liveNow: liveSummary,
      baselineAnswerPreview: truncate(baselineAnswer),
      regression951AnswerPreview: truncate(regressionAnswer),
      liveAnswerPreview: truncate(liveAnswer),
      statusVsBaseline_951: statusVs951,
      statusVsBaseline_live: statusVsLive
    });
  }

  const outputDir = path.join(
    __dirname,
    'test results'
  );
  const outputPath = path.join(
    outputDir,
    `interactive-vs-951-${Date.now()}.json`
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    apiEndpoint: API_ENDPOINT,
    regressionTestId: REGRESSION_TEST_ID,
    baselineFile: path.basename(baselinePath),
    summary: {
      totalQuestions: baselineResults.length,
      worseVsBaseline951: worseCount
    },
    results: detailed
  };

  fs.writeFileSync(
    outputPath,
    JSON.stringify(payload, null, 2),
    'utf8'
  );

  console.log(
    `\nSaved detailed comparison report to:\n  ${outputPath}`
  );
  console.log(
    `Questions marked statusVsBaseline_951 = "worse" are the ones to prioritise.`
  );
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});


