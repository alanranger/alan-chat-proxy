#!/usr/bin/env node
/**
 * Backfill page_entities.image_url for articles/guides
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
 */

import { createClient } from '@supabase/supabase-js';
import { JSDOM } from 'jsdom';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Extract og:image or twitter:image from HTML
 */
function extractImageFromHtml(html, url) {
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
    // Priority 1: og:image
    const ogImage = doc.querySelector('meta[property="og:image"]');
    if (ogImage && ogImage.content) {
      return normalizeImageUrl(ogImage.content, url);
    }
    
    // Priority 2: twitter:image
    const twitterImage = doc.querySelector('meta[name="twitter:image"]');
    if (twitterImage && twitterImage.content) {
      return normalizeImageUrl(twitterImage.content, url);
    }
    
    return null;
  } catch (error) {
    console.error(`  ⚠️  Error parsing HTML for ${url}:`, error.message);
    return null;
  }
}

/**
 * Normalize image URL: make absolute, convert HTTP to HTTPS
 */
function normalizeImageUrl(imageUrl, pageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  
  let url = imageUrl.trim();
  
  // Make absolute if relative
  if (url.startsWith('//')) {
    url = 'https:' + url;
  } else if (url.startsWith('/')) {
    try {
      const baseUrl = new URL(pageUrl);
      url = baseUrl.origin + url;
    } catch {
      return null;
    }
  } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // Relative path - make absolute
    try {
      const baseUrl = new URL(pageUrl);
      url = new URL(url, baseUrl).href;
    } catch {
      return null;
    }
  }
  
  // Convert HTTP to HTTPS
  if (url.startsWith('http://')) {
    url = 'https://' + url.substring(7);
  }
  
  // Add Squarespace size parameter if it's a Squarespace CDN URL
  if (url.includes('squarespace-cdn.com') && !url.includes('format=')) {
    url += (url.includes('?') ? '&' : '?') + 'format=300w';
  }
  
  return url;
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

/**
 * Backfill image_url for a single page_entities row
 */
async function backfillImageUrl(row) {
  const { url, id, title } = row;
  
  console.log(`\n📄 Processing: ${title || url}`);
  
  // Fetch HTML
  const html = await fetchHtml(url);
  if (!html) {
    return { success: false, reason: 'fetch_failed' };
  }
  
  // Extract image URL
  const imageUrl = extractImageFromHtml(html, url);
  if (!imageUrl) {
    return { success: false, reason: 'no_image_found' };
  }
  
  // Update Supabase
  const { error } = await supabase
    .from('page_entities')
    .update({ image_url: imageUrl })
    .eq('id', id);
  
  if (error) {
    console.error(`  ❌ Update failed:`, error.message);
    return { success: false, reason: 'update_failed', error: error.message };
  }
  
  console.log(`  ✅ Updated image_url: ${imageUrl}`);
  return { success: true, imageUrl };
}

/**
 * Main backfill function
 */
async function main() {
  console.log('🚀 Starting backfill of page_entities.image_url for articles...\n');
  
  // Query for articles with null image_url
  const { data: rows, error: queryError } = await supabase
    .from('page_entities')
    .select('id, url, title, image_url')
    .eq('kind', 'article')
    .is('image_url', null)
    .limit(100); // Process in batches
  
  if (queryError) {
    console.error('❌ Query failed:', queryError);
    process.exit(1);
  }
  
  if (!rows || rows.length === 0) {
    console.log('✅ No articles with null image_url found. All done!');
    return;
  }
  
  console.log(`📊 Found ${rows.length} articles with null image_url\n`);
  
  let successCount = 0;
  let failCount = 0;
  const failures = [];
  
  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    console.log(`[${i + 1}/${rows.length}]`);
    
    const result = await backfillImageUrl(row);
    
    if (result.success) {
      successCount++;
    } else {
      failCount++;
      failures.push({ url: row.url, reason: result.reason });
    }
    
    // Rate limiting: wait 500ms between requests
    if (i < rows.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Summary
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

// Run
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
