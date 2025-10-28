import https from 'https';

// Diagnostic script to understand why evidence extraction is failing
// and why we're getting generic fallback options

const testQueries = [
  "photography courses",
  "photography articles", 
  "photography services",
  "explain the exposure triangle",
  "what tripod do you recommend"
];

async function diagnoseQuery(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query });
    
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

async function runDiagnosis() {
  console.log('🔍 DIAGNOSING EVIDENCE EXTRACTION ISSUES');
  console.log('=' .repeat(60));
  
  for (const query of testQueries) {
    console.log(`\n📋 Testing: "${query}"`);
    console.log('-'.repeat(40));
    
    try {
      const result = await diagnoseQuery(query);
      
      console.log(`Type: ${result.type}`);
      console.log(`Confidence: ${result.confidence}%`);
      console.log(`Options: ${result.options.length}`);
      
      if (result.options.length > 0) {
        console.log('Options:');
        result.options.forEach((opt, i) => {
          const text = opt.text || opt;
          console.log(`  ${i+1}. ${text}`);
        });
      }
      
      if (result.debug) {
        console.log('Debug Info:');
        console.log(`  Version: ${result.debug.version}`);
        if (result.debug.debugInfo) {
          console.log(`  Debug Info: ${JSON.stringify(result.debug.debugInfo, null, 2)}`);
        }
      }
      
      // Analyze the response
      if (result.options.length > 0) {
        const isGeneric = result.options.some(opt => {
          const text = opt.text || opt;
          return text.includes('Photography equipment advice') || 
                 text.includes('Photography courses and workshops') ||
                 text.includes('Photography services and mentoring');
        });
        
        console.log(`Analysis: ${isGeneric ? '❌ GENERIC FALLBACK' : '✅ EVIDENCE-BASED'}`);
      }
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎯 DIAGNOSIS SUMMARY');
  console.log('='.repeat(60));
  
  console.log('\nKey Issues to Investigate:');
  console.log('1. Why are queries getting generic fallback options?');
  console.log('2. Why is evidence extraction failing for non-workshop queries?');
  console.log('3. Why are direct answer queries going to clarification?');
  console.log('4. What is the evidence extraction logic actually finding?');
  
  console.log('\nNext Steps:');
  console.log('1. Check getEvidenceSnapshot function for all query types');
  console.log('2. Verify database has content for courses, articles, services');
  console.log('3. Fix direct answer routing logic');
  console.log('4. Improve evidence extraction for non-workshop queries');
}

runDiagnosis().catch(console.error);



