// Debug event response structure
const http = require('http');

function testEventResponse() {
  const postData = JSON.stringify({
    query: 'when is your next devon workshop',
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
        
        console.log('Event Response Analysis:');
        console.log('─'.repeat(50));
        console.log(`✅ Success: ${response.ok}`);
        console.log(`🎯 Type: ${response.type}`);
        console.log(`📝 Answer type: ${typeof response.answer}`);
        console.log(`📝 Answer length: ${Array.isArray(response.answer) ? response.answer.length : response.answer?.length || 0}`);
        console.log(`📝 Answer markdown: "${response.answer_markdown}"`);
        console.log(`📅 Events count: ${response.events?.length || 0}`);
        
        if (response.answer_markdown) {
          console.log(`📝 Answer markdown length: ${response.answer_markdown.length} chars`);
          console.log(`📝 Answer markdown content: "${response.answer_markdown}"`);
        }
        
        if (response.events && response.events.length > 0) {
          console.log('\nEvent Details:');
          response.events.forEach((event, i) => {
            console.log(`Event ${i + 1}: ${event.title || event.event_title || 'No title'}`);
            console.log(`  Date: ${event.date || 'No date'}`);
            console.log(`  Location: ${event.location || 'No location'}`);
            console.log(`  Price: ${event.price || 'No price'}`);
          });
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

testEventResponse();









