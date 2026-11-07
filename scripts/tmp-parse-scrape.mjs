import fs from 'fs';
const p = process.argv[2];
let raw = fs.readFileSync(p, 'utf8');
let html = raw;
try {
  const j = JSON.parse(raw);
  html = j.rawHtml || j.html || raw;
} catch (_) {}

const markers = [
  'accordion-icon-container',
  'ar-reviews',
  'inline-flex',
  'transform: none',
  'accordion-item__click-target',
  'ProductItem-additional',
  'sqs-purchase',
  'sticky',
];

for (const m of markers) {
  const idx = html.indexOf(m);
  console.log(m, idx >= 0 ? `found @${idx}` : 'NOT FOUND');
  if (idx >= 0) {
    console.log(html.slice(Math.max(0, idx - 200), idx + 400).replace(/\s+/g, ' ').slice(0, 500));
    console.log('---');
  }
}
