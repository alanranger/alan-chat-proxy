/**
 * Refresh 07 CSV then import product_schema into Supabase (full-replace).
 * Prefer AI GEO Audit .env.vercel.prod secret key (same project) when local legacy keys are disabled.
 * node scripts/import-07-product-schema-now.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envCandidates = [
  resolve(root, '../AI GEO Audit/.env.vercel.prod'),
  resolve(root, '../AI GEO Audit/.env.local'),
  resolve(root, '.env.local'),
  resolve(root, '.env.BAK'),
  resolve(root, '.cursor/.env')
];
for (const file of envCandidates) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!m) continue;
    const val = m[2].replace(/^["']|["']$/g, '');
    // Prefer non-legacy sb_ keys / freshest file order
    if (!process.env[m[1]] || val.startsWith('sb_') || m[1] === 'INGEST_TOKEN' || m[1] === 'ADMIN_UI_TOKEN') {
      process.env[m[1]] = val;
    }
  }
}

spawnSync(process.execPath, [resolve(root, 'scripts/refresh-07-product-schema-ingest.mjs')], { stdio: 'inherit' });

const csvPath = resolve(root, '../alan-shared-resources/csv/07-product-schema-with-review-ratings.csv');
const csvData = readFileSync(csvPath, 'utf8');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE || process.env.SERVICD_ROLE;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SERVICE_ROLE_KEY');
  process.exit(1);
}
console.log('Using key prefix', key.slice(0, 6) + '…');

const sb = createClient(url, key, { auth: { persistSession: false } });
// Smoke test
const smoke = await sb.from('csv_metadata').select('url', { count: 'exact', head: true }).eq('csv_type', 'product_schema');
if (smoke.error) {
  console.error('Supabase auth failed:', smoke.error.message);
  process.exit(1);
}

// Minimal POST simulation
const token = process.env.INGEST_TOKEN || process.env.ADMIN_UI_TOKEN || '';
const req = {
  method: 'POST',
  body: { contentType: 'metadata', csvType: 'product_schema', csvData },
  headers: { authorization: token ? `Bearer ${token}` : '' }
};
let status = 0;
let payload = null;
const res = {
  setHeader() {},
  status(code) { status = code; return this; },
  send(s) { payload = typeof s === 'string' ? JSON.parse(s) : s; }
};

// Import parse + importProductSchemaMetadata by evaluating through handler
const mod = await import('../api/csv-import.js');
if (typeof mod.default === 'function') {
  await mod.default(req, res);
  console.log(JSON.stringify({ status, payload }, null, 2));
} else {
  console.error('csv-import has no default export handler');
  process.exit(1);
}

const after = await sb.from('csv_metadata').select('url', { count: 'exact', head: true }).eq('csv_type', 'product_schema');
console.log('product_schema count', after.count);
