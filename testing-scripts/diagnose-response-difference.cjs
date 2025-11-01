const http = require('http');

// Test the exact same query through both methods
const testQuery = "Where is your gallery and can I submit my images for feedback?";

// Test 1: Same as baseline test (localhost)
function testBaselineStyle() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: testQuery,
      sessionId: `diagnostic-test-baseline-${Date.now()}`
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
            method: 'baseline-style',
            status: res.statusCode,
            response: {
              ok: response.ok,
              answer: response.answer || '',
              answer_markdown: response.answer_markdown || '',
              type: response.type,
              confidence: response.confidence,
              structured: response.structured,
              sources: response.sources
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

// Test 2: Same as interactive testing (using fetch would be ideal but this simulates it)
// Since we're in Node.js, we'll use the same http module but note the difference
function testInteractiveStyle() {
  return new Promise((resolve, reject) => {
    // Interactive testing uses the same payload structure
    const postData = JSON.stringify({
      query: testQuery,
      sessionId: 'interactive-test-session'
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
            method: 'interactive-style',
            status: res.statusCode,
            response: {
              ok: response.ok,
              answer: response.answer || '',
              answer_markdown: response.answer_markdown || '',
              type: response.type,
              confidence: response.confidence,
              structured: response.structured,
              sources: response.sources
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

// Run both tests and compare
(async () => {
  console.log('🔍 DIAGNOSTIC TEST: Comparing baseline vs interactive-style responses');
  console.log('='.repeat(80));
  console.log(`Test Query: "${testQuery}"\n`);

  try {
    // Run both tests sequentially (same server, so no race conditions)
    const result1 = await testBaselineStyle();
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
    const result2 = await testInteractiveStyle();

    console.log('📊 RESULT 1: Baseline-style');
    console.log(JSON.stringify(result1, null, 2));
    console.log('\n📊 RESULT 2: Interactive-style');
    console.log(JSON.stringify(result2, null, 2));

    console.log('\n🔍 COMPARISON:');
    console.log('='.repeat(80));
    
    const answersMatch = result1.response.answer === result2.response.answer;
    const typesMatch = result1.response.type === result2.response.type;
    const confidenceMatch = result1.response.confidence === result2.response.confidence;
    
    console.log(`Answer match: ${answersMatch ? '✅ YES' : '❌ NO'}`);
    if (!answersMatch) {
      console.log(`\nBaseline answer (${result1.response.answer.length} chars):`);
      console.log(result1.response.answer.substring(0, 300));
      console.log(`\nInteractive answer (${result2.response.answer.length} chars):`);
      console.log(result2.response.answer.substring(0, 300));
    }
    
    console.log(`\nType match: ${typesMatch ? '✅ YES' : '❌ NO'}`);
    if (!typesMatch) {
      console.log(`  Baseline: ${result1.response.type}`);
      console.log(`  Interactive: ${result2.response.type}`);
    }
    
    console.log(`\nConfidence match: ${confidenceMatch ? '✅ YES' : '❌ NO'}`);
    if (!confidenceMatch) {
      console.log(`  Baseline: ${result1.response.confidence}`);
      console.log(`  Interactive: ${result2.response.confidence}`);
    }

    // Check structured data
    const baselineArticles = result1.response.structured?.articles?.length || 0;
    const interactiveArticles = result2.response.structured?.articles?.length || 0;
    const baselineServices = result1.response.structured?.services?.length || 0;
    const interactiveServices = result2.response.structured?.services?.length || 0;
    
    console.log(`\nStructured data:`);
    console.log(`  Articles - Baseline: ${baselineArticles}, Interactive: ${interactiveArticles}`);
    console.log(`  Services - Baseline: ${baselineServices}, Interactive: ${interactiveServices}`);

    if (answersMatch && typesMatch && confidenceMatch) {
      console.log('\n✅ Both methods produce IDENTICAL responses');
    } else {
      console.log('\n❌ Responses DIFFER - investigating root cause...');
      
      // Check if it's a sessionId issue
      if (result1.method.includes('baseline') && result2.method.includes('interactive')) {
        console.log('\n⚠️  SessionId difference detected:');
        console.log(`  Baseline: diagnostic-test-baseline-${Date.now()}`);
        console.log(`  Interactive: interactive-test-session`);
        console.log('\n   Note: SessionId should NOT affect response logic, but checking...');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
})();

