/**
 * COMPLETE FOLLOW-UP HANDLING TEST
 * 
 * This script tests the complete follow-up handling system with all patterns
 * from the 20-question dataset. It validates that user responses are correctly
 * routed to the appropriate intents and queries.
 */

import fs from 'fs';

// Load the complete 20-question dataset
const testData = JSON.parse(fs.readFileSync('chatbot-test-results-2025-10-14 (3).json', 'utf8'));

// COMPLETE FOLLOW-UP HANDLER FUNCTION
function handleClarificationFollowUp(query, originalQuery, originalIntent) {
  const lc = query.toLowerCase();
  
  // Current patterns (keep existing for backward compatibility)
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
  
  // COMPREHENSIVE FOLLOW-UP PATTERNS FROM 20-QUESTION DATASET
  
  // Online courses patterns
  if (lc.includes("online") || lc.includes("can't get to coventry")) {
    return {
      type: "route_to_advice",
      newQuery: "online photography courses",
      newIntent: "advice"
    };
  }
  
  // Specific course types
  if (lc.includes("camera course")) {
    return {
      type: "route_to_advice",
      newQuery: "camera course for beginners",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("editing course") || lc.includes("beginners editing")) {
    return {
      type: "route_to_events",
      newQuery: "beginner editing course",
      newIntent: "events"
    };
  }
  
  // Workshop types
  if (lc.includes("bluebell") || lc.includes("bluebells")) {
    return {
      type: "route_to_events",
      newQuery: "bluebell photography workshops",
      newIntent: "events"
    };
  }
  
  if (lc.includes("outdoor photography") || lc.includes("outdoor")) {
    return {
      type: "route_to_events",
      newQuery: "outdoor photography workshops",
      newIntent: "events"
    };
  }
  
  // Equipment advice patterns
  if (lc.includes("sony")) {
    return {
      type: "route_to_advice",
      newQuery: "sony camera recommendations",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("entry level") || lc.includes("beginners camera")) {
    return {
      type: "route_to_advice",
      newQuery: "beginner camera recommendations",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("basic camera settings") || lc.includes("composition") || lc.includes("editing")) {
    return {
      type: "route_to_advice",
      newQuery: "camera settings and composition lessons",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("intermediate") && lc.includes("upgrade")) {
    return {
      type: "route_to_advice",
      newQuery: "camera upgrade for intermediate photographers",
      newIntent: "advice"
    };
  }
  
  // About information patterns
  if (lc.includes("teaching") || lc.includes("how long")) {
    return {
      type: "route_to_advice",
      newQuery: "Alan Ranger teaching experience",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("qualified") || lc.includes("qualifications")) {
    return {
      type: "route_to_advice",
      newQuery: "Alan Ranger qualifications",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("where is he based") || lc.includes("location")) {
    return {
      type: "route_to_advice",
      newQuery: "Alan Ranger location",
      newIntent: "advice"
    };
  }
  
  // Service types
  if (lc.includes("private lessons") || lc.includes("private")) {
    return {
      type: "route_to_advice",
      newQuery: "private photography lessons",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("work rota") || lc.includes("shifts") || lc.includes("flexible")) {
    return {
      type: "route_to_advice",
      newQuery: "flexible photography lessons",
      newIntent: "advice"
    };
  }
  
  // Technical help
  if (lc.includes("exposure settings") || lc.includes("exposure")) {
    return {
      type: "route_to_advice",
      newQuery: "manual exposure settings",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("manual mode")) {
    return {
      type: "route_to_advice",
      newQuery: "manual mode tutorial",
      newIntent: "advice"
    };
  }
  
  // Location preferences
  if (lc.includes("birmingham") || lc.includes("close to birmingham")) {
    return {
      type: "route_to_advice",
      newQuery: "photography courses near Birmingham",
      newIntent: "advice"
    };
  }
  
  // Beginner focus
  if (lc.includes("suitable for beginners") || lc.includes("complete beginners")) {
    return {
      type: "route_to_advice",
      newQuery: "beginner photography courses",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("dates and cost") || lc.includes("where are they")) {
    return {
      type: "route_to_events",
      newQuery: "workshop dates and locations",
      newIntent: "events"
    };
  }
  
  // Free course patterns
  if (lc.includes("really free") || lc.includes("is it really free")) {
    return {
      type: "route_to_advice",
      newQuery: "free online photography course confirmation",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("how do i join") || lc.includes("how to join")) {
    return {
      type: "route_to_advice",
      newQuery: "how to join free course",
      newIntent: "advice"
    };
  }
  
  // Specific date patterns
  if (lc.includes("sunday") && lc.includes("2026")) {
    return {
      type: "route_to_events",
      newQuery: "macro workshop Sunday 17 May 2026",
      newIntent: "events"
    };
  }
  
  if (lc.includes("may 2026") || lc.includes("17 may")) {
    return {
      type: "route_to_events",
      newQuery: "macro workshop May 2026",
      newIntent: "events"
    };
  }
  
  // Technical photography types
  if (lc.includes("astrophotography")) {
    return {
      type: "route_to_advice",
      newQuery: "astrophotography settings",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("night photography")) {
    return {
      type: "route_to_advice",
      newQuery: "night photography settings",
      newIntent: "advice"
    };
  }
  
  // Course format comparison
  if (lc.includes("give me the differences") || lc.includes("differences")) {
    return {
      type: "route_to_advice",
      newQuery: "online vs in-person course differences",
      newIntent: "advice"
    };
  }
  
  // Camera type advice
  if (lc.includes("dslr") || lc.includes("mirrorless")) {
    return {
      type: "route_to_advice",
      newQuery: "DSLR vs mirrorless camera comparison",
      newIntent: "advice"
    };
  }
  
  // Upcoming events
  if (lc.includes("coming up this month") || lc.includes("upcoming")) {
    return {
      type: "route_to_events",
      newQuery: "upcoming photography workshops",
      newIntent: "events"
    };
  }
  
  // Generic fallbacks
  if (lc.includes("yes") && lc.includes("free")) {
    return {
      type: "route_to_advice",
      newQuery: "free course details",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("beginner") && lc.includes("ok")) {
    return {
      type: "route_to_advice",
      newQuery: "beginner photography courses",
      newIntent: "advice"
    };
  }
  
  return null;
}

// Test the complete follow-up handling system
function testCompleteFollowUpHandling() {
  console.log("🧪 COMPLETE FOLLOW-UP HANDLING TEST");
  console.log("===================================");
  console.log("Testing follow-up handling for all 20 questions");
  
  const results = [];
  let totalFollowUps = 0;
  let handledFollowUps = 0;
  
  // Test each question from the dataset
  for (const questionData of testData.testResults) {
    const { questionId, category, userQuestion, userFollowUpResponse, businessOwnerResponse } = questionData;
    
    console.log(`\n📝 Question ${questionId}: ${category}`);
    console.log(`   User: "${userQuestion}"`);
    
    if (userFollowUpResponse) {
      console.log(`   👤 Follow-up: "${userFollowUpResponse}"`);
      
      // Test follow-up handling
      const followUpResult = handleClarificationFollowUp(userFollowUpResponse, userQuestion, "advice");
      
      if (followUpResult) {
        handledFollowUps++;
        console.log(`   ✅ Handled: ${followUpResult.newIntent}`);
        console.log(`   🎯 New Query: "${followUpResult.newQuery}"`);
        
        // Check if the intent matches expected
        const intentMatch = followUpResult.newIntent === businessOwnerResponse.expectedIntent;
        console.log(`   📊 Intent Match: ${intentMatch ? '✅' : '❌'} (Expected: ${businessOwnerResponse.expectedIntent})`);
        
        results.push({
          questionId,
          category,
          userQuestion,
          userFollowUpResponse,
          followUpResult,
          expectedIntent: businessOwnerResponse.expectedIntent,
          expectedKind: businessOwnerResponse.expectedKind,
          intentMatch,
          handled: true
        });
      } else {
        console.log(`   ❌ NOT Handled`);
        results.push({
          questionId,
          category,
          userQuestion,
          userFollowUpResponse,
          followUpResult: null,
          expectedIntent: businessOwnerResponse.expectedIntent,
          expectedKind: businessOwnerResponse.expectedKind,
          intentMatch: false,
          handled: false
        });
      }
      
      totalFollowUps++;
    } else {
      console.log(`   ⏭️ No follow-up response`);
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 COMPLETE FOLLOW-UP HANDLING RESULTS");
  console.log("=".repeat(60));
  
  console.log(`\n📈 Overall Statistics:`);
  console.log(`   Total Follow-ups: ${totalFollowUps}`);
  console.log(`   Handled Follow-ups: ${handledFollowUps}`);
  console.log(`   Handling Rate: ${((handledFollowUps / totalFollowUps) * 100).toFixed(1)}%`);
  
  // Calculate intent accuracy
  const intentMatches = results.filter(r => r.intentMatch).length;
  const intentAccuracy = (intentMatches / handledFollowUps) * 100;
  console.log(`   Intent Accuracy: ${intentAccuracy.toFixed(1)}%`);
  
  // Analyze by category
  console.log(`\n📋 Analysis by Category:`);
  const categoryAnalysis = {};
  
  results.forEach(result => {
    if (!categoryAnalysis[result.category]) {
      categoryAnalysis[result.category] = {
        total: 0,
        handled: 0,
        intentMatches: 0
      };
    }
    
    categoryAnalysis[result.category].total++;
    if (result.handled) categoryAnalysis[result.category].handled++;
    if (result.intentMatch) categoryAnalysis[result.category].intentMatches++;
  });
  
  Object.entries(categoryAnalysis).forEach(([category, stats]) => {
    const handlingRate = (stats.handled / stats.total) * 100;
    const intentRate = stats.handled > 0 ? (stats.intentMatches / stats.handled) * 100 : 0;
    console.log(`   ${category}:`);
    console.log(`     Total: ${stats.total}, Handled: ${stats.handled} (${handlingRate.toFixed(1)}%), Intent Match: ${stats.intentMatches} (${intentRate.toFixed(1)}%)`);
  });
  
  // Identify unhandled patterns
  const unhandled = results.filter(r => !r.handled);
  if (unhandled.length > 0) {
    console.log(`\n❌ Unhandled Follow-ups (${unhandled.length}):`);
    unhandled.forEach(result => {
      console.log(`   Q${result.questionId}: "${result.userFollowUpResponse}"`);
    });
  }
  
  // Identify intent mismatches
  const intentMismatches = results.filter(r => r.handled && !r.intentMatch);
  if (intentMismatches.length > 0) {
    console.log(`\n⚠️ Intent Mismatches (${intentMismatches.length}):`);
    intentMismatches.forEach(result => {
      console.log(`   Q${result.questionId}: Got ${result.followUpResult.newIntent}, Expected ${result.expectedIntent}`);
    });
  }
  
  // Summary
  console.log(`\n🎯 Summary:`);
  if (handledFollowUps === totalFollowUps && intentMatches === handledFollowUps) {
    console.log(`   🎉 PERFECT! All follow-ups handled with correct intent routing.`);
  } else {
    console.log(`   📊 ${handledFollowUps}/${totalFollowUps} follow-ups handled.`);
    console.log(`   📊 ${intentMatches}/${handledFollowUps} with correct intent routing.`);
    if (unhandled.length > 0) {
      console.log(`   🔧 ${unhandled.length} patterns need to be added.`);
    }
    if (intentMismatches.length > 0) {
      console.log(`   🔧 ${intentMismatches.length} intent routings need correction.`);
    }
  }
  
  // Save results
  const report = {
    timestamp: new Date().toISOString(),
    testType: "complete_followup_handling",
    totalFollowUps,
    handledFollowUps,
    handlingRate: (handledFollowUps / totalFollowUps) * 100,
    intentMatches,
    intentAccuracy,
    categoryAnalysis,
    unhandled: unhandled.map(r => ({
      questionId: r.questionId,
      category: r.category,
      userFollowUpResponse: r.userFollowUpResponse
    })),
    intentMismatches: intentMismatches.map(r => ({
      questionId: r.questionId,
      category: r.category,
      gotIntent: r.followUpResult.newIntent,
      expectedIntent: r.expectedIntent
    })),
    results
  };
  
  fs.writeFileSync('complete-followup-handling-results.json', JSON.stringify(report, null, 2));
  console.log("\n📄 Results saved to: complete-followup-handling-results.json");
  
  return handledFollowUps === totalFollowUps && intentMatches === handledFollowUps;
}

// Run the test
const success = testCompleteFollowUpHandling();
console.log(`\n🏁 Complete follow-up handling test completed with ${success ? 'SUCCESS' : 'NEEDS REFINEMENT'}`);
process.exit(success ? 0 : 1);

export { testCompleteFollowUpHandling, handleClarificationFollowUp };
