import fs from 'fs';
import path from 'path';

const CSV_DIR =
  'G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/csv processed';

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

function normQuote(q) {
  return (q || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120);
}

const combined = parseCsv(
  fs.readFileSync(path.join(CSV_DIR, '03 – combined_product_reviews.csv'), 'utf8')
);
const byQuote = new Map();
for (const r of combined) {
  const q = normQuote(r.review || r.reviewBody || r.review_content);
  if (q) byQuote.set(q, { slug: r.product_slug, name: r.product_name, reviewer: r.reviewer || r.review_username });
}

const bPath = path.join(CSV_DIR, '03b_google_matched.csv');
const parsed = parseCsv(fs.readFileSync(bPath, 'utf8'));
let n = 0;
for (const row of parsed) {
  const q = normQuote(row.review);
  const hit = byQuote.get(q);
  if (!hit) continue;
  if (row.product_slug !== hit.slug) {
    row.product_slug = hit.slug;
    row.product_name = hit.name || row.product_name;
    n++;
  }
}

const esc = (v) => {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
};
const hdr = Object.keys(parsed[0] || {});
const out = [hdr.join(',')].concat(parsed.map((r) => hdr.map((h) => esc(r[h])).join(',')));
fs.writeFileSync(bPath, out.join('\n') + '\n', 'utf8');
console.log('03b rows updated:', n);
