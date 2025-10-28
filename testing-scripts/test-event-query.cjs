const http = require('http');

async function testEventQuery() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({query: "when is your next devon workshop", sessionId: 'test'});
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
          console.log('✅ ORIGINAL SERVER EVENT RESPONSE:');
          console.log('Status:', res.statusCode);
          console.log('Confidence:', result.confidence);
          console.log('Answer type:', typeof result.answer);
          console.log('Answer is array:', Array.isArray(result.answer));
          console.log('Answer length:', result.answer?.length || 'N/A');
          console.log('Answer preview:', JSON.stringify(result.answer).substring(0, 200));
          console.log('Events:', result.events?.length || 0);
          console.log('Full response keys:', Object.keys(result));
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

testEventQuery().catch(console.error);