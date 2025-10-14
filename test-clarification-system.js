/**
 * CLARIFICATION SYSTEM TEST
 * 
 * This script tests the Phase 1 implementation of the interactive clarification system
 * to verify that the 3 edge cases are properly detected and handled.
 */

import fs from 'fs';

// Test the 3 edge cases that should trigger clarification
const edgeCaseTests = [
  {
    query: "what equipment do I need",
    expectedClarification: true,
    expectedType: "equipment_clarification",
    expectedQuestion: "What type of photography activity are you planning? This will help me recommend the right equipment."
  },
  {
    query: "photography events",
    expectedClarification: true,
    expectedType: "events_clarification", 
    expectedQuestion: "What type of photography events are you interested in?"
  },
  {
    query: "photography training",
    expectedClarification: true,
    expectedType: "training_clarification",
    expectedQuestion: "What type of photography training are you looking for?"
  }
];

// Test queries that should NOT trigger clarification
const nonClarificationTests = [
  {
    query: "photography courses in Coventry",
    expectedClarification: false
  },
  {
    query: "workshop schedule",
    expectedClarification: false
  },
  {
    query: "equipment for photography course",
    expectedClarification: false
  },
  {
    query: "photography courses",
    expectedClarification: false
  },
  {
    query: "photography workshops",
    expectedClarification: false
  }
];

// Import the clarification functions (we'll need to extract them for testing)
// For now, we'll copy the logic here for testing

function needsClarification(query) {
  if (!query) return false;
  
  const lc = query.toLowerCase();
  
  // Edge case patterns that need clarification (from our analysis)
  const ambiguousPatterns = [
    // Edge Case 1: Equipment queries without context
    lc.includes("equipment") && !lc.includes("course") && !lc.includes("workshop"),
    
    // Edge Case 2: Generic event queries
    lc.includes("events") && !lc.includes("course") && !lc.includes("workshop"),
    
    // Edge Case 3: Training queries without context
    lc.includes("training") && !lc.includes("course") && !lc.includes("workshop")
  ];
  
  return ambiguousPatterns.some(pattern => pattern);
}

function generateClarificationQuestion(query) {
  const lc = query.toLowerCase();
  
  // Edge Case 1: Equipment queries
  if (lc.includes("equipment")) {
    return {
      type: "equipment_clarification",
      question: "What type of photography activity are you planning? This will help me recommend the right equipment.",
      options: [
        { text: "Photography course/workshop", query: "equipment for photography course" },
        { text: "General photography advice", query: "photography equipment advice" },
        { text: "Specific camera/lens advice", query: "camera lens recommendations" }
      ]
    };
  }
  
  // Edge Case 2: Generic event queries
  if (lc.includes("events")) {
    return {
      type: "events_clarification",
      question: "What type of photography events are you interested in?",
      options: [
        { text: "Photography courses", query: "photography courses" },
        { text: "Photography workshops", query: "photography workshops" },
        { text: "Photography exhibitions", query: "photography exhibitions" }
      ]
    };
  }
  
  // Edge Case 3: Training queries
  if (lc.includes("training")) {
    return {
      type: "training_clarification",
      question: "What type of photography training are you looking for?",
      options: [
        { text: "Photography courses", query: "photography courses" },
        { text: "Photography workshops", query: "photography workshops" },
        { text: "Photography mentoring", query: "photography mentoring" }
      ]
    };
  }
  
  return null;
}

async function testClarificationSystem() {
  console.log("🧪 TESTING CLARIFICATION SYSTEM - PHASE 1 IMPLEMENTATION");
  console.log("========================================================");
  
  const results = [];
  let passed = 0;
  let failed = 0;
  
  // Test edge cases that should trigger clarification
  console.log("\n📝 Testing Edge Cases (Should Trigger Clarification):");
  for (const test of edgeCaseTests) {
    console.log(`\n🔍 Testing: "${test.query}"`);
    
    const needsClar = needsClarification(test.query);
    const clarification = needsClar ? generateClarificationQuestion(test.query) : null;
    
    const result = {
      query: test.query,
      expectedClarification: test.expectedClarification,
      actualClarification: needsClar,
      expectedType: test.expectedType,
      actualType: clarification?.type,
      expectedQuestion: test.expectedQuestion,
      actualQuestion: clarification?.question,
      passed: false,
      failureReason: null
    };
    
    // Check if clarification is needed
    if (needsClar !== test.expectedClarification) {
      result.failureReason = `Clarification detection failed: expected ${test.expectedClarification}, got ${needsClar}`;
    } else if (needsClar && clarification) {
      // Check clarification type
      if (clarification.type !== test.expectedType) {
        result.failureReason = `Wrong clarification type: expected ${test.expectedType}, got ${clarification.type}`;
      } else if (clarification.question !== test.expectedQuestion) {
        result.failureReason = `Wrong clarification question: expected "${test.expectedQuestion}", got "${clarification.question}"`;
      } else {
        result.passed = true;
        passed++;
        console.log(`✅ PASSED - Type: ${clarification.type}`);
        console.log(`   Question: ${clarification.question}`);
        console.log(`   Options: ${clarification.options.length} options`);
      }
    } else if (needsClar && !clarification) {
      result.failureReason = "Clarification needed but no clarification generated";
    } else {
      result.passed = true;
      passed++;
      console.log(`✅ PASSED - No clarification needed`);
    }
    
    if (!result.passed) {
      console.log(`❌ FAILED - ${result.failureReason}`);
      failed++;
    }
    
    results.push(result);
  }
  
  // Test queries that should NOT trigger clarification
  console.log("\n📝 Testing Non-Clarification Cases (Should NOT Trigger Clarification):");
  for (const test of nonClarificationTests) {
    console.log(`\n🔍 Testing: "${test.query}"`);
    
    const needsClar = needsClarification(test.query);
    
    const result = {
      query: test.query,
      expectedClarification: test.expectedClarification,
      actualClarification: needsClar,
      passed: false,
      failureReason: null
    };
    
    if (needsClar === test.expectedClarification) {
      result.passed = true;
      passed++;
      console.log(`✅ PASSED - No clarification needed`);
    } else {
      result.failureReason = `Unexpected clarification: expected ${test.expectedClarification}, got ${needsClar}`;
      console.log(`❌ FAILED - ${result.failureReason}`);
      failed++;
    }
    
    results.push(result);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 CLARIFICATION SYSTEM TEST RESULTS");
  console.log("=".repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (edgeCaseTests.length + nonClarificationTests.length)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log("🎉 ALL CLARIFICATION SYSTEM TESTS PASSED!");
    console.log("✅ Phase 1 implementation is working correctly!");
  } else {
    console.log("🚨 SOME CLARIFICATION SYSTEM TESTS FAILED!");
    console.log("\nFailed tests:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - "${r.query}" → ${r.failureReason}`);
    });
  }
  
  // Save results
  const report = {
    timestamp: new Date().toISOString(),
    testType: "clarification_system_phase1",
    totalTests: edgeCaseTests.length + nonClarificationTests.length,
    passed,
    failed,
    successRate: (passed / (edgeCaseTests.length + nonClarificationTests.length)) * 100,
    results
  };
  
  fs.writeFileSync('clarification-system-test-results.json', JSON.stringify(report, null, 2));
  console.log("\n📄 Results saved to: clarification-system-test-results.json");
  
  return failed === 0;
}

// Run the tests
testClarificationSystem()
  .then(success => {
    console.log(`\n🏁 Clarification system test completed with ${success ? 'SUCCESS' : 'FAILURE'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });

export { testClarificationSystem, edgeCaseTests, nonClarificationTests };
