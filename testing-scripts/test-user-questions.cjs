const http = require('http');

function testQuery(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: query,
      sessionId: 'test-session-' + Date.now()
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
            confidence: response.confidence,
            sources: response.sources,
            structured: response.structured
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

async function testUserQuestions() {
  console.log('🔍 Testing exact questions from user\'s interactive testing results...\n');
  
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
      console.log(`   📝 Answer: ${result.answer ? result.answer.substring(0, 150) + '...' : 'No answer'}`);
      console.log(`   🎯 Type: ${result.type}`);
      console.log(`   🔍 Confidence: ${result.confidence}`);
      
      // Check if answer contains URLs (article links)
      if (result.answer && (result.answer.includes('http') || result.answer.includes('www'))) {
        console.log(`   ⚠️  ISSUE: Answer contains URL instead of direct response`);
      } else if (result.answer && result.answer.includes('**')) {
        console.log(`   ✅ GOOD: Answer contains formatted direct response`);
      }
      
      // Check sources
      if (result.sources && result.sources.articles && result.sources.articles.length > 0) {
        console.log(`   📚 Related Articles: ${result.sources.articles.length} articles found`);
      } else {
        console.log(`   ⚠️  ISSUE: No related articles provided`);
      }
      
      // Check structured data
      if (result.structured && result.structured.articles && result.structured.articles.length > 0) {
        console.log(`   📊 Structured Articles: ${result.structured.articles.length} articles`);
      }
      
    } else {
      console.log(`   ❌ Status: ${result.status}`);
      console.log(`   Error: ${result.error || 'Unknown error'}`);
    }
    console.log('');
  }
}

testUserQuestions().catch(console.error);
