const http = require('http');

// Test with key questions that should show clear differences
const testQueries = [
  "what is exposure",
  "what is exposure triangle", 
  "do you have photography courses",
  "what camera do i need for your courses",
  "do you do commercial photography"
];

async function testQuery(query, params, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔍 Testing: "${query}" with ${label}`);
    console.log('='.repeat(50));
    
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
          
          // Analyze response content
          const answerText = result.answer || '';
          const hasDirectAnswer = answerText.length > 50 && !answerText.includes('http');
          const hasArticleLinks = answerText.includes('http') || (result.articles && result.articles.length > 0);
          const hasEvents = result.events && result.events.length > 0;
          const hasArticles = result.articles && result.articles.length > 0;
          
          // Determine response type
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
            query,
            label,
            confidence: result.confidence,
            answerLength: answerText.length,
            answerPreview: answerText.substring(0, 200),
            responseType,
            hasDirectAnswer,
            hasArticleLinks,
            hasEvents,
            hasArticles,
            eventsCount: result.events?.length || 0,
            articlesCount: result.articles?.length || 0
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
  console.log('🔍 QUICK APPROACH COMPARISON TEST');
  console.log('='.repeat(60));
  console.log('Testing both approaches for key questions...\n');
  
  const results = [];
  
  for (const query of testQueries) {
    // Test 1: Simple Parameters (New Logic)
    const simpleParams = {
      query: query,
      sessionId: 'simple-test-session'
    };
    
    const simpleResult = await testQuery(query, simpleParams, 'Simple Parameters');
    results.push(simpleResult);
    
    // Test 2: Live Chat Parameters (Original Logic)
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
    console.log(`\n📊 COMPARISON FOR: "${query}"`);
    console.log(`Simple Confidence: ${(simpleResult.confidence * 100).toFixed(1)}%`);
    console.log(`Live Chat Confidence: ${(liveChatResult.confidence * 100).toFixed(1)}%`);
    console.log(`Simple Response Type: ${simpleResult.responseType}`);
    console.log(`Live Chat Response Type: ${liveChatResult.responseType}`);
    
    if (simpleResult.answerPreview !== liveChatResult.answerPreview) {
      console.log('\n📝 CONTENT DIFFERENCES:');
      console.log('Simple Answer:', simpleResult.answerPreview);
      console.log('Live Chat Answer:', liveChatResult.answerPreview);
    }
    
    console.log('\n' + '='.repeat(60));
  }
  
  // Summary
  console.log('\n📈 SUMMARY:');
  const simpleResponseTypes = results.filter((r, i) => i % 2 === 0).map(r => r.responseType);
  const liveChatResponseTypes = results.filter((r, i) => i % 2 === 1).map(r => r.responseType);
  
  console.log('Simple Parameters Response Types:', simpleResponseTypes);
  console.log('Live Chat Parameters Response Types:', liveChatResponseTypes);
  
  const simpleConfidences = results.filter((r, i) => i % 2 === 0).map(r => r.confidence * 100);
  const liveChatConfidences = results.filter((r, i) => i % 2 === 1).map(r => r.confidence * 100);
  
  console.log(`Simple Avg Confidence: ${(simpleConfidences.reduce((a,b) => a+b, 0) / simpleConfidences.length).toFixed(1)}%`);
  console.log(`Live Chat Avg Confidence: ${(liveChatConfidences.reduce((a,b) => a+b, 0) / liveChatConfidences.length).toFixed(1)}%`);
}

main().catch(console.error);
