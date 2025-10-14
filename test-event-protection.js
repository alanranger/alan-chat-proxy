/**
 * EVENT SYSTEM PROTECTION TESTS
 * 
 * This script tests that the event system remains 100% functional
 * after implementing the interactive clarification system.
 * 
 * CRITICAL: These tests must pass before and after implementation.
 */

import fs from 'fs';

// Event test queries that must work identically
const eventTestQueries = [
  // Basic event queries
  "photography courses in Coventry",
  "workshop schedule", 
  "when are the next photography classes",
  "how much does the beginners course cost",
  "where are the photography workshops held",
  
  // Course-specific queries
  "do you do photography courses",
  "photography course for beginners",
  "camera course near me",
  "photography lessons Coventry",
  
  // Workshop-specific queries  
  "photography workshop",
  "lightroom workshop",
  "photoshop workshop",
  "workshop dates",
  
  // Follow-up questions
  "how much does it cost",
  "where is it held",
  "when is the next one",
  "how many people attend",
  "what equipment do I need",
  "how do I book",
  
  // Event-specific terms
  "photography events",
  "camera classes",
  "photography training",
  "photography lessons"
];

// Expected results for event queries
const expectedEventResults = {
  intent: "events",
  confidence: "> 0.5", // Should have reasonable confidence
  hasEvents: true,
  hasProduct: true,
  hasLanding: true,
  responseFormat: "markdown with pills"
};

async function testEventSystem() {
  console.log("🛡️ TESTING EVENT SYSTEM PROTECTION");
  console.log("=====================================");
  
  const results = [];
  let passed = 0;
  let failed = 0;
  
  for (const query of eventTestQueries) {
    console.log(`\n📝 Testing: "${query}"`);
    
    try {
      const response = await testSingleQuery(query);
      const result = analyzeEventResponse(query, response);
      results.push(result);
      
      if (result.passed) {
        console.log(`✅ PASSED - Intent: ${result.intent}, Confidence: ${result.confidence}`);
        passed++;
      } else {
        console.log(`❌ FAILED - ${result.failureReason}`);
        failed++;
      }
    } catch (error) {
      console.log(`💥 ERROR - ${error.message}`);
      failed++;
      results.push({
        query,
        passed: false,
        failureReason: `Error: ${error.message}`
      });
    }
  }
  
  console.log("\n" + "=".repeat(50));
  console.log(`📊 EVENT SYSTEM PROTECTION TEST RESULTS`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / eventTestQueries.length) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log("🎉 ALL EVENT SYSTEM TESTS PASSED - SYSTEM IS PROTECTED!");
  } else {
    console.log("🚨 EVENT SYSTEM TESTS FAILED - DO NOT PROCEED WITH IMPLEMENTATION!");
  }
  
  // Save results
  const report = {
    timestamp: new Date().toISOString(),
    totalTests: eventTestQueries.length,
    passed,
    failed,
    successRate: (passed / eventTestQueries.length) * 100,
    results
  };
  
  fs.writeFileSync('event-protection-test-results.json', JSON.stringify(report, null, 2));
  console.log("\n📄 Results saved to: event-protection-test-results.json");
  
  return failed === 0;
}

async function testSingleQuery(query) {
  const response = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      sessionId: 'event-protection-test'
    })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return await response.json();
}

function analyzeEventResponse(query, response) {
  const result = {
    query,
    passed: false,
    failureReason: null,
    intent: response.structured?.intent,
    confidence: response.confidence,
    hasEvents: false,
    hasProduct: false,
    hasLanding: false,
    responseFormat: 'unknown'
  };
  
  // Check intent
  if (response.structured?.intent !== "events") {
    result.failureReason = `Wrong intent: ${response.structured?.intent} (expected: events)`;
    return result;
  }
  
  // Check confidence
  if (response.confidence < 0.3) {
    result.failureReason = `Low confidence: ${response.confidence} (expected: > 0.3)`;
    return result;
  }
  
  // Check events
  if (!response.structured?.events || response.structured.events.length === 0) {
    result.failureReason = "No events returned";
    return result;
  }
  result.hasEvents = true;
  
  // Check product
  if (!response.structured?.products || response.structured.products.length === 0) {
    result.failureReason = "No product returned";
    return result;
  }
  result.hasProduct = true;
  
  // Check response format
  if (!response.answer_markdown || typeof response.answer_markdown !== 'string') {
    result.failureReason = "Invalid response format";
    return result;
  }
  result.responseFormat = 'markdown';
  
  // Check citations
  if (!response.citations || response.citations.length === 0) {
    result.failureReason = "No citations returned";
    return result;
  }
  
  // All checks passed
  result.passed = true;
  return result;
}

// Run the tests
testEventSystem()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });

export { testEventSystem, eventTestQueries };
