#!/usr/bin/env node
/**
 * Run only the 40-question test
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { validateAnswerQuality } = require('./validate-answer-quality.cjs');

const API_URL = 'localhost';
const API_PORT = 3000;
const API_PATH = '/api/chat';

// Load test data
const interactiveData = JSON.parse(fs.readFileSync('testing-scripts/interactive-testing-data.json', 'utf8'));

const testConfig = {
  name: '40-question-interactive-subset',
  questions: interactiveData.questions.flatMap(cat => cat.questions.map(q => ({
    question: q.question,
    category: q.category,
    focus: q.focus
  }))),
  description: '40 questions from interactive testing subset (5 per business category)'
};

async function testQuery(queryObj, testName) {
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
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          // Extract comprehensive response data
          const result = {
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
              sources: response.sources || [],
              structured: response.structured || {},
              debugInfo: response.debugInfo || {}
            },
            analysis: {
              answerLength: response.answer ? response.answer.length : 0,
              hasAnswer: !!(response.answer && response.answer.length > 0),
              hasStructuredData: !!(response.structured && Object.keys(response.structured).length > 0),
              hasEvents: !!(response.structured?.events && response.structured.events.length > 0),
              hasProducts: !!(response.structured?.products && response.structured.products.length > 0),
              hasArticles: !!(response.structured?.articles && response.structured.articles.length > 0),
              confidenceLevel: response.confidence >= 0.7 ? 'high' : response.confidence >= 0.4 ? 'medium' : 'low',
              responseType: response.type || 'unknown'
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

async function runBaselineTest() {
  console.log(`\n🚀 Starting 40-question baseline test...`);
  console.log(`📊 Description: ${testConfig.description}`);
  console.log(`📋 Questions: ${testConfig.questions.length}`);
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log(`================================================================================`);

  const results = [];
  const startTime = Date.now();
  
  for (let i = 0; i < testConfig.questions.length; i++) {
    const question = testConfig.questions[i];
    const progress = ((i + 1) / testConfig.questions.length * 100).toFixed(1);
    
    try {
      console.log(`[${i + 1}/${testConfig.questions.length}] (${progress}%) Testing: "${question.question}"`);
      
      const result = await testQuery(question, testConfig.name);
      
      // Validate answer quality (catch regressions)
      const validation = validateAnswerQuality(
        result.query,
        result.response.answer,
        result.response.type,
        result.response.sources
      );
      
      if (!validation.valid) {
        console.log(`  ⚠️  Quality issues: ${validation.errors.join(', ')}`);
      } else if (validation.warnings.length > 0) {
        console.log(`  ⚠️  Warnings: ${validation.warnings.join(', ')}`);
      }
      
      // Add validation results to result object
      result.qualityValidation = validation;
      results.push(result);
      
      // Log key metrics
      const statusIcon = validation.errors.length > 0 ? '❌' : (validation.warnings.length > 0 ? '⚠️' : '✅');
      console.log(`  ${statusIcon} Status: ${result.status}, Confidence: ${(result.response.confidence * 100).toFixed(1)}%, Answer Length: ${result.analysis.answerLength}`);
      
      // Add small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
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
  
  // Calculate summary statistics
  const successfulTests = results.filter(r => r.status === 200).length;
  const failedTests = results.filter(r => r.status !== 200).length;
  const avgConfidence = results
    .filter(r => r.response?.confidence !== undefined)
    .reduce((sum, r) => sum + r.response.confidence, 0) / successfulTests || 0;
  
  // Quality validation stats
  const qualityErrors = results.filter(r => r.qualityValidation && !r.qualityValidation.valid).length;
  const qualityWarnings = results.filter(r => r.qualityValidation && r.qualityValidation.warnings.length > 0).length;
  
  const summary = {
    testName: testConfig.name,
    description: testConfig.description,
    timestamp: new Date().toISOString(),
    duration: `${duration}s`,
    totalQuestions: testConfig.questions.length,
    successfulTests,
    failedTests,
    successRate: `${(successfulTests / testConfig.questions.length * 100).toFixed(1)}%`,
    averageConfidence: `${(avgConfidence * 100).toFixed(1)}%`,
    qualityErrors,
    qualityWarnings,
    qualityPassRate: `${((testConfig.questions.length - qualityErrors) / testConfig.questions.length * 100).toFixed(1)}%`,
    results
  };
  
  // Save results
  const resultsDir = path.join(__dirname, 'test results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const filename = path.join(resultsDir, `baseline-${testConfig.name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(filename, JSON.stringify(summary, null, 2));
  
  console.log(`\n📊 40-QUESTION BASELINE TEST COMPLETE:`);
  console.log(`================================================================================`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`✅ Successful: ${successfulTests}/${testConfig.questions.length} (${summary.successRate})`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📈 Average Confidence: ${summary.averageConfidence}`);
  console.log(`📊 Quality Pass Rate: ${summary.qualityPassRate} (${qualityErrors} errors, ${qualityWarnings} warnings)`);
  
  if (qualityErrors > 0) {
    console.log(`\n❌ QUALITY ISSUES DETECTED: ${qualityErrors} questions with errors`);
    console.log(`   These indicate regressions (e.g., wrong routing, generic responses)`);
    
    // List questions with errors
    results.filter(r => r.qualityValidation && !r.qualityValidation.valid).forEach((r, idx) => {
      console.log(`   ${idx + 1}. "${r.query}" - ${r.qualityValidation.errors.join(', ')}`);
    });
  }
  
  console.log(`💾 Results saved to: ${filename}`);
  
  // Automatically run analysis
  console.log(`\n🔍 Running automatic analysis...`);
  try {
    require('./analyze-40q-results.cjs');
  } catch (error) {
    console.warn(`⚠️  Could not run automatic analysis: ${error.message}`);
    process.exit(0);
  }
}

// Run the test
runBaselineTest().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

