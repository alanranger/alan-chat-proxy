#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { loadSupabaseEnv } from '../lib/load-supabase-env.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CSV =
  'G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/csv processed/06-product-reviews-attributed.csv';

loadSupabaseEnv();

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

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchAll() {
  const all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('product_reviews')
      .select('product_slug,reviewer_name,is_excluded,quote')
      .order('id')
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

function key(r) {
  const slug = r.product_slug || '';
  const name = (r.reviewer_name || '').trim();
  const q = (r.quote || '').slice(0, 80);
  return slug + '|' + name + '|' + q;
}

const csv = parseCsv(fs.readFileSync(CSV, 'utf8'));
const db = await fetchAll();
const dbMap = new Map(
  db.map((r) => [
    key(r),
    { product_slug: r.product_slug, is_excluded: r.is_excluded ? 'yes' : 'no' },
  ])
);

let mismatch = 0;
for (const r of csv) {
  const d = dbMap.get(key(r));
  if (!d) {
    mismatch += 1;
    continue;
  }
  if (d.product_slug !== r.product_slug || d.is_excluded !== r.is_excluded) mismatch += 1;
}

console.log(
  JSON.stringify(
    { csv_rows: csv.length, db_rows: db.length, slug_is_excluded_mismatches: mismatch },
    null,
    2
  )
);
