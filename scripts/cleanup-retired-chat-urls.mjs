/**
 * One-off: remove retired workshop product/event URLs + stale 2025 service entities.
 * node scripts/cleanup-retired-chat-urls.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const name of ['.env.local', '.env', '.env.vercel.prod']) {
  try {
    for (const line of readFileSync(resolve(root, name), 'utf8').split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (!m) continue;
      const val = m[2].replace(/^["']|["']$/g, '');
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch { /* optional */ }
}

const RETIRED = [
  'https://www.alanranger.com/photo-workshops-uk/coastal-northumberland-photography-workshops',
  'https://www.alanranger.com/photo-workshops-uk/exmoor-photography-workshops-lynmouth',
  'https://www.alanranger.com/photo-workshops-uk/landscape-photography-snowdonia-workshops',
  'https://www.alanranger.com/photo-workshops-uk/north-yorkshire-landscape-photography',
  'https://www.alanranger.com/photographic-workshops-near-me/landscape-photography-snowdonia-workshop',
  'https://www.alanranger.com/photographic-workshops-near-me/lake-district-photography-workshop-spring',
  'https://www.alanranger.com/photographic-workshops-near-me/hartland-quay-photography-devon-seascapes',
  'https://www.alanranger.com/photographic-workshops-near-me/landscape-photography-wales-gower-peninsular',
  'https://www.alanranger.com/photographic-workshops-near-me/landscape-photography-workshops-yorkshire'
];

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function deleteByUrls(table, urls) {
  const { data, error } = await sb.from(table).delete().in('url', urls).select('id, url');
  if (error) throw error;
  return data || [];
}

const meta = await deleteByUrls('csv_metadata', RETIRED);
// nullify then delete page_entities by url
const { data: ents } = await sb.from('page_entities').select('id, url, kind, last_seen').in('url', RETIRED);
const entIds = (ents || []).map((e) => e.id);
if (entIds.length) {
  await sb.from('page_chunks').update({ page_entity_id: null }).in('page_entity_id', entIds).then(() => {});
  await sb.from('page_entities').delete().in('id', entIds);
}

const { data: staleServices } = await sb
  .from('page_entities')
  .select('id, url, kind, last_seen')
  .eq('kind', 'service')
  .lte('last_seen', '2025-10-13')
  .gte('last_seen', '2025-10-11');
const svcIds = (staleServices || []).map((e) => e.id);
if (svcIds.length) {
  await sb.from('page_entities').delete().in('id', svcIds);
}

const check = await sb.from('csv_metadata').select('url').in('url', RETIRED);
const checkPe = await sb.from('page_entities').select('url').in('url', RETIRED);

console.log(JSON.stringify({
  csv_metadata_deleted: meta.length,
  page_entities_retired_deleted: (ents || []).length,
  stale_service_deleted: svcIds.length,
  remaining_csv_metadata: (check.data || []).length,
  remaining_page_entities: (checkPe.data || []).length,
  retired_urls: RETIRED.length
}, null, 2));
