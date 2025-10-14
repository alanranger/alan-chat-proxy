/**
 * SIMPLE EVENT SYSTEM PROTECTION TESTS
 * 
 * This script tests the event system logic directly without requiring
 * the API server to be running.
 */

import fs from 'fs';

// Import the chat.js functions directly
// Note: This requires the chat.js to be structured for direct import
// For now, we'll create a simplified test that validates the logic

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

// Simplified intent detection logic (copied from chat.js)
function detectIntent(q) {
  const lc = (q || "").toLowerCase();
  
  // PRIORITY: Free course queries should be treated as advice, not events
  const isFreeCourseQuery = lc.includes("free") && (lc.includes("course") || lc.includes("online"));
  if (isFreeCourseQuery) {
    return "advice"; // Free course queries need cross-entity search
  }
  
  // Check for course/class queries
  const mentionsCourse = lc.includes("course") || lc.includes("class") || lc.includes("lesson");
  const mentionsWorkshop = lc.includes("workshop");
  
  // Check for event-style questions (dates/times/locations)
  const EVENT_HINTS = ["when", "where", "schedule", "date", "time", "location", "cost", "price", "book", "booking"];
  const hasEventWord = EVENT_HINTS.some((w) => lc.includes(w));
  
  // Both courses and workshops have events - they're both scheduled sessions
  // Course queries should look for course events, workshop queries should look for workshop events
  if (mentionsCourse || mentionsWorkshop) {
    return "events"; // Both courses and workshops are events (scheduled sessions)
  }
  
  // ADVICE keywords
  const adviceKeywords = [
    "certificate", "camera", "laptop", "equipment", "tripod", "lens", "gear",
    "need", "require", "recommend", "advise", "help", "wrong", "problem",
    "free", "online", "sort of", "what do i", "do i need", "get a",
    "what is", "what are", "how does", "explain", "define", "meaning",
    "training", "mentoring", "tutoring"
  ];
  if (adviceKeywords.some(word => lc.includes(word))) {
    return "advice";
  }
  
  // heuristic: if question starts with "when/where" + includes 'workshop' → events
  if (/^\s*(when|where)\b/i.test(q || "") && mentionsWorkshop) return "events";
  
  // Handle follow-up questions for events (price, location, etc.) - ENHANCED LOGIC
  const followUpQuestions = [
    "how much", "cost", "price", "where", "location", "when", "date",
    "how many", "people", "attend", "fitness", "level", "duration", "long",
    "how do i book", "book", "booking", "required", "needed", "suitable"
  ];
  
  // Check if this is a follow-up question about event details
  if (followUpQuestions.some(q => lc.includes(q))) {
    return "events";
  }
  
  return "advice"; // Default fallback
}

async function testEventSystem() {
  console.log("🛡️ TESTING EVENT SYSTEM PROTECTION (INTENT DETECTION)");
  console.log("=====================================================");
  
  const results = [];
  let passed = 0;
  let failed = 0;
  
  for (const query of eventTestQueries) {
    console.log(`\n📝 Testing: "${query}"`);
    
    const intent = detectIntent(query);
    const result = {
      query,
      intent,
      passed: intent === "events",
      failureReason: intent !== "events" ? `Wrong intent: ${intent} (expected: events)` : null
    };
    
    results.push(result);
    
    if (result.passed) {
      console.log(`✅ PASSED - Intent: ${result.intent}`);
      passed++;
    } else {
      console.log(`❌ FAILED - ${result.failureReason}`);
      failed++;
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log(`📊 EVENT SYSTEM PROTECTION TEST RESULTS (INTENT DETECTION)`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / eventTestQueries.length) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log("🎉 ALL EVENT INTENT DETECTION TESTS PASSED!");
  } else {
    console.log("🚨 SOME EVENT INTENT DETECTION TESTS FAILED!");
    console.log("\nFailed queries:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - "${r.query}" → ${r.intent} (expected: events)`);
    });
  }
  
  // Save results
  const report = {
    timestamp: new Date().toISOString(),
    testType: "intent_detection",
    totalTests: eventTestQueries.length,
    passed,
    failed,
    successRate: (passed / eventTestQueries.length) * 100,
    results
  };
  
  fs.writeFileSync('event-protection-intent-test-results.json', JSON.stringify(report, null, 2));
  console.log("\n📄 Results saved to: event-protection-intent-test-results.json");
  
  return failed === 0;
}

// Run the tests
testEventSystem()
  .then(success => {
    console.log(`\n🏁 Test completed with ${success ? 'SUCCESS' : 'FAILURE'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });

export { testEventSystem, eventTestQueries };
