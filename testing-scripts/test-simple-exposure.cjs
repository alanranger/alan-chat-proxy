// Simple test to check if the server is working
const http = require('http');

function testExposureTriangle() {
  const postData = JSON.stringify({
    query: 'what is exposure triangle',
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
      try {
        const response = JSON.parse(data);
        console.log('\n📊 Response Analysis:');
        console.log(`✅ Success: ${response.success}`);
        console.log(`📝 Answer Length: ${response.answer?.length || 0} characters`);
        console.log(`🎯 Type: ${response.type}`);
        
        console.log('\n📝 Answer Content:');
        console.log('─'.repeat(50));
        console.log(response.answer || 'No answer provided');
        console.log('─'.repeat(50));
        
        // Check for concept synthesis
        const answer = response.answer?.toLowerCase() || '';
        console.log('\n🔍 Concept Analysis:');
        console.log(`Contains "triangle": ${answer.includes('triangle')}`);
        console.log(`Contains "relationship": ${answer.includes('relationship')}`);
        console.log(`Contains "aperture": ${answer.includes('aperture')}`);
        console.log(`Contains "shutter": ${answer.includes('shutter')}`);
        console.log(`Contains "iso": ${answer.includes('iso')}`);
        console.log(`Contains "work together": ${answer.includes('work together')}`);
        console.log(`Contains "f-stop": ${answer.includes('f-stop')}`);
        
      } catch (error) {
        console.error('❌ Parse error:', error.message);
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request failed:', error.message);
  });

  req.write(postData);
  req.end();
}

console.log('🧪 Testing "exposure triangle" with simple HTTP...\n');
testExposureTriangle();
