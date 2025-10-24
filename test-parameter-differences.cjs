const http = require('http');

// Test queries to compare
const testQueries = [
  "what is exposure",
  "what is exposure triangle", 
  "do you have photography courses",
  "what camera do i need for your courses"
];

async function testQuery(query, params, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔍 Testing: "${query}" with ${label}`);
    console.log('='.repeat(60));
    
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
          console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
          console.log(`Answer length: ${result.answer?.length || 0} characters`);
          console.log(`Answer preview: ${result.answer?.substring(0, 200) || 'No answer'}...`);
          
          // Check for articles and events
          if (result.articles && result.articles.length > 0) {
            console.log(`Articles found: ${result.articles.length}`);
            console.log(`First article: ${result.articles[0]?.title || 'No title'}`);
          }
          if (result.events && result.events.length > 0) {
            console.log(`Events found: ${result.events.length}`);
            console.log(`First event: ${result.events[0]?.title || 'No title'}`);
          }
          
          resolve({
            query,
            label,
            confidence: result.confidence,
            answerLength: result.answer?.length || 0,
            answerPreview: result.answer?.substring(0, 200) || '',
            articlesCount: result.articles?.length || 0,
            eventsCount: result.events?.length || 0,
            hasArticles: (result.articles?.length || 0) > 0,
            hasEvents: (result.events?.length || 0) > 0
          });
        } catch (error) {
          console.error(`Error parsing response for "${query}":`, error.message);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`Error testing "${query}":`, error.message);
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🔍 Testing Parameter Differences: Simple vs Live Chat Parameters');
  console.log('='.repeat(80));
  
  const results = [];
  
  for (const query of testQueries) {
    // Test 1: Simple parameters (like automated tests and interactive testing)
    const simpleParams = {
      query: query,
      sessionId: 'test-session'
    };
    
    const simpleResult = await testQuery(query, simpleParams, 'Simple Parameters');
    results.push(simpleResult);
    
    // Test 2: Live chat parameters (like chat.html)
    const liveChatParams = {
      query: query,
      topK: 8,
      previousQuery: null,
      sessionId: 'live-chat-session',
      pageContext: {
        pathname: '/chat.html',
        clarificationLevel: 0
      }
    };
    
    const liveChatResult = await testQuery(query, liveChatParams, 'Live Chat Parameters');
    results.push(liveChatResult);
    
    // Compare results
    console.log('\n📊 COMPARISON:');
    console.log(`Confidence: ${(simpleResult.confidence * 100).toFixed(1)}% vs ${(liveChatResult.confidence * 100).toFixed(1)}%`);
    console.log(`Answer Length: ${simpleResult.answerLength} vs ${liveChatResult.answerLength}`);
    console.log(`Articles: ${simpleResult.articlesCount} vs ${liveChatResult.articlesCount}`);
    console.log(`Events: ${simpleResult.eventsCount} vs ${liveChatResult.eventsCount}`);
    console.log(`Has Articles: ${simpleResult.hasArticles} vs ${liveChatResult.hasArticles}`);
    console.log(`Has Events: ${simpleResult.hasEvents} vs ${liveChatResult.hasEvents}`);
    
    const contentDifferent = simpleResult.answerPreview !== liveChatResult.answerPreview;
    console.log(`Content Different: ${contentDifferent ? 'YES' : 'NO'}`);
    
    if (contentDifferent) {
      console.log('\n📝 CONTENT DIFFERENCES:');
      console.log('Simple Answer:', simpleResult.answerPreview);
      console.log('Live Chat Answer:', liveChatResult.answerPreview);
    }
    
    console.log('\n' + '='.repeat(80));
  }
  
  // Summary
  console.log('\n📈 SUMMARY ANALYSIS:');
  const contentDifferences = results.filter((r, i) => i % 2 === 1 && r.answerPreview !== results[i-1].answerPreview);
  const confidenceDifferences = results.filter((r, i) => i % 2 === 1 && Math.abs(r.confidence - results[i-1].confidence) > 0.05);
  
  console.log(`Queries with different content: ${contentDifferences.length}/${testQueries.length}`);
  console.log(`Queries with different confidence: ${confidenceDifferences.length}/${testQueries.length}`);
  
  console.log('\n🎯 KEY FINDINGS:');
  console.log('- Simple parameters: Used by automated tests and interactive testing');
  console.log('- Live chat parameters: Used by chat.html with topK, pageContext, etc.');
  console.log('- These parameter differences are causing different response content and confidence scores');
}

main().catch(console.error);
