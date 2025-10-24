const http = require('http');

// Test the actual endpoints being used
async function testRealEndpoints() {
  console.log('🔍 TESTING REAL ENDPOINTS');
  console.log('='.repeat(60));
  
  const testQuery = "what is exposure";
  
  // Test A: Using the same parameters as chat.html
  console.log('\n📱 TEST A: chat.html parameters');
  console.log('-'.repeat(40));
  
  const chatHtmlParams = {
    query: testQuery,
    topK: 8,
    previousQuery: null,
    sessionId: 'chat-html-test',
    pageContext: {
      pathname: '/chat.html',
      clarificationLevel: 0
    }
  };
  
  const chatHtmlResult = await makeRequest(chatHtmlParams, 'chat.html');
  
  // Test B: Using the same parameters as interactive-testing.html  
  console.log('\n🧪 TEST B: interactive-testing.html parameters');
  console.log('-'.repeat(40));
  
  const interactiveParams = {
    query: testQuery,
    sessionId: 'interactive-test'
  };
  
  const interactiveResult = await makeRequest(interactiveParams, 'interactive-testing');
  
  // Compare results
  console.log('\n📊 COMPARISON:');
  console.log('='.repeat(60));
  console.log(`Query: "${testQuery}"`);
  console.log(`chat.html Confidence: ${(chatHtmlResult.confidence * 100).toFixed(1)}%`);
  console.log(`interactive Confidence: ${(interactiveResult.confidence * 100).toFixed(1)}%`);
  console.log(`chat.html Answer Length: ${chatHtmlResult.answerLength} chars`);
  console.log(`interactive Answer Length: ${interactiveResult.answerLength} chars`);
  console.log(`chat.html Events: ${chatHtmlResult.eventsCount}, Articles: ${chatHtmlResult.articlesCount}`);
  console.log(`interactive Events: ${interactiveResult.eventsCount}, Articles: ${interactiveResult.articlesCount}`);
  
  const contentDifferent = chatHtmlResult.answerPreview !== interactiveResult.answerPreview;
  console.log(`Content Different: ${contentDifferent ? 'YES' : 'NO'}`);
  
  if (contentDifferent) {
    console.log('\n📝 CONTENT DIFFERENCES:');
    console.log('chat.html Answer:', chatHtmlResult.answerPreview);
    console.log('interactive Answer:', interactiveResult.answerPreview);
  }
  
  console.log('\n🎯 CONCLUSION:');
  if (contentDifferent) {
    console.log('❌ The parameters DO affect the response content');
    console.log('❌ My previous test was NOT accurate');
    console.log('❌ We need to investigate why the parameters are not working as expected');
  } else {
    console.log('✅ The parameters do NOT affect the response content');
    console.log('✅ The difference between live chat and interactive testing is caused by something else');
  }
}

function makeRequest(params, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔍 Testing with ${label} parameters...`);
    console.log('Parameters:', JSON.stringify(params, null, 2));
    
    const postData = JSON.stringify(params);
    
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
          const result = JSON.parse(data);
          
          const answerText = result.answer || '';
          const hasDirectAnswer = answerText.length > 50 && !answerText.includes('http');
          const hasArticleLinks = answerText.includes('http') || (result.articles && result.articles.length > 0);
          
          let responseType = 'unknown';
          if (hasDirectAnswer && !hasArticleLinks) {
            responseType = 'direct_answer';
          } else if (hasArticleLinks && !hasDirectAnswer) {
            responseType = 'article_links';
          } else if (hasDirectAnswer && hasArticleLinks) {
            responseType = 'hybrid';
          } else {
            responseType = 'minimal';
          }
          
          console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
          console.log(`Response Type: ${responseType}`);
          console.log(`Answer Length: ${answerText.length} chars`);
          console.log(`Events: ${result.events?.length || 0}, Articles: ${result.articles?.length || 0}`);
          console.log(`Answer Preview: ${answerText.substring(0, 150)}...`);
          
          resolve({
            confidence: result.confidence,
            answerLength: answerText.length,
            answerPreview: answerText.substring(0, 200),
            responseType,
            hasDirectAnswer,
            hasArticleLinks,
            eventsCount: result.events?.length || 0,
            articlesCount: result.articles?.length || 0
          });
        } catch (error) {
          console.error(`Error parsing response:`, error.message);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`Request error:`, error.message);
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

testRealEndpoints().catch(console.error);
