const http = require('http');

// Test ALL "what is" questions to see the full pattern
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

async function testQuery(query) {
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
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🔍 TESTING ALL "WHAT IS" QUESTIONS');
  console.log('='.repeat(60));
  console.log('Testing all 29 "what is" questions to see the full pattern\n');
  
  const results = [];
  
  for (const query of testQueries) {
    try {
      const result = await testQuery(query);
      results.push(result);
      
      console.log(`${results.length}/${testQueries.length} - ${result.responseType} - ${result.answerLength} chars - "${query}"`);
    } catch (error) {
      console.error(`Error testing "${query}":`, error.message);
    }
  }
  
  // Analysis
  console.log('\n📈 FULL PATTERN ANALYSIS:');
  console.log('='.repeat(60));
  
  const directAnswers = results.filter(r => r.responseType === 'direct_answer');
  const articleLinks = results.filter(r => r.responseType === 'article_links');
  const hybrid = results.filter(r => r.responseType === 'hybrid');
  const minimal = results.filter(r => r.responseType === 'minimal');
  
  console.log(`Direct Answers: ${directAnswers.length}/${results.length}`);
  console.log(`Article Links: ${articleLinks.length}/${results.length}`);
  console.log(`Hybrid: ${hybrid.length}/${results.length}`);
  console.log(`Minimal: ${minimal.length}/${results.length}`);
  
  console.log('\n📊 DIRECT ANSWERS:');
  directAnswers.forEach(r => {
    console.log(`- "${r.query}": ${r.answerLength} chars`);
  });
  
  console.log('\n📊 ARTICLE LINKS:');
  articleLinks.forEach(r => {
    console.log(`- "${r.query}": ${r.answerLength} chars`);
  });
  
  console.log('\n📊 HYBRID (Direct + Articles):');
  hybrid.forEach(r => {
    console.log(`- "${r.query}": ${r.answerLength} chars`);
  });
  
  console.log('\n🎯 BUSINESS DECISION NEEDED:');
  console.log('Which questions should get:');
  console.log('1. Direct answers only?');
  console.log('2. Article links only?');
  console.log('3. Hybrid (direct answer + article links)?');
  console.log('4. Different approach for different question types?');
}

main().catch(console.error);
