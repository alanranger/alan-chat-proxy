const http = require('http');

async function debugKeywords() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({query: 'corporate photography', sessionId: 'debug'});
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
          console.log('=== KEYWORD DEBUG ===');
          console.log('Query: corporate photography');
          console.log('Type:', result.type);
          
          if (result.debug && result.debug.keywords) {
            console.log('Keywords extracted:', result.debug.keywords);
          }
          
          if (result.structured && result.structured.services) {
            console.log('\nServices found:', result.structured.services.length);
            result.structured.services.forEach((s, i) => {
              console.log(`${i+1}. ${s.title} - ${s.page_url}`);
            });
          }
          
          resolve(result);
        } catch (e) {
          console.log('Parse error:', e.message);
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

debugKeywords().catch(console.error);
