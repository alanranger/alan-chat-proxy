const http = require('http');

async function testSingleQuery() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({query: "what is exposure triangle", sessionId: 'test'});
    const options = {
      hostname: 'localhost',
      port: 3001,
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
          console.log('✅ ORIGINAL SERVER RESPONSE:');
          console.log('Status:', res.statusCode);
          console.log('Confidence:', result.confidence);
          console.log('Answer length:', result.answer?.length || 0);
          console.log('Answer preview:', result.answer?.substring(0, 200) || 'No answer');
          resolve(result);
        } catch (e) {
          console.log('❌ Parse error:', e.message);
          console.log('Raw response:', body);
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

testSingleQuery().catch(console.error);


