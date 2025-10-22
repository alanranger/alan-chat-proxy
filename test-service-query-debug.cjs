// Debug service query responses
const http = require('http');

function testServiceQuery() {
  const postData = JSON.stringify({
    query: 'do you provide photography courses',
    sessionId: 'debug-session'
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
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        
        console.log('Service Query Debug:');
        console.log('─'.repeat(50));
        console.log(`✅ Success: ${response.ok}`);
        console.log(`🎯 Type: ${response.type}`);
        console.log(`📝 Answer: "${response.answer}"`);
        console.log(`📝 Answer markdown: "${response.answer_markdown}"`);
        console.log(`📚 Articles: ${response.structured?.articles?.length || 0}`);
        console.log(`📅 Events: ${response.structured?.events?.length || 0}`);
        console.log(`🔍 Debug info: ${JSON.stringify(response.debug, null, 2)}`);
        
      } catch (error) {
        console.log(`❌ Parse Error: ${error.message}`);
      }
    });
  });

  req.on('error', (error) => {
    console.error(`Request error: ${error.message}`);
  });

  req.write(postData);
  req.end();
}

testServiceQuery();
