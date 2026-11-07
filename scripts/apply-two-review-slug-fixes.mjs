#!/usr/bin/env node
/**
 * Apply approved slug fixes (Chris Stamp, Lonnie Morris) to local review CSVs only.
 * Does NOT touch Supabase — use apply-two-review-slug-fixes-supabase.mjs or MCP SQL separately.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_DIR =
  'G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/csv processed';

const FIXES = [
  {
    reviewerMatch: /chris\s+stamp/i,
    oldSlug: 'north-yorkshire-landscape-photography',
    newSlug: 'yorkshire-dales-photography-workshops',
    newProductName: 'Landscape YORKSHIRE DALES Photography Workshop - 16 - 18 Apr',
    newUrl:
      'https://www.alanranger.com/photo-workshops-uk/yorkshire-dales-photography-workshops',
    clearExclusion: true,
  },
  {
    reviewerMatch: /lonnie\s+morris/i,
    oldSlug: 'landscape-photography-wales-photo-workshop',
    newSlug: 'wales-photography-workshop-pistyll-rhaeadr',
    newProductName: 'Wales Photography Workshop | Pistyll Rhaeadr',
    newUrl:
      'https://www.alanranger.com/photo-workshops-uk/wales-photography-workshop-pistyll-rhaeadr',
    clearExclusion: false,
  },
];

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
  const lines = [parsed.hdr.map(esc).join(',')];
  for (const r of parsed.rows) {
    lines.push(r.cells.map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function patchCombinedFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const parsed = parseCsv(text);
  let changed = 0;
  const slugIx = parsed.hdr.indexOf('product_slug');
  const nameIx = parsed.hdr.indexOf('product_name');
  const reviewerIx = Math.max(
    parsed.hdr.indexOf('reviewer'),
    parsed.hdr.indexOf('review_username')
  );
  const urlIx = parsed.hdr.indexOf('domain_url');

  for (const row of parsed.rows) {
    const reviewer = row.cells[reviewerIx] || '';
    const slug = row.cells[slugIx] || '';
    for (const fix of FIXES) {
      if (!fix.reviewerMatch.test(reviewer)) continue;
      if (slug !== fix.oldSlug && !fix.reviewerMatch.test(reviewer)) continue;
      row.cells[slugIx] = fix.newSlug;
      if (nameIx >= 0) row.cells[nameIx] = fix.newProductName;
      changed++;
      console.log(`  ${path.basename(filePath)}: ${reviewer} -> ${fix.newSlug}`);
    }
  }
  if (changed) fs.writeFileSync(filePath, serializeCsv(parsed), 'utf8');
  return changed;
}

function patchAttributed(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const parsed = parseCsv(text);
  let changed = 0;
  const cols = parsed.hdr;
  const ix = Object.fromEntries(cols.map((h, i) => [h, i]));

  for (const row of parsed.rows) {
    const reviewer = row.cells[ix.reviewer_name] || '';
    for (const fix of FIXES) {
      if (!fix.reviewerMatch.test(reviewer)) continue;
      if (row.cells[ix.product_slug] !== fix.oldSlug && row.cells[ix.product_slug] !== fix.newSlug)
        continue;
      row.cells[ix.product_slug] = fix.newSlug;
      row.cells[ix.slug_key] = `photo-workshops-uk/${fix.newSlug}`;
      row.cells[ix.url] = fix.newUrl;
      if (fix.clearExclusion) {
        row.cells[ix.is_excluded] = 'no';
        row.cells[ix.exclude_reason] = '';
      }
      changed++;
      console.log(`  attributed: ${reviewer} -> ${fix.newSlug}`);
    }
  }
  if (changed) fs.writeFileSync(filePath, serializeCsv(parsed), 'utf8');
  return changed;
}

function patchGoogleMatched(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const parsed = parseCsv(text);
  let changed = 0;
  const slugIx = parsed.hdr.indexOf('product_slug');
  const nameIx = parsed.hdr.indexOf('product_name');
  const revIx = parsed.hdr.indexOf('reviewer');

  for (const row of parsed.rows) {
    const reviewer = row.cells[revIx] || '';
    for (const fix of FIXES) {
      if (!fix.reviewerMatch.test(reviewer)) continue;
      if (row.cells[slugIx] !== fix.oldSlug) continue;
      row.cells[slugIx] = fix.newSlug;
      if (nameIx >= 0) row.cells[nameIx] = fix.newProductName;
      changed++;
      console.log(`  google matched: ${reviewer} -> ${fix.newSlug}`);
    }
  }
  if (changed) fs.writeFileSync(filePath, serializeCsv(parsed), 'utf8');
  return changed;
}

function main() {
  const combined = path.join(CSV_DIR, '03 – combined_product_reviews.csv');
  const attributed = path.join(CSV_DIR, '06-product-reviews-attributed.csv');
  const google = path.join(CSV_DIR, '03b_google_matched.csv');

  console.log('Patching local CSVs...');
  const n1 = patchCombinedFile(combined);
  const n2 = patchAttributed(attributed);
  const n3 = patchGoogleMatched(google);
  console.log(`Done: combined=${n1}, attributed=${n2}, google=${n3}`);
}

main();
