// Bulk re-ingest all event URLs to clean up old dates
// This script will re-ingest all event URLs, which will trigger the cleanup logic
// to remove old dates that are no longer in the source data

const apiUrl = process.env.TEST_API_URL || 'http://localhost:3000';
const batchSize = 5; // Process 5 URLs at a time
const delayBetweenBatches = 2000; // 2 seconds between batches

async function bulkReingestEvents() {
  console.log('🔄 Bulk Re-ingesting Event URLs to Clean Up Old Dates\n');
  
  try {
    // Step 1: Get all unique event URLs from database
    console.log('📊 Step 1: Fetching all event URLs from database...');
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data: eventUrls, error: fetchErr } = await supabase
      .from('page_entities')
      .select('url')
      .eq('kind', 'event')
      .not('url', 'is', null);
    
    if (fetchErr) {
      console.error('❌ Error fetching event URLs:', fetchErr);
      return;
    }
    
    // Get unique URLs
    const uniqueUrls = [...new Set(eventUrls.map(e => e.url))];
    console.log(`Found ${uniqueUrls.length} unique event URLs\n`);
    
    if (uniqueUrls.length === 0) {
      console.log('✅ No event URLs found. Nothing to re-ingest.');
      return;
    }
    
    // Step 2: Re-ingest in batches
    console.log(`🔄 Step 2: Re-ingesting ${uniqueUrls.length} URLs in batches of ${batchSize}...\n`);
    
    let successCount = 0;
    let failCount = 0;
    const failedUrls = [];
    
    for (let i = 0; i < uniqueUrls.length; i += batchSize) {
      const batch = uniqueUrls.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(uniqueUrls.length / batchSize);
      
      console.log(`📦 Batch ${batchNum}/${totalBatches}: Processing ${batch.length} URLs...`);
      
      const batchPromises = batch.map(async (url) => {
        try {
          const response = await fetch(`${apiUrl}/api/ingest`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.INGEST_TOKEN || ''}`
            },
            body: JSON.stringify({ url }),
            signal: AbortSignal.timeout(65000) // 65 second timeout
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }
          
          const result = await response.json();
          return { url, success: true, result };
        } catch (error) {
          return { url, success: false, error: error.message };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(({ url, success, error }) => {
        if (success) {
          successCount++;
          console.log(`  ✅ ${url.substring(url.lastIndexOf('/') + 1)}`);
        } else {
          failCount++;
          failedUrls.push({ url, error });
          console.log(`  ❌ ${url.substring(url.lastIndexOf('/') + 1)}: ${error}`);
        }
      });
      
      const processed = Math.min(i + batchSize, uniqueUrls.length);
      const percentage = ((processed / uniqueUrls.length) * 100).toFixed(1);
      console.log(`  Progress: ${processed}/${uniqueUrls.length} (${percentage}%)\n`);
      
      // Delay between batches (except for the last batch)
      if (i + batchSize < uniqueUrls.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }
    
    // Step 3: Summary
    console.log('📊 Step 3: Summary\n');
    console.log(`✅ Successfully re-ingested: ${successCount}/${uniqueUrls.length}`);
    console.log(`❌ Failed: ${failCount}/${uniqueUrls.length}`);
    
    if (failedUrls.length > 0) {
      console.log('\n❌ Failed URLs:');
      failedUrls.forEach(({ url, error }) => {
        console.log(`  - ${url}: ${error}`);
      });
    }
    
    console.log('\n✅ Bulk re-ingest completed!');
    console.log('💡 Old event dates should now be cleaned up from the database.');
    console.log('💡 Check the database to verify old dates have been removed.');
    
  } catch (error) {
    console.error('❌ Bulk re-ingest failed:', error);
    process.exit(1);
  }
}

bulkReingestEvents();

