/**
 * Import one shared CSV type via local csv-import handler.
 * Usage: node scripts/import-csv-type-now.mjs workshop_products
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const csvType = process.argv[2] || 'workshop_products';
const map = {
  workshop_products: '../alan-shared-resources/csv/05-photo-workshops-uk-landscape.csv',
  site_urls: '../alan-shared-resources/csv/06-site-urls.csv',
  product_schema: '../alan-shared-resources/csv/07-product-schema-with-review-ratings.csv',
  workshop_events: '../alan-shared-resources/csv/03-photographic-workshops-near-me.csv'
};
for (const file of [
  resolve(root, '../AI GEO Audit/.env.vercel.prod'),
  resolve(root, '.env.local'),
  resolve(root, '.env.BAK'),
  resolve(root, '.cursor/.env')
]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!m) continue;
    const val = m[2].replace(/^["']|["']$/g, '');
    if (!process.env[m[1]] || val.startsWith('sb_') || m[1] === 'INGEST_TOKEN') process.env[m[1]] = val;
  }
}
const csvPath = resolve(root, map[csvType]);
const csvData = readFileSync(csvPath, 'utf8');
const token = process.env.INGEST_TOKEN || '';
const req = {
  method: 'POST',
  body: { contentType: 'metadata', csvType, csvData },
  headers: { authorization: token ? `Bearer ${token}` : '' }
};
let status = 0; let payload = null;
const res = { setHeader() {}, status(c) { status = c; return this; }, send(s) { payload = typeof s === 'string' ? JSON.parse(s) : s; } };
const { default: handler } = await import('../api/csv-import.js');
await handler(req, res);
console.log(JSON.stringify({ csvType, status, payload }, null, 2));
