const http = require('http');

async function testServicesQuery() {
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
          console.log('=== SERVICES QUERY TEST ===');
          console.log('Query: What types of photography services do you offer?');
          console.log('Type:', result.type);
          console.log('Confidence:', result.confidence);
          console.log('Answer:', result.answer);
          console.log('\n=== STRUCTURED DATA ===');
          console.log('Services count:', result.structured?.services?.length || 0);
          console.log('Events count:', result.structured?.events?.length || 0);
          console.log('Articles count:', result.structured?.articles?.length || 0);
          
          if (result.structured?.services) {
            console.log('\n=== SERVICE DETAILS ===');
            result.structured.services.forEach((s, i) => {
              console.log(`${i+1}. ${s.title} - ${s.page_url}`);
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

testServicesQuery().catch(console.error);
