/**
 * PHASE 2: Test Clarification Questions with Real Users
 * 
 * This script tests the clarification system with live API calls to verify
 * that the clarification questions are working correctly and user responses
 * are being handled properly.
 */

import fs from 'fs';

// Test scenarios for Phase 2
const phase2TestScenarios = [
  {
    name: "Equipment Clarification Flow",
    initialQuery: "what equipment do I need",
    expectedClarification: {
      type: "equipment_clarification",
      question: "What type of photography activity are you planning? This will help me recommend the right equipment.",
      options: [
        { text: "Photography course/workshop", query: "equipment for photography course" },
        { text: "General photography advice", query: "photography equipment advice" },
        { text: "Specific camera/lens advice", query: "camera lens recommendations" }
      ]
    },
    userResponses: [
      {
        response: "equipment for photography course",
        expectedIntent: "events",
        expectedRouting: "route_to_events"
      },
      {
        response: "photography equipment advice", 
        expectedIntent: "advice",
        expectedRouting: "route_to_advice"
      }
    ]
  },
  {
    name: "Events Clarification Flow",
    initialQuery: "photography events",
    expectedClarification: {
      type: "events_clarification",
      question: "What type of photography events are you interested in?",
      options: [
        { text: "Photography courses", query: "photography courses" },
        { text: "Photography workshops", query: "photography workshops" },
        { text: "Photography exhibitions", query: "photography exhibitions" }
      ]
    },
    userResponses: [
      {
        response: "photography courses",
        expectedIntent: "events",
        expectedRouting: "route_to_events"
      },
      {
        response: "photography workshops",
        expectedIntent: "events", 
        expectedRouting: "route_to_events"
      }
    ]
  },
  {
    name: "Training Clarification Flow",
    initialQuery: "photography training",
    expectedClarification: {
      type: "training_clarification",
      question: "What type of photography training are you looking for?",
      options: [
        { text: "Photography courses", query: "photography courses" },
        { text: "Photography workshops", query: "photography workshops" },
        { text: "Photography mentoring", query: "photography mentoring" }
      ]
    },
    userResponses: [
      {
        response: "photography courses",
        expectedIntent: "events",
        expectedRouting: "route_to_events"
      },
      {
        response: "photography mentoring",
        expectedIntent: "advice",
        expectedRouting: "route_to_advice"
      }
    ]
  }
];

// Test API call function
async function testApiCall(query, sessionId = 'phase2-test') {
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        sessionId
      })
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

// Test clarification question generation
async function testClarificationQuestion(scenario) {
  console.log(`\n🔍 Testing: ${scenario.name}`);
  console.log(`   Initial Query: "${scenario.initialQuery}"`);
  
  const response = await testApiCall(scenario.initialQuery);
  
  if (!response) {
    return {
      scenario: scenario.name,
      test: "clarification_question",
      passed: false,
      failureReason: "API call failed"
    };
  }
  
  // Check if clarification response is returned
  if (response.type !== "clarification") {
    return {
      scenario: scenario.name,
      test: "clarification_question",
      passed: false,
      failureReason: `Expected clarification response, got type: ${response.type}`
    };
  }
  
  // Check clarification type
  if (response.clarification_type !== scenario.expectedClarification.type) {
    return {
      scenario: scenario.name,
      test: "clarification_question",
      passed: false,
      failureReason: `Wrong clarification type: expected ${scenario.expectedClarification.type}, got ${response.clarification_type}`
    };
  }
  
  // Check question text
  if (response.question !== scenario.expectedClarification.question) {
    return {
      scenario: scenario.name,
      test: "clarification_question",
      passed: false,
      failureReason: `Wrong question text: expected "${scenario.expectedClarification.question}", got "${response.question}"`
    };
  }
  
  // Check options
  if (!response.options || response.options.length !== scenario.expectedClarification.options.length) {
    return {
      scenario: scenario.name,
      test: "clarification_question",
      passed: false,
      failureReason: `Wrong number of options: expected ${scenario.expectedClarification.options.length}, got ${response.options?.length || 0}`
    };
  }
  
  console.log(`   ✅ Clarification Question Generated`);
  console.log(`   Question: ${response.question}`);
  console.log(`   Options: ${response.options.length} options`);
  
  return {
    scenario: scenario.name,
    test: "clarification_question",
    passed: true,
    clarificationResponse: response
  };
}

// Test user response handling
async function testUserResponse(scenario, userResponse, clarificationResponse) {
  console.log(`\n   🔄 Testing User Response: "${userResponse.response}"`);
  
  // Simulate follow-up query with previous query context
  const followUpResponse = await testApiCall(userResponse.response, 'phase2-test');
  
  if (!followUpResponse) {
    return {
      scenario: scenario.name,
      test: "user_response",
      userResponse: userResponse.response,
      passed: false,
      failureReason: "Follow-up API call failed"
    };
  }
  
  // Check if response is routed correctly
  if (followUpResponse.structured?.intent !== userResponse.expectedIntent) {
    return {
      scenario: scenario.name,
      test: "user_response",
      userResponse: userResponse.response,
      passed: false,
      failureReason: `Wrong intent: expected ${userResponse.expectedIntent}, got ${followUpResponse.structured?.intent}`
    };
  }
  
  console.log(`   ✅ User Response Handled Correctly`);
  console.log(`   Intent: ${followUpResponse.structured?.intent}`);
  console.log(`   Response Type: ${followUpResponse.type || 'standard'}`);
  
  return {
    scenario: scenario.name,
    test: "user_response",
    userResponse: userResponse.response,
    passed: true,
    followUpResponse
  };
}

// Main test function
async function testPhase2ClarificationQuestions() {
  console.log("🧪 PHASE 2: Testing Clarification Questions with Real Users");
  console.log("==========================================================");
  
  const results = [];
  let totalTests = 0;
  let passedTests = 0;
  
  for (const scenario of phase2TestScenarios) {
    console.log(`\n📋 Testing Scenario: ${scenario.name}`);
    console.log("=".repeat(50));
    
    // Test 1: Clarification question generation
    const clarificationResult = await testClarificationQuestion(scenario);
    results.push(clarificationResult);
    totalTests++;
    
    if (clarificationResult.passed) {
      passedTests++;
      
      // Test 2: User response handling
      for (const userResponse of scenario.userResponses) {
        const responseResult = await testUserResponse(scenario, userResponse, clarificationResult.clarificationResponse);
        results.push(responseResult);
        totalTests++;
        
        if (responseResult.passed) {
          passedTests++;
        }
      }
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 PHASE 2 TEST RESULTS");
  console.log("=".repeat(60));
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}`);
  console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log("🎉 ALL PHASE 2 TESTS PASSED!");
    console.log("✅ Clarification questions are working correctly!");
  } else {
    console.log("🚨 SOME PHASE 2 TESTS FAILED!");
    console.log("\nFailed tests:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.scenario}: ${r.test} → ${r.failureReason}`);
    });
  }
  
  // Save results
  const report = {
    timestamp: new Date().toISOString(),
    testType: "phase2_clarification_questions",
    totalTests,
    passedTests,
    failedTests: totalTests - passedTests,
    successRate: (passedTests / totalTests) * 100,
    results
  };
  
  fs.writeFileSync('phase2-clarification-test-results.json', JSON.stringify(report, null, 2));
  console.log("\n📄 Results saved to: phase2-clarification-test-results.json");
  
  return passedTests === totalTests;
}

// Run the tests
testPhase2ClarificationQuestions()
  .then(success => {
    console.log(`\n🏁 Phase 2 test completed with ${success ? 'SUCCESS' : 'FAILURE'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Phase 2 test failed:', error);
    process.exit(1);
  });

export { testPhase2ClarificationQuestions, phase2TestScenarios };
