import fs from 'fs';
import path from 'path';

const CSV =
  'G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/csv processed';
const OUT = path.join(CSV, '12-trustpilot-named-reviews.txt');

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

const needles = ['kirsten', 'pearce', 'clinton', 'joyce james', 'karen'];
const rows = parseCsv(fs.readFileSync(path.join(CSV, '03a_trustpilot_matched.csv'), 'utf8'));
const lines = [];
for (const row of rows) {
  const u = (row.review_username || '').toLowerCase();
  if (!needles.some((n) => u.includes(n))) continue;
  const q = (row.review_content || row.review_title || '').replace(/\s+/g, ' ').slice(0, 250);
  lines.push(`${row.review_username}\t${row['review_created_(utc)']}\t${row.product_slug}\t${q}`);
}
fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log('lines', lines.length);
