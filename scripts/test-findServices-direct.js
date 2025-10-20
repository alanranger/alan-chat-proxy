import https from 'https';

// Test script to directly test the findServices function via API
// This will help us understand why evidence extraction is failing

async function testFindServicesDirect() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ 
      query: "photography services",
      debug: true
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
          resolve(response);
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

async function runDirectTest() {
  console.log('🔍 TESTING findServices FUNCTION DIRECTLY');
  console.log('=' .repeat(60));
  
  try {
    const result = await testFindServicesDirect();
    
    console.log('Response Type:', result.type);
    console.log('Confidence:', result.confidence);
    console.log('Options Count:', result.options?.length || 0);
    
    if (result.debug) {
      console.log('\n🔍 Debug Information:');
      console.log('Version:', result.debug.version);
      
      if (result.debug.debugInfo) {
        const debugInfo = result.debug.debugInfo;
        console.log('Events Count:', debugInfo.eventsCount || 0);
        console.log('Articles Count:', debugInfo.articlesCount || 0);
        console.log('Services Count:', debugInfo.servicesCount || 0);
        
        if (debugInfo.sampleEvents && debugInfo.sampleEvents.length > 0) {
          console.log('Sample Events:', debugInfo.sampleEvents.length);
          debugInfo.sampleEvents.forEach((event, i) => {
            console.log(`  ${i+1}. ${event.title || event.event_title || 'No title'}`);
          });
        }
      }
    }
    
    if (result.options && result.options.length > 0) {
      console.log('\n📝 Clarification Options:');
      result.options.forEach((opt, i) => {
        const text = opt.text || opt;
        console.log(`  ${i+1}. ${text}`);
      });
    }
    
    // Check if this is a generic fallback
    if (result.options && result.options.length > 0) {
      const isGeneric = result.options.some(opt => {
        const text = opt.text || opt;
        return text.includes('Photography equipment advice') || 
               text.includes('Photography courses and workshops') ||
               text.includes('Photography services and mentoring');
      });
      
      console.log(`\n🎯 Analysis: ${isGeneric ? '❌ GENERIC FALLBACK' : '✅ EVIDENCE-BASED'}`);
      
      if (isGeneric) {
        console.log('   → Evidence extraction failed, falling back to generic options');
        console.log('   → This means findServices is not working properly');
      } else {
        console.log('   → Evidence extraction succeeded, showing relevant options');
      }
    }
    
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎯 DIRECT TEST SUMMARY');
  console.log('='.repeat(60));
  
  console.log('\nKey Questions:');
  console.log('1. Is findServices being called at all?');
  console.log('2. Is findServices returning data?');
  console.log('3. Is the evidence extraction logic working?');
  console.log('4. Why are we getting generic fallback options?');
  
  console.log('\nNext Steps:');
  console.log('1. Check server logs for findServices debug output');
  console.log('2. Verify Supabase connection is working');
  console.log('3. Test findServices function in isolation');
  console.log('4. Fix the root cause of evidence extraction failure');
}

runDirectTest().catch(console.error);



