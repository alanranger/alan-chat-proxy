const http = require('http');

function testSingleRequest() {
  return new Promise((resolve, reject) => {
    console.log('🔍 Testing single request...');
    
    const data = JSON.stringify({
      query: "what is exposure",
      sessionId: "test-session"
    });
    
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
      console.log(`Status: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);
      
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        console.log('Raw response body:');
        console.log(body);
        
        try {
          const result = JSON.parse(body);
          console.log('Parsed response:');
          console.log(JSON.stringify(result, null, 2));
          resolve(result);
        } catch (error) {
          console.error('Error parsing JSON:', error.message);
          console.log('Raw body was:', body);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error.message);
      reject(error);
    });
    
    req.write(data);
    req.end();
  });
}

testSingleRequest().catch(console.error);
