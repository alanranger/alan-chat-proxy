const http = require('http');

async function testCorporateService() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({query: 'corporate photography', sessionId: 'test'});
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
          console.log('Query: corporate photography');
          console.log('Type:', result.type);
          console.log('Confidence:', result.confidence);
          console.log('Services found:', result.structured?.services?.length || 0);
          
          if (result.structured?.services) {
            console.log('\nService details:');
            result.structured.services.forEach((s, i) => {
              console.log(`${i+1}. Title: ${s.title || 'NO_TITLE'}`);
              console.log(`   URL: ${s.page_url || 'NO_URL'}`);
              console.log(`   Kind: ${s.kind || 'NO_KIND'}`);
              console.log('');
            });
          }
          
          resolve(result);
        } catch (e) {
          console.log('Parse error:', e.message);
          console.log('Raw response:', body.substring(0, 500));
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

testCorporateService().catch(console.error);
