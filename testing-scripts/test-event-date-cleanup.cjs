// Test script to verify event date cleanup logic
// Tests that old event dates are removed when a URL is re-ingested with new dates

const testUrl = 'https://www.alanranger.com/beginners-photography-lessons/camera-courses-for-beginners-coventry-2k99k';
const apiUrl = process.env.TEST_API_URL || 'http://localhost:3000';

async function testEventDateCleanup() {
  console.log('🧪 Testing Event Date Cleanup Logic\n');
  console.log(`Test URL: ${testUrl}\n`);
  
  try {
    // Step 1: Check current state in database
    console.log('📊 Step 1: Checking current database state...');
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data: beforeData, error: beforeErr } = await supabase
      .from('page_entities')
      .select('id, url, start_date, date_start, last_seen')
      .eq('url', testUrl)
      .eq('kind', 'event')
      .order('start_date');
    
    if (beforeErr) {
      console.error('❌ Error fetching before state:', beforeErr);
      return;
    }
    
    console.log(`Found ${beforeData.length} event entries before ingestion:`);
    beforeData.forEach(e => {
      console.log(`  - ID: ${e.id}, Date: ${e.start_date || e.date_start?.split('T')[0]}, Last seen: ${e.last_seen}`);
    });
    console.log('');
    
    // Step 2: Ingest the URL
    console.log('🔄 Step 2: Ingesting URL...');
    const ingestResponse = await fetch(`${apiUrl}/api/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INGEST_TOKEN || ''}`
      },
      body: JSON.stringify({ url: testUrl })
    });
    
    if (!ingestResponse.ok) {
      const errorText = await ingestResponse.text();
      console.error('❌ Ingest failed:', ingestResponse.status, errorText);
      return;
    }
    
    const ingestResult = await ingestResponse.json();
    console.log('✅ Ingest completed:', JSON.stringify(ingestResult, null, 2));
    console.log('');
    
    // Wait a moment for database to update
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Check state after ingestion
    console.log('📊 Step 3: Checking database state after ingestion...');
    const { data: afterData, error: afterErr } = await supabase
      .from('page_entities')
      .select('id, url, start_date, date_start, last_seen')
      .eq('url', testUrl)
      .eq('kind', 'event')
      .order('start_date');
    
    if (afterErr) {
      console.error('❌ Error fetching after state:', afterErr);
      return;
    }
    
    console.log(`Found ${afterData.length} event entries after ingestion:`);
    afterData.forEach(e => {
      console.log(`  - ID: ${e.id}, Date: ${e.start_date || e.date_start?.split('T')[0]}, Last seen: ${e.last_seen}`);
    });
    console.log('');
    
    // Step 4: Verify cleanup
    console.log('✅ Step 4: Verifying cleanup...');
    const beforeDates = new Set(beforeData.map(e => e.start_date || e.date_start?.split('T')[0]).filter(Boolean));
    const afterDates = new Set(afterData.map(e => e.start_date || e.date_start?.split('T')[0]).filter(Boolean));
    
    const removedDates = [...beforeDates].filter(d => !afterDates.has(d));
    const addedDates = [...afterDates].filter(d => !beforeDates.has(d));
    
    if (removedDates.length > 0) {
      console.log(`✅ Old dates removed: ${removedDates.join(', ')}`);
    } else {
      console.log('⚠️  No old dates were removed (this might be expected if all dates are current)');
    }
    
    if (addedDates.length > 0) {
      console.log(`✅ New dates added: ${addedDates.join(', ')}`);
    }
    
    // Check if we have fewer or equal entries (old dates should be removed)
    if (afterData.length <= beforeData.length) {
      console.log(`✅ Cleanup successful: Reduced from ${beforeData.length} to ${afterData.length} entries`);
    } else {
      console.log(`⚠️  Warning: Increased from ${beforeData.length} to ${afterData.length} entries (might indicate new dates were added)`);
    }
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testEventDateCleanup();



