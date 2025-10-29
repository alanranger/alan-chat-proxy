const http = require('http');

async function testServiceQuery(query) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({query: query, sessionId: 'test-service'});
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
          console.log(`\n✅ Query: "${query}"`);
          console.log('Status:', res.statusCode);
          console.log('Type:', result.type);
          console.log('Confidence:', result.confidence);
          console.log('Has services:', result.structured?.services?.length > 0 ? `Yes (${result.structured.services.length})` : 'No');
          if (result.structured?.services?.length > 0) {
            console.log('Services found:');
            result.structured.services.forEach((s, i) => {
              console.log(`  ${i+1}. ${s.title || s.page_url}`);
            });
          }
          console.log('Answer preview:', result.answer?.substring(0, 150) || 'No answer');
          resolve(result);
        } catch (e) {
          console.log('❌ Parse error:', e.message);
          console.log('Raw response:', body.substring(0, 500));
          reject(e);
        }
      });
    });

    req.on('error', (err) => {
      console.log('❌ Connection error:', err.message);
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Service Integration...');
  console.log('⚠️  Make sure local server is running on port 3000 (npm run dev)\n');
  
  const testQueries = [
    'What photography services do you offer?',
    'Do you do corporate photography?',
    'I need a professional photographer near me',
    'What training services do you provide?'
  ];

  for (const query of testQueries) {
    try {
      await testServiceQuery(query);
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between tests
    } catch (e) {
      console.error('Test failed:', e.message);
    }
  }
  
  console.log('\n✅ Tests completed!');
}

runTests().catch(console.error);

