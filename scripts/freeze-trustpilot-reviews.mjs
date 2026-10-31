#!/usr/bin/env node
/**
 * One-time: freeze Trustpilot review attribution from product_reviews (the 6 Oct state) into
 * alan-shared-resources/csv/raw-03a-trustpilot-attributed-FROZEN.csv. The review merge reads that
 * file and never re-matches Trustpilot again. raw-03a stays untouched as the original export.
 *
 * Usage: node scripts/freeze-trustpilot-reviews.mjs [--force]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadSupabaseEnv } from '../lib/load-supabase-env.mjs';
import { readCsvFile, writeCsvFile } from '../lib/simple-csv.mjs';

const SHARED = 'G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources';
const FROZEN = path.join(SHARED, 'csv', 'raw-03a-trustpilot-attributed-FROZEN.csv');
const AUDIT = path.join(SHARED, 'csv processed', '16-trustpilot-freeze-corrections-2026-10-31.csv');

const INVITE = 'invitation reference and review text agree; neither mentions Lightroom';
const CORRECTIONS = [
  ...['5e0f2df4c8454508343a56f2', '5e0f0415c845450914b04ed9', '5e0ef9cac845450914b049b7', '5d6f668cf0186907108bcb74',
    '5e204f7fc845450bec38a593', '5df366cbc845450910a63d4d', '5d641fe7f01869069cd3bff7', '5d601630f018690bd052fdff']
    .map((id) => ({ id, slug: 'beginners-photography-course', reason: `Invited for "Beginners Photography Course | 3 Weekly Evening Classes"; ${INVITE}` })),
  ...['5c3a37de9d378009a45baeb0', '5c384a629d37800944c61efc', '5c7907b497afa10630aee5fa']
    .map((id) => ({ id, slug: 'beginners-photography-classes-coventry', reason: `Invited for "Beginners Photography Classes - Coventry - Get Off Auto" (hidden product); ${INVITE}` })),
  ...['5bf5499c9d3780035820ba98', '5bf53d029d3780035820b404']
    .map((id) => ({ id, slug: 'landscape-photography-workshops-glencoe', reason: 'Invited for Glencoe and text says Glencoe; was on Snowdonia (both hidden)' })),
  { id: '5d700e89f01869060ceb566b', slug: 'woodland-photography-walk-warwickshire', reason: 'Invited for Woodland Photography Walks; text names no other product' },
  { id: '5d6fffe0f0186907108c36f4', slug: 'poppy-fields-photography-workshops', reason: 'Text is about the 4 Sep 2019 sunflower shoot; same home as the other sunflower reviews; was on 4 x private classes' },
  { id: '575c00990000ff000964e312', slug: 'beginners-photography-course', reason: 'Alan-approved override 7 Oct (15-review-attribution-overrides.csv), made after the 6 Oct DB load' },
  { id: '5df215e4c8454509e478f3cb', slug: 'beginners-photography-course', reason: 'Alan-approved override 7 Oct (15-review-attribution-overrides.csv), made after the 6 Oct DB load' }
];

/** Alan-approved exclusions (15 overrides, scope=exclude): kept as history, never shown in schema. */
const SCHEMA_EXCLUDE = new Map([
  ['5acf589f6d33bc0a24fe2f7f', 'Alan-approved exclude 7 Oct (1-star, not happy) — 15-review-attribution-overrides.csv']
]);

const RAW_COLS = ['Review Id', 'Review Created (UTC)', 'Review Consumer User Id', 'Review Username', 'Review Title', 'Review Content',
  'Review Stars', 'Source Of Review', 'Reference Id', 'Company Response', 'Review Language', 'Domain Url', 'Webshop Name',
  'Business Unit Id', 'Tags', 'Company Reply Date (UTC)', 'Location Name', 'Location Id'];
const snake = (h) => h.trim().toLowerCase().replace(/ /g, '_');
const COLUMNS = [...RAW_COLS.map(snake), 'source', 'product_slug', 'product_name', 'attribution_source',
  'ingest_is_excluded', 'ingest_exclude_reason', 'frozen_note'];

async function loadDbTrustpilot(sb) {
  const { data, error } = await sb.from('product_reviews')
    .select('source_review_id, product_slug, is_excluded, exclude_reason').eq('source', 'Trustpilot').limit(5000);
  if (error) throw error;
  return data;
}

function productNames() {
  const rows = readCsvFile(path.join(SHARED, 'csv', 'raw-01-products-sqsp-export.csv'));
  return new Map(rows.filter((r) => r['Product URL'] && r.Title).map((r) => [r['Product URL'], r.Title]));
}

function attributionOf(id, fix) {
  if (SCHEMA_EXCLUDE.has(id)) return 'override_exclude';
  return fix ? 'frozen_corrected_2026-10-31' : 'frozen_db_2026-10-06';
}

function frozenRow(raw, db, fix, names) {
  const slug = fix ? fix.slug : db.product_slug;
  const out = Object.fromEntries(RAW_COLS.map((c) => [snake(c), raw[c] ?? '']));
  return {
    ...out,
    source: 'Trustpilot',
    product_slug: slug,
    product_name: names.get(slug) || '',
    attribution_source: attributionOf(db.source_review_id, fix),
    ingest_is_excluded: db.is_excluded ? 'yes' : 'no',
    ingest_exclude_reason: db.exclude_reason || '',
    frozen_note: SCHEMA_EXCLUDE.get(db.source_review_id) || (fix ? fix.reason : '')
  };
}

async function main() {
  if (fs.existsSync(FROZEN) && !process.argv.includes('--force')) {
    throw new Error(`${FROZEN} already exists. Trustpilot is frozen history; edit that file by hand or pass --force.`);
  }
  const { url, key } = loadSupabaseEnv();
  const sb = createClient(url, key);
  const db = await loadDbTrustpilot(sb);
  const raw = new Map(readCsvFile(path.join(SHARED, 'csv', 'raw-03a-trustpilot-reviews-historical.csv')).map((r) => [r['Review Id'], r]));
  const fixes = new Map(CORRECTIONS.map((c) => [c.id, c]));
  const names = productNames();
  const missing = db.filter((d) => !raw.has(d.source_review_id)).map((d) => d.source_review_id);
  if (missing.length) throw new Error(`DB Trustpilot ids missing from raw-03a: ${missing.join(', ')}`);
  const unknownFix = CORRECTIONS.filter((c) => !db.some((d) => d.source_review_id === c.id));
  if (unknownFix.length) throw new Error(`Correction ids not in DB: ${unknownFix.map((c) => c.id).join(', ')}`);

  const rows = db.map((d) => frozenRow(raw.get(d.source_review_id), d, fixes.get(d.source_review_id), names));
  writeCsvFile(FROZEN, COLUMNS, rows);
  const audit = CORRECTIONS.map((c) => {
    const d = db.find((x) => x.source_review_id === c.id);
    const r = raw.get(c.id);
    return { review_id: c.id, reviewer: r['Review Username'], date: r['Review Created (UTC)'], invitation: r['Reference Id'], before: d.product_slug, after: c.slug, reason: c.reason };
  });
  writeCsvFile(AUDIT, ['review_id', 'reviewer', 'date', 'invitation', 'before', 'after', 'reason'], audit);
  console.log(JSON.stringify({ frozen_rows: rows.length, corrected: audit.length, excluded: rows.filter((r) => r.ingest_is_excluded === 'yes').length, file: FROZEN, audit: AUDIT }, null, 2));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
