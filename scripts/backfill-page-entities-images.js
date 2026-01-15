#!/usr/bin/env node
/* global AbortController */
/**
 * Backfill page_entities.image_url for page_entities rows
 * 
 * Tier B: Proper data fix - fetches og:image from each page HTML
 * and stores it in page_entities.image_url when currently null.
 * 
 * Usage:
 *   node scripts/backfill-page-entities-images.js
 * 
 * Environment variables required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 * Optional:
 *   BACKFILL_KINDS (comma-separated, default: article,service,event)
 */

import { createClient } from '@supabase/supabase-js';
import { JSDOM } from 'jsdom';
import dotenv from 'dotenv';

// Load local env files (not committed)
dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function getProjectRef(url) {
  try {
    const host = new URL(url).host;
    return host.split('.')[0] || host;
  } catch {
    return 'unknown';
  }
}

const PROJECT_REF = getProjectRef(SUPABASE_URL);
console.log(`🔒 Targeting Supabase project: ${PROJECT_REF}`);

function getMetaImage(doc, selector, pageUrl) {
  const el = doc.querySelector(selector);
  const content = el && el.content ? el.content : '';
  return content ? normalizeImageUrl(content, pageUrl) : null;
}

function getFirstContentImage(doc, pageUrl) {
  const main = doc.querySelector('main') || doc.querySelector('article') || doc.body;
  if (!main) return null;
  const img = main.querySelector('img');
  const src = img ? img.getAttribute('src') : '';
  return src ? normalizeImageUrl(src, pageUrl) : null;
}

/**
 * Extract og:image or twitter:image from HTML
 */
function extractImageFromHtml(html, url) {
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    return (
      getMetaImage(doc, 'meta[property="og:image"]', url) ||
      getMetaImage(doc, 'meta[name="twitter:image"]', url) ||
      getFirstContentImage(doc, url)
    );
  } catch (error) {
    console.error(`  ⚠️  Error parsing HTML for ${url}:`, error.message);
    return null;
  }
}

function toAbsoluteUrl(rawUrl, pageUrl) {
  const url = rawUrl.trim();
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  try {
    const baseUrl = new URL(pageUrl);
    if (url.startsWith('/')) return baseUrl.origin + url;
    return new URL(url, baseUrl).href;
  } catch {
    return null;
  }
}

function ensureHttps(url) {
  if (!url) return null;
  return url.startsWith('http://') ? `https://${url.substring(7)}` : url;
}

function addSquarespaceFormat(url) {
  if (!url || !url.includes('squarespace-cdn.com') || url.includes('format=')) {
    return url;
  }
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}format=300w`;
}

/**
 * Normalize image URL: make absolute, convert HTTP to HTTPS
 */
function normalizeImageUrl(imageUrl, pageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  const absolute = toAbsoluteUrl(imageUrl, pageUrl);
  const httpsUrl = ensureHttps(absolute);
  return addSquarespaceFormat(httpsUrl);
}

/**
 * Fetch HTML from URL
 */
async function fetchHtml(url) {
  try {
    // Use native fetch (Node 18+)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AlanRangerBot/1.0; +https://www.alanranger.com)'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`  ⚠️  HTTP ${response.status} for ${url}`);
      return null;
    }
    
    return await response.text();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`  ⚠️  Timeout fetching ${url}`);
    } else {
      console.error(`  ⚠️  Error fetching ${url}:`, error.message);
    }
    return null;
  }
}

const SKIP_PATTERNS = [
  { match: '/improved-content/', reason: 'skip_improved_content' },
  { match: '/photography-services-near-me/', reason: 'skip_services_near_me' }
];

function getSkipReason(url) {
  if (!url) return null;
  for (const entry of SKIP_PATTERNS) {
    if (url.includes(entry.match)) return entry.reason;
  }
  return null;
}

async function updateImageUrl(id, imageUrl) {
  const { error } = await supabase
    .from('page_entities')
    .update({ image_url: imageUrl })
    .eq('id', id);
  return error ? error.message : null;
}

/**
 * Backfill image_url for a single page_entities row
 */
async function backfillImageUrl(row) {
  const { url, id, title } = row;
  const skipReason = getSkipReason(url);
  if (skipReason) return { success: false, reason: skipReason };

  console.log(`\n📄 Processing: ${title || url}`);

  const html = await fetchHtml(url);
  if (!html) return { success: false, reason: 'fetch_failed' };

  const imageUrl = extractImageFromHtml(html, url);
  if (!imageUrl) return { success: false, reason: 'no_image_found' };

  const updateError = await updateImageUrl(id, imageUrl);
  if (updateError) {
    console.error('  ❌ Update failed:', updateError);
    return { success: false, reason: 'update_failed', error: updateError };
  }

  console.log(`  ✅ Updated image_url: ${imageUrl}`);
  return { success: true, imageUrl };
}

function getKindsFromEnv() {
  const kindsRaw = process.env.BACKFILL_KINDS || 'article,service,event';
  return kindsRaw.split(',').map(k => k.trim()).filter(Boolean);
}

async function fetchRowsForBackfill(kinds) {
  const { data: rows, error } = await supabase
    .from('page_entities')
    .select('id, url, title, image_url, kind')
    .in('kind', kinds)
    .is('image_url', null)
    .limit(200);

  if (error) {
    console.error('❌ Query failed:', error);
    process.exit(1);
  }

  return rows || [];
}

function shouldCountAsFailure(reason) {
  return reason !== 'skip_improved_content' && reason !== 'skip_services_near_me';
}

function logSummary(successCount, failCount, failures) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Backfill Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);

  if (failures.length > 0) {
    console.log('\n❌ Failures:');
    failures.forEach(f => {
      console.log(`   - ${f.url}: ${f.reason}`);
    });
  }

  console.log('\n✅ Backfill complete!');
}

const MAX_CONSECUTIVE_FAILURES = 5;

function createProcessState(total) {
  return {
    total,
    successCount: 0,
    failCount: 0,
    consecutiveFailures: 0,
    failures: []
  };
}

function recordSuccess(state) {
  state.successCount += 1;
  state.consecutiveFailures = 0;
}

function recordFailure(state, row, reason) {
  state.failCount += 1;
  state.failures.push({ url: row.url, reason });
  state.consecutiveFailures = shouldCountAsFailure(reason)
    ? state.consecutiveFailures + 1
    : 0;
}

function shouldStopProcessing(state) {
  return state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
}

async function maybeDelay(index, total) {
  if (index < total - 1) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function handleRow(row, index, state) {
  console.log(`[${index + 1}/${state.total}]`);
  const result = await backfillImageUrl(row);
  if (result.success) {
    recordSuccess(state);
  } else {
    recordFailure(state, row, result.reason);
  }

  if (shouldStopProcessing(state)) {
    console.error(`❌ Stopping after ${state.consecutiveFailures} consecutive failures.`);
    return true;
  }

  await maybeDelay(index, state.total);
  return false;
}

async function processRows(rows) {
  const state = createProcessState(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const shouldStop = await handleRow(rows[i], i, state);
    if (shouldStop) break;
  }
  return state;
}

/**
 * Main backfill function
 */
async function main() {
  const kinds = getKindsFromEnv();
  console.log(`🚀 Starting backfill of page_entities.image_url for kinds: ${kinds.join(', ')}\n`);

  const rows = await fetchRowsForBackfill(kinds);
  if (rows.length === 0) {
    console.log('✅ No rows with null image_url found. All done!');
    return;
  }

  console.log(`📊 Found ${rows.length} rows with null image_url\n`);
  const { successCount, failCount, failures } = await processRows(rows);
  logSummary(successCount, failCount, failures);
}

// Run
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
