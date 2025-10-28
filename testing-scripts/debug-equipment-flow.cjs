const http = require('http');

function testQuery(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: query,
      sessionId: 'equipment-debug-' + Date.now()
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
            structured: response.structured,
            debug: response.debug
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

async function debugEquipmentFlow() {
  console.log('🔧 Debugging Equipment Recommendation Flow...\n');
  
  const question = 'what camera should I buy';
  console.log(`📝 Testing: "${question}"`);
  const result = await testQuery(question);
  
  if (result.status === 200) {
    console.log(`   ✅ Status: ${result.status}`);
    console.log(`   📝 Answer: ${result.answer ? result.answer.substring(0, 300) + '...' : 'No answer'}`);
    console.log(`   🎯 Type: ${result.type}`);
    console.log(`   🔍 Confidence: ${result.confidence}`);
    
    // Check debug info
    if (result.debug) {
      console.log(`   🐛 Debug Info: ${JSON.stringify(result.debug, null, 2)}`);
    }
    
    // Check sources
    if (result.sources && result.sources.articles && result.sources.articles.length > 0) {
      console.log(`   📚 Sources Articles: ${result.sources.articles.length} articles found`);
      result.sources.articles.slice(0, 3).forEach((article, index) => {
        console.log(`      ${index + 1}. ${article.title || 'Untitled'} - ${article.page_url || article.url || 'No URL'}`);
      });
    } else {
      console.log(`   ⚠️  ISSUE: No sources articles provided`);
    }
    
    // Check structured data
    if (result.structured && result.structured.articles && result.structured.articles.length > 0) {
      console.log(`   📊 Structured Articles: ${result.structured.articles.length} articles found`);
      result.structured.articles.slice(0, 3).forEach((article, index) => {
        console.log(`      ${index + 1}. ${article.title || 'Untitled'} - ${article.page_url || article.url || 'No URL'}`);
      });
    } else {
      console.log(`   ⚠️  ISSUE: No structured articles provided`);
    }
    
  } else {
    console.log(`   ❌ Status: ${result.status}`);
    console.log(`   Error: ${result.error || 'Unknown error'}`);
  }
}

debugEquipmentFlow().catch(console.error);
