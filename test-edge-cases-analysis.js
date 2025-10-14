/**
 * EDGE CASES ANALYSIS - Understanding Current Failures
 * 
 * This script analyzes the 3 edge cases that failed in our baseline test
 * to understand why they're being misclassified and how the clarification
 * system should handle them.
 */

import fs from 'fs';

// The 3 edge cases that failed in our baseline test
const edgeCases = [
  {
    query: "what equipment do I need",
    expectedIntent: "events",
    actualIntent: "advice",
    failureReason: "Wrong intent: advice (expected: events)"
  },
  {
    query: "photography events", 
    expectedIntent: "events",
    actualIntent: "advice",
    failureReason: "Wrong intent: advice (expected: events)"
  },
  {
    query: "photography training",
    expectedIntent: "events", 
    actualIntent: "advice",
    failureReason: "Wrong intent: advice (expected: events)"
  }
];

// Enhanced intent detection logic (copied from chat.js for analysis)
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

// Detailed analysis function
function analyzeEdgeCase(query, expectedIntent, actualIntent) {
  const lc = query.toLowerCase();
  
  const analysis = {
    query,
    expectedIntent,
    actualIntent,
    analysis: {
      mentionsCourse: lc.includes("course") || lc.includes("class") || lc.includes("lesson"),
      mentionsWorkshop: lc.includes("workshop"),
      hasEventHints: ["when", "where", "schedule", "date", "time", "location", "cost", "price", "book", "booking"].some(w => lc.includes(w)),
      hasAdviceKeywords: ["certificate", "camera", "laptop", "equipment", "tripod", "lens", "gear", "need", "require", "recommend", "advise", "help", "wrong", "problem", "free", "online", "sort of", "what do i", "do i need", "get a", "what is", "what are", "how does", "explain", "define", "meaning", "training", "mentoring", "tutoring"].some(word => lc.includes(word)),
      hasFollowUpQuestions: ["how much", "cost", "price", "where", "location", "when", "date", "how many", "people", "attend", "fitness", "level", "duration", "long", "how do i book", "book", "booking", "required", "needed", "suitable"].some(q => lc.includes(q))
    },
    rootCause: null,
    clarificationNeeded: false,
    suggestedClarification: null
  };
  
  // Determine root cause
  if (query === "what equipment do I need") {
    analysis.rootCause = "Contains 'equipment' which triggers advice keywords, but context suggests event-related equipment needs";
    analysis.clarificationNeeded = true;
    analysis.suggestedClarification = {
      question: "What type of photography activity are you planning? This will help me recommend the right equipment.",
      options: [
        { text: "Photography course/workshop", query: "equipment for photography course" },
        { text: "General photography advice", query: "photography equipment advice" },
        { text: "Specific camera/lens advice", query: "camera lens recommendations" }
      ]
    };
  } else if (query === "photography events") {
    analysis.rootCause = "Contains 'events' but no course/workshop keywords, so doesn't match event detection logic";
    analysis.clarificationNeeded = true;
    analysis.suggestedClarification = {
      question: "What type of photography events are you interested in?",
      options: [
        { text: "Photography courses", query: "photography courses" },
        { text: "Photography workshops", query: "photography workshops" },
        { text: "Photography exhibitions", query: "photography exhibitions" }
      ]
    };
  } else if (query === "photography training") {
    analysis.rootCause = "Contains 'training' which triggers advice keywords, but could refer to training courses/events";
    analysis.clarificationNeeded = true;
    analysis.suggestedClarification = {
      question: "What type of photography training are you looking for?",
      options: [
        { text: "Photography courses", query: "photography courses" },
        { text: "Photography workshops", query: "photography workshops" },
        { text: "Photography mentoring", query: "photography mentoring" }
      ]
    };
  }
  
  return analysis;
}

async function analyzeEdgeCases() {
  console.log("🔍 ANALYZING EDGE CASES - Understanding Current Failures");
  console.log("========================================================");
  
  const results = [];
  
  for (const edgeCase of edgeCases) {
    console.log(`\n📝 Analyzing: "${edgeCase.query}"`);
    console.log(`Expected: ${edgeCase.expectedIntent}, Actual: ${edgeCase.actualIntent}`);
    
    const analysis = analyzeEdgeCase(edgeCase.query, edgeCase.expectedIntent, edgeCase.actualIntent);
    results.push(analysis);
    
    console.log(`\n🔍 Analysis:`);
    console.log(`  - Mentions Course: ${analysis.analysis.mentionsCourse}`);
    console.log(`  - Mentions Workshop: ${analysis.analysis.mentionsWorkshop}`);
    console.log(`  - Has Event Hints: ${analysis.analysis.hasEventHints}`);
    console.log(`  - Has Advice Keywords: ${analysis.analysis.hasAdviceKeywords}`);
    console.log(`  - Has Follow-up Questions: ${analysis.analysis.hasFollowUpQuestions}`);
    
    console.log(`\n🎯 Root Cause: ${analysis.rootCause}`);
    
    if (analysis.clarificationNeeded) {
      console.log(`\n💡 Clarification Needed: YES`);
      console.log(`   Question: ${analysis.suggestedClarification.question}`);
      console.log(`   Options:`);
      analysis.suggestedClarification.options.forEach((option, index) => {
        console.log(`     ${index + 1}. ${option.text} → "${option.query}"`);
      });
    } else {
      console.log(`\n💡 Clarification Needed: NO`);
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 EDGE CASES ANALYSIS SUMMARY");
  console.log("=".repeat(60));
  
  const clarificationNeeded = results.filter(r => r.clarificationNeeded).length;
  console.log(`\n🎯 Key Findings:`);
  console.log(`  - Total Edge Cases: ${edgeCases.length}`);
  console.log(`  - Need Clarification: ${clarificationNeeded}`);
  console.log(`  - Clarification Rate: ${((clarificationNeeded / edgeCases.length) * 100).toFixed(1)}%`);
  
  console.log(`\n🔍 Root Causes Identified:`);
  results.forEach((result, index) => {
    console.log(`  ${index + 1}. "${result.query}" → ${result.rootCause}`);
  });
  
  console.log(`\n💡 Clarification System Design:`);
  console.log(`  - All 3 edge cases need clarification`);
  console.log(`  - Context-aware questions required`);
  console.log(`  - Multiple option routing needed`);
  console.log(`  - Event vs advice distinction critical`);
  
  // Save results
  const report = {
    timestamp: new Date().toISOString(),
    testType: "edge_cases_analysis",
    totalEdgeCases: edgeCases.length,
    clarificationNeeded,
    clarificationRate: (clarificationNeeded / edgeCases.length) * 100,
    results
  };
  
  fs.writeFileSync('edge-cases-analysis-results.json', JSON.stringify(report, null, 2));
  console.log("\n📄 Results saved to: edge-cases-analysis-results.json");
  
  return results;
}

// Run the analysis
analyzeEdgeCases()
  .then(results => {
    console.log(`\n🏁 Edge cases analysis completed successfully!`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });

export { analyzeEdgeCases, edgeCases };
