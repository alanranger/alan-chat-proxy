#!/usr/bin/env node
/**
 * Targeted Supabase update for two approved review slug fixes only.
 */
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadSupabaseEnv } from '../lib/load-supabase-env.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadSupabaseEnv();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const UPDATES = [
  {
    id: 669,
    reviewer_name: 'Chris Stamp',
    product_slug: 'yorkshire-dales-photography-workshops',
    url: 'https://www.alanranger.com/photo-workshops-uk/yorkshire-dales-photography-workshops',
    category: 'workshop (residential)',
    page_type: 'workshop',
    is_excluded: false,
    exclude_reason: null,
  },
  {
    id: 764,
    reviewer_name: 'lonnie morris',
    product_slug: 'wales-photography-workshop-pistyll-rhaeadr',
    url: 'https://www.alanranger.com/photo-workshops-uk/wales-photography-workshop-pistyll-rhaeadr',
    category: 'workshop (residential)',
    page_type: 'workshop',
    is_excluded: false,
    exclude_reason: null,
  },
];

for (const row of UPDATES) {
  const { id, ...patch } = row;
  const { data, error } = await supabase
    .from('product_reviews')
    .update(patch)
    .eq('id', id)
    .select('id, reviewer_name, product_slug, is_excluded');
  if (error) throw error;
  console.log('Updated:', data);
}
