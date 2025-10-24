const http = require('http');

async function testQualityDebug(query) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({query, sessionId: 'test-session'});
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve({
            query,
            confidence: result.confidence,
            answer: result.answer,
            debug: result.debug
          });
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Connection error: ${err.message}`));
    });

    req.write(data);
    req.end();
  });
}

async function debugQuality() {
  console.log('🔍 DEBUGGING QUALITY INDICATORS');
  console.log('================================\n');
  
  const testQuery = "do you do commercial photography";
  
  try {
    const result = await testQualityDebug(testQuery);
    
    console.log(`📝 Query: "${testQuery}"`);
    console.log(`🤖 Final Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    console.log(`📄 Response: "${result.answer}"`);
    console.log(`\n🔍 Debug Info:`);
    console.log(JSON.stringify(result.debug, null, 2));
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

debugQuality().catch(console.error);