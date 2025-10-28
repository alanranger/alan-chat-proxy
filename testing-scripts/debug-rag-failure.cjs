const http = require('http');

// Debug script to understand why RAG is failing
async function debugRagFailure() {
  console.log('🔍 DEBUGGING RAG SYSTEM FAILURE');
  console.log('================================================================================');
  
  const testQuery = 'what is raw format';
  console.log(`Testing query: "${testQuery}"`);
  
  try {
    const response = await makeRequest(testQuery);
    const data = JSON.parse(response);
    
    console.log('\n📊 RESPONSE ANALYSIS:');
    console.log(`Success: ${data.ok}`);
    console.log(`Type: ${data.type}`);
    console.log(`Confidence: ${data.confidence}`);
    console.log(`Answer Length: ${data.answer?.length || 0}`);
    
    console.log('\n📝 FULL ANSWER:');
    console.log(data.answer);
    
    console.log('\n🔍 DEBUG INFO:');
    if (data.debugInfo) {
      console.log(`Intent: ${data.debugInfo.intent}`);
      console.log(`Classification: ${data.debugInfo.classification}`);
      console.log(`Total Matches: ${data.debugInfo.totalMatches}`);
      console.log(`Chunks Found: ${data.debugInfo.chunksFound}`);
      console.log(`Entities Found: ${data.debugInfo.entitiesFound}`);
      
      if (data.debugInfo.debugLogs) {
        console.log('\n📋 DEBUG LOGS:');
        data.debugInfo.debugLogs.forEach((log, i) => {
          console.log(`${i + 1}. ${log}`);
        });
      }
    }
    
    console.log('\n📚 STRUCTURED DATA:');
    if (data.structured) {
      console.log(`Events: ${data.structured.events?.length || 0}`);
      console.log(`Articles: ${data.structured.articles?.length || 0}`);
      console.log(`Products: ${data.structured.products?.length || 0}`);
    }
    
    // Analyze why this failed
    console.log('\n🚨 FAILURE ANALYSIS:');
    if (data.debugInfo?.totalMatches === 0) {
      console.log('❌ NO MATCHES FOUND - RAG system found no relevant content');
    }
    if (data.debugInfo?.chunksFound === 0) {
      console.log('❌ NO CHUNKS FOUND - Database search failed');
    }
    if (data.debugInfo?.entitiesFound === 0) {
      console.log('❌ NO ENTITIES FOUND - Entity search failed');
    }
    if (data.confidence < 0.3) {
      console.log('❌ LOW CONFIDENCE - System not confident in response');
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

function makeRequest(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query });
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Run the debug
debugRagFailure().catch(console.error);
