/**
 * HEAD-check workshop_products + workshop_events + product_schema URLs; delete 404s / listing redirects.
 * node scripts/prune-dead-metadata-urls.mjs
 */
/* global fetch */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const file of [
  resolve(root, '../AI GEO Audit/.env.vercel.prod'),
  resolve(root, '.env.local'),
  resolve(root, '.cursor/.env')
]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!m) continue;
    const val = m[2].replace(/^["']|["']$/g, '');
    if (!process.env[m[1]] || val.startsWith('sb_')) process.env[m[1]] = val;
  }
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});
const types = ['workshop_products', 'workshop_events', 'product_schema', 'site_urls'];
const { data: rows, error } = await sb.from('csv_metadata').select('id, url, csv_type').in('csv_type', types);
if (error) throw error;

const listingRe = /\/(photo-workshops-uk|photographic-workshops-near-me|photography-services-near-me)\/?$/i;
const dead = [];
for (const r of rows || []) {
  if (!r.url) continue;
  try {
    const res = await fetch(r.url, { method: 'HEAD', redirect: 'manual', headers: { 'User-Agent': 'alan-chat-prune/1.0' } });
    let status = res.status;
    let loc = res.headers.get('location') || '';
    if (status === 405 || status === 403) {
      const g = await fetch(r.url, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': 'alan-chat-prune/1.0' } });
      status = g.status;
      loc = g.headers.get('location') || loc;
    }
    const toListing = (status === 301 || status === 302 || status === 308) && listingRe.test(loc.split('?')[0]);
    if (status === 404 || toListing) dead.push({ ...r, status, loc });
  } catch (e) {
    dead.push({ ...r, status: 'err', loc: String(e.message || e) });
  }
}

const ids = dead.map((d) => d.id);
for (let i = 0; i < ids.length; i += 80) {
  const batch = ids.slice(i, i + 80);
  await sb.from('page_entities').update({ csv_metadata_id: null }).in('csv_metadata_id', batch);
  await sb.from('csv_metadata').delete().in('id', batch);
  const urls = dead.slice(i, i + 80).map((d) => d.url);
  await sb.from('page_entities').delete().in('url', urls);
}

console.log(JSON.stringify({
  checked: (rows || []).length,
  removed: dead.length,
  sample: dead.slice(0, 15)
}, null, 2));
