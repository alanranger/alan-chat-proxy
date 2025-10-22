// Test event query to debug parse errors
const http = require('http');

function testEventQuery() {
  const postData = JSON.stringify({
    query: 'when is your next devon workshop',
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
        console.log(`Success: ${response.success}`);
        console.log(`Answer: ${response.answer}`);
        console.log(`Type: ${response.type}`);
        console.log(`Sources: ${response.sources?.length || 0}`);
        console.log(`Articles: ${response.articles?.length || 0}`);
        console.log(`Events: ${response.events?.length || 0}`);
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

console.log('🔍 Testing event query...\n');
testEventQuery();
