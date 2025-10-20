// scripts/simple-mapping-test.js
// Simple test to verify the mapping fix

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMappings() {
  console.log('🧪 SIMPLE MAPPING TEST');
  console.log('======================');
  
  const { data, error } = await supabase
    .from('v_event_product_mappings')
    .select('event_url, event_title, product_title, price_gbp')
    .in('event_url', [
      'https://www.alanranger.com/photographic-workshops-near-me/fairy-glen-betws-y-coed-photography',
      'https://www.alanranger.com/photographic-workshops-near-me/landscape-photography-snowdonia-workshop'
    ]);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('\n📊 RESULTS:');
  data.forEach(mapping => {
    console.log(`\nEvent: ${mapping.event_title}`);
    console.log(`Product: ${mapping.product_title}`);
    console.log(`Price: £${mapping.price_gbp}`);
    
    // Simple checks
    const isFairyGlen = mapping.event_url.includes('fairy-glen');
    const isSnowdonia = mapping.event_url.includes('snowdonia');
    
    if (isFairyGlen) {
      const hasFairyGlenInProduct = mapping.product_title.includes('FAIRY GLEN');
      const correctPrice = mapping.price_gbp === '125' || mapping.price_gbp === 125;
      console.log(`✅ Fairy Glen Fix: ${hasFairyGlenInProduct && correctPrice ? 'SUCCESS' : 'FAILED'}`);
      console.log(`   Debug: hasFairyGlen=${hasFairyGlenInProduct}, price=${mapping.price_gbp} (type: ${typeof mapping.price_gbp}), correctPrice=${correctPrice}`);
    }
    
    if (isSnowdonia) {
      const hasSnowdoniaInProduct = mapping.product_title.includes('SNOWDONIA');
      const correctPrice = mapping.price_gbp === '595' || mapping.price_gbp === 595;
      console.log(`✅ Snowdonia Fix: ${hasSnowdoniaInProduct && correctPrice ? 'SUCCESS' : 'FAILED'}`);
      console.log(`   Debug: hasSnowdonia=${hasSnowdoniaInProduct}, price=${mapping.price_gbp} (type: ${typeof mapping.price_gbp}), correctPrice=${correctPrice}`);
    }
  });
}

testMappings();
