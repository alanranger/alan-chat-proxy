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
          
          // Extract detailed response structure metrics
          const structured = response.structured || {};
          const metrics = {
            responseType: response.type || 'unknown',
            articlesCount: Array.isArray(structured.articles) ? structured.articles.length : 0,
            productsCount: Array.isArray(structured.products) ? structured.products.length : 0,
            eventsCount: Array.isArray(structured.events) ? structured.events.length : 0,
            servicesCount: Array.isArray(structured.services) ? structured.services.length : 0,
            landingCount: Array.isArray(structured.landing) ? structured.landing.length : 0,
            // Check for product categorization issues
            productsInArticles: Array.isArray(structured.articles) 
              ? structured.articles.filter(a => a.kind === 'product' || a.source_type === 'workshop_product').length 
              : 0,
            // Check sources structure (legacy)
            sourcesEventsCount: (response.sources?.events && Array.isArray(response.sources.events)) 
              ? response.sources.events.length 
              : 0,
            sourcesArticlesCount: (response.sources?.articles && Array.isArray(response.sources.articles)) 
              ? response.sources.articles.length 
              : 0
          };
          
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
              structured: structured
            },
            metrics: metrics
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
      const m = result.metrics || {};
      const typeIcon = m.responseType === 'events' ? '📅' : m.responseType === 'advice' ? '💡' : '❓';
      const productIssue = m.productsInArticles > 0 ? ' ⚠️ PRODUCTS IN ARTICLES!' : '';
      console.log(`  ${statusIcon} ${typeIcon} Status: ${result.status}, Type: ${m.responseType}, Confidence: ${(result.response.confidence * 100).toFixed(1)}%`);
      console.log(`     📊 Articles: ${m.articlesCount}, Products: ${m.productsCount}, Events: ${m.eventsCount}, Services: ${m.servicesCount}${productIssue}`);
      
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
  
  // Calculate aggregate metrics
  const totalArticles = results.reduce((sum, r) => sum + (r.metrics?.articlesCount || 0), 0);
  const totalProducts = results.reduce((sum, r) => sum + (r.metrics?.productsCount || 0), 0);
  const totalEvents = results.reduce((sum, r) => sum + (r.metrics?.eventsCount || 0), 0);
  const totalServices = results.reduce((sum, r) => sum + (r.metrics?.servicesCount || 0), 0);
  const productsInArticlesIssues = results.filter(r => (r.metrics?.productsInArticles || 0) > 0).length;
  
  // Response type distribution
  const responseTypes = {};
  results.forEach(r => {
    const type = r.metrics?.responseType || 'unknown';
    responseTypes[type] = (responseTypes[type] || 0) + 1;
  });
  
  console.log(`\n📊 DEPLOYED API TEST COMPLETE:`);
  console.log(`================================================================================`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`✅ Successful: ${successfulTests}/${testConfig.questions.length} (${(successfulTests / testConfig.questions.length * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📈 Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
  console.log(`\n📦 RESPONSE STRUCTURE METRICS:`);
  console.log(`   Articles: ${totalArticles} total, Products: ${totalProducts} total`);
  console.log(`   Events: ${totalEvents} total, Services: ${totalServices} total`);
  console.log(`   Response Types: ${Object.entries(responseTypes).map(([k, v]) => `${k}:${v}`).join(', ')}`);
  if (productsInArticlesIssues > 0) {
    console.log(`   ⚠️  WARNING: ${productsInArticlesIssues} queries have products incorrectly in articles array!`);
  }
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
    aggregateMetrics: {
      totalArticles,
      totalProducts,
      totalEvents,
      totalServices,
      productsInArticlesIssues,
      responseTypes
    },
    results
  }, null, 2));
  
  console.log(`💾 Results saved to: ${filename}`);
}

runDeployedTest().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

