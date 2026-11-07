#!/usr/bin/env node
/**
 * Sync 03 – combined_product_reviews.csv from public.product_reviews (Supabase):
 * product_slug, product_name, reviewer, ingest_is_excluded, ingest_exclude_reason.
 * Ingest reads these columns so the next full ingest matches targeted DB fixes.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { loadSupabaseEnv } from '../lib/load-supabase-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CSV_DIR =
  'G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/csv processed';

loadSupabaseEnv();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
        rows.push({ hdr, cells: row });
      }
      row = [];
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  return { hdr, rows };
}

function serializeCsv(parsed) {
  const esc = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return (
    [parsed.hdr.map(esc).join(',')]
      .concat(parsed.rows.map((r) => r.cells.map(esc).join(',')))
      .join('\n') + '\n'
  );
}

function normQuote(q) {
  return (q || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/['']/g, "'")
    .trim()
    .slice(0, 160);
}

function rowQuote(cells, hdr) {
  const ix = Object.fromEntries(hdr.map((h, i) => [h, i]));
  return (
    cells[ix.review] ||
    cells[ix.reviewBody] ||
    cells[ix.review_content] ||
    ''
  ).trim();
}

function ensureColumn(parsed, name) {
  let ix = parsed.hdr.indexOf(name);
  if (ix >= 0) return ix;
  ix = parsed.hdr.length;
  parsed.hdr.push(name);
  for (const row of parsed.rows) {
    while (row.cells.length < ix) row.cells.push('');
    row.cells.push('');
  }
  return ix;
}

function setCell(row, ix, value) {
  while (row.cells.length <= ix) row.cells.push('');
  row.cells[ix] = value;
}

async function main() {
  const combinedName = fs
    .readdirSync(CSV_DIR)
    .find((f) => f.startsWith('03') && f.includes('combined') && !f.includes('backup'));
  const combinedPath = path.join(CSV_DIR, combinedName);

  const { data: reviews, error: rErr } = await supabase
    .from('product_reviews')
    .select('reviewer_name, product_slug, quote, is_excluded, exclude_reason');
  if (rErr) throw rErr;

  const { data: catalog, error: cErr } = await supabase
    .from('page_slug_catalog')
    .select('product_slug, product_title');
  if (cErr) throw cErr;

  const titleBySlug = new Map();
  for (const c of catalog || []) {
    if (c.product_slug && c.product_title) {
      titleBySlug.set(c.product_slug, c.product_title);
    }
  }

  const byQuote = new Map();
  for (const r of reviews || []) {
    const key = normQuote(r.quote);
    if (!key) continue;
    byQuote.set(key, {
      reviewer_name: r.reviewer_name,
      product_slug: r.product_slug,
      product_title: titleBySlug.get(r.product_slug) || '',
      is_excluded: r.is_excluded ? 'yes' : 'no',
      exclude_reason: r.exclude_reason || '',
    });
  }

  const parsed = parseCsv(fs.readFileSync(combinedPath, 'utf8'));
  const ix = Object.fromEntries(parsed.hdr.map((h, i) => [h, i]));
  const ixExcluded = ensureColumn(parsed, 'ingest_is_excluded');
  const ixExcludeReason = ensureColumn(parsed, 'ingest_exclude_reason');

  let updated = 0;
  let unmatched = 0;
  const changes = [];

  for (const row of parsed.rows) {
    const quote = rowQuote(row.cells, parsed.hdr);
    const key = normQuote(quote);
    const hit = byQuote.get(key);
    if (!hit) {
      unmatched++;
      continue;
    }
    const oldSlug = row.cells[ix.product_slug];
    const oldReviewer = row.cells[ix.reviewer] || row.cells[ix.review_username];
    const newSlug = hit.product_slug;
    const newTitle = hit.product_title || row.cells[ix.product_name];
    const newReviewer = hit.reviewer_name;
    const oldExcluded = row.cells[ixExcluded];
    const oldReason = row.cells[ixExcludeReason];

    const changed =
      oldSlug !== newSlug ||
      oldReviewer !== newReviewer ||
      row.cells[ix.product_name] !== newTitle ||
      oldExcluded !== hit.is_excluded ||
      oldReason !== hit.exclude_reason;

    if (changed) {
      if (oldSlug !== newSlug || oldReviewer !== newReviewer) {
        changes.push({
          from: `${oldReviewer} @ ${oldSlug}`,
          to: `${newReviewer} @ ${newSlug}`,
        });
      }
      row.cells[ix.product_slug] = newSlug;
      if (ix.product_name >= 0) row.cells[ix.product_name] = newTitle;
      if (ix.reviewer >= 0) row.cells[ix.reviewer] = newReviewer;
      if (ix.review_username >= 0) row.cells[ix.review_username] = newReviewer;
      setCell(row, ixExcluded, hit.is_excluded);
      setCell(row, ixExcludeReason, hit.exclude_reason);
      updated++;
    }
  }

  const backupPath = combinedPath.replace(
    '.csv',
    `.backup-${new Date().toISOString().slice(0, 10)}.csv`
  );
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(combinedPath, backupPath);
    console.log('Backup:', backupPath);
  }

  fs.writeFileSync(combinedPath, serializeCsv(parsed), 'utf8');

  console.log(`Matched map entries: ${byQuote.size}`);
  console.log(`Rows updated: ${updated}`);
  console.log(`Rows unchanged (no DB match): ${unmatched}`);
  if (changes.length) {
    console.log('\nSample changes (up to 25):');
    changes.slice(0, 25).forEach((c) => console.log(`  ${c.from} -> ${c.to}`));
  }

  const checkSlugs = [
    'yorkshire-dales-photography-workshops',
    'wales-photography-workshop-pistyll-rhaeadr',
    'dartmoor-photography-landscape-workshop',
    'somerset-landscape-photography-workshops',
    'north-yorkshire-landscape-photography',
    'exmoor-photography-workshops-lynmouth',
  ];
  const text = fs.readFileSync(combinedPath, 'utf8');
  console.log('\nSlug row counts in combined CSV:');
  for (const s of checkSlugs) {
    const n = (text.match(new RegExp(`,${s},`, 'g')) || []).length;
    console.log(`  ${s}: ${n}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
