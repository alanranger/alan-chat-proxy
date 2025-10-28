// scripts/test-database-mapping-fix.js
// Test the actual database state after the mapping fix

import { createClient } from '@supabase/supabase-js';

console.log('🧪 DATABASE MAPPING FIX VALIDATION TEST');
console.log('======================================');

const supabaseUrl = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDatabaseMappingFix() {
  console.log('🚀 Testing database mapping fix...');
  
  try {
    // Test the specific problematic events
    const { data, error } = await supabase
      .from('v_event_product_mappings')
      .select(`
        event_url,
        event_title,
        product_url,
        product_title,
        price_gbp
      `)
      .in('event_url', [
        'https://www.alanranger.com/photographic-workshops-near-me/fairy-glen-betws-y-coed-photography',
        'https://www.alanranger.com/photographic-workshops-near-me/landscape-photography-snowdonia-workshop'
      ]);
    
    if (error) {
      console.error('❌ Database query error:', error);
      return;
    }
    
    console.log('\n📊 CURRENT DATABASE MAPPINGS:');
    console.log('==============================');
    
    data.forEach((mapping, index) => {
      console.log(`\n${index + 1}. ${mapping.event_title}`);
      console.log(`   Event URL: ${mapping.event_url}`);
      console.log(`   Product: ${mapping.product_title}`);
      console.log(`   Price: £${mapping.price_gbp}`);
      
      // Check if this is correct
      if (mapping.event_url.includes('fairy-glen')) {
        if (mapping.product_title.includes('FAIRY GLEN') && mapping.price_gbp === '125') {
          console.log(`   ✅ CORRECT: Fairy Glen mapped to correct product and price`);
        } else {
          console.log(`   ❌ INCORRECT: Should be FAIRY GLEN product at £125`);
        }
      } else if (mapping.event_url.includes('landscape-photography-snowdonia')) {
        if (mapping.product_title.includes('SNOWDONIA') && mapping.price_gbp === '595') {
          console.log(`   ✅ CORRECT: Snowdonia mapped to correct product and price`);
        } else {
          console.log(`   ❌ INCORRECT: Should be SNOWDONIA product at £595`);
        }
      }
    });
    
    // Count total mappings
    const { count, error: countError } = await supabase
      .from('event_product_links_auto')
      .select('*', { count: 'exact', head: true });
    
    if (!countError) {
      console.log(`\n📈 Total mappings in database: ${count}`);
    }
    
    console.log('\n✅ DATABASE MAPPING FIX VALIDATION COMPLETE');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the test
testDatabaseMappingFix();




