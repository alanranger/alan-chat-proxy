/**
 * PHASE 3: Test Follow-up Handling with Live API Calls
 * 
 * This script tests the complete clarification system flow:
 * 1. Initial ambiguous query triggers clarification
 * 2. User responds with clarification choice
 * 3. System routes to correct content based on user choice
 * 4. Verifies end-to-end conversation flow
 */

import fs from 'fs';

// Test scenarios for Phase 3 - Complete conversation flows
const phase3TestScenarios = [
  {
    name: "Equipment Clarification - Course Route",
    initialQuery: "what equipment do I need",
    userResponse: "equipment for photography course",
    expectedIntent: "events",
    expectedRouting: "route_to_events",
    expectedContent: "course-related equipment information"
  },
  {
    name: "Equipment Clarification - Advice Route",
    initialQuery: "what equipment do I need", 
    userResponse: "photography equipment advice",
    expectedIntent: "advice",
    expectedRouting: "route_to_advice",
    expectedContent: "general equipment advice"
  },
  {
    name: "Events Clarification - Courses Route",
    initialQuery: "photography events",
    userResponse: "photography courses",
    expectedIntent: "events",
    expectedRouting: "route_to_events",
    expectedContent: "photography courses information"
  },
  {
    name: "Training Clarification - Workshops Route",
    initialQuery: "photography training",
    userResponse: "photography workshops", 
    expectedIntent: "events",
    expectedRouting: "route_to_events",
    expectedContent: "photography workshops information"
  },
  {
    name: "Training Clarification - Mentoring Route",
    initialQuery: "photography training",
    userResponse: "photography mentoring",
    expectedIntent: "advice",
    expectedRouting: "route_to_advice",
    expectedContent: "photography mentoring information"
  }
];

// Test API call function
async function testApiCall(query, sessionId = 'phase3-test', previousQuery = null) {
  try {
    const body = {
      query,
      sessionId
    };
    
    // Add previous query context for follow-up handling
    if (previousQuery) {
      body.previousQuery = previousQuery;
    }
    
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API call failed for query "${query}":`, error.message);
    return null;
  }
}

// Test complete conversation flow
async function testConversationFlow(scenario) {
  console.log(`\n🔍 Testing: ${scenario.name}`);
  console.log(`📝 Initial Query: "${scenario.initialQuery}"`);
  
  // Step 1: Test initial query (should trigger clarification)
  const initialResponse = await testApiCall(scenario.initialQuery, 'phase3-test');
  
  if (!initialResponse) {
    return {
      scenario: scenario.name,
      test: "initial_query",
      passed: false,
      failureReason: "Initial API call failed"
    };
  }
  
  // Check if clarification is triggered
  if (initialResponse.type !== "clarification") {
    return {
      scenario: scenario.name,
      test: "initial_query",
      passed: false,
      failureReason: `Expected clarification, got type: ${initialResponse.type}`
    };
  }
  
  console.log(`✅ Clarification triggered: ${initialResponse.clarification_type}`);
  console.log(`🤔 Question: ${initialResponse.question}`);
  console.log(`📋 Options: ${initialResponse.options.length} options`);
  
  // Step 2: Test user response (should route to correct content)
  console.log(`👤 User Response: "${scenario.userResponse}"`);
  
  const followUpResponse = await testApiCall(
    scenario.userResponse, 
    'phase3-test', 
    scenario.initialQuery
  );
  
  if (!followUpResponse) {
    return {
      scenario: scenario.name,
      test: "followup_response",
      passed: false,
      failureReason: "Follow-up API call failed"
    };
  }
  
  // Check if response is routed correctly
  if (followUpResponse.structured?.intent !== scenario.expectedIntent) {
    return {
      scenario: scenario.name,
      test: "followup_response",
      passed: false,
      failureReason: `Wrong intent: expected ${scenario.expectedIntent}, got ${followUpResponse.structured?.intent}`
    };
  }
  
  // Check if we get actual content (not another clarification)
  if (followUpResponse.type === "clarification") {
    return {
      scenario: scenario.name,
      test: "followup_response",
      passed: false,
      failureReason: "Got clarification instead of content response"
    };
  }
  
  // Check if we have meaningful content
  if (!followUpResponse.answer_markdown || followUpResponse.answer_markdown.length < 10) {
    return {
      scenario: scenario.name,
      test: "followup_response",
      passed: false,
      failureReason: "No meaningful content in response"
    };
  }
  
  console.log(`✅ Follow-up handled correctly`);
  console.log(`🎯 Intent: ${followUpResponse.structured?.intent}`);
  console.log(`📄 Content: ${followUpResponse.answer_markdown.substring(0, 100)}...`);
  console.log(`🔗 Citations: ${followUpResponse.citations?.length || 0} URLs`);
  
  return {
    scenario: scenario.name,
    test: "complete_flow",
    passed: true,
    initialResponse,
    followUpResponse,
    contentLength: followUpResponse.answer_markdown?.length || 0,
    citationsCount: followUpResponse.citations?.length || 0
  };
}

// Test edge case protection
async function testEdgeCaseProtection() {
  console.log(`\n🛡️ Testing Edge Case Protection`);
  
  const workingQueries = [
    "photography courses in Coventry",
    "workshop schedule",
    "when are the next photography classes"
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const query of workingQueries) {
    console.log(`\n📝 Testing working query: "${query}"`);
    
    const response = await testApiCall(query, 'phase3-protection-test');
    
    if (!response) {
      console.log(`❌ FAILED - API call failed`);
      failed++;
      continue;
    }
    
    // Should NOT trigger clarification for working queries
    if (response.type === "clarification") {
      console.log(`❌ FAILED - Unexpected clarification triggered`);
      failed++;
      continue;
    }
    
    // Should have normal response
    if (response.structured?.intent === "events" && response.answer_markdown) {
      console.log(`✅ PASSED - Normal event response`);
      passed++;
    } else {
      console.log(`❌ FAILED - Unexpected response type or content`);
      failed++;
    }
  }
  
  return { passed, failed, total: workingQueries.length };
}

// Main test function
async function testPhase3FollowupHandling() {
  console.log("🧪 PHASE 3: Testing Follow-up Handling with Live API Calls");
  console.log("=========================================================");
  
  const results = [];
  let totalTests = 0;
  let passedTests = 0;
  
  // Test complete conversation flows
  console.log("\n📋 Testing Complete Conversation Flows:");
  for (const scenario of phase3TestScenarios) {
    const result = await testConversationFlow(scenario);
    results.push(result);
    totalTests++;
    
    if (result.passed) {
      passedTests++;
    }
  }
  
  // Test edge case protection
  console.log("\n🛡️ Testing Edge Case Protection:");
  const protectionResult = await testEdgeCaseProtection();
  totalTests += protectionResult.total;
  passedTests += protectionResult.passed;
  
  results.push({
    scenario: "Edge Case Protection",
    test: "protection_test",
    passed: protectionResult.failed === 0,
    protectionResult
  });
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 PHASE 3 TEST RESULTS");
  console.log("=".repeat(60));
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}`);
  console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log("🎉 ALL PHASE 3 TESTS PASSED!");
    console.log("✅ Follow-up handling is working correctly!");
    console.log("\n💡 Key Achievements:");
    console.log("   - Complete conversation flows working");
    console.log("   - User responses routed correctly");
    console.log("   - Meaningful content returned");
    console.log("   - Edge case protection maintained");
  } else {
    console.log("🚨 SOME PHASE 3 TESTS FAILED!");
    console.log("\nFailed tests:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.scenario}: ${r.test} → ${r.failureReason}`);
    });
  }
  
  // Save results
  const report = {
    timestamp: new Date().toISOString(),
    testType: "phase3_followup_handling",
    totalTests,
    passedTests,
    failedTests: totalTests - passedTests,
    successRate: (passedTests / totalTests) * 100,
    results
  };
  
  fs.writeFileSync('phase3-followup-test-results.json', JSON.stringify(report, null, 2));
  console.log("\n📄 Results saved to: phase3-followup-test-results.json");
  
  return passedTests === totalTests;
}

// Run the tests
testPhase3FollowupHandling()
  .then(success => {
    console.log(`\n🏁 Phase 3 test completed with ${success ? 'SUCCESS' : 'FAILURE'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Phase 3 test failed:', error);
    process.exit(1);
  });

export { testPhase3FollowupHandling, phase3TestScenarios };
