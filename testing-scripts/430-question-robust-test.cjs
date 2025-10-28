const http = require('http');
const fs = require('fs');
const path = require('path');

// Load comprehensive test data
const comprehensiveTestSet = JSON.parse(fs.readFileSync('testing-scripts/comprehensive-test-set.json', 'utf8'));

const API_URL = 'localhost';
const API_PORT = 3000;
const API_PATH = '/api/chat';

// Test configuration for 430 questions only
const TEST_CONFIG = {
  name: '430-question-comprehensive-set',
  questions: comprehensiveTestSet.allQuestions.map(q => ({
    question: q,
    category: 'Comprehensive',
    focus: 'Full test set'
  })),
  description: '430 questions from comprehensive test set (all sources combined)'
};

async function testQuery(queryObj, testName, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: queryObj.question,
      sessionId: `baseline-test-${testName}-${Date.now()}`
    });

    const options = {
      hostname: API_URL,
      port: API_PORT,
      path: API_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: timeoutMs
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          const analysis = {
            answerLength: response.answer?.length || 0,
            confidence: response.confidence || 0,
            type: response.type || 'unknown',
            hasSources: response.sources && response.sources.length > 0,
            hasStructured: response.structured && Object.keys(response.structured).length > 0
          };
          
          resolve({
            query: queryObj.question,
            category: queryObj.category,
            focus: queryObj.focus,
            status: res.statusCode,
            timestamp: new Date().toISOString(),
            response,
            analysis
          });
        } catch (error) {
          reject(new Error(`Failed to parse JSON response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    });

    req.write(postData);
    req.end();
  });
}

async function run430QuestionTest() {
  console.log(`\n🚀 Starting 430-question comprehensive baseline test...`);
  console.log(`📊 Description: ${TEST_CONFIG.description}`);
  console.log(`📋 Questions: ${TEST_CONFIG.questions.length}`);
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log(`🔧 Testing against: http://${API_URL}:${API_PORT}${API_PATH}`);
  console.log(`⏱️  Timeout per request: 30 seconds`);
  console.log(`================================================================================`);

  const results = [];
  const startTime = Date.now();
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;
  
  for (let i = 0; i < TEST_CONFIG.questions.length; i++) {
    const question = TEST_CONFIG.questions[i];
    const progress = ((i + 1) / TEST_CONFIG.questions.length * 100).toFixed(1);
    
    try {
      console.log(`[${i + 1}/${TEST_CONFIG.questions.length}] (${progress}%) Testing: "${question.question}"`);
      
      const result = await testQuery(question, TEST_CONFIG.name, 30000); // 30 second timeout
      results.push(result);
      consecutiveErrors = 0; // Reset error counter on success
      
      // Log key metrics
      console.log(`  ✅ Status: ${result.status}, Confidence: ${(result.response.confidence * 100).toFixed(1)}%, Answer Length: ${result.analysis.answerLength}`);
      
      // Add small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Add longer pause every 100 questions to prevent server overload
      if ((i + 1) % 100 === 0 && i + 1 < TEST_CONFIG.questions.length) {
        console.log(`\n⏸️  Pausing for 15 seconds after ${i + 1} questions to prevent server overload...`);
        await new Promise(resolve => setTimeout(resolve, 15000));
        console.log(`▶️  Resuming test...\n`);
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      consecutiveErrors++;
      
      results.push({
        query: question.question,
        category: question.category,
        focus: question.focus,
        status: 'ERROR',
        timestamp: new Date().toISOString(),
        error: error.message,
        response: null,
        analysis: null
      });

      // If we get too many consecutive errors, pause longer
      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.log(`\n⚠️  ${consecutiveErrors} consecutive errors detected. Pausing for 30 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 30000));
        consecutiveErrors = 0; // Reset counter
        console.log(`▶️  Resuming test...\n`);
      }
    }
  }
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);
  
  // Calculate summary statistics
  const successfulTests = results.filter(r => r.status === 200).length;
  const failedTests = results.filter(r => r.status !== 200).length;
  const avgConfidence = results
    .filter(r => r.response?.confidence !== undefined)
    .reduce((sum, r) => sum + r.response.confidence, 0) / successfulTests || 0;
  
  const summary = {
    testName: TEST_CONFIG.name,
    description: TEST_CONFIG.description,
    timestamp: new Date().toISOString(),
    duration: `${duration}s`,
    totalQuestions: TEST_CONFIG.questions.length,
    successfulTests,
    failedTests,
    successRate: `${(successfulTests / TEST_CONFIG.questions.length * 100).toFixed(1)}%`,
    averageConfidence: `${(avgConfidence * 100).toFixed(1)}%`,
    results
  };
  
  // Save results
  const resultsDir = path.join(__dirname, 'test results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const filename = path.join(resultsDir, `baseline-${TEST_CONFIG.name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(filename, JSON.stringify(summary, null, 2));
  
  console.log(`\n📊 430-QUESTION COMPREHENSIVE BASELINE TEST COMPLETE:`);
  console.log(`================================================================================`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`✅ Successful: ${successfulTests}/${TEST_CONFIG.questions.length} (${summary.successRate})`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📈 Average Confidence: ${summary.averageConfidence}`);
  console.log(`💾 Results saved to: ${filename}`);
  
  return summary;
}

// Run the test
run430QuestionTest().catch(console.error);
