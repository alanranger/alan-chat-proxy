const http = require('http');

const testQuery = "what camera do i need for your courses and workshops";

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

console.log(`🔍 Testing server response for: "${testQuery}"`);
console.log('📊 This should show classification logs in the server console...\n');

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
      console.log(`📊 Answer: ${response.answer ? response.answer.substring(0, 100) + '...' : 'No answer'}`);
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


