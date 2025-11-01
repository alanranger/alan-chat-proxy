#!/usr/bin/env node
/**
 * Run 430-question test against DEPLOYED API
 * This will generate comprehensive analytics data to verify analytics.html tracking
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const DEPLOYED_API_URL = 'https://alan-chat-proxy.vercel.app';
const API_PATH = '/api/chat';

// Load comprehensive test data
const comprehensiveTestSet = JSON.parse(fs.readFileSync('testing-scripts/comprehensive-test-set.json', 'utf8'));

const TEST_CONFIG = {
  name: '430-question-deployed-analytics-test',
  questions: comprehensiveTestSet.allQuestions.map(q => ({
    question: q,
    category: 'Comprehensive',
    focus: 'Full test set'
  })),
  description: '430 questions against deployed API to generate comprehensive analytics data'
};

async function testQuery(queryObj, testName, questionIndex) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: queryObj.question,
      sessionId: `analytics-test-430-${Date.now()}-${questionIndex}`
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
            },
            analysis: {
              answerLength: response.answer?.length || 0,
              confidence: response.confidence || 0,
              type: response.type || 'unknown',
              hasSources: response.sources && Object.keys(response.sources).length > 0,
              hasStructured: response.structured && Object.keys(response.structured).length > 0
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

async function run430QuestionTest() {
  console.log(`\n🚀 Starting 430-question DEPLOYED API test for comprehensive analytics verification...`);
  console.log(`📊 Description: ${TEST_CONFIG.description}`);
  console.log(`📋 Questions: ${TEST_CONFIG.questions.length}`);
  console.log(`🌐 Endpoint: ${DEPLOYED_API_URL}${API_PATH}`);
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log(`================================================================================`);

  const results = [];
  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < TEST_CONFIG.questions.length; i++) {
    const question = TEST_CONFIG.questions[i];
    const progress = ((i + 1) / TEST_CONFIG.questions.length * 100).toFixed(1);
    
    try {
      // Show progress every 50 questions
      if ((i + 1) % 50 === 0 || i === 0) {
        console.log(`\n📊 Progress: ${i + 1}/${TEST_CONFIG.questions.length} (${progress}%)`);
        console.log(`   Success: ${successCount}, Errors: ${errorCount}`);
      }
      
      const result = await testQuery(question, TEST_CONFIG.name, i);
      results.push(result);
      
      if (result.status === 200) {
        successCount++;
      } else {
        errorCount++;
      }
      
      // Show every 10th question for detailed progress
      if ((i + 1) % 10 === 0) {
        const statusIcon = result.status === 200 ? '✅' : '❌';
        console.log(`  [${i + 1}] ${statusIcon} "${question.question.substring(0, 50)}${question.question.length > 50 ? '...' : ''}"`);
      }
      
      // Add delay to avoid overwhelming the server and allow analytics to process
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.log(`  [${i + 1}] ❌ Error: ${error.message}`);
      errorCount++;
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
    }
  }
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);
  
  const successfulTests = results.filter(r => r.status === 200).length;
  const failedTests = results.filter(r => r.status !== 200).length;
  const avgConfidence = results
    .filter(r => r.response?.confidence !== undefined)
    .reduce((sum, r) => sum + r.response.confidence, 0) / successfulTests || 0;
  
  console.log(`\n📊 430-QUESTION DEPLOYED API TEST COMPLETE:`);
  console.log(`================================================================================`);
  console.log(`⏱️  Duration: ${duration}s (${(duration / 60).toFixed(1)} minutes)`);
  console.log(`✅ Successful: ${successfulTests}/${TEST_CONFIG.questions.length} (${(successfulTests / TEST_CONFIG.questions.length * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📈 Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
  console.log(`\n💡 Now check analytics.html at ${DEPLOYED_API_URL}/analytics.html`);
  console.log(`   - Go to Overview tab to see total sessions and questions`);
  console.log(`   - Go to Questions tab to see the questions asked`);
  console.log(`   - Go to Sessions tab to see individual sessions`);
  console.log(`   - Go to Performance tab to see confidence and response time trends`);
  
  // Save results for reference
  const resultsDir = path.join(__dirname, 'test results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const filename = path.join(resultsDir, `deployed-430-analytics-test-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(filename, JSON.stringify({
    testName: TEST_CONFIG.name,
    timestamp: new Date().toISOString(),
    duration: `${duration}s`,
    successfulTests,
    failedTests,
    avgConfidence: `${(avgConfidence * 100).toFixed(1)}%`,
    totalQuestions: TEST_CONFIG.questions.length,
    results: results.slice(0, 100) // Save first 100 for reference (full results would be too large)
  }, null, 2));
  
  console.log(`💾 Results summary saved to: ${filename}`);
}

run430QuestionTest().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

