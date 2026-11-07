#!/usr/bin/env node
/**
 * Build full site URL list (incl. noindex/hidden) and gallery list from live map + Supabase.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createClient } from '@supabase/supabase-js';
import { loadSupabaseEnv } from '../lib/load-supabase-env.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadSupabaseEnv();

const SHARED_CSV =
  'G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/csv processed';
const MAP_FILE =
  'C:/Users/alan/.cursor/projects/g-Dropbox-alan-ranger-photography-Website-Code-Chat-AI-Bot/agent-tools/6cbc96ef-11fc-46cc-ab92-b51f7e02e196.txt';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function norm(u) {
  return u
    .trim()
    .replace(/^http:\/\//i, 'https://')
    .replace(/\/$/, '')
    .split('#')[0];
}

function pathOnly(u) {
  try {
    return new URL(norm(u)).pathname.toLowerCase();
  } catch {
    return '';
  }
}

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

function policyFor(pathname, policies) {
  for (const p of policies) {
    const prefix = p.url_or_prefix.startsWith('/') ? p.url_or_prefix : `/${p.url_or_prefix}`;
    if (p.match_type === 'prefix' && pathname.startsWith(prefix.toLowerCase())) return p;
    if (p.match_type === 'exact' && pathname === prefix.toLowerCase()) return p;
  }
  return null;
}

function writeCsv(file, cols, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  fs.writeFileSync(file, cols.join(',') + '\n' + rows.map((r) => cols.map((c) => esc(r[c])).join(',')).join('\n'), 'utf8');
}

async function main() {
  const galleryFromScrape = [
    'https://www.alanranger.com/gallery-image-portfolios',
    'https://www.alanranger.com/fine-art-prints/latest-photography-images',
    'https://www.alanranger.com/fine-art-prints/serenity-photography-collection',
    'https://www.alanranger.com/fine-art-prints/collection-tree-bark-photography',
    'https://www.alanranger.com/fine-art-prints/collection-woodland-photography-spirit',
    'https://www.alanranger.com/fine-art-prints/collection-rock-photography-study',
    'https://www.alanranger.com/fine-art-prints/collection-a-love-of-emptiness-photography',
    'https://www.alanranger.com/fine-art-prints/collection-coastline-minimalist-photography',
    'https://www.alanranger.com/fine-art-prints/collection-water-abstracts-photography',
    'https://www.alanranger.com/fine-art-prints/collection-lake-reflections-photography',
    'https://www.alanranger.com/fine-art-prints/anglesey-photography-photo-spots',
    'https://www.alanranger.com/fine-art-prints/batsford-arboretum-photography',
    'https://www.alanranger.com/fine-art-prints/dartmoor-photography-prints',
    'https://www.alanranger.com/fine-art-prints/ireland-photography-prints',
    'https://www.alanranger.com/fine-art-prints/devon-photography-prints',
    'https://www.alanranger.com/fine-art-prints-/lake-district-photography',
    'https://www.alanranger.com/fine-art-prints/peak-district-photography',
    'https://www.alanranger.com/fine-art-prints/wales-photography-images',
    'https://www.alanranger.com/fine-art-prints/glencoe-photography-prints',
    'https://www.alanranger.com/fine-art-prints/warwickshire-photography-images',
    'https://www.alanranger.com/fine-art-prints/chesterton-photography-prints',
    'https://www.alanranger.com/fine-art-prints/dorset-photography-prints',
    'https://www.alanranger.com/fine-art-prints/norfolk-photography-images',
    'https://www.alanranger.com/fine-art-prints/somerset-photography-prints',
    'https://www.alanranger.com/fine-art-prints/yorkshire-photography-images',
    'https://www.alanranger.com/fine-art-prints/coventry-photography-spots',
    'https://www.alanranger.com/fine-art-prints/french-riviera-photography',
    'https://www.alanranger.com/fine-art-prints/northumbria-photography-images',
    'https://www.alanranger.com/fine-art-prints/suffolk-photography-images',
    'https://www.alanranger.com/fine-art-prints',
  ].map(norm);

  const urlSet = new Map();

  function add(url, meta = {}) {
    const u = norm(url);
    if (!u.includes('alanranger.com')) return;
    const existing = urlSet.get(u) || { url: u };
    urlSet.set(u, { ...existing, ...meta, url: u });
  }

  if (fs.existsSync(MAP_FILE)) {
    const map = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
    for (const link of map.links || []) add(link.url, { source: 'firecrawl_map' });
  }

  for (const u of galleryFromScrape) add(u, { source: 'gallery_hub_scrape', is_gallery: 'yes' });

  const landing = parseCsv(fs.readFileSync(path.join(SHARED_CSV, 'landing-pages.csv'), 'utf8'));
  for (const row of landing) add(row.url, { source: 'landing_pages_csv', page_type: row.page_type });

  const { data: catalog } = await supabase.from('page_slug_catalog').select('url, page_type, category');
  for (const row of catalog || []) add(row.url, { source: 'page_slug_catalog', page_type: row.page_type, category: row.category });

  let offset = 0;
  while (true) {
    const { data, error } = await supabase.from('csv_metadata').select('url, csv_type').order('id').range(offset, offset + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) add(row.url, { source: 'csv_metadata', csv_type: row.csv_type });
    if (data.length < 1000) break;
    offset += 1000;
  }

  const { data: events } = await supabase.from('event').select('url');
  for (const row of events || []) if (row.url) add(row.url, { source: 'event_table', page_type: 'event' });

  const { data: policies } = await supabase.from('page_indexability_policy').select('*');
  const { data: gsc } = await supabase
    .from('gsc_url_inspection_cache')
    .select('page_url, indexed, verdict, coverage_state');

  const gscMap = new Map();
  for (const row of gsc || []) {
    const u = norm(`https://www.alanranger.com/${row.page_url.replace(/^\//, '')}`);
    gscMap.set(u, row);
  }

  const rows = [];
  for (const entry of urlSet.values()) {
    const p = pathOnly(entry.url);
    const pol = policyFor(p, policies || []);
    const g = gscMap.get(entry.url);
    const isGallery =
      entry.is_gallery === 'yes' ||
      p.includes('gallery-image-portfolios') ||
      p.startsWith('/fine-art-prints');
    rows.push({
      url: entry.url,
      path: p,
      is_gallery: isGallery ? 'yes' : 'no',
      source: entry.source || '',
      page_type: entry.page_type || '',
      category: entry.category || '',
      csv_type: entry.csv_type || '',
      indexability_policy: pol?.policy || '',
      policy_note: pol?.note || '',
      gsc_indexed: g?.indexed === true ? 'yes' : g?.indexed === false ? 'no' : '',
      gsc_verdict: g?.verdict || '',
      gsc_coverage: g?.coverage_state || '',
      likely_hidden_from_google:
        pol?.policy === 'intentional_noindex' || pol?.policy === 'retired_redirect' || g?.indexed === false
          ? 'yes'
          : '',
    });
  }

  rows.sort((a, b) => a.url.localeCompare(b.url));

  const galleryList = [...new Set(rows.filter((r) => r.is_gallery === 'yes').map((r) => r.url))].sort();
  const galleryTxt = path.join(SHARED_CSV, '08-gallery-urls-list.txt');
  fs.writeFileSync(galleryTxt, galleryList.join('\n') + '\n', 'utf8');

  const sitemapCsv = path.join(SHARED_CSV, '08-full-site-sitemap-with-indexability.csv');
  const cols = [
    'url',
    'path',
    'is_gallery',
    'likely_hidden_from_google',
    'indexability_policy',
    'policy_note',
    'gsc_indexed',
    'gsc_verdict',
    'gsc_coverage',
    'source',
    'page_type',
    'category',
    'csv_type',
  ];
  writeCsv(sitemapCsv, cols, rows);

  console.log(JSON.stringify({
    total_urls: rows.length,
    gallery_urls: galleryList.length,
    hidden_or_noindex: rows.filter((r) => r.likely_hidden_from_google === 'yes').length,
    gallery_txt: galleryTxt,
    sitemap_csv: sitemapCsv,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
