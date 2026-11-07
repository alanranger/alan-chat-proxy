#!/usr/bin/env node
/** Sync gap attribution changes into combined + attributed CSVs */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const CSV_DIR =
  'G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/csv processed';

const CHANGES = [
  {
    matchReviewer: /^clinton rindfuss$/i,
    oldSlug: 'dartmoor-photography-landscape-workshop',
    action: 'exclude',
  },
  {
    matchReviewer: /^KP$/i,
    matchSlug: 'beginners-photography-course',
    newSlug: 'dartmoor-photography-landscape-workshop',
    newReviewer: 'Kirsten Pearce',
    newProductName: 'DARTMOOR Photography Workshop - Landscapes - 9th - 11th Oct',
  },
  {
    matchReviewer: /^Karen Barber$/i,
    matchSlug: 'lake-district-photography-workshop',
    newSlug: 'somerset-landscape-photography-workshops',
    newProductName: 'SOMERSET Landscape Photography Workshops 9 - 11 May 2025',
  },
  {
    matchReviewer: /^Joyce James$/i,
    matchSlug: 'rps-mentoring-photography-course',
    newSlug: 'north-yorkshire-landscape-photography',
    newProductName: 'NORTH YORKSHIRE Landscape Photography Workshop - Sep 2026',
    clearExclude: true,
  },
  {
    matchReviewer: /^Janice Jordan$/i,
    matchSlug: 'lightroom-courses-for-beginners-coventry',
    matchQuoteIncludes: 'Over the last 2 years I have attended many',
    newSlug: 'north-yorkshire-landscape-photography',
    newProductName: 'NORTH YORKSHIRE Landscape Photography Workshop - Sep 2026',
    clearExclude: true,
  },
  {
    matchReviewer: /^KP$/i,
    matchSlug: 'four-private-photography-classes',
    newSlug: 'north-yorkshire-landscape-photography',
    newReviewer: 'Kirsten Pearce',
    newProductName: 'NORTH YORKSHIRE Landscape Photography Workshop - Sep 2026',
    clearExclude: true,
  },
  {
    matchReviewer: /^Angie Rondeau$/i,
    matchSlug: 'exmoor-photography-workshops-lynmouth',
    action: 'exclude',
  },
  {
    matchReviewer: /^Simon\s+Wright$/i,
    matchSlug: 'landscape-photography-snowdonia-workshops',
    newSlug: 'exmoor-photography-workshops-lynmouth',
    newProductName: 'EXMOOR Photography Workshop - Sat 18 - Sun 19 Jul 2026',
    clearExclude: true,
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
  return (
    [parsed.hdr.map(esc).join(',')]
      .concat(parsed.rows.map((r) => r.cells.map(esc).join(',')))
      .join('\n') + '\n'
  );
}

function patchCombined(filePath) {
  const parsed = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const ix = {
    slug: parsed.hdr.indexOf('product_slug'),
    name: parsed.hdr.indexOf('product_name'),
    reviewer: Math.max(
      parsed.hdr.indexOf('reviewer'),
      parsed.hdr.indexOf('review_username')
    ),
    review: parsed.hdr.indexOf('review'),
  };
  let n = 0;
  for (const row of parsed.rows) {
    const reviewer = row.cells[ix.reviewer] || '';
    const slug = row.cells[ix.slug] || '';
    const quote = row.cells[ix.review] || '';
    for (const ch of CHANGES) {
      if (!ch.matchReviewer.test(reviewer)) continue;
      if (ch.matchSlug && slug !== ch.matchSlug) continue;
      if (ch.matchQuoteIncludes && !quote.includes(ch.matchQuoteIncludes)) continue;
      if (ch.action === 'exclude') continue;
      if (ch.newSlug) row.cells[ix.slug] = ch.newSlug;
      if (ch.newProductName && ix.name >= 0) row.cells[ix.name] = ch.newProductName;
      if (ch.newReviewer) row.cells[ix.reviewer] = ch.newReviewer;
      n++;
    }
  }
  if (n) fs.writeFileSync(filePath, serializeCsv(parsed), 'utf8');
  return n;
}

function patchAttributed(filePath) {
  const parsed = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const cols = Object.fromEntries(parsed.hdr.map((h, i) => [h, i]));
  const urlMap = {
    'dartmoor-photography-landscape-workshop':
      'https://www.alanranger.com/photo-workshops-uk/dartmoor-photography-landscape-workshop',
    'somerset-landscape-photography-workshops':
      'https://www.alanranger.com/photo-workshops-uk/somerset-landscape-photography-workshops',
    'north-yorkshire-landscape-photography':
      'https://www.alanranger.com/photo-workshops-uk/north-yorkshire-landscape-photography',
    'exmoor-photography-workshops-lynmouth':
      'https://www.alanranger.com/photo-workshops-uk/exmoor-photography-workshops-lynmouth',
  };
  let n = 0;
  for (const row of parsed.rows) {
    const reviewer = row.cells[cols.reviewer_name] || '';
    const slug = row.cells[cols.product_slug] || '';
    const quote = row.cells[cols.quote] || '';
    for (const ch of CHANGES) {
      if (!ch.matchReviewer.test(reviewer)) continue;
      if (ch.matchSlug && slug !== ch.matchSlug) continue;
      if (ch.matchQuoteIncludes && !quote.includes(ch.matchQuoteIncludes)) continue;
      if (ch.action === 'exclude') {
        row.cells[cols.is_excluded] = 'yes';
        row.cells[cols.exclude_reason] = 'gap_tile_reassignment';
        n++;
        continue;
      }
      if (ch.newSlug) {
        row.cells[cols.product_slug] = ch.newSlug;
        row.cells[cols.slug_key] = `photo-workshops-uk/${ch.newSlug}`;
        row.cells[cols.url] = urlMap[ch.newSlug] || row.cells[cols.url];
        if (ch.newReviewer) row.cells[cols.reviewer_name] = ch.newReviewer;
        if (ch.clearExclude) {
          row.cells[cols.is_excluded] = 'no';
          row.cells[cols.exclude_reason] = '';
        }
        n++;
      }
    }
  }
  if (n) fs.writeFileSync(filePath, serializeCsv(parsed), 'utf8');
  return n;
}

const combined = path.join(CSV_DIR, '03 – combined_product_reviews.csv');
const attributed = path.join(CSV_DIR, '06-product-reviews-attributed.csv');
console.log('combined', patchCombined(combined));
console.log('attributed', patchAttributed(attributed));
