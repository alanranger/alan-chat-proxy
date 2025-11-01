#!/usr/bin/env node
/**
 * Run 40-question test against DEPLOYED API
 * This will generate analytics data to verify analytics.html tracking
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const DEPLOYED_API_URL = 'https://alan-chat-proxy.vercel.app';
const API_PATH = '/api/chat';

// Load test data
const interactiveData = JSON.parse(fs.readFileSync('testing-scripts/interactive-testing-data.json', 'utf8'));

const testConfig = {
  name: '40-question-deployed-analytics-test',
  questions: interactiveData.questions.flatMap(cat => cat.questions.map(q => ({
    question: q.question,
    category: q.category,
    focus: q.focus
  }))),
  description: '40 questions against deployed API to generate analytics data'
};

async function testQuery(queryObj, testName, questionIndex) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: queryObj.question,
      sessionId: `analytics-test-${Date.now()}-${questionIndex}`
    });

    const url = new URL(API_PATH, DEPLOYED_API_URL);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
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
            query: queryObj.question,
            category: queryObj.category,
            focus: queryObj.focus,
            status: res.statusCode,
            timestamp: new Date().toISOString(),
            sessionId: postData.match(/"sessionId":"([^"]+)"/)?.[1] || 'unknown',
            response: {
              success: response.ok || false,
              type: response.type || 'unknown',
              answer: response.answer || '',
              confidence: response.confidence || 0,
              sources: response.sources || [],
              structured: response.structured || {}
            }
          };
          
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
}

async function runDeployedTest() {
  console.log(`\n🚀 Starting 40-question DEPLOYED API test for analytics verification...`);
  console.log(`📊 Description: ${testConfig.description}`);
  console.log(`📋 Questions: ${testConfig.questions.length}`);
  console.log(`🌐 Endpoint: ${DEPLOYED_API_URL}${API_PATH}`);
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log(`================================================================================`);

  const results = [];
  const startTime = Date.now();
  
  for (let i = 0; i < testConfig.questions.length; i++) {
    const question = testConfig.questions[i];
    const progress = ((i + 1) / testConfig.questions.length * 100).toFixed(1);
    
    try {
      console.log(`[${i + 1}/${testConfig.questions.length}] (${progress}%) Testing: "${question.question}"`);
      
      const result = await testQuery(question, testConfig.name, i);
      results.push(result);
      
      const statusIcon = result.status === 200 ? '✅' : '❌';
      console.log(`  ${statusIcon} Status: ${result.status}, Confidence: ${(result.response.confidence * 100).toFixed(1)}%, Answer Length: ${result.response.answer.length}`);
      
      // Add delay to avoid overwhelming the server and allow analytics to process
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.push({
        query: question.question,
        category: question.category,
        focus: question.focus,
        status: 'ERROR',
        timestamp: new Date().toISOString(),
        error: error.message,
        response: null
      });
    }
  }
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);
  
  const successfulTests = results.filter(r => r.status === 200).length;
  const failedTests = results.filter(r => r.status !== 200).length;
  const avgConfidence = results
    .filter(r => r.response?.confidence !== undefined)
    .reduce((sum, r) => sum + r.response.confidence, 0) / successfulTests || 0;
  
  console.log(`\n📊 DEPLOYED API TEST COMPLETE:`);
  console.log(`================================================================================`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`✅ Successful: ${successfulTests}/${testConfig.questions.length} (${(successfulTests / testConfig.questions.length * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📈 Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
  console.log(`\n💡 Now check analytics.html at ${DEPLOYED_API_URL}/analytics.html`);
  console.log(`   - Go to Overview tab to see total sessions and questions`);
  console.log(`   - Go to Questions tab to see the questions asked`);
  console.log(`   - Go to Sessions tab to see individual sessions`);
  
  // Save results for reference
  const resultsDir = path.join(__dirname, 'test results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const filename = path.join(resultsDir, `deployed-analytics-test-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(filename, JSON.stringify({
    testName: testConfig.name,
    timestamp: new Date().toISOString(),
    duration: `${duration}s`,
    successfulTests,
    failedTests,
    avgConfidence: `${(avgConfidence * 100).toFixed(1)}%`,
    results
  }, null, 2));
  
  console.log(`💾 Results saved to: ${filename}`);
}

runDeployedTest().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

