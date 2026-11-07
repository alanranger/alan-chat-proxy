#!/usr/bin/env node
/**
 * Re-attribute real workshop reviews to gap tiles using booking-sheet attendees.
 * Moves each quote once (no duplicate text on multiple slugs).
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

const SLUGS = {
  dartmoor: {
    product_slug: 'dartmoor-photography-landscape-workshop',
    url: 'https://www.alanranger.com/photo-workshops-uk/dartmoor-photography-landscape-workshop',
    category: 'workshop (residential)',
    page_type: 'workshop',
  },
  somerset: {
    product_slug: 'somerset-landscape-photography-workshops',
    url: 'https://www.alanranger.com/photo-workshops-uk/somerset-landscape-photography-workshops',
    category: 'workshop (residential)',
    page_type: 'workshop',
  },
  northYorkshire: {
    product_slug: 'north-yorkshire-landscape-photography',
    url: 'https://www.alanranger.com/photo-workshops-uk/north-yorkshire-landscape-photography',
    category: 'workshop (residential)',
    page_type: 'workshop',
  },
  exmoor: {
    product_slug: 'exmoor-photography-workshops-lynmouth',
    url: 'https://www.alanranger.com/photo-workshops-uk/exmoor-photography-workshops-lynmouth',
    category: 'workshop (residential)',
    page_type: 'workshop',
  },
};

const UPDATES = [
  {
    id: 1011,
    patch: {
      is_excluded: true,
      exclude_reason: 'not_dartmoor_attendee_superseded',
    },
    note: 'Clinton Rindfuss off Dartmoor',
  },
  {
    id: 928,
    patch: {
      reviewer_name: 'Kirsten Pearce',
      ...SLUGS.dartmoor,
      is_excluded: false,
      exclude_reason: null,
    },
    note: 'KP generic workshops quote -> Dartmoor (Kirsten Pearce booked Dartmoor)',
  },
  {
    id: 939,
    patch: {
      ...SLUGS.somerset,
      is_excluded: false,
      exclude_reason: null,
    },
    note: 'Karen Barber workshop quote -> Somerset',
  },
  {
    id: 848,
    patch: {
      ...SLUGS.northYorkshire,
      is_excluded: false,
      exclude_reason: null,
    },
    note: 'Joyce James -> North Yorkshire (Aug 2020 booking)',
  },
  {
    id: 930,
    patch: {
      ...SLUGS.northYorkshire,
      is_excluded: false,
      exclude_reason: null,
    },
    note: 'Janice Jordan multi-workshop quote -> North Yorkshire (Aug 2020 booking)',
  },
  {
    id: 860,
    patch: {
      reviewer_name: 'Kirsten Pearce',
      ...SLUGS.northYorkshire,
      is_excluded: false,
      exclude_reason: null,
    },
    note: 'KP evening workshop quote -> North Yorkshire (Aug 2020 booking)',
  },
  {
    id: 926,
    patch: {
      is_excluded: true,
      exclude_reason: 'superseded_by_workshop_specific_quote',
    },
    note: 'Angie Rondeau generic line excluded',
  },
  {
    id: 1178,
    patch: {
      ...SLUGS.exmoor,
      is_excluded: false,
      exclude_reason: null,
    },
    note: 'Simon Wright first-workshop quote -> Exmoor/Lynmouth (generic, no other location)',
  },
];

for (const { id, patch, note } of UPDATES) {
  const { data, error } = await supabase
    .from('product_reviews')
    .update(patch)
    .eq('id', id)
    .select('id, reviewer_name, product_slug, is_excluded');
  if (error) throw error;
  console.log(note, data);
}

const { data: top3 } = await supabase
  .from('product_reviews_top3')
  .select('product_slug, reviewer_name, rating')
  .in('product_slug', Object.values(SLUGS).map((s) => s.product_slug));
console.log('\nTop3 after update:', top3);
