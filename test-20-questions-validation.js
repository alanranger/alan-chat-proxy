/**
 * 20 QUESTIONS VALIDATION TEST
 * 
 * This script tests the clarification system against all 20 questions
 * from the interactive testing with business owner specifications.
 * It validates that the clarification system correctly handles the
 * scenarios that were identified as needing clarification.
 */

import fs from 'fs';

// Load the complete 20-question dataset
const testData = JSON.parse(fs.readFileSync('chatbot-test-results-2025-10-14 (3).json', 'utf8'));

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

// Analyze each question from the dataset
function analyzeQuestion(questionData) {
  const { questionId, category, userQuestion, userFollowUpResponse, businessOwnerResponse } = questionData;
  
  console.log(`\n📝 Question ${questionId}: ${category}`);
  console.log(`   User: "${userQuestion}"`);
  
  // Check if this question should trigger clarification
  const shouldClarify = needsClarification(userQuestion);
  
  // Check if the business owner response indicates this needed clarification
  const hasFollowUp = userFollowUpResponse && userFollowUpResponse.trim().length > 0;
  const needsClarificationBasedOnData = hasFollowUp;
  
  const analysis = {
    questionId,
    category,
    userQuestion,
    userFollowUpResponse,
    businessOwnerResponse,
    shouldClarify,
    needsClarificationBasedOnData,
    clarificationMatch: shouldClarify === needsClarificationBasedOnData,
    expectedIntent: businessOwnerResponse.expectedIntent,
    expectedKind: businessOwnerResponse.expectedKind,
    expectedUrls: businessOwnerResponse.expectedUrls
  };
  
  if (shouldClarify) {
    const clarification = generateClarificationQuestion(userQuestion);
    analysis.clarification = clarification;
    console.log(`   🤔 Should Clarify: YES (${clarification?.type})`);
    console.log(`   📋 Question: ${clarification?.question}`);
  } else {
    console.log(`   ✅ Should Clarify: NO (direct response)`);
  }
  
  if (hasFollowUp) {
    console.log(`   👤 User Follow-up: "${userFollowUpResponse}"`);
    console.log(`   🎯 Expected Intent: ${businessOwnerResponse.expectedIntent}`);
    console.log(`   📄 Expected Kind: ${businessOwnerResponse.expectedKind}`);
    console.log(`   🔗 Expected URLs: ${businessOwnerResponse.expectedUrls.length} URLs`);
  }
  
  return analysis;
}

// Main validation function
async function validate20Questions() {
  console.log("🧪 20 QUESTIONS VALIDATION TEST");
  console.log("================================");
  console.log("Testing clarification system against all 20 questions with business owner specifications");
  
  const results = [];
  let totalQuestions = 0;
  let clarificationMatches = 0;
  let questionsNeedingClarification = 0;
  let questionsWithFollowUp = 0;
  
  // Analyze each question
  for (const questionData of testData.testResults) {
    const analysis = analyzeQuestion(questionData);
    results.push(analysis);
    totalQuestions++;
    
    if (analysis.shouldClarify) {
      questionsNeedingClarification++;
    }
    
    if (analysis.needsClarificationBasedOnData) {
      questionsWithFollowUp++;
    }
    
    if (analysis.clarificationMatch) {
      clarificationMatches++;
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 20 QUESTIONS VALIDATION RESULTS");
  console.log("=".repeat(60));
  
  console.log(`\n📈 Overall Statistics:`);
  console.log(`   Total Questions: ${totalQuestions}`);
  console.log(`   Questions with Follow-up: ${questionsWithFollowUp}`);
  console.log(`   Questions Needing Clarification: ${questionsNeedingClarification}`);
  console.log(`   Clarification Matches: ${clarificationMatches}`);
  console.log(`   Match Rate: ${((clarificationMatches / totalQuestions) * 100).toFixed(1)}%`);
  
  // Analyze by category
  console.log(`\n📋 Analysis by Category:`);
  const categoryAnalysis = {};
  
  results.forEach(result => {
    if (!categoryAnalysis[result.category]) {
      categoryAnalysis[result.category] = {
        total: 0,
        needsClarification: 0,
        hasFollowUp: 0,
        matches: 0
      };
    }
    
    categoryAnalysis[result.category].total++;
    if (result.shouldClarify) categoryAnalysis[result.category].needsClarification++;
    if (result.needsClarificationBasedOnData) categoryAnalysis[result.category].hasFollowUp++;
    if (result.clarificationMatch) categoryAnalysis[result.category].matches++;
  });
  
  Object.entries(categoryAnalysis).forEach(([category, stats]) => {
    console.log(`   ${category}:`);
    console.log(`     Total: ${stats.total}, Needs Clarification: ${stats.needsClarification}, Has Follow-up: ${stats.hasFollowUp}, Matches: ${stats.matches}`);
  });
  
  // Identify questions that need clarification system expansion
  console.log(`\n🔍 Questions Needing Clarification System Expansion:`);
  const expansionNeeded = results.filter(r => r.needsClarificationBasedOnData && !r.shouldClarify);
  
  if (expansionNeeded.length > 0) {
    console.log(`   Found ${expansionNeeded.length} questions that need clarification but aren't detected:`);
    expansionNeeded.forEach(q => {
      console.log(`   - Q${q.questionId}: "${q.userQuestion}" (${q.category})`);
    });
  } else {
    console.log(`   ✅ All questions needing clarification are properly detected!`);
  }
  
  // Identify false positives
  console.log(`\n⚠️ False Positives (Questions incorrectly flagged for clarification):`);
  const falsePositives = results.filter(r => r.shouldClarify && !r.needsClarificationBasedOnData);
  
  if (falsePositives.length > 0) {
    console.log(`   Found ${falsePositives.length} false positives:`);
    falsePositives.forEach(q => {
      console.log(`   - Q${q.questionId}: "${q.userQuestion}" (${q.category})`);
    });
  } else {
    console.log(`   ✅ No false positives found!`);
  }
  
  // Summary
  console.log(`\n🎯 Summary:`);
  if (clarificationMatches === totalQuestions) {
    console.log(`   🎉 PERFECT MATCH! All questions correctly identified for clarification needs.`);
  } else {
    console.log(`   📊 ${clarificationMatches}/${totalQuestions} questions correctly identified.`);
    console.log(`   🔧 System needs refinement for ${totalQuestions - clarificationMatches} questions.`);
  }
  
  // Save results
  const report = {
    timestamp: new Date().toISOString(),
    testType: "20_questions_validation",
    totalQuestions,
    questionsWithFollowUp,
    questionsNeedingClarification,
    clarificationMatches,
    matchRate: (clarificationMatches / totalQuestions) * 100,
    categoryAnalysis,
    expansionNeeded: expansionNeeded.map(q => ({
      questionId: q.questionId,
      category: q.category,
      userQuestion: q.userQuestion
    })),
    falsePositives: falsePositives.map(q => ({
      questionId: q.questionId,
      category: q.category,
      userQuestion: q.userQuestion
    })),
    results
  };
  
  fs.writeFileSync('20-questions-validation-results.json', JSON.stringify(report, null, 2));
  console.log("\n📄 Results saved to: 20-questions-validation-results.json");
  
  return clarificationMatches === totalQuestions;
}

// Run the validation
validate20Questions()
  .then(success => {
    console.log(`\n🏁 20 questions validation completed with ${success ? 'PERFECT MATCH' : 'NEEDS REFINEMENT'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('20 questions validation failed:', error);
    process.exit(1);
  });

export { validate20Questions };
