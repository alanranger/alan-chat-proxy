#!/usr/bin/env node
/** One-off re-ingest after mobile-menu / share-button htmlToText skip selectors. */
import dotenv from 'dotenv';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { ingestSingleUrl } from '../api/ingest.js';

for (const f of ['.env.local', '.env']) {
  if (fs.existsSync(f)) dotenv.config({ path: f });
}

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BATCH = 5;
const DELAY_MS = 1500;

async function allDistinctUrls() {
  const urls = new Set();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supa
      .from('page_chunks')
      .select('url')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) urls.add(row.url);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return [...urls].sort();
}

async function runVerification(label) {
  const marker = 'back photography courses coventry';
  const { data, error } = await supa
    .from('page_chunks')
    .select('url, chunk_text, content, tokens, id, created_at')
    .ilike('url', '%/photo-workshops-uk/%');
  if (error) throw error;

  const polluted = {};
  for (const row of data) {
    const txt = (row.chunk_text || row.content || '').toLowerCase();
    if (txt.includes(marker)) polluted[row.url] = (polluted[row.url] || 0) + 1;
  }

  const slugRows = (slug) =>
    data.filter((r) => r.url.toLowerCase().includes(slug.toLowerCase()));

  function summarize(slug) {
    const rows = slugRows(slug);
    if (!rows.length) return null;
    const url = rows[0].url;
    const samples = rows
      .sort((a, b) => a.id - b.id)
      .map((r) => (r.chunk_text || r.content || '').slice(0, 180));
    return {
      url,
      chunks: rows.length,
      total_tokens: rows.reduce((s, r) => s + (r.tokens || 0), 0),
      sample: samples[0],
      first_chunk_preview: samples[0],
    };
  }

  console.log(`\n=== ${label} ===`);
  console.log('Q1 polluted rows:', JSON.stringify(polluted, null, 2));
  console.log('Q2 fireworks:', JSON.stringify(summarize('fireworks-photography-workshop-kenilworth'), null, 2));
  console.log(
    'Q3 lake-district:',
    JSON.stringify(
      slugRows('lake-district-photography-workshop')
        .sort((a, b) => a.id - b.id)
        .slice(0, 6)
        .map((r) => ({
          url: r.url,
          first_chunk_preview: (r.chunk_text || r.content || '').slice(0, 180),
        })),
      null,
      2
    )
  );
}

const urls = await allDistinctUrls();
console.log(`Re-ingesting ${urls.length} distinct URLs from page_chunks...`);

let ok = 0;
let fail = 0;
for (let i = 0; i < urls.length; i += BATCH) {
  const batch = urls.slice(i, i + BATCH);
  const results = await Promise.all(
    batch.map(async (url) => {
      try {
        const r = await ingestSingleUrl(url, supa, { dryRun: false });
        return { url, ok: true, chunks: r.chunks };
      } catch (e) {
        return { url, ok: false, error: e.message };
      }
    })
  );
  for (const r of results) {
    if (r.ok) {
      ok++;
      console.log(`OK ${r.url} (${r.chunks} chunks)`);
    } else {
      fail++;
      console.log(`FAIL ${r.url}: ${r.error}`);
    }
  }
  if (i + BATCH < urls.length) await new Promise((r) => setTimeout(r, DELAY_MS));
}

console.log(`\nDone: ${ok} ok, ${fail} fail, ${urls.length} total`);
await runVerification('AFTER RE-INGEST');
