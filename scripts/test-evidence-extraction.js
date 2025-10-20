import https from 'https';

// Test script to debug evidence extraction for specific queries
// This will help us understand why evidence extraction is failing

const testQueries = [
  "photography courses",
  "photography articles", 
  "photography services"
];

async function testEvidenceExtraction(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ 
      query,
      debug: true  // Request debug information
    });
    
    const options = {
      hostname: 'alan-chat-proxy.vercel.app',
      port: 443,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            query,
            type: response.type,
            confidence: response.confidence,
            options: response.options || [],
            debug: response.debug || {}
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runEvidenceTest() {
  console.log('🔍 TESTING EVIDENCE EXTRACTION FOR NON-WORKSHOP QUERIES');
  console.log('=' .repeat(70));
  
  for (const query of testQueries) {
    console.log(`\n📋 Testing: "${query}"`);
    console.log('-'.repeat(50));
    
    try {
      const result = await testEvidenceExtraction(query);
      
      console.log(`Response Type: ${result.type}`);
      console.log(`Confidence: ${result.confidence}%`);
      console.log(`Options Count: ${result.options.length}`);
      
      if (result.debug) {
        console.log('\n🔍 Debug Information:');
        console.log(`  Version: ${result.debug.version}`);
        
        if (result.debug.debugInfo) {
          const debugInfo = result.debug.debugInfo;
          console.log(`  Events Count: ${debugInfo.eventsCount || 0}`);
          console.log(`  Articles Count: ${debugInfo.articlesCount || 0}`);
          console.log(`  Services Count: ${debugInfo.servicesCount || 0}`);
          
          if (debugInfo.sampleEvents && debugInfo.sampleEvents.length > 0) {
            console.log(`  Sample Events: ${debugInfo.sampleEvents.length}`);
            debugInfo.sampleEvents.forEach((event, i) => {
              console.log(`    ${i+1}. ${event.title || event.event_title || 'No title'}`);
            });
          }
        }
      }
      
      if (result.options.length > 0) {
        console.log('\n📝 Clarification Options:');
        result.options.forEach((opt, i) => {
          const text = opt.text || opt;
          console.log(`  ${i+1}. ${text}`);
        });
        
        // Check if options are generic fallbacks
        const isGeneric = result.options.some(opt => {
          const text = opt.text || opt;
          return text.includes('Photography equipment advice') || 
                 text.includes('Photography courses and workshops') ||
                 text.includes('Photography services and mentoring');
        });
        
        console.log(`\n🎯 Analysis: ${isGeneric ? '❌ GENERIC FALLBACK OPTIONS' : '✅ EVIDENCE-BASED OPTIONS'}`);
        
        if (isGeneric) {
          console.log('   → Evidence extraction failed, falling back to generic options');
        } else {
          console.log('   → Evidence extraction succeeded, showing relevant options');
        }
      } else {
        console.log('\n🎯 Analysis: ❌ NO OPTIONS GENERATED');
        console.log('   → Evidence extraction completely failed');
      }
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('🎯 EVIDENCE EXTRACTION TEST SUMMARY');
  console.log('='.repeat(70));
  
  console.log('\nKey Findings:');
  console.log('1. If all queries show generic fallback options, evidence extraction is failing');
  console.log('2. If debug shows 0 events/articles/services, the search functions are not finding content');
  console.log('3. If debug shows content but options are generic, the option generation logic is failing');
  
  console.log('\nNext Steps:');
  console.log('1. Check if findServices/findArticles functions are working');
  console.log('2. Verify keyword extraction is working for non-workshop queries');
  console.log('3. Check if the evidence-based option generation logic is working');
  console.log('4. Fix the root cause of evidence extraction failure');
}

runEvidenceTest().catch(console.error);



