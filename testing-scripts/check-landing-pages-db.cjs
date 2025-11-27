#!/usr/bin/env node

/**
 * Check database for contact and terms/conditions landing pages
 */

const fs = require('fs');
const path = require('path');

// Try multiple env file locations
const envFiles = ['.env.local', '.env', '.env.production'];
for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    require('dotenv').config({ path: envFile });
    break;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkLandingPages() {
  console.log('🔍 Checking database for landing pages...\n');
  
  // Check for contact pages
  console.log('='.repeat(80));
  console.log('CONTACT PAGES');
  console.log('='.repeat(80));
  
  const contactSearches = [
    { pattern: 'contact', desc: 'Contact' },
    { pattern: 'get-in-touch', desc: 'Get in Touch' },
    { pattern: 'contact-us', desc: 'Contact Us' },
    { pattern: 'get-in-touch-with-alan', desc: 'Get in Touch with Alan' }
  ];
  
  for (const search of contactSearches) {
    const { data, error } = await supabase
      .from('page_entities')
      .select('id, title, page_url, url, description, csv_type')
      .eq('csv_type', 'landing_service_pages')
      .or(`page_url.ilike.%${search.pattern}%,url.ilike.%${search.pattern}%,title.ilike.%${search.pattern}%`)
      .limit(10);
    
    if (error) {
      console.log(`❌ Error searching for "${search.pattern}": ${error.message}`);
      continue;
    }
    
    if (data && data.length > 0) {
      console.log(`\n✅ Found ${data.length} page(s) matching "${search.pattern}":`);
      data.forEach((page, idx) => {
        console.log(`   ${idx + 1}. ${page.title || 'No title'}`);
        console.log(`      URL: ${page.page_url || page.url || 'No URL'}`);
        console.log(`      ID: ${page.id}`);
      });
    } else {
      console.log(`   ❌ No pages found matching "${search.pattern}"`);
    }
  }
  
  // Check for terms/conditions pages
  console.log('\n' + '='.repeat(80));
  console.log('TERMS/CONDITIONS PAGES');
  console.log('='.repeat(80));
  
  const termsSearches = [
    { pattern: 'terms', desc: 'Terms' },
    { pattern: 'conditions', desc: 'Conditions' },
    { pattern: 'terms-and-conditions', desc: 'Terms and Conditions' },
    { pattern: 'booking-terms', desc: 'Booking Terms' },
    { pattern: 'cancellation', desc: 'Cancellation' },
    { pattern: 'refund', desc: 'Refund' },
    { pattern: 'policy', desc: 'Policy' }
  ];
  
  for (const search of termsSearches) {
    const { data, error } = await supabase
      .from('page_entities')
      .select('id, title, page_url, url, description, csv_type')
      .eq('csv_type', 'landing_service_pages')
      .or(`page_url.ilike.%${search.pattern}%,url.ilike.%${search.pattern}%,title.ilike.%${search.pattern}%`)
      .limit(10);
    
    if (error) {
      console.log(`❌ Error searching for "${search.pattern}": ${error.message}`);
      continue;
    }
    
    if (data && data.length > 0) {
      console.log(`\n✅ Found ${data.length} page(s) matching "${search.pattern}":`);
      data.forEach((page, idx) => {
        console.log(`   ${idx + 1}. ${page.title || 'No title'}`);
        console.log(`      URL: ${page.page_url || page.url || 'No URL'}`);
        console.log(`      ID: ${page.id}`);
      });
    } else {
      console.log(`   ❌ No pages found matching "${search.pattern}"`);
    }
  }
  
  // List all landing_service_pages to see what exists
  console.log('\n' + '='.repeat(80));
  console.log('ALL LANDING SERVICE PAGES (first 50)');
  console.log('='.repeat(80));
  
  const { data: allPages, error: allError } = await supabase
    .from('page_entities')
    .select('id, title, page_url, url, csv_type')
    .eq('csv_type', 'landing_service_pages')
    .limit(50)
    .order('title');
  
  if (allError) {
    console.log(`❌ Error fetching all pages: ${allError.message}`);
  } else if (allPages && allPages.length > 0) {
    console.log(`\n📋 Found ${allPages.length} landing service pages:\n`);
    allPages.forEach((page, idx) => {
      const url = page.page_url || page.url || 'No URL';
      console.log(`${(idx + 1).toString().padStart(3)}. ${page.title || 'No title'}`);
      console.log(`     ${url}`);
    });
  } else {
    console.log('❌ No landing service pages found in database');
  }
}

checkLandingPages().catch(console.error);

