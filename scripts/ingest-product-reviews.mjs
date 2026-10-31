#!/usr/bin/env node
/* eslint-disable complexity, max-statements -- CSV ingest + exclusion matrix is intentionally dense */
/**
 * Ingest combined_product_reviews.csv into public.product_reviews
 * and build public.page_slug_catalog from canonical_products + landing-pages + events.
 *
 * Never deletes reviews. Existing rows (Trustpilot by review id, Google by reviewer + quote) keep
 * their exclusion; only slug-derived fields change when the slug changes, and null rating/date
 * are backfilled. New rows are inserted. Writes product-reviews-db-snapshot.csv for the merge.
 *
 * Usage: node scripts/ingest-product-reviews.mjs [--dry-run]
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createClient } from '@supabase/supabase-js';
import { loadSupabaseEnv } from '../lib/load-supabase-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
loadSupabaseEnv();

const SHARED_CSV =
  'G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/csv processed';
const SITE = 'https://www.alanranger.com';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);
const DRY = process.argv.includes('--dry-run');

function parseCsv(text) {
  const rows = [];
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
      else if (row.some((x) => x !== '')) {
        rows.push(Object.fromEntries(hdr.map((h, ix) => [h, row[ix] || ''])));
      }
      row = [];
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  return rows;
}

function normalizePath(url) {
  if (!url) return '';
  return url
    .trim()
    .replace(/^https?:\/\/(www\.)?alanranger\.com\/?/i, '')
    .replace(/\/$/, '')
    .toLowerCase();
}

function lastSlug(urlOrPath) {
  const p = normalizePath(urlOrPath);
  const parts = p.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function fullUrl(pathOrUrl) {
  const p = (pathOrUrl || '').trim();
  if (!p) return null;
  if (p.startsWith('http')) return p.replace(/\/$/, '');
  return `${SITE}/${p.replace(/^\//, '')}`;
}

function pageTypeFromCategory(category) {
  if (!category) return 'product';
  if (category.startsWith('workshop')) return 'workshop';
  if (category.includes('course')) return 'course';
  if (category === 'service') return 'service';
  if (category === 'academy') return 'academy';
  if (category.includes('gift')) return 'gift-voucher';
  return 'product';
}

function parseReviewDate(row) {
  const parsed = (row.date_parsed || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(parsed)) return parsed.slice(0, 10);
  const isTrustpilot = /trustpilot/i.test(row.source || '');
  const plain = (row.date || '').trim();
  if (!isTrustpilot && /^\d{4}-\d{2}-\d{2}/.test(plain)) return plain.slice(0, 10);
  const created = (row['review_created_(utc)'] || '').trim();
  const uk = created.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (uk) {
    const [, dd, mm, yyyy] = uk;
    return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }
  const t = Date.parse(created);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

function reviewQuote(row) {
  return (row.review_content || row.reviewBody || row.review || '').trim();
}

const WORD_RATINGS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

function parseRating(row) {
  const raw = row.rating_numeric || row.review_stars || row.rating || row.ratingValue || '';
  const word = WORD_RATINGS[String(raw).trim().toUpperCase()];
  if (word) return word;
  const n = Math.round(parseFloat(String(raw).replace(/[^0-9.]/g, '')));
  if (Number.isNaN(n) || n < 1 || n > 5) return null;
  return n;
}

function parseSource(row) {
  const s = (row.source || row.source_of_review || '').trim();
  if (s) return s;
  return 'combined_csv';
}

function exclusionReason(quote, slug) {
  const ql = quote.toLowerCase();
  if (ql.includes('beginners photography class') || ql.includes('beginners camera class')) {
    return 'mis_tagged_beginners_course';
  }
  if (ql.includes('intentions course')) return 'mis_tagged_intentions_course';
  if (ql.includes('house shoot') || ql.includes('undertook some house shoots')) {
    return 'mis_tagged_hire_not_workshop';
  }
  if (
    ql.includes('beginners') &&
    (ql.includes('3 sessions') ||
      ql.includes('three sessions') ||
      ql.includes('over three weeks') ||
      ql.includes('2 hour session'))
  ) {
    return 'mis_tagged_beginners_multi_session';
  }
  if (ql.includes('photo walk') && !ql.includes('workshop') && !ql.includes('weekend')) {
    return 'mis_tagged_photo_walk';
  }
  if (
    slug === 'north-yorkshire-landscape-photography' &&
    (ql.includes('3hour slot') ||
      ql.includes('3 hour slot') ||
      ql.includes('covers the basics of both technical and composition'))
  ) {
    return 'slug_cross_contamination_north_yorkshire';
  }
  if (slug === 'landscape-photography-wales-photo-workshop' && ql.includes('house')) {
    return 'mis_tagged_hire_on_gower';
  }
  if (quote.length < 15) return 'quote_too_short';
  return null;
}

/** CSV ingest_is_excluded / ingest_exclude_reason from sync:yes — overrides quote heuristics. */
function resolveExclusion(row, quote, slug) {
  const flag = (row.ingest_is_excluded || '').trim().toLowerCase();
  if (flag === 'yes' || flag === 'true' || flag === '1') {
    const reason = (row.ingest_exclude_reason || '').trim();
    return reason || 'csv_ingest_excluded';
  }
  if (flag === 'no' || flag === 'false' || flag === '0') {
    return null;
  }
  return exclusionReason(quote, slug);
}

async function loadKeywordMap() {
  const map = new Map();
  const { data, error } = await supabase
    .from('traditional_seo_target_keyword_overrides')
    .select('page_url, target_keyword');
  if (error) throw error;
  for (const row of data || []) {
    const key = normalizePath(row.page_url);
    if (key && row.target_keyword) map.set(key, row.target_keyword.trim());
  }
  return map;
}

async function buildCatalog(keywordMap) {
  const catalog = new Map();

  function addEntry({ product_slug, slug_key, url, category, page_type, product_title, catalog_source }) {
    if (!slug_key || !url || !product_slug) return;
    const key = slug_key.toLowerCase();
    if (catalog.has(key)) return;
    const pathNorm = normalizePath(url);
    catalog.set(key, {
      product_slug,
      slug_key: key,
      url: fullUrl(url),
      category: category || null,
      page_type: page_type || 'product',
      target_keyword: keywordMap.get(pathNorm) || null,
      product_title: product_title || null,
      catalog_source,
    });
  }

  const { data: products, error: pErr } = await supabase
    .from('canonical_products')
    .select('product_title, product_url, category, service_page_url, service_page_title');
  if (pErr) throw pErr;

  for (const p of products || []) {
    if (p.product_url) {
      const pathNorm = normalizePath(p.product_url);
      addEntry({
        product_slug: lastSlug(p.product_url),
        slug_key: pathNorm,
        url: p.product_url,
        category: p.category,
        page_type: pageTypeFromCategory(p.category),
        product_title: p.product_title,
        catalog_source: 'canonical_products',
      });
    }
    if (p.service_page_url) {
      const pathNorm = normalizePath(p.service_page_url);
      addEntry({
        product_slug: lastSlug(p.service_page_url),
        slug_key: pathNorm,
        url: p.service_page_url,
        category: 'service hub',
        page_type: 'service',
        product_title: p.service_page_title || p.service_page_url,
        catalog_source: 'service_hub',
      });
    }
  }

  const landingPath = path.join(SHARED_CSV, 'landing-pages.csv');
  if (fs.existsSync(landingPath)) {
    for (const row of parseCsv(fs.readFileSync(landingPath, 'utf8'))) {
      if (!row.url) continue;
      const pathNorm = normalizePath(row.url);
      addEntry({
        product_slug: lastSlug(row.url),
        slug_key: pathNorm,
        url: row.url,
        category: row.page_type || 'landing',
        page_type: row.page_type || 'landing',
        product_title: null,
        catalog_source: 'landing_pages_csv',
      });
    }
  }

  const { data: events, error: eErr } = await supabase
    .from('event')
    .select('url, title')
    .not('url', 'is', null);
  if (eErr) throw eErr;
  for (const ev of events || []) {
    const pathNorm = normalizePath(ev.url);
    addEntry({
      product_slug: lastSlug(ev.url),
      slug_key: pathNorm,
      url: ev.url,
      category: 'event',
      page_type: 'event',
      product_title: ev.title,
      catalog_source: 'event_table',
    });
  }

  return catalog;
}

function resolveCatalog(catalog, productSlug) {
  const bySlug = [...catalog.values()].filter((c) => c.product_slug === productSlug);
  if (bySlug.length === 1) return bySlug[0];
  if (bySlug.length > 1) {
    const product = bySlug.find((c) => c.catalog_source === 'canonical_products');
    return product || bySlug[0];
  }
  const pathMatch = [...catalog.values()].find((c) => c.slug_key.endsWith(`/${productSlug}`) || c.slug_key === productSlug);
  return pathMatch || null;
}

function writeCsv(filePath, headerCols, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = headerCols.join(',') + '\n';
  const body = rows.map((r) => headerCols.map((c) => esc(r[c])).join(',')).join('\n');
  fs.writeFileSync(filePath, header + body, 'utf8');
}

function summarizeReviewsBySlug(reviewRows) {
  const map = new Map();
  for (const r of reviewRows) {
    const s = r.product_slug;
    if (!map.has(s)) {
      map.set(s, { total: 0, active: 0, excluded: 0, latest_quote: '' });
    }
    const agg = map.get(s);
    agg.total += 1;
    if (r.is_excluded) agg.excluded += 1;
    else {
      agg.active += 1;
      if (!agg.latest_quote && r.rating === 5) agg.latest_quote = r.quote.slice(0, 200);
    }
  }
  return map;
}

const keyText = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Stable identity: Trustpilot review id; otherwise source + reviewer + quote text. */
export function reviewKey(r) {
  if (r.source_review_id) return `id:${r.source_review_id}`;
  return `${keyText(r.source)}|${keyText(r.reviewer_name)}|${keyText(r.quote)}`;
}

const SLUG_FIELDS = ['product_slug', 'url', 'category', 'page_type', 'target_keyword'];

/**
 * A review with no product in this run (business level, pending, Alan exclude) can still backfill
 * rating/date on a row that already exists. It never inserts and never changes the product.
 */
function backfillOnlyRow(row, quote) {
  return {
    backfill_only: true,
    source_review_id: row.review_id || null,
    reviewer_name: (row.review_username || row.reviewer || 'Anonymous').trim(),
    quote,
    source: parseSource(row),
    rating: parseRating(row),
    review_date: parseReviewDate(row)
  };
}

/** Fields to change on an existing row. Exclusion is never touched. */
export function reviewChanges(old, next) {
  const changes = {};
  if (!next.backfill_only && next.product_slug !== old.product_slug) {
    for (const f of SLUG_FIELDS) changes[f] = next[f] ?? null;
  }
  if (old.rating == null && next.rating != null) changes.rating = next.rating;
  if (!old.review_date && next.review_date) changes.review_date = next.review_date;
  return changes;
}

export function planReviewUpsert(existing, incoming) {
  const byKey = new Map(existing.map((r) => [reviewKey(r), r]));
  const seen = new Set();
  const plan = { updates: [], inserts: [], unchanged: 0, duplicate_incoming: 0 };
  for (const next of incoming) {
    const key = reviewKey(next);
    if (seen.has(key)) { plan.duplicate_incoming += 1; continue; }
    seen.add(key);
    const old = byKey.get(key);
    if (!old) {
      if (!next.backfill_only) plan.inserts.push(next);
      continue;
    }
    const changes = reviewChanges(old, next);
    if (Object.keys(changes).length) {
      plan.updates.push({ id: old.id, source: old.source, reviewer_name: old.reviewer_name, before_slug: old.product_slug, changes });
    } else plan.unchanged += 1;
  }
  return plan;
}

function summarisePlan(plan, existingCount) {
  const fieldCounts = {};
  for (const u of plan.updates) for (const f of Object.keys(u.changes)) fieldCounts[f] = (fieldCounts[f] || 0) + 1;
  return {
    existing_rows: existingCount,
    updates: plan.updates.length,
    inserts: plan.inserts.length,
    unchanged: plan.unchanged,
    deletes: 0,
    duplicate_incoming: plan.duplicate_incoming,
    updated_fields: fieldCounts,
    slug_moves: plan.updates.filter((u) => u.changes.product_slug !== undefined)
      .map((u) => `${u.source} ${u.reviewer_name}: ${u.before_slug} -> ${u.changes.product_slug}`)
  };
}

async function loadExistingReviews() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('product_reviews')
      .select('id, source, source_review_id, reviewer_name, quote, product_slug, rating, review_date, is_excluded')
      .order('id').range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function applyReviewPlan(plan) {
  for (const u of plan.updates) {
    const { error } = await supabase.from('product_reviews').update(u.changes).eq('id', u.id);
    if (error) throw error;
  }
  for (let i = 0; i < plan.inserts.length; i += 100) {
    const { error } = await supabase.from('product_reviews').insert(plan.inserts.slice(i, i + 100));
    if (error) throw error;
  }
}

/** DB truth for the review merge (Google append-only lock). */
async function writeDbSnapshot() {
  const rows = await loadExistingReviews();
  const file = path.join(SHARED_CSV, 'product-reviews-db-snapshot.csv');
  const cols = ['source', 'source_review_id', 'reviewer_name', 'quote', 'product_slug', 'rating', 'review_date', 'is_excluded'];
  writeCsv(file, cols, rows.map((r) => ({ ...r, is_excluded: r.is_excluded ? 'yes' : 'no' })));
  return file;
}

/**
 * Ingest reviews + catalog into Supabase and write shared-resources CSV exports.
 * @param {{ dryRun?: boolean }} opts
 */
export async function runProductReviewsIngest(opts = {}) {
  const dryRun = opts.dryRun ?? DRY;
  const reviewFile = fs
    .readdirSync(SHARED_CSV)
    .find((f) => f.startsWith('03') && f.includes('combined') && !f.includes('backup'));
  const reviews = parseCsv(fs.readFileSync(path.join(SHARED_CSV, reviewFile), 'utf8'));

  console.log(`Loaded ${reviews.length} reviews from CSV`);

  const keywordMap = await loadKeywordMap();
  const catalog = await buildCatalog(keywordMap);
  console.log(`Built ${catalog.size} catalog entries`);

  const catalogRows = [...catalog.values()];
  const reviewRows = [];
  const report = {
    catalog_entries: catalogRows.length,
    reviews_in_csv: reviews.length,
    reviews_inserted: 0,
    mapped_to_slug: 0,
    unmapped_slug: 0,
    excluded: 0,
    exclude_reasons: {},
    by_category: {},
    unmapped_slugs: [],
  };

  const backfillRows = [];
  for (const row of reviews) {
    const slug = (row.product_slug || '').trim();
    const quote = reviewQuote(row);
    if (!quote) continue;
    if (!slug) {
      backfillRows.push(backfillOnlyRow(row, quote));
      continue;
    }

    const cat = resolveCatalog(catalog, slug);
    const reason = resolveExclusion(row, quote, slug);
    const isExcluded = Boolean(reason);

    if (isExcluded) {
      report.excluded += 1;
      report.exclude_reasons[reason] = (report.exclude_reasons[reason] || 0) + 1;
    } else if (cat) {
      report.mapped_to_slug += 1;
      const catLabel = cat.category || 'unknown';
      report.by_category[catLabel] = (report.by_category[catLabel] || 0) + 1;
    } else {
      report.unmapped_slug += 1;
      if (!report.unmapped_slugs.includes(slug)) report.unmapped_slugs.push(slug);
    }

    const pathNorm = cat ? normalizePath(cat.url) : null;
    reviewRows.push({
      source_review_id: row.review_id || null,
      reviewer_name: (row.review_username || row.reviewer || 'Anonymous').trim(),
      review_date: parseReviewDate(row),
      rating: parseRating(row),
      quote,
      source: parseSource(row),
      product_slug: slug,
      url: cat?.url || null,
      category: cat?.category || null,
      page_type: cat?.page_type || null,
      target_keyword: cat?.target_keyword || (pathNorm ? keywordMap.get(pathNorm) : null) || null,
      is_verified: Boolean(row.review_id && /trustpilot|google/i.test(parseSource(row))),
      is_excluded: isExcluded,
      exclude_reason: reason,
    });
  }

  report.reviews_inserted = reviewRows.length;
  const reviewStats = summarizeReviewsBySlug(reviewRows);

  const catalogExport = catalogRows.map((c) => {
    const stats = reviewStats.get(c.product_slug) || {
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
      review_count_total: stats.total,
      review_count_active: stats.active,
      review_count_excluded: stats.excluded,
      has_reviews: stats.total > 0 ? 'yes' : 'no',
      sample_quote: stats.latest_quote,
    };
  });

  const catalogCsvPath = path.join(SHARED_CSV, '07-page-slug-catalog-and-reviews.csv');
  const reviewsCsvPath = path.join(SHARED_CSV, '06-product-reviews-attributed.csv');
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

  const reviewExport = reviewRows.map((r) => {
    const cat = resolveCatalog(catalog, r.product_slug);
    return {
      product_slug: r.product_slug,
      slug_key: cat?.slug_key || '',
      url: r.url,
      category: r.category,
      page_type: r.page_type,
      catalog_source: cat?.catalog_source || '',
      target_keyword: r.target_keyword,
      product_title: cat?.product_title || '',
      reviewer_name: r.reviewer_name,
      review_date: r.review_date,
      rating: r.rating,
      quote: r.quote,
      source: r.source,
      is_excluded: r.is_excluded ? 'yes' : 'no',
      exclude_reason: r.exclude_reason || '',
    };
  });

  writeCsv(catalogCsvPath, catalogCols, catalogExport);
  writeCsv(reviewsCsvPath, reviewCols, reviewExport);
  report.catalog_csv = catalogCsvPath;
  report.reviews_csv = reviewsCsvPath;

  const existing = await loadExistingReviews();
  const plan = planReviewUpsert(existing, [...reviewRows, ...backfillRows]);
  report.upsert = summarisePlan(plan, existing.length);
  fs.writeFileSync(path.join(ROOT, 'scripts', 'product-reviews-upsert-plan.json'), JSON.stringify(plan, null, 2));

  if (dryRun) {
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  for (let i = 0; i < catalogRows.length; i += 200) {
    const { error } = await supabase.from('page_slug_catalog')
      .upsert(catalogRows.slice(i, i + 200), { onConflict: 'slug_key' });
    if (error) throw error;
  }
  await applyReviewPlan(plan);
  report.snapshot_csv = await writeDbSnapshot();

  const reportPath = path.join(ROOT, 'scripts', 'product-reviews-ingest-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));
  console.log(`Report: ${reportPath}`);
  console.log(`Catalog CSV (every slug): ${catalogCsvPath}`);
  console.log(`Reviews CSV: ${reviewsCsvPath}`);
  return report;
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain && process.argv.includes('--snapshot-only')) {
  writeDbSnapshot().then((f) => console.log(`DB snapshot: ${f}`)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else if (isMain) {
  runProductReviewsIngest().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
