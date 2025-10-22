// Debug clarification system
const http = require('http');

function testClarification() {
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
        
        console.log('Clarification Debug:');
        console.log('─'.repeat(50));
        console.log(`✅ Success: ${response.ok}`);
        console.log(`🎯 Type: ${response.type}`);
        console.log(`📝 Answer: "${response.answer}"`);
        console.log(`📝 Answer markdown: "${response.answer_markdown}"`);
        console.log(`📝 Clarification: "${response.clarification}"`);
        console.log(`📝 Options: ${JSON.stringify(response.options)}`);
        console.log(`🔍 Debug info: ${JSON.stringify(response.debug, null, 2)}`);
        
        if (response.structured) {
          console.log(`📊 Structured: ${JSON.stringify(response.structured, null, 2)}`);
        }
        
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

testClarification();
