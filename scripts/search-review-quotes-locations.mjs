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

const rows = parseCsv(
  fs.readFileSync(path.join(CSV_DIR, '03 – combined_product_reviews.csv'), 'utf8')
);
const keys = [
  'dartmoor',
  'exmoor',
  'lynmouth',
  'anglesey',
  'llanddwyn',
  'pistyll',
  'vyrnwy',
  'suffolk',
  'northumberland',
  'northumbria',
  'ireland',
  'dingle',
  'yorkshire dales',
  'north yorkshire',
  'hartland',
];
for (const k of keys) {
  const hits = rows.filter((r) => {
    const q = (r.review || r.reviewBody || '').toLowerCase();
    return q.includes(k);
  });
  console.log(`\n=== ${k} (${hits.length}) ===`);
  hits.slice(0, 5).forEach((r) => {
    console.log(
      r.reviewer,
      r.date_parsed,
      r.product_slug,
      (r.review || '').slice(0, 120)
    );
  });
}
