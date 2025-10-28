const http = require('http');

const postData = JSON.stringify({
  query: 'what is exposure',
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
    console.log('Status Code:', res.statusCode);
    try {
      const response = JSON.parse(responseData);
      console.log('=== LOCAL FIX TEST RESULTS ===');
      console.log('Answer:', response.answer);
      console.log('Confidence:', response.confidence);
      console.log('Type:', response.type);
      if (response.structured && response.structured.articles) {
        console.log('Articles found:', response.structured.articles.length);
        response.structured.articles.forEach((article, i) => {
          console.log(`Article ${i+1}: ${article.title}`);
        });
      }
      console.log('==============================');
    } catch (e) {
      console.log('JSON Parse Error:', e.message);
      console.log('Raw response:', responseData);
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(postData);
req.end();

