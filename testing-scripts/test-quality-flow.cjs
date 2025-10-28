const http = require('http');

async function testQualityFlow(query) {
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
            type: result.type
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

async function testQualityFlowDebug() {
  console.log('🔍 TESTING QUALITY FLOW DEBUG');
  console.log('============================\n');
  
  const testQuery = "do you do commercial photography";
  
  try {
    const result = await testQualityFlow(testQuery);
    
    console.log(`📝 Query: "${testQuery}"`);
    console.log(`🤖 Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    console.log(`📄 Type: ${result.type}`);
    console.log(`📏 Response: "${result.answer.substring(0, 100)}..."`);
    
    // Check if this should be detected as irrelevant
    const responseLower = result.answer.toLowerCase();
    const queryLower = testQuery.toLowerCase();
    
    console.log(`\n🔍 Manual Quality Analysis:`);
    console.log(`   Has "based on alan ranger's expertise": ${responseLower.includes('based on alan ranger\'s expertise')}`);
    console.log(`   Has "autumn photography": ${responseLower.includes('autumn photography')}`);
    console.log(`   Query includes "autumn": ${queryLower.includes('autumn')}`);
    console.log(`   Should be irrelevant: ${responseLower.includes('based on alan ranger\'s expertise') && responseLower.includes('autumn photography') && !queryLower.includes('autumn')}`);
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

testQualityFlowDebug().catch(console.error);


