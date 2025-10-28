const http = require('http');

// Test the 5 benchmark questions
const testQueries = [
  'what is iso',
  'what is shutter speed', 
  'peter orton',
  'when is your next devon workshop',
  'when is your next photography course'
];

async function testQuery(query) {
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
            type: response.type,
            confidence: response.confidence,
            hasAnswer: !!response.answer,
            answerLength: response.answer?.length || 0,
            hasArticles: !!(response.structured && response.structured.articles && response.structured.articles.length > 0),
            articleCount: response.structured?.articles?.length || 0
          });
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

async function runTests() {
  console.log('=== RAG PIPELINE DEBUG TEST ===\n');
  
  for (const query of testQueries) {
    console.log(`Testing: "${query}"`);
    try {
      const result = await testQuery(query);
      console.log(`  Status: ${result.status}`);
      console.log(`  Type: ${result.type}`);
      console.log(`  Confidence: ${result.confidence}`);
      console.log(`  Has Answer: ${result.hasAnswer} (${result.answerLength} chars)`);
      console.log(`  Has Articles: ${result.hasArticles} (${result.articleCount} articles)`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
        console.log(`  Raw: ${result.rawResponse}`);
      }
      console.log('');
    } catch (error) {
      console.log(`  Error: ${error.message}\n`);
    }
  }
}

runTests().catch(console.error);
