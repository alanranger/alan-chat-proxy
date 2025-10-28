const http = require('http');

// Test a few key questions to show the difference
const testQueries = [
  "what is exposure",
  "what is exposure triangle", 
  "what is iso",
  "what is aperture",
  "what is shutter speed"
];

async function testQuery(query) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔍 Testing: "${query}"`);
    console.log('-'.repeat(50));
    
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
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          const answer = result.answer || '';
          const hasDirectAnswer = answer.length > 50 && !answer.includes('http');
          const hasArticleLinks = answer.includes('http');
          
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
          console.log(`Answer Length: ${answer.length} chars`);
          console.log(`Events: ${result.events?.length || 0}, Articles: ${result.articles?.length || 0}`);
          console.log(`Answer Preview: ${answer.substring(0, 200)}...`);
          
          resolve({
            query,
            confidence: result.confidence,
            answer,
            answerLength: answer.length,
            responseType,
            hasDirectAnswer,
            hasArticleLinks,
            eventsCount: result.events?.length || 0,
            articlesCount: result.articles?.length || 0
          });
        } catch (error) {
          console.error(`Error parsing response:`, error.message);
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

async function main() {
  console.log('🔍 TESTING ORIGINAL LOGIC (isConceptQuery DISABLED)');
  console.log('='.repeat(60));
  console.log('This shows how queries behave WITHOUT the isConceptQuery logic\n');
  
  const results = [];
  
  for (const query of testQueries) {
    try {
      const result = await testQuery(query);
      results.push(result);
    } catch (error) {
      console.error(`Error testing "${query}":`, error.message);
    }
  }
  
  // Summary
  console.log('\n📈 SUMMARY:');
  console.log('='.repeat(60));
  console.log('Response Types:');
  results.forEach(r => {
    console.log(`- "${r.query}": ${r.responseType} (${r.answerLength} chars)`);
  });
  
  const directAnswers = results.filter(r => r.responseType === 'direct_answer').length;
  const articleLinks = results.filter(r => r.responseType === 'article_links').length;
  
  console.log(`\nDirect Answers: ${directAnswers}/${results.length}`);
  console.log(`Article Links: ${articleLinks}/${results.length}`);
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('1. Review these responses (original logic)');
  console.log('2. Compare with what you saw before (current logic)');
  console.log('3. Decide which approach works better for each question type');
  console.log('4. We can then implement the best approach');
}

main().catch(console.error);
