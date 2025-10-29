const http = require('http');

async function debugClassification() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({query: 'What types of photography services do you offer?', sessionId: 'test'});
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
          console.log('=== CLASSIFICATION DEBUG ===');
          console.log('Query: What types of photography services do you offer?');
          console.log('Type:', result.type);
          console.log('Confidence:', result.confidence);
          console.log('Answer:', result.answer);
          
          if (result.debugInfo) {
            console.log('\n=== DEBUG INFO ===');
            console.log('Version:', result.debugInfo.version);
            console.log('Intent:', result.debugInfo.intent);
            console.log('Classification:', result.debugInfo.classification);
            console.log('Reason:', result.debugInfo.reason);
          }
          
          if (result.options) {
            console.log('\n=== OPTIONS ===');
            result.options.forEach((opt, i) => {
              console.log(`${i+1}. ${opt.text} -> ${opt.query}`);
            });
          }
          
          resolve(result);
        } catch (e) {
          console.log('Parse error:', e.message);
          console.log('Raw response:', body.substring(0, 1000));
          reject(e);
        }
      });
    });

    req.on('error', (err) => {
      console.log('Connection error:', err.message);
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

debugClassification().catch(console.error);
