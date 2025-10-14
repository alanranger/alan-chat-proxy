/**
 * PHASE 2: Simulated Clarification Questions Test
 * 
 * This script simulates the clarification system working with real user scenarios
 * to demonstrate how the clarification questions would work in practice.
 */

import fs from 'fs';

// Simulate the clarification system functions (copied from chat.js)
function needsClarification(query) {
  if (!query) return false;
  
  const lc = query.toLowerCase();
  
  const ambiguousPatterns = [
    lc.includes("equipment") && !lc.includes("course") && !lc.includes("workshop"),
    lc.includes("events") && !lc.includes("course") && !lc.includes("workshop"),
    lc.includes("training") && !lc.includes("course") && !lc.includes("workshop")
  ];
  
  return ambiguousPatterns.some(pattern => pattern);
}

function generateClarificationQuestion(query) {
  const lc = query.toLowerCase();
  
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

function handleClarificationFollowUp(query, originalQuery, originalIntent) {
  const lc = query.toLowerCase();
  
  if (lc.includes("equipment for photography course")) {
    return {
      type: "route_to_events",
      newQuery: "equipment for photography course",
      newIntent: "events"
    };
  } else if (lc.includes("photography courses")) {
    return {
      type: "route_to_events", 
      newQuery: "photography courses",
      newIntent: "events"
    };
  } else if (lc.includes("photography workshops")) {
    return {
      type: "route_to_events",
      newQuery: "photography workshops", 
      newIntent: "events"
    };
  } else if (lc.includes("photography equipment advice")) {
    return {
      type: "route_to_advice",
      newQuery: "photography equipment advice",
      newIntent: "advice"
    };
  } else if (lc.includes("camera lens recommendations")) {
    return {
      type: "route_to_advice",
      newQuery: "camera lens recommendations",
      newIntent: "advice"
    };
  } else if (lc.includes("photography exhibitions")) {
    return {
      type: "route_to_advice",
      newQuery: "photography exhibitions",
      newIntent: "advice"
    };
  } else if (lc.includes("photography mentoring")) {
    return {
      type: "route_to_advice",
      newQuery: "photography mentoring",
      newIntent: "advice"
    };
  }
  
  return null;
}

// Real user scenarios for testing
const userScenarios = [
  {
    name: "Sarah - Equipment for Course",
    userQuery: "what equipment do I need",
    userResponse: "equipment for photography course",
    expectedIntent: "events",
    expectedRouting: "route_to_events"
  },
  {
    name: "Mike - General Equipment Advice", 
    userQuery: "what equipment do I need",
    userResponse: "photography equipment advice",
    expectedIntent: "advice",
    expectedRouting: "route_to_advice"
  },
  {
    name: "Emma - Photography Events",
    userQuery: "photography events",
    userResponse: "photography courses",
    expectedIntent: "events",
    expectedRouting: "route_to_events"
  },
  {
    name: "David - Photography Training",
    userQuery: "photography training",
    userResponse: "photography workshops",
    expectedIntent: "events",
    expectedRouting: "route_to_events"
  },
  {
    name: "Lisa - Training Mentoring",
    userQuery: "photography training",
    userResponse: "photography mentoring",
    expectedIntent: "advice",
    expectedRouting: "route_to_advice"
  }
];

// Simulate the complete conversation flow
function simulateConversationFlow(scenario) {
  console.log(`\n👤 User: ${scenario.name}`);
  console.log(`📝 Initial Query: "${scenario.userQuery}"`);
  
  // Step 1: Check if clarification is needed
  const needsClar = needsClarification(scenario.userQuery);
  if (!needsClar) {
    return {
      scenario: scenario.name,
      passed: false,
      failureReason: "Clarification not detected when it should be"
    };
  }
  
  // Step 2: Generate clarification question
  const clarification = generateClarificationQuestion(scenario.userQuery);
  if (!clarification) {
    return {
      scenario: scenario.name,
      passed: false,
      failureReason: "No clarification question generated"
    };
  }
  
  console.log(`🤔 Bot: ${clarification.question}`);
  console.log(`📋 Options:`);
  clarification.options.forEach((option, index) => {
    console.log(`   ${index + 1}. ${option.text}`);
  });
  
  // Step 3: User responds with their choice
  console.log(`👤 User Response: "${scenario.userResponse}"`);
  
  // Step 4: Handle the follow-up
  const followUpResult = handleClarificationFollowUp(scenario.userResponse, scenario.userQuery, "advice");
  if (!followUpResult) {
    return {
      scenario: scenario.name,
      passed: false,
      failureReason: "No follow-up handling result"
    };
  }
  
  // Step 5: Verify the routing
  if (followUpResult.newIntent !== scenario.expectedIntent) {
    return {
      scenario: scenario.name,
      passed: false,
      failureReason: `Wrong intent: expected ${scenario.expectedIntent}, got ${followUpResult.newIntent}`
    };
  }
  
  if (followUpResult.type !== scenario.expectedRouting) {
    return {
      scenario: scenario.name,
      passed: false,
      failureReason: `Wrong routing: expected ${scenario.expectedRouting}, got ${followUpResult.type}`
    };
  }
  
  console.log(`✅ Bot: Routing to ${followUpResult.newIntent} with query "${followUpResult.newQuery}"`);
  
  return {
    scenario: scenario.name,
    passed: true,
    clarification,
    followUpResult
  };
}

// Main test function
async function testPhase2Simulated() {
  console.log("🧪 PHASE 2: Simulated Clarification Questions with Real User Scenarios");
  console.log("=====================================================================");
  
  const results = [];
  let passed = 0;
  let failed = 0;
  
  for (const scenario of userScenarios) {
    const result = simulateConversationFlow(scenario);
    results.push(result);
    
    if (result.passed) {
      passed++;
      console.log(`✅ PASSED - ${scenario.name}`);
    } else {
      failed++;
      console.log(`❌ FAILED - ${scenario.name}: ${result.failureReason}`);
    }
  }
  
  console.log("\n" + "=".repeat(70));
  console.log("📊 PHASE 2 SIMULATED TEST RESULTS");
  console.log("=".repeat(70));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / userScenarios.length) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log("🎉 ALL PHASE 2 SIMULATED TESTS PASSED!");
    console.log("✅ Clarification system is working correctly!");
    console.log("\n💡 Key Benefits Demonstrated:");
    console.log("   - Ambiguous queries trigger helpful clarification questions");
    console.log("   - Users get clear options to choose from");
    console.log("   - System routes to correct content based on user choice");
    console.log("   - Natural conversation flow established");
  } else {
    console.log("🚨 SOME PHASE 2 SIMULATED TESTS FAILED!");
    console.log("\nFailed scenarios:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.scenario}: ${r.failureReason}`);
    });
  }
  
  // Save results
  const report = {
    timestamp: new Date().toISOString(),
    testType: "phase2_simulated_clarification",
    totalScenarios: userScenarios.length,
    passed,
    failed,
    successRate: (passed / userScenarios.length) * 100,
    results
  };
  
  fs.writeFileSync('phase2-simulated-test-results.json', JSON.stringify(report, null, 2));
  console.log("\n📄 Results saved to: phase2-simulated-test-results.json");
  
  return failed === 0;
}

// Run the simulated tests
testPhase2Simulated()
  .then(success => {
    console.log(`\n🏁 Phase 2 simulated test completed with ${success ? 'SUCCESS' : 'FAILURE'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Phase 2 simulated test failed:', error);
    process.exit(1);
  });

export { testPhase2Simulated, userScenarios };
