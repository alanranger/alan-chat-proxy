#!/usr/bin/env node

/**
 * Inspect current live chat answers for a subset of 40Q questions and summarise:
 *  - The full answer text (truncated for readability)
 *  - Which related information blocks are shown (articles, services, events, products)
 *
 * This is purely diagnostic and does NOT touch Supabase.
 *
 * Usage (PowerShell):
 *   cd "G:\Dropbox\alan ranger photography\Website Code\Chat AI Bot"
 *   node testing-scripts/inspect-current-answers.cjs
 *
 * Optional:
 *   $env:API_ENDPOINT = "https://alan-chat-proxy.vercel.app/api/chat"
 */

const fs = require('fs');
const path = require('path');

const API_ENDPOINT =
  process.env.API_ENDPOINT || 'https://alan-chat-proxy.vercel.app/api/chat';

// We drive off the latest interactive-vs-951 report so we keep the same 40-question ordering.
const REPORT_FILE =
  process.env.INTERACTIVE_REPORT_FILE ||
  'interactive-vs-951-1764174613187.json';

// Focus set: 10 representative questions with clear regressions (non-events)
// Indexes are 1-based (Q numbers from the report).
const TARGET_INDEXES = [
  15, // memory card (clear bug)
  27, // exposure triangle
  28, // depth of field
  30, // HDR
  31, // who is Alan
  34, // peter orton
  35, // who is alan ranger
  37, // composition/storytelling
  38, // flash
  39  // edit RAW
];

function loadReport() {
  const p = path.join(__dirname, 'test results', REPORT_FILE);
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

async function callChat(query, idx) {
  const body = {
    query,
    sessionId: `inspect-${Date.now()}-${idx}`
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
    // ignore parse error; we'll still print status
  }
  return { status: res.status, response: json || {} };
}

function summariseBlocks(resp) {
  const sources = resp.sources || {};
  const structured = resp.structured || {};

  function toSummaries(items, kind) {
    if (!Array.isArray(items)) return [];
    return items.slice(0, 5).map((it) => {
      const id =
        it.id ||
        it.event_id ||
        it.product_id ||
        (it.raw && it.raw.id) ||
        it.page_url ||
        it.href ||
        'N/A';
      const title =
        it.title ||
        it.event_title ||
        it.product_title ||
        (it.raw && (it.raw.name || it.raw.title)) ||
        it.page_url ||
        'N/A';
      return { kind, id, title: String(title).slice(0, 120) };
    });
  }

  const articles =
    sources.articles || structured.articles || [];
  const services =
    sources.services || structured.services || [];
  const events =
    sources.events || structured.events || [];
  const products =
    sources.products || structured.products || [];

  return {
    counts: {
      articles: articles.length,
      services: services.length,
      events: events.length,
      products: products.length
    },
    top: [
      ...toSummaries(articles, 'article'),
      ...toSummaries(services, 'service'),
      ...toSummaries(events, 'event'),
      ...toSummaries(products, 'product')
    ]
  };
}

function truncateAnswer(text) {
  if (!text) return '';
  const s = String(text).trim();
  return s.length > 900 ? `${s.slice(0, 900)}…` : s;
}

async function main() {
  console.log(
    `Inspecting current live answers from ${API_ENDPOINT} for ${TARGET_INDEXES.length} questions.\n`
  );

  const report = loadReport();
  const byIndex = new Map();
  for (const row of report.results || []) {
    byIndex.set(row.index, row);
  }

  for (const idx of TARGET_INDEXES) {
    const row = byIndex.get(idx);
    if (!row) {
      console.warn(`Skipping Q${idx}: not found in report.`);
      continue;
    }
    const { query, category } = row;
    console.log(
      '=============================================================================='
    );
    console.log(`Q${idx} [${category || 'Uncategorised'}]`);
    console.log(`Query: ${query}`);

    let live = null;
    try {
      live = await callChat(query, idx);
    } catch (e) {
      console.error(
        `  Live call failed (status unknown): ${e.message}`
      );
      continue;
    }

    const resp = live.response || {};
    const answer =
      resp.answer_markdown || resp.answer || '(no answer text)';
    const blocks = summariseBlocks(resp);

    console.log(`\nStatus: ${live.status}, type: ${resp.type || 'n/a'}`);
    console.log('\nCurrent answer (truncated):\n');
    console.log(truncateAnswer(answer));
    console.log('\nRelated information blocks:');
    console.log(
      `  Counts -> articles: ${blocks.counts.articles}, services: ${blocks.counts.services}, events: ${blocks.counts.events}, products: ${blocks.counts.products}`
    );
    if (!blocks.top.length) {
      console.log('  Top items: (none)');
    } else {
      console.log('  Top items:');
      for (const item of blocks.top) {
        console.log(
          `   - [${item.kind}] ${item.title} (id: ${item.id})`
        );
      }
    }
    console.log(); // spacer
  }
}

main().catch((err) => {
  console.error('Fatal error in inspect-current-answers:', err);
  process.exit(1);
});



