const http = require('http');

async function debugServiceFinding() {
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
          console.log('=== DEBUG SERVICE FINDING ===');
          console.log('Query: corporate photography');
          console.log('Type:', result.type);
          console.log('Confidence:', result.confidence);
          console.log('Answer:', result.answer);
          console.log('\n=== STRUCTURED DATA ===');
          console.log('Services count:', result.structured?.services?.length || 0);
          
          if (result.structured?.services) {
            console.log('\n=== SERVICE DETAILS ===');
            result.structured.services.forEach((s, i) => {
              console.log(`\nService ${i+1}:`);
              console.log(`  Title: "${s.title}"`);
              console.log(`  URL: ${s.page_url}`);
              console.log(`  Kind: ${s.kind}`);
              console.log(`  Description: ${s.description || 'NO_DESCRIPTION'}`);
            });
          }
          
          console.log('\n=== DEBUG INFO ===');
          if (result.debug) {
            console.log('Debug info available:', Object.keys(result.debug));
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

debugServiceFinding().catch(console.error);
