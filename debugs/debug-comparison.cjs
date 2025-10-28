const http = require('http');

async function debugSingleQuery(query) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({query, sessionId: 'test-session'});
    const options = {
      hostname: 'localhost',
      port: 3000, // Test current server only
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
          console.log(`\n🔍 DEBUG for "${query}":`);
          console.log(`Status: ${res.statusCode}`);
          console.log(`Confidence: ${result.confidence}`);
          console.log(`Answer type: ${typeof result.answer}`);
          console.log(`Answer length: ${result.answer?.length || 0}`);
          console.log(`Answer preview: "${result.answer?.substring(0, 50) || 'NO ANSWER'}"`);
          console.log(`Events: ${result.events?.length || 0}`);
          console.log(`Articles: ${result.sources?.articles?.length || 0}`);
          console.log(`Full keys: ${Object.keys(result).join(', ')}`);
          resolve(result);
        } catch (e) {
          console.log(`❌ Parse error: ${e.message}`);
          console.log(`Raw response: ${body.substring(0, 200)}`);
          reject(e);
        }
      });
    });

    req.on('error', (err) => {
      console.log(`❌ Connection error: ${err.message}`);
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

async function debugComparison() {
  console.log('🔍 DEBUGGING COMPARISON ISSUES');
  console.log('================================');
  
  const testQueries = [
    "what is exposure triangle",
    "what tripod do you recommend", 
    "who is alan ranger"
  ];
  
  for (const query of testQueries) {
    try {
      await debugSingleQuery(query);
    } catch (error) {
      console.log(`❌ Error testing "${query}": ${error.message}`);
    }
  }
}

debugComparison().catch(console.error);


