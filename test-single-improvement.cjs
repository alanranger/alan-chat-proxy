const http = require('http');

async function testSingleQuery(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: query,
      sessionId: 'test-session'
    });

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
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);
          resolve({
            query,
            status: res.statusCode,
            response: response
          });
        } catch (e) {
          resolve({
            query,
            status: res.statusCode,
            error: e.message,
            rawResponse: responseData
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        query,
        error: e.message
      });
    });

    req.write(postData);
    req.end();
  });
}

async function testImprovements() {
  console.log('🔍 TESTING IMPROVEMENTS - Single Query Test');
  console.log('='.repeat(50));
  
  const testQuery = "what is exposure triangle";
  console.log(`📝 Testing: "${testQuery}"`);
  
  try {
    const result = await testSingleQuery(testQuery);
    
    console.log(`✅ Status: ${result.status}`);
    if (result.response) {
      console.log(`📊 Type: ${result.response.type}`);
      console.log(`📊 Confidence: ${result.response.confidence}`);
      console.log(`📝 Answer Length: ${result.response.answer?.length || 0} chars`);
      console.log(`📚 Articles: ${result.response.structured?.articles?.length || 0}`);
      console.log(`📅 Events: ${result.response.structured?.events?.length || 0}`);
      
      if (result.response.answer) {
        console.log(`\n📄 Answer Preview:`);
        console.log(result.response.answer.substring(0, 300) + '...');
      }
    } else {
      console.log(`❌ Error: ${result.error}`);
      if (result.rawResponse) {
        console.log(`Raw response: ${result.rawResponse.substring(0, 200)}...`);
      }
    }
    
  } catch (error) {
    console.log(`❌ Test error: ${error.message}`);
  }
}

testImprovements();
