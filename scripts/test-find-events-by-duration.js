import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://igzwbvgvmzvvzoclufx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFindEventsByDuration() {
  console.log('🧪 Testing findEventsByDuration function directly');
  console.log('===============================================');

  try {
    // Test the exact query from findEventsByDuration
    const { data, error } = await supabase
      .from('v_events_for_chat')
      .select('*')
      .gte('date_start', new Date().toISOString().split('T')[0])
      .not('date_start', 'is', null)
      .not('date_end', 'is', null)
      .ilike('event_title', '%workshop%')
      .contains('categories', ['1-day']) // Filter by category
      .order('date_start', { ascending: true })
      .limit(50);

    if (error) {
      console.error('❌ Supabase error:', error);
      return;
    }

    console.log(`✅ Found ${data.length} events with '1-day' category`);
    
    if (data.length > 0) {
      console.log('\n📋 Sample events:');
      data.slice(0, 3).forEach((event, index) => {
        console.log(`${index + 1}. ${event.event_title}`);
        console.log(`   URL: ${event.event_url}`);
        console.log(`   Categories: ${JSON.stringify(event.categories)}`);
        console.log(`   Price: £${event.price_gbp}`);
        console.log(`   Date: ${event.date_start}`);
        console.log('');
      });
    } else {
      console.log('❌ No events found with 1-day category');
    }

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testFindEventsByDuration();



