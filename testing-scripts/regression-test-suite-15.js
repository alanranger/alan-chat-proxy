#!/usr/bin/env node

/**
 * Comprehensive Regression Test Suite for Chat API (15 Questions)
 * 
 * This test suite runs the exact 15 questions from BASELINE_REGRESSION_SUITE.md
 * against the live system to ensure no regressions occur during refactoring.
 */

import fs from 'fs';
import path from 'path';

// Test configuration
const API_ENDPOINT = 'https://alan-chat-proxy.vercel.app/api/chat';

// 15 questions from BASELINE_REGRESSION_SUITE.md
const REGRESSION_TESTS = [
  {
    id: 'refund-policy',
    query: 'What is your refund and cancellation policy?',
    expectedType: 'advice',
    expectedConfidence: 0.6,
    expectedEvents: false,
    description: 'General Policy - should return policy information'
  },
  {
    id: 'lightroom-coventry',
    query: 'When is the next Lightroom course in Coventry?',
    expectedType: 'events',
    expectedConfidence: 0.7,
    expectedEvents: true,
    description: 'Course Event - should return course events with title, date, location'
  },
  {
    id: 'lake-district-workshops',
    query: 'Do you still run Lake District photography workshops?',
    expectedType: 'events',
    expectedConfidence: 0.6,
    expectedEvents: true,
    description: 'Workshop Event - should return workshop tiles with dates'
  },
  {
    id: 'lightroom-pricing',
    query: 'How much is the Lightroom beginners course?',
    expectedType: 'events',
    expectedConfidence: 0.6,
    expectedEvents: true,
    description: 'Product (Course) - should return price and CTA link'
  },
  {
    id: 'one-to-one-mentoring',
    query: 'Can I book a 1-to-1 mentoring session with Alan?',
    expectedType: 'advice',
    expectedConfidence: 0.6,
    expectedEvents: false,
    description: 'Service (1-to-1) - should return availability and booking path'
  },
  {
    id: 'composition-tips',
    query: 'Do you have tips for composition or leading lines?',
    expectedType: 'advice',
    expectedConfidence: 0.6,
    expectedEvents: false,
    description: 'Article - should return blog/article links'
  },
  {
    id: 'exposure-triangle',
    query: 'Show me an article about the exposure triangle.',
    expectedType: 'advice',
    expectedConfidence: 0.6,
    expectedEvents: false,
    description: 'Article - should return relevant article'
  },
  {
    id: 'iso-manual',
    query: 'How do I set ISO manually on my camera?',
    expectedType: 'advice',
    expectedConfidence: 0.6,
    expectedEvents: false,
    description: 'Technical - should return concise steps'
  },
  {
    id: 'aperture-shutter',
    query: 'What\'s the difference between aperture and shutter speed?',
    expectedType: 'advice',
    expectedConfidence: 0.6,
    expectedEvents: false,
    description: 'Technical - should return correct definitions and examples'
  },
  {
    id: 'landscape-timing',
    query: 'When is the best time of day for landscape photography?',
    expectedType: 'advice',
    expectedConfidence: 0.6,
    expectedEvents: false,
    description: 'Advice - should return golden hour guidance'
  },
  {
    id: 'workshop-meeting',
    query: 'Where do your workshops meet and start from?',
    expectedType: 'advice',
    expectedConfidence: 0.6,
    expectedEvents: false,
    description: 'Logistics - should return meeting point policy'
  },
  {
    id: 'transport-accommodation',
    query: 'Do you provide transport or accommodation?',
    expectedType: 'advice',
    expectedConfidence: 0.6,
    expectedEvents: false,
    description: 'Logistics - should return clear policy'
  },
  {
    id: 'photography-academy-join',
    query: 'How do I join the Photography Academy?',
    expectedType: 'advice',
    expectedConfidence: 0.6,
    expectedEvents: false,
    description: 'Photography Academy - should return join path/URL'
  },
  {
    id: 'academy-exams',
    query: 'How do module exams and certificates work?',
    expectedType: 'advice',
    expectedConfidence: 0.6,
    expectedEvents: false,
    description: 'Photography Academy - should return assessment flow'
  },
  {
    id: 'about-alan',
    query: 'Who is Alan Ranger?',
    expectedType: 'advice',
    expectedConfidence: 0.6,
    expectedEvents: false,
    description: 'About/General - should return short bio and link to About page'
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

async function runRegressionTests() {
  console.log('🚀 Starting Comprehensive Regression Test Suite (15 Questions)');
  console.log(`📡 Testing against: ${API_ENDPOINT}`);
  console.log(`📅 Test run: ${new Date().toISOString()}`);
  console.log(`📊 Total tests: ${REGRESSION_TESTS.length}\n`);

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const test of REGRESSION_TESTS) {
    console.log(`🧪 Testing: ${test.description}`);
    console.log(`   Query: "${test.query}"`);

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: test.query })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Extract actual values
      const actual = {
        type: data.type,
        confidence: data.confidence,
        events: data.events?.length || 0,
        articles: data.structured?.articles?.length || 0,
        hasClarification: data.type === 'clarification' || (data.structured?.clarification && data.structured.clarification.length > 0)
      };

      // Check if test passed
      let testPassed = true;
      const failures = [];

      // Check type
      if (actual.type !== test.expectedType) {
        testPassed = false;
        failures.push(`Type mismatch: got "${actual.type}", expected "${test.expectedType}"`);
      }

      // Check confidence (with some tolerance)
      const confidenceDiff = Math.abs(actual.confidence - test.expectedConfidence);
      if (confidenceDiff > 0.1) {
        testPassed = false;
        failures.push(`Confidence mismatch: got ${actual.confidence}, expected ${test.expectedConfidence}`);
      }

      // Check events
      if (test.expectedEvents && actual.events === 0) {
        testPassed = false;
        failures.push('Expected events but got none');
      }

      // Create test result
      const result = new TestResult(
        test.id,
        test.query,
        test,
        actual,
        testPassed,
        testPassed ? null : failures.join('; ')
      );

      results.push(result);

      if (testPassed) {
        console.log(`   Result: ✅ PASS`);
        passed++;
      } else {
        console.log(`   Result: ❌ FAIL`);
        console.log(`   Type: ${actual.type} (expected: ${test.expectedType})`);
        console.log(`   Confidence: ${actual.confidence} (expected: ${test.expectedConfidence})`);
        console.log(`   Events: ${actual.events} (expected: ${test.expectedEvents ? '>0' : '0'})`);
        console.log(`   ❌ FAILURE DETAILS:`);
        failures.forEach(failure => console.log(`     - ${failure}`));
        failed++;
      }

    } catch (error) {
      console.log(`   Result: ❌ ERROR`);
      console.log(`   Error: ${error.message}`);
      
      const result = new TestResult(
        test.id,
        test.query,
        test,
        null,
        false,
        error.message
      );
      
      results.push(result);
      failed++;
    }

    console.log(''); // Empty line for readability
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Generate summary
  console.log('📊 REGRESSION TEST SUMMARY');
  console.log('==================================================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

  // Save detailed results
  const resultsPath = `regression-test-results-15-${new Date().toISOString().split('T')[0]}.json`;
  const summary = {
    timestamp: new Date().toISOString(),
    endpoint: API_ENDPOINT,
    totalTests: REGRESSION_TESTS.length,
    passed,
    failed,
    successRate: ((passed / (passed + failed)) * 100).toFixed(1),
    results
  };

  fs.writeFileSync(resultsPath, JSON.stringify(summary, null, 2));
  console.log(`📄 Detailed report saved to: ${resultsPath}`);

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
  console.error('💥 Regression test suite failed:', error);
  process.exit(1);
});
