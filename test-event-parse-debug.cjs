// Debug event query parse errors
const http = require('http');

function testEventParseError() {
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
        console.log('─'.repeat(50));
        console.log(JSON.stringify(response, null, 2));
        console.log('─'.repeat(50));
        
        console.log('\nResponse Analysis:');
        console.log(`✅ Success: ${response.success}`);
        console.log(`📝 Answer: ${response.answer?.substring(0, 200)}...`);
        console.log(`🎯 Type: ${response.type}`);
        console.log(`📚 Sources: ${response.sources?.length || 0}`);
        console.log(`📅 Events: ${response.events?.length || 0}`);
        
        if (response.events && response.events.length > 0) {
          console.log('\nEvent Details:');
          response.events.forEach((event, i) => {
            console.log(`Event ${i + 1}: ${event.title || 'No title'}`);
            console.log(`  Date: ${event.date || 'No date'}`);
            console.log(`  Location: ${event.location || 'No location'}`);
            console.log(`  Price: ${event.price || 'No price'}`);
          });
        }
        
      } catch (error) {
        console.log(`❌ Parse Error: ${error.message}`);
        console.log('Raw data that failed to parse:');
        console.log(data.substring(0, 500) + '...');
      }
    });
  });

  req.on('error', (error) => {
    console.error(`Request error: ${error.message}`);
  });

  req.write(postData);
  req.end();
}

testEventParseError();









