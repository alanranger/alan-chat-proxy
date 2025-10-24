const http = require('http');

const testQuery = "why are my images always grainy and noisy";

const postData = JSON.stringify({
  query: testQuery
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

console.log(`🔍 Testing technical query: "${testQuery}"`);

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log(`📊 Response Type: ${response.type}`);
      console.log(`📊 Confidence: ${(response.confidence * 100).toFixed(1)}%`);
      console.log(`📊 Answer Length: ${response.answer ? response.answer.length : 0} chars`);
      console.log(`📊 Events Count: ${response.events ? response.events.length : 0}`);
      console.log(`📊 Articles Count: ${response.sources ? response.sources.articles ? response.sources.articles.length : 0 : 0}`);
      console.log(`\n💬 Response Preview: ${response.answer ? response.answer.substring(0, 300) + '...' : 'No answer'}`);
    } catch (e) {
      console.log('❌ Error parsing response:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.log('❌ Request error:', e.message);
});

req.write(postData);
req.end();


