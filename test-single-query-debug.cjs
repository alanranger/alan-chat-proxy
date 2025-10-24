const http = require('http');

async function testSingleQuery(query) {
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
            status: res.statusCode,
            confidence: result.confidence,
            answer: result.answer,
            type: result.type,
            sources: result.sources,
            events: result.events,
            structured: result.structured
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

async function debugSingleQuery() {
  console.log('🔍 DEBUGGING SINGLE QUERY');
  console.log('========================\n');
  
  const testQuery = "do you do commercial photography";
  
  try {
    const result = await testSingleQuery(testQuery);
    
    console.log(`📝 Query: "${testQuery}"`);
    console.log(`📊 Status: ${result.status}`);
    console.log(`🤖 Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    console.log(`📄 Type: ${result.type}`);
    console.log(`📏 Answer Length: ${result.answer?.length || 0} chars`);
    console.log(`🎪 Events: ${result.events?.length || 0}`);
    console.log(`📚 Sources: ${result.sources?.articles?.length || 0}`);
    console.log(`🏗️ Structured: ${JSON.stringify(result.structured, null, 2)}`);
    console.log(`\n💬 Response:`);
    console.log(`"${result.answer}"`);
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

debugSingleQuery().catch(console.error);


