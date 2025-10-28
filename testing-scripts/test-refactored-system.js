// Test the refactored evidence-based system
import https from 'https';

const testQuestions = [
  "What tripod do you recommend?",
  "Who is Alan Ranger?",
  "Do you do commercial photography?",
  "How can I contact you?",
  "What is the exposure triangle?",
  "What equipment do I need for workshops?",
  "Where can I read customer reviews?",
  "What are your terms and conditions?",
  "How do I book a workshop?",
  "What photography services do you offer?"
];

async function testQuestion(question, index) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      query: question,
      topK: 10,
      sessionId: `test-refactored-${Date.now()}`,
      pageContext: null
    });

    const options = {
      hostname: 'alan-chat-proxy.vercel.app',
      port: 443,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          const result = {
            index: index + 1,
            question: question,
            responseType: response.type || 'unknown',
            confidence: response.confidence || 0,
            hasAnswer: !!(response.answer_markdown),
            answerLength: (response.answer_markdown || '').length,
            hasPills: !!(response.structured && response.structured.pills && response.structured.pills.length > 0),
            pillsCount: (response.structured && response.structured.pills) ? response.structured.pills.length : 0,
            debug: response.debug || {},
            timestamp: new Date().toISOString()
          };
          resolve(result);
        } catch (error) {
          resolve({
            index: index + 1,
            question: question,
            responseType: 'error',
            confidence: 0,
            hasAnswer: false,
            answerLength: 0,
            hasPills: false,
            pillsCount: 0,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        index: index + 1,
        question: question,
        responseType: 'network_error',
        confidence: 0,
        hasAnswer: false,
        answerLength: 0,
        hasPills: false,
        pillsCount: 0,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });

    req.write(postData);
    req.end();
  });
}

async function runTest() {
  console.log('🧪 TESTING REFACTORED EVIDENCE-BASED SYSTEM');
  console.log('============================================');
  console.log(`Testing ${testQuestions.length} key questions...\n`);
  
  const results = [];
  
  for (let i = 0; i < testQuestions.length; i++) {
    const question = testQuestions[i];
    console.log(`📊 Testing ${i + 1}/${testQuestions.length}: "${question}"`);
    
    const result = await testQuestion(question, i);
    results.push(result);
    
    console.log(`   Type: ${result.responseType}, Confidence: ${result.confidence}%, Answer: ${result.hasAnswer ? 'Yes' : 'No'}, Pills: ${result.pillsCount}`);
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Generate report
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('=======================');
  
  const directAnswers = results.filter(r => r.responseType === 'advice' && r.hasAnswer);
  const clarifications = results.filter(r => r.responseType === 'clarification');
  const errors = results.filter(r => r.responseType === 'error' || r.responseType === 'network_error');
  
  console.log(`Total questions: ${results.length}`);
  console.log(`Direct answers: ${directAnswers.length} (${Math.round(directAnswers.length/results.length*100)}%)`);
  console.log(`Clarifications: ${clarifications.length} (${Math.round(clarifications.length/results.length*100)}%)`);
  console.log(`Errors: ${errors.length} (${Math.round(errors.length/results.length*100)}%)`);
  console.log('');
  
  console.log('🎯 CONFIDENCE DISTRIBUTION:');
  const highConfidence = results.filter(r => r.confidence >= 80).length;
  const mediumConfidence = results.filter(r => r.confidence >= 50 && r.confidence < 80).length;
  const lowConfidence = results.filter(r => r.confidence < 50).length;
  
  console.log(`High (80%+): ${highConfidence} (${Math.round(highConfidence/results.length*100)}%)`);
  console.log(`Medium (50-79%): ${mediumConfidence} (${Math.round(mediumConfidence/results.length*100)}%)`);
  console.log(`Low (<50%): ${lowConfidence} (${Math.round(lowConfidence/results.length*100)}%)`);
  console.log('');
  
  console.log('🔗 PILL AVAILABILITY:');
  const withPills = results.filter(r => r.hasPills).length;
  console.log(`With Pills: ${withPills} (${Math.round(withPills/results.length*100)}%)`);
  console.log('');
  
  console.log('✅ IMPROVEMENT COMPARISON:');
  console.log('Baseline (Old System):');
  console.log('- Direct answers: 16%');
  console.log('- High confidence: 7%');
  console.log('- With pills: 8%');
  console.log('- Problematic: 93%');
  console.log('');
  console.log('Refactored (New System):');
  console.log(`- Direct answers: ${Math.round(directAnswers.length/results.length*100)}%`);
  console.log(`- High confidence: ${Math.round(highConfidence/results.length*100)}%`);
  console.log(`- With pills: ${Math.round(withPills/results.length*100)}%`);
  console.log(`- Errors: ${Math.round(errors.length/results.length*100)}%`);
  console.log('');
  
  if (directAnswers.length > results.length * 0.5) {
    console.log('🎉 SUCCESS: Refactored system shows significant improvement!');
  } else {
    console.log('⚠️  WARNING: System may need further refinement');
  }
  
  // Save detailed results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `results/refactored-system-test-${timestamp}.json`;
  
  const reportData = {
    summary: {
      totalQuestions: results.length,
      directAnswers: directAnswers.length,
      clarifications: clarifications.length,
      errors: errors.length,
      highConfidence: highConfidence,
      withPills: withPills
    },
    results: results
  };
  
  // Ensure results directory exists
  if (!require('fs').existsSync('results')) {
    require('fs').mkdirSync('results');
  }
  
  require('fs').writeFileSync(filename, JSON.stringify(reportData, null, 2));
  console.log(`💾 Detailed results saved to: ${filename}`);
}

// Run the test
runTest().catch(console.error);



