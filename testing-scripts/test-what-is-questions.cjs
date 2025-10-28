const http = require('http');

function testQuery(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: query,
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
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);
          resolve({
            query,
            status: res.statusCode,
            answer: response.answer,
            answer_markdown: response.answer_markdown,
            type: response.type,
            confidence: response.confidence
          });
        } catch (e) {
          resolve({
            query,
            status: res.statusCode,
            error: e.message,
            rawResponse: responseData
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        query,
        error: e.message
      });
    });

    req.write(postData);
    req.end();
  });
}

async function testWhatIsQuestions() {
  console.log('🔍 Testing "what is" questions to understand current behavior...\n');
  
  const questions = [
    'what is iso',
    'what is aperture', 
    'what is shutter speed',
    'what is exposure triangle'
  ];
  
  for (const question of questions) {
    console.log(`📝 Testing: "${question}"`);
    const result = await testQuery(question);
    
    if (result.status === 200) {
      console.log(`   ✅ Status: ${result.status}`);
      console.log(`   📝 Answer: ${result.answer ? result.answer.substring(0, 100) + '...' : 'No answer'}`);
      console.log(`   🎯 Type: ${result.type}`);
      console.log(`   🔍 Confidence: ${result.confidence}`);
      
      if (result.answer && result.answer.includes('http')) {
        console.log(`   ⚠️  ISSUE: Answer contains URL instead of direct response`);
      }
    } else {
      console.log(`   ❌ Status: ${result.status}`);
      console.log(`   Error: ${result.error || 'Unknown error'}`);
    }
    console.log('');
  }
}

testWhatIsQuestions().catch(console.error);
