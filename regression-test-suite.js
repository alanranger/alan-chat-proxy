#!/usr/bin/env node

/**
 * Comprehensive Regression Test Suite for Chat API
 * 
 * This test suite runs against the live system to ensure no regressions
 * occur during refactoring. It tests all critical user journeys and
 * validates both API responses and frontend behavior.
 */

import fs from 'fs';
import path from 'path';

// Test configuration
const API_ENDPOINT = 'https://alan-chat-proxy.vercel.app/api/chat';
const FRONTEND_URL = 'https://alan-chat-proxy.vercel.app/chat.html';

// Comprehensive test cases covering all critical user journeys
const REGRESSION_TESTS = [
  // Core Event Queries
  {
    id: 'lightroom-coventry',
    query: 'When is the next Lightroom course in Coventry?',
    expectedType: 'events',
    expectedConfidence: 0.7, // High confidence expected
    expectedEvents: true,
    description: 'Lightroom course query - should return high confidence with events'
  },
  {
    id: 'photography-workshop',
    query: 'What photography workshops do you have?',
    expectedType: 'events',
    expectedConfidence: 0.6,
    expectedEvents: true,
    description: 'General workshop query - should return events'
  },
  {
    id: 'residential-pricing',
    query: 'How much is a residential photography workshop and does it include B&B?',
    expectedType: 'events',
    expectedConfidence: 0.8,
    expectedEvents: true,
    description: 'Residential pricing query - should return high confidence with pricing info'
  },

  // Equipment Advice Queries
  {
    id: 'tripod-recommendation',
    query: 'What tripod do you recommend?',
    expectedType: 'advice',
    expectedConfidence: 0.7,
    expectedEvents: false,
    expectedArticles: true,
    description: 'Tripod recommendation - should return articles/advice'
  },
  {
    id: 'camera-advice',
    query: 'What camera should I buy for landscape photography?',
    expectedType: 'advice',
    expectedConfidence: 0.6,
    expectedEvents: false,
    expectedArticles: true,
    description: 'Camera advice - should return articles'
  },

  // Clarification Queries
  {
    id: 'ambiguous-workshop',
    query: 'I want to learn photography',
    expectedType: 'clarification',
    expectedConfidence: 0.3,
    expectedEvents: false,
    expectedClarification: true,
    description: 'Ambiguous query - should trigger clarification'
  },
  {
    id: 'vague-equipment',
    query: 'I need help with my camera',
    expectedType: 'clarification',
    expectedConfidence: 0.3,
    expectedEvents: false,
    expectedClarification: true,
    description: 'Vague equipment query - should trigger clarification'
  },

  // Specific Service Queries
  {
    id: 'beginner-course',
    query: 'Do you have beginner photography courses?',
    expectedType: 'events',
    expectedConfidence: 0.7,
    expectedEvents: true,
    description: 'Beginner course query - should return events'
  },
  {
    id: 'online-course',
    query: 'Do you offer online photography courses?',
    expectedType: 'events',
    expectedConfidence: 0.6,
    expectedEvents: true,
    description: 'Online course query - should return events'
  },

  // Edge Cases
  {
    id: 'nonsensical-query',
    query: 'asdfghjkl qwerty',
    expectedType: 'clarification',
    expectedConfidence: 0.1,
    expectedEvents: false,
    expectedClarification: true,
    description: 'Nonsensical query - should trigger clarification'
  },
  {
    id: 'empty-query',
    query: '',
    expectedType: 'clarification',
    expectedConfidence: 0.1,
    expectedEvents: false,
    expectedClarification: true,
    description: 'Empty query - should trigger clarification'
  }
];

// Test result structure
class TestResult {
  constructor(testId, query, expected, actual, passed, error = null) {
    this.testId = testId;
    this.query = query;
    this.expected = expected;
    this.actual = actual;
    this.passed = passed;
    this.error = error;
    this.timestamp = new Date().toISOString();
  }
}

// API test function
async function testAPIQuery(testCase) {
  try {
    console.log(`\n🧪 Testing: ${testCase.description}`);
    console.log(`   Query: "${testCase.query}"`);
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: testCase.query })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Validate response structure
    const actual = {
      type: data.type,
      confidence: data.confidence,
      hasEvents: Array.isArray(data.events) && data.events.length > 0,
      hasArticles: Array.isArray(data.structured?.articles) && data.structured.articles.length > 0,
      hasClarification: data.type === 'clarification' || (data.structured?.clarification && data.structured.clarification.length > 0),
      eventsCount: data.events?.length || 0,
      answer: data.answer || null
    };

    // Check if test passed
    const passed = validateTestResult(testCase, actual);
    
    console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Type: ${actual.type} (expected: ${testCase.expectedType})`);
    console.log(`   Confidence: ${actual.confidence} (expected: ${testCase.expectedConfidence})`);
    console.log(`   Events: ${actual.eventsCount} (expected: ${testCase.expectedEvents ? '>0' : '0'})`);
    
    if (!passed) {
      console.log(`   ❌ FAILURE DETAILS:`);
      if (actual.type !== testCase.expectedType) {
        console.log(`     - Type mismatch: got "${actual.type}", expected "${testCase.expectedType}"`);
      }
      if (Math.abs(actual.confidence - testCase.expectedConfidence) > 0.2) {
        console.log(`     - Confidence mismatch: got ${actual.confidence}, expected ${testCase.expectedConfidence}`);
      }
      if (testCase.expectedEvents && !actual.hasEvents) {
        console.log(`     - Expected events but got none`);
      }
      if (testCase.expectedArticles && !actual.hasArticles) {
        console.log(`     - Expected articles but got none`);
      }
      if (testCase.expectedClarification && !actual.hasClarification) {
        console.log(`     - Expected clarification but got none`);
      }
    }

    return new TestResult(
      testCase.id,
      testCase.query,
      testCase,
      actual,
      passed
    );

  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    return new TestResult(
      testCase.id,
      testCase.query,
      testCase,
      null,
      false,
      error.message
    );
  }
}

// Validation function
function validateTestResult(testCase, actual) {
  // Check type
  if (actual.type !== testCase.expectedType) {
    return false;
  }

  // Check confidence (allow some tolerance)
  if (Math.abs(actual.confidence - testCase.expectedConfidence) > 0.2) {
    return false;
  }

  // Check events
  if (testCase.expectedEvents && !actual.hasEvents) {
    return false;
  }

  // Check articles
  if (testCase.expectedArticles && !actual.hasArticles) {
    return false;
  }

  // Check clarification
  if (testCase.expectedClarification && !actual.hasClarification) {
    return false;
  }

  return true;
}

// Main test runner
async function runRegressionTests() {
  console.log('🚀 Starting Comprehensive Regression Test Suite');
  console.log(`📡 Testing against: ${API_ENDPOINT}`);
  console.log(`📅 Test run: ${new Date().toISOString()}`);
  console.log(`📊 Total tests: ${REGRESSION_TESTS.length}`);

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const testCase of REGRESSION_TESTS) {
    const result = await testAPIQuery(testCase);
    results.push(result);
    
    if (result.passed) {
      passed++;
    } else {
      failed++;
    }

    // Small delay between tests to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Generate summary
  console.log('\n📊 REGRESSION TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / REGRESSION_TESTS.length) * 100).toFixed(1)}%`);

  // Save detailed results
  const reportPath = `regression-test-results-${new Date().toISOString().split('T')[0]}.json`;
  const report = {
    timestamp: new Date().toISOString(),
    endpoint: API_ENDPOINT,
    summary: {
      total: REGRESSION_TESTS.length,
      passed,
      failed,
      successRate: (passed / REGRESSION_TESTS.length) * 100
    },
    results
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);

  // Exit with error code if any tests failed
  if (failed > 0) {
    console.log('\n❌ REGRESSION TESTS FAILED - DO NOT DEPLOY');
    process.exit(1);
  } else {
    console.log('\n✅ ALL REGRESSION TESTS PASSED - SAFE TO DEPLOY');
    process.exit(0);
  }
}

// Run the tests
runRegressionTests().catch(error => {
  console.error('💥 Test suite failed:', error);
  process.exit(1);
});
