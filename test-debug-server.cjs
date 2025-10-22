// Debug server response
const http = require('http');

function testServer() {
  const postData = JSON.stringify({
    message: 'what is exposure triangle',
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
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers: ${JSON.stringify(res.headers)}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('\nRaw Response:');
      console.log('─'.repeat(50));
      console.log(data);
      console.log('─'.repeat(50));
      
      try {
        const response = JSON.parse(data);
        console.log('\nParsed Response:');
        console.log(JSON.stringify(response, null, 2));
      } catch (error) {
        console.log('\n❌ Parse error:', error.message);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request failed:', error.message);
  });

  req.write(postData);
  req.end();
}

console.log('🔍 Debugging server response...\n');
testServer();









