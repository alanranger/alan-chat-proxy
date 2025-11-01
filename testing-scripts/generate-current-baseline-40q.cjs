const http = require('http');
const fs = require('fs');
const path = require('path');

// Load the 40 questions
const testData = JSON.parse(fs.readFileSync('testing-scripts/interactive-testing-data.json', 'utf8'));
const questions = [];
testData.questions.forEach(category => {
  if (category.questions && Array.isArray(category.questions)) {
    category.questions.forEach(q => {
      questions.push(q);
    });
  }
});

async function testQuery(queryObj) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: queryObj.question,
      sessionId: `baseline-test-40q-${Date.now()}`
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
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            query: queryObj.question,
            category: queryObj.category,
            focus: queryObj.focus,
            status: res.statusCode,
            timestamp: new Date().toISOString(),
            response: {
              success: response.ok || false,
              type: response.type || 'unknown',
              answer: response.answer || '',
              answer_markdown: response.answer_markdown || '',
              confidence: response.confidence || 0,
              sources: response.sources || {},
              structured: response.structured || {},
              debugInfo: response.debugInfo || {}
            }
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

(async () => {
  console.log('📊 Running current baseline test for 40 questions...');
  const results = [];
  
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    process.stdout.write(`\rTesting ${i + 1}/40: "${question.question.substring(0, 50)}..."`);
    
    try {
      const result = await testQuery(question);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`\nError testing question ${i + 1}: ${error.message}`);
      results.push({
        query: question.question,
        category: question.category,
        focus: question.focus,
        error: error.message,
        response: { success: false }
      });
    }
  }
  
  const outputPath = path.join('testing-scripts/test results', `baseline-40-question-interactive-subset-${new Date().toISOString().replace(/:/g, '-')}.json`);
  fs.writeFileSync(outputPath, JSON.stringify({ results }, null, 2));
  
  console.log(`\n✅ Current baseline saved to: ${outputPath}`);
  console.log(`📊 Total questions tested: ${results.length}`);
})();

