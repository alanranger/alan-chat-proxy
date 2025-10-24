const http = require('http');

// Alan's manual scores for comparison
const alanScores = {
  "what is exposure": 100,
  "what is exposure triangle": 100,
  "what is iso": 100,
  "what is aperture": 100,
  "what is shutter speed": 100,
  "what is depth of field": 100,
  "what is white balance": 100,
  "what is raw format": 100,
  "what is histogram": 100,
  "what is composition": 100,
  "what is rule of thirds": 100,
  "what is leading lines": 100,
  "what is golden hour": 100,
  "what is blue hour": 100,
  "what is hdr photography": 100,
  "what is macro photography": 100,
  "what is street photography": 100,
  "what is portrait photography": 100,
  "what is landscape photography": 100,
  "what is wildlife photography": 100,
  "what is sports photography": 100,
  "what is wedding photography": 100,
  "what is event photography": 100,
  "what is commercial photography": 100,
  "what is fine art photography": 100,
  "what is documentary photography": 100,
  "what is travel photography": 100,
  "what is architectural photography": 100,
  "what is food photography": 100
};

// Test queries from the 29-question set
const testQueries = [
  "what is exposure",
  "what is exposure triangle", 
  "what is iso",
  "what is aperture",
  "what is shutter speed",
  "what is depth of field",
  "what is white balance",
  "what is raw format",
  "what is histogram",
  "what is composition",
  "what is rule of thirds",
  "what is leading lines",
  "what is golden hour",
  "what is blue hour",
  "what is hdr photography",
  "what is macro photography",
  "what is street photography",
  "what is portrait photography",
  "what is landscape photography",
  "what is wildlife photography",
  "what is sports photography",
  "what is wedding photography",
  "what is event photography",
  "what is commercial photography",
  "what is fine art photography",
  "what is documentary photography",
  "what is travel photography",
  "what is architectural photography",
  "what is food photography"
];

async function testQuery(query, params, label) {
  return new Promise((resolve, reject) => {
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
            articlesCount: result.articles?.length || 0,
            alanScore: alanScores[query] || 0
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
  console.log('🔍 COMPREHENSIVE APPROACH COMPARISON TEST');
  console.log('='.repeat(80));
  console.log('Testing both approaches for all 29 questions...\n');
  
  const results = [];
  
  for (const query of testQueries) {
    console.log(`\n🔍 Testing: "${query}"`);
    console.log('-'.repeat(60));
    
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
    console.log(`Alan's Score: ${alanScores[query] || 'N/A'}%`);
    console.log(`Simple Confidence: ${(simpleResult.confidence * 100).toFixed(1)}%`);
    console.log(`Live Chat Confidence: ${(liveChatResult.confidence * 100).toFixed(1)}%`);
    console.log(`Simple Response Type: ${simpleResult.responseType}`);
    console.log(`Live Chat Response Type: ${liveChatResult.responseType}`);
    console.log(`Simple Answer Length: ${simpleResult.answerLength} chars`);
    console.log(`Live Chat Answer Length: ${liveChatResult.answerLength} chars`);
    console.log(`Simple Events: ${simpleResult.eventsCount}, Articles: ${simpleResult.articlesCount}`);
    console.log(`Live Chat Events: ${liveChatResult.eventsCount}, Articles: ${liveChatResult.articlesCount}`);
    
    // Determine which approach is better
    const simpleDeviation = Math.abs((simpleResult.confidence * 100) - (alanScores[query] || 0));
    const liveChatDeviation = Math.abs((liveChatResult.confidence * 100) - (alanScores[query] || 0));
    
    let betterApproach = 'tie';
    if (simpleDeviation < liveChatDeviation) {
      betterApproach = 'simple';
    } else if (liveChatDeviation < simpleDeviation) {
      betterApproach = 'live_chat';
    }
    
    console.log(`Better Approach: ${betterApproach} (Simple dev: ${simpleDeviation.toFixed(1)}%, Live Chat dev: ${liveChatDeviation.toFixed(1)}%)`);
    
    if (simpleResult.answerPreview !== liveChatResult.answerPreview) {
      console.log('\n📝 CONTENT DIFFERENCES:');
      console.log('Simple Answer:', simpleResult.answerPreview);
      console.log('Live Chat Answer:', liveChatResult.answerPreview);
    }
    
    console.log('\n' + '='.repeat(80));
  }
  
  // Summary Analysis
  console.log('\n📈 SUMMARY ANALYSIS');
  console.log('='.repeat(80));
  
  const simpleWins = results.filter((r, i) => i % 2 === 0 && r.betterApproach === 'simple').length;
  const liveChatWins = results.filter((r, i) => i % 2 === 0 && r.betterApproach === 'live_chat').length;
  const ties = results.filter((r, i) => i % 2 === 0 && r.betterApproach === 'tie').length;
  
  console.log(`Simple Parameters Better: ${simpleWins}/${testQueries.length} queries`);
  console.log(`Live Chat Parameters Better: ${liveChatWins}/${testQueries.length} queries`);
  console.log(`Ties: ${ties}/${testQueries.length} queries`);
  
  // Response type analysis
  const simpleResponseTypes = results.filter((r, i) => i % 2 === 0).map(r => r.responseType);
  const liveChatResponseTypes = results.filter((r, i) => i % 2 === 1).map(r => r.responseType);
  
  console.log('\n📊 RESPONSE TYPE ANALYSIS:');
  console.log('Simple Parameters:');
  console.log(`- Direct Answers: ${simpleResponseTypes.filter(t => t === 'direct_answer').length}`);
  console.log(`- Article Links: ${simpleResponseTypes.filter(t => t === 'article_links').length}`);
  console.log(`- Hybrid: ${simpleResponseTypes.filter(t => t === 'hybrid').length}`);
  console.log(`- Minimal: ${simpleResponseTypes.filter(t => t === 'minimal').length}`);
  
  console.log('Live Chat Parameters:');
  console.log(`- Direct Answers: ${liveChatResponseTypes.filter(t => t === 'direct_answer').length}`);
  console.log(`- Article Links: ${liveChatResponseTypes.filter(t => t === 'article_links').length}`);
  console.log(`- Hybrid: ${liveChatResponseTypes.filter(t => t === 'hybrid').length}`);
  console.log(`- Minimal: ${liveChatResponseTypes.filter(t => t === 'minimal').length}`);
  
  // Confidence analysis
  const simpleConfidences = results.filter((r, i) => i % 2 === 0).map(r => r.confidence * 100);
  const liveChatConfidences = results.filter((r, i) => i % 2 === 1).map(r => r.confidence * 100);
  
  console.log('\n📊 CONFIDENCE ANALYSIS:');
  console.log(`Simple Parameters - Avg: ${(simpleConfidences.reduce((a,b) => a+b, 0) / simpleConfidences.length).toFixed(1)}%`);
  console.log(`Live Chat Parameters - Avg: ${(liveChatConfidences.reduce((a,b) => a+b, 0) / liveChatConfidences.length).toFixed(1)}%`);
  
  console.log('\n🎯 RECOMMENDATIONS:');
  if (simpleWins > liveChatWins) {
    console.log('- Simple parameters work better for most queries');
    console.log('- Consider using simple parameters for technical queries');
  } else if (liveChatWins > simpleWins) {
    console.log('- Live chat parameters work better for most queries');
    console.log('- Consider using live chat parameters for business queries');
  } else {
    console.log('- Both approaches have similar performance');
    console.log('- Consider hybrid approach based on query type');
  }
}

main().catch(console.error);
