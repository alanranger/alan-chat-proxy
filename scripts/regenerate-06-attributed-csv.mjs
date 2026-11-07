#!/usr/bin/env node
/**
 * Regenerate 06-product-reviews-attributed.csv (+ 07 catalog) from Supabase
 * with RFC-style quoting. Validates 15 columns per row; is_excluded always yes/no.
 *
 * Usage: node scripts/regenerate-06-attributed-csv.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { loadSupabaseEnv } from '../lib/load-supabase-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHARED_CSV =
  'G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/csv processed';

loadSupabaseEnv();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const RESIDENTIAL_SLUGS = [
  'dartmoor-photography-landscape-workshop',
  'exmoor-photography-workshops-lynmouth',
  'north-yorkshire-landscape-photography',
  'somerset-landscape-photography-workshops',
  'ireland-photography-workshops-dingle',
];

const reviewCols = [
  'product_slug',
  'slug_key',
  'url',
  'category',
  'page_type',
  'catalog_source',
  'target_keyword',
  'product_title',
  'reviewer_name',
  'review_date',
  'rating',
  'quote',
  'source',
  'is_excluded',
  'exclude_reason',
];

const catalogCols = [
  'slug_key',
  'product_slug',
  'url',
  'category',
  'page_type',
  'catalog_source',
  'target_keyword',
  'product_title',
  'review_count_total',
  'review_count_active',
  'review_count_excluded',
  'has_reviews',
  'sample_quote',
];

function writeCsv(filePath, headerCols, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = headerCols.join(',') + '\n';
  const body = rows.map((r) => headerCols.map((c) => esc(r[c])).join(',')).join('\n');
  fs.writeFileSync(filePath, header + body + '\n', 'utf8');
}

function parseCsvFieldCount(text) {
  const widths = [];
  let i = 0;
  let cur = '';
  let inQ = false;
  let row = [];
  let hdr = [];
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i += 2;
        continue;
      }
      if (c === '"') {
        inQ = false;
        i++;
        continue;
      }
      cur += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(cur);
      cur = '';
      i++;
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      if (!hdr.length) hdr = row.map((h) => h.replace(/^\uFEFF/, '').trim());
      else if (row.some((x) => x !== '')) widths.push(row.length);
      row = [];
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  return widths;
}

async function fetchAll(table, select) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order('id')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function summarizeBySlug(reviewExport) {
  const map = new Map();
  for (const r of reviewExport) {
    const s = r.product_slug;
    if (!map.has(s)) {
      map.set(s, { total: 0, active: 0, excluded: 0, latest_quote: '' });
    }
    const agg = map.get(s);
    agg.total += 1;
    if (r.is_excluded === 'yes') agg.excluded += 1;
    else {
      agg.active += 1;
      if (!agg.latest_quote && Number(r.rating) === 5) {
        agg.latest_quote = String(r.quote).slice(0, 200);
      }
    }
  }
  return map;
}

function appendNyProposals(excludedNy) {
  const outPath = path.join(SHARED_CSV, '10-proposed-review-reattributions.csv');
  const existing = fs.readFileSync(outPath, 'utf8');
  const header =
    'action,confidence,gap_tile,proposed_slug,reviewer_name,review_date,rating,event_date,workshop_location,participant_from_booking,current_slug,is_excluded,loc_in_quote,quote,notes';
  const lines = existing.trim().split(/\r?\n/);
  const have = new Set(
    lines.slice(1).map((l) => {
      const m = l.match(/^[^,]+,[^,]+,[^,]+,[^,]+,([^,]+),/);
      return m ? `${m[1]}:north_yorkshire_residential` : '';
    })
  );

  const additions = [];
  for (const r of excludedNy) {
    const key = `${r.reviewer_name}:north_yorkshire_residential`;
    if (have.has(key)) continue;
    const ql = (r.quote || '').toLowerCase();
    const locInQuote =
      ql.includes('north yorkshire') ||
      ql.includes('yorkshire dales') ||
      ql.includes('swaledale') ||
      ql.includes('reeth') ||
      ql.includes('muker')
        ? 'yes'
        : 'no';
    const action = locInQuote === 'yes' ? 'unexclude_or_move' : 'review_before_unexclude';
    const quoteEsc = String(r.quote || '').replace(/"/g, '""');
    additions.push(
      [
        action,
        'medium',
        'north_yorkshire_residential',
        'north-yorkshire-landscape-photography',
        r.reviewer_name,
        r.review_date || '',
        r.rating,
        '',
        'North Yorkshire residential (booking TBC)',
        r.reviewer_name,
        r.product_slug,
        'yes',
        locInQuote,
        `"${quoteEsc}"`,
        'slug_cross_contamination_north_yorkshire — propose sign-off only; do not auto-change',
      ].join(',')
    );
  }

  if (!additions.length) {
    console.log('No new NY residential proposals to append to 10-proposed');
    return;
  }
  fs.writeFileSync(outPath, `${existing.trim()}\n${additions.join('\n')}\n`, 'utf8');
  console.log(`Appended ${additions.length} rows to 10-proposed-review-reattributions.csv`);
}

async function main() {
  const [reviews, catalog] = await Promise.all([
    fetchAll(
      'product_reviews',
      'product_slug,reviewer_name,review_date,rating,quote,source,is_excluded,exclude_reason,url,category,page_type,target_keyword'
    ),
    fetchAll(
      'page_slug_catalog',
      'slug_key,product_slug,url,category,page_type,catalog_source,target_keyword,product_title'
    ),
  ]);

  const catBySlug = new Map(catalog.map((c) => [c.product_slug, c]));

  const reviewExport = reviews.map((r) => {
    const cat = catBySlug.get(r.product_slug) || {};
    return {
      product_slug: r.product_slug,
      slug_key: cat.slug_key || '',
      url: r.url || cat.url || '',
      category: r.category || cat.category || '',
      page_type: r.page_type || cat.page_type || '',
      catalog_source: cat.catalog_source || '',
      target_keyword: r.target_keyword || cat.target_keyword || '',
      product_title: cat.product_title || '',
      reviewer_name: r.reviewer_name || 'Anonymous',
      review_date: r.review_date || '',
      rating: r.rating,
      quote: r.quote || '',
      source: r.source || '',
      is_excluded: r.is_excluded ? 'yes' : 'no',
      exclude_reason: r.exclude_reason || '',
    };
  });

  const blankExcluded = reviewExport.filter((r) => r.is_excluded !== 'yes' && r.is_excluded !== 'no');
  if (blankExcluded.length) {
    throw new Error(`${blankExcluded.length} rows with blank is_excluded`);
  }

  const stats = summarizeBySlug(reviewExport);
  const catalogExport = catalog.map((c) => {
    const s = stats.get(c.product_slug) || {
      total: 0,
      active: 0,
      excluded: 0,
      latest_quote: '',
    };
    return {
      slug_key: c.slug_key,
      product_slug: c.product_slug,
      url: c.url,
      category: c.category,
      page_type: c.page_type,
      catalog_source: c.catalog_source,
      target_keyword: c.target_keyword,
      product_title: c.product_title,
      review_count_total: s.total,
      review_count_active: s.active,
      review_count_excluded: s.excluded,
      has_reviews: s.total > 0 ? 'yes' : 'no',
      sample_quote: s.latest_quote,
    };
  });

  const reviewsPath = path.join(SHARED_CSV, '06-product-reviews-attributed.csv');
  const catalogPath = path.join(SHARED_CSV, '07-page-slug-catalog-and-reviews.csv');
  const backup = reviewsPath.replace('.csv', `.backup-${new Date().toISOString().slice(0, 10)}.csv`);
  if (fs.existsSync(reviewsPath)) fs.copyFileSync(reviewsPath, backup);

  writeCsv(reviewsPath, reviewCols, reviewExport);
  writeCsv(catalogPath, catalogCols, catalogExport);

  const written = fs.readFileSync(reviewsPath, 'utf8');
  const widths = parseCsvFieldCount(written);
  const bad = widths.filter((w) => w !== 15);
  if (bad.length) {
    throw new Error(`Validation failed: ${bad.length} rows not 15 columns (e.g. ${bad.slice(0, 5)})`);
  }

  const emptyQuote = reviewExport.filter((r) => !String(r.quote).trim());
  if (emptyQuote.length) {
    console.warn(`WARN: ${emptyQuote.length} rows with empty quote`);
  }

  console.log(`Wrote ${reviewExport.length} reviews -> ${reviewsPath}`);
  console.log(`Wrote ${catalogExport.length} catalog rows -> ${catalogPath}`);
  console.log(`Backup: ${backup}`);
  console.log(`All ${widths.length} data rows validated at 15 columns`);

  console.log('\n--- Residential active 5-star (is_excluded=no) ---');
  for (const slug of RESIDENTIAL_SLUGS) {
    const active5 = reviewExport.filter(
      (r) =>
        r.product_slug === slug &&
        r.is_excluded === 'no' &&
        Number(r.rating) === 5
    );
    console.log(`${slug}: ${active5.length} (${active5.map((r) => r.reviewer_name).join(', ') || 'none'})`);
  }

  const excludedNy = reviewExport.filter(
    (r) =>
      r.product_slug === 'north-yorkshire-landscape-photography' &&
      r.is_excluded === 'yes' &&
      r.exclude_reason === 'slug_cross_contamination_north_yorkshire'
  );
  appendNyProposals(excludedNy);

  const report = {
    generated_at: new Date().toISOString(),
    review_rows: reviewExport.length,
    column_validation: '15/15',
    residential_active_5star: Object.fromEntries(
      RESIDENTIAL_SLUGS.map((slug) => [
        slug,
        reviewExport.filter(
          (r) => r.product_slug === slug && r.is_excluded === 'no' && Number(r.rating) === 5
        ).length,
      ])
    ),
  };
  const reportPath = path.join(ROOT, 'scripts', 'regenerate-06-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report: ${reportPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
