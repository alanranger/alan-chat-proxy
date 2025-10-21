const http = require('http');

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
            answer: response.answer,
            type: response.type,
            confidence: response.confidence,
            articles: response.structured?.articles || [],
            events: response.structured?.events || []
          });
        } catch (e) {
          resolve({
            query,
            error: e.message,
            rawResponse: responseData.substring(0, 500)
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
  console.log('=== ACTUAL RESPONSE CONTENT TEST ===\n');
  
  const queries = [
    'what is iso',
    'what is shutter speed', 
    'peter orton',
    'when is your next devon workshop',
    'when is your next photography course'
  ];
  
  for (const query of queries) {
    console.log(`\n=== "${query}" ===`);
    try {
      const result = await testQuery(query);
      if (result.error) {
        console.log(`Error: ${result.error}`);
        console.log(`Raw: ${result.rawResponse}`);
      } else {
        console.log(`Type: ${result.type}`);
        console.log(`Confidence: ${result.confidence}`);
        console.log(`Answer: ${result.answer}`);
        console.log(`Articles: ${result.articles.length}`);
        if (result.articles.length > 0) {
          result.articles.forEach((article, i) => {
            console.log(`  ${i+1}. ${article.title}`);
          });
        }
        console.log(`Events: ${result.events.length}`);
        if (result.events.length > 0) {
          result.events.forEach((event, i) => {
            console.log(`  ${i+1}. ${event.title}`);
          });
        }
      }
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
  }
}

runTests().catch(console.error);
