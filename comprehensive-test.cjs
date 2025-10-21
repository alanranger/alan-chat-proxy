const http = require('http');

async function testQuery(query, expectedType = null) {
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
          const result = {
            query,
            status: res.statusCode,
            type: response.type,
            confidence: response.confidence,
            hasAnswer: !!response.answer,
            answerLength: response.answer?.length || 0,
            answerPreview: response.answer?.substring(0, 100) + '...' || 'No answer',
            hasArticles: !!(response.structured && response.structured.articles && response.structured.articles.length > 0),
            articleCount: response.structured?.articles?.length || 0,
            hasEvents: !!(response.structured && response.structured.events && response.structured.events.length > 0),
            eventCount: response.structured?.events?.length || 0,
            expectedType,
            typeMatch: expectedType ? response.type === expectedType : 'N/A'
          };
          resolve(result);
        } catch (e) {
          resolve({
            query,
            status: res.statusCode,
            error: e.message,
            rawResponse: responseData.substring(0, 200)
          });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function runComprehensiveTest() {
  console.log('=== COMPREHENSIVE RAG SYSTEM TEST ===\n');
  
  const testCases = [
    { query: 'what is iso', expectedType: 'advice', description: 'Technical question - should get intelligent answer + articles' },
    { query: 'what is shutter speed', expectedType: 'advice', description: 'Technical question - should get intelligent answer + articles' },
    { query: 'peter orton', expectedType: 'advice', description: 'Person query - should find article' },
    { query: 'when is your next devon workshop', expectedType: 'events', description: 'Location-specific workshop query' },
    { query: 'when is your next photography course', expectedType: 'events', description: 'General course query' },
    { query: 'what is exposure', expectedType: 'advice', description: 'Technical question - should get intelligent answer' },
    { query: 'tripod recommendations', expectedType: 'advice', description: 'Equipment query - should get advice' },
    { query: 'who is alan ranger', expectedType: 'advice', description: 'About query - should get biographical info' }
  ];
  
  let passedTests = 0;
  let totalTests = testCases.length;
  
  for (const testCase of testCases) {
    console.log(`\n=== Testing: "${testCase.query}" ===`);
    console.log(`Expected: ${testCase.description}`);
    
    try {
      const result = await testQuery(testCase.query, testCase.expectedType);
      
      if (result.error) {
        console.log(`❌ ERROR: ${result.error}`);
        console.log(`Raw: ${result.rawResponse}`);
      } else {
        console.log(`✅ Status: ${result.status}`);
        console.log(`📊 Type: ${result.type} (Expected: ${testCase.expectedType}) ${result.typeMatch === true ? '✅' : '❌'}`);
        console.log(`🎯 Confidence: ${result.confidence}`);
        console.log(`📝 Answer: ${result.answerPreview}`);
        console.log(`📚 Articles: ${result.articleCount}`);
        console.log(`📅 Events: ${result.eventCount}`);
        
        // Test criteria
        const hasGoodAnswer = result.hasAnswer && result.answerLength > 50;
        const hasRelevantContent = result.articleCount > 0 || result.eventCount > 0;
        const typeMatches = result.typeMatch === true || result.typeMatch === 'N/A';
        
        if (hasGoodAnswer && hasRelevantContent && typeMatches) {
          console.log(`✅ PASS - Good answer with relevant content`);
          passedTests++;
        } else {
          console.log(`❌ FAIL - Missing: ${!hasGoodAnswer ? 'Good answer' : ''} ${!hasRelevantContent ? 'Relevant content' : ''} ${!typeMatches ? 'Correct type' : ''}`);
        }
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }
  }
  
  console.log(`\n=== TEST SUMMARY ===`);
  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
  console.log(`📊 Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log(`\n🎉 ALL TESTS PASSED! RAG system is working correctly.`);
  } else {
    console.log(`\n⚠️  Some tests failed. RAG system needs more work.`);
  }
}

runComprehensiveTest().catch(console.error);
