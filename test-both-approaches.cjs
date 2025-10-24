const http = require('http');

// Test queries that should show clear differences
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

async function testWithCurrentLogic(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: query,
      sessionId: 'current-logic-test'
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
          resolve({
            confidence: result.confidence,
            answer: result.answer || '',
            answerLength: (result.answer || '').length,
            hasDirectAnswer: (result.answer || '').length > 50 && !(result.answer || '').includes('http'),
            hasArticleLinks: (result.answer || '').includes('http'),
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

async function testWithOriginalLogic(query) {
  // This would test with the original logic, but we need to modify the API temporarily
  // For now, let's just return the current result and note that we need to implement this
  return {
    confidence: 0,
    answer: '[ORIGINAL LOGIC TEST NEEDED]',
    answerLength: 0,
    hasDirectAnswer: false,
    hasArticleLinks: false,
    eventsCount: 0,
    articlesCount: 0
  };
}

async function main() {
  console.log('🔍 TESTING BOTH APPROACHES SIDE-BY-SIDE');
  console.log('='.repeat(80));
  console.log('This will show you both responses so YOU can decide which is better for each question type\n');
  
  const results = [];
  
  for (const query of testQueries) {
    console.log(`\n🔍 Testing: "${query}"`);
    console.log('='.repeat(60));
    
    try {
      // Test current logic (with isConceptQuery)
      const currentResult = await testWithCurrentLogic(query);
      
      // Test original logic (without isConceptQuery) - placeholder for now
      const originalResult = await testWithOriginalLogic(query);
      
      console.log(`\n📊 CURRENT LOGIC (with isConceptQuery):`);
      console.log(`Confidence: ${(currentResult.confidence * 100).toFixed(1)}%`);
      console.log(`Answer Length: ${currentResult.answerLength} chars`);
      console.log(`Has Direct Answer: ${currentResult.hasDirectAnswer ? 'YES' : 'NO'}`);
      console.log(`Has Article Links: ${currentResult.hasArticleLinks ? 'YES' : 'NO'}`);
      console.log(`Events: ${currentResult.eventsCount}, Articles: ${currentResult.articlesCount}`);
      console.log(`Answer Preview: ${currentResult.answer.substring(0, 200)}...`);
      
      console.log(`\n📊 ORIGINAL LOGIC (without isConceptQuery):`);
      console.log(`Confidence: ${(originalResult.confidence * 100).toFixed(1)}%`);
      console.log(`Answer Length: ${originalResult.answerLength} chars`);
      console.log(`Has Direct Answer: ${originalResult.hasDirectAnswer ? 'YES' : 'NO'}`);
      console.log(`Has Article Links: ${originalResult.hasArticleLinks ? 'YES' : 'NO'}`);
      console.log(`Events: ${originalResult.eventsCount}, Articles: ${originalResult.articlesCount}`);
      console.log(`Answer Preview: ${originalResult.answer.substring(0, 200)}...`);
      
      console.log(`\n🤔 BUSINESS DECISION NEEDED:`);
      console.log(`Which approach works better for "${query}"?`);
      console.log(`- Current (isConceptQuery): ${currentResult.hasDirectAnswer ? 'Direct Answer' : 'Article Links'}`);
      console.log(`- Original: ${originalResult.hasDirectAnswer ? 'Direct Answer' : 'Article Links'}`);
      
      results.push({
        query,
        current: currentResult,
        original: originalResult
      });
      
    } catch (error) {
      console.error(`Error testing "${query}":`, error.message);
    }
    
    console.log('\n' + '='.repeat(80));
  }
  
  // Summary
  console.log('\n📈 SUMMARY:');
  console.log('='.repeat(80));
  console.log('You need to review each question and decide:');
  console.log('1. Which approach gives better content for each question type');
  console.log('2. Whether we need hybrid logic (some questions use isConceptQuery, others don\'t)');
  console.log('3. Whether we need to modify isConceptQuery logic to be more selective');
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('1. Review the responses above');
  console.log('2. Identify which questions benefit from which approach');
  console.log('3. Decide on the best strategy (hybrid, modified logic, or revert)');
  console.log('4. Implement the chosen approach');
}

main().catch(console.error);
