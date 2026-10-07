/**
 * Rebuild 05 from Squarespace raw export, excluding Visible=No.
 * Keeps only photo-workshops-uk product pages.
 * node scripts/filter-05-hidden-products.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const shared = resolve(dirname(fileURLToPath(import.meta.url)), '../../alan-shared-resources/csv');
const rawPath = resolve(shared, 'raw-01-products-sqsp-export.csv');
const outPath = resolve(shared, '05-photo-workshops-uk-landscape.csv');

function parseCsv(text) {
  // Use a line-oriented fallback: RFC4180 via regex split for ingest prep only
  const lines = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQ && text[i + 1] === '"') { cur += '"'; i++; continue; }
      inQ = !inQ; cur += ch; continue;
    }
    if ((ch === '\n' || ch === '\r') && !inQ) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      lines.push(cur); cur = ''; continue;
    }
    cur += ch;
  }
  if (cur) lines.push(cur);
  return lines.map((line) => {
    const out = []; let f = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { f += '"'; i++; } else q = !q; continue; }
      if (c === ',' && !q) { out.push(f); f = ''; continue; }
      f += c;
    }
    out.push(f); return out;
  });
}

function toCsv(rows) {
  return rows.map((r) => r.map((c) => {
    const s = String(c ?? '');
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }).join(',')).join('\n') + '\n';
}

const raw = parseCsv(readFileSync(rawPath, 'utf8'));
const headers = raw[0].map((h) => h.replace(/^\uFEFF/, '').trim());
const idx = (re) => headers.findIndex((h) => re.test(h));
const visIdx = idx(/^visible$/i);
const pageIdx = idx(/product page/i);
const slugIdx = idx(/product url/i);
const titleIdx = idx(/^title$/i);
const catIdx = idx(/^categories$/i);
const tagIdx = idx(/^tags$/i);
const imgIdx = idx(/host.?image/i);

const outHeaders = ['Title', 'Url Id', 'Full Url', 'Categories', 'Tags', 'Publish On', 'Image', 'Visible'];
const kept = [outHeaders];
let skipped = 0;
let skippedPage = 0;
const seen = new Set();

for (const r of raw.slice(1)) {
  const page = String(r[pageIdx] || '').trim();
  if (page !== 'photo-workshops-uk') { skippedPage += 1; continue; }
  const vis = String(r[visIdx] || 'Yes').trim().toLowerCase();
  if (vis === 'no' || vis === 'false' || vis === 'hidden') { skipped += 1; continue; }
  const slug = String(r[slugIdx] || '').trim();
  if (!slug || seen.has(slug)) continue;
  seen.add(slug);
  const full = `https://www.alanranger.com/photo-workshops-uk/${slug}`;
  kept.push([
    r[titleIdx] || '',
    slug,
    full,
    r[catIdx] || '',
    r[tagIdx] || '',
    '',
    r[imgIdx] || '',
    'Yes'
  ]);
}

writeFileSync(outPath, toCsv(kept), 'utf8');
console.log(JSON.stringify({
  outPath,
  kept: kept.length - 1,
  skipped_hidden: skipped,
  skipped_other_page: skippedPage,
  sample: kept.slice(1, 4).map((r) => r[2])
}, null, 2));

