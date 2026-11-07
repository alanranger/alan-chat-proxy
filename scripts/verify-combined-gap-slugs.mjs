import fs from 'fs';
import path from 'path';

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

const file = path.join(
  'G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/csv processed',
  '03 – combined_product_reviews.csv'
);
const rows = parseCsv(fs.readFileSync(file, 'utf8'));
const names = [
  'Chris Stamp',
  'Kirsten Pearce',
  'Karen Clothier',
  'Karen Barber',
  'Joyce James',
  'Janice Jordan',
  'Simon',
  'Clinton Rindfuss',
  'lonnie morris',
  'Angie Rondeau',
];
for (const n of names) {
  const hits = rows.filter((r) =>
    (r.reviewer || r.review_username || '').toLowerCase().includes(n.toLowerCase())
  );
  console.log(`\n${n} (${hits.length} rows):`);
  hits.forEach((r) =>
    console.log(`  ${r.product_slug} | ${(r.review || '').slice(0, 60)}`)
  );
}
