#!/usr/bin/env node

/**
 * Test Multiple Random Questions to Identify Failures
 */

const API_BASE = 'https://alan-chat-proxy.vercel.app';

const testQuestions = [
  // Technical questions
  "what is iso",
  "what is aperture", 
  "what is shutter speed",
  "what is exposure",
  "what is metering",
  
  // Equipment questions
  "tripod recommendations",
  "camera recommendations",
  "lens recommendations",
  "best camera for beginners",
  "what equipment do I need",
  
  // Events questions
  "when is the next devon workshop",
  "photography courses",
  "photography workshops",
  "when is the next course",
  "what courses do you offer",
  
  // Service questions
  "photography services",
  "private lessons",
  "mentoring",
  "feedback on my photos",
  "how do I get feedback",
  
  // About questions
  "about alan ranger",
  "who is alan",
  "where is alan based",
  "contact alan",
  
  // Vague questions (should trigger clarification)
  "photography help",
  "photography advice",
  "help with photography",
  "what can you help me with",
  
  // Edge cases
  "photography equipment advice",
  "equipment for photography course",
  "beginners camera course",
  "online photography courses"
];

async function testQuestion(question, index) {
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: question,
        topK: 8,
        sessionId: `test-session-${index}`
      })
    });
    
    const data = await response.json();
    
    return {
      question,
      status: response.status,
      type: data.type,
      confidence: data.confidence,
      hasAnswer: !!data.answer,
      hasAnswerMarkdown: !!data.answer_markdown,
      isClarification: data.type === 'clarification',
      debug: data.debug || {},
      meta: data.meta || {}
    };
    
  } catch (error) {
    return {
      question,
      error: error.message,
      status: 'ERROR'
    };
  }
}

async function runComprehensiveTest() {
  console.log("🧪 Testing Multiple Random Questions to Identify Failures\n");
  
  const results = [];
  let successCount = 0;
  let clarificationCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < testQuestions.length; i++) {
    const question = testQuestions[i];
    console.log(`Testing ${i + 1}/${testQuestions.length}: "${question}"`);
    
    const result = await testQuestion(question, i);
    results.push(result);
    
    if (result.status === 'ERROR') {
      errorCount++;
      console.log(`  ❌ ERROR: ${result.error}`);
    } else if (result.isClarification) {
      clarificationCount++;
      console.log(`  🤔 CLARIFICATION: ${result.confidence}% confidence`);
    } else if (result.hasAnswer || result.hasAnswerMarkdown) {
      successCount++;
      console.log(`  ✅ SUCCESS: ${result.type} - ${result.confidence}% confidence`);
    } else {
      console.log(`  ⚠️  NO ANSWER: ${result.type} - ${result.confidence}% confidence`);
    }
    
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log("\n📊 COMPREHENSIVE TEST RESULTS:");
  console.log(`✅ Successful Answers: ${successCount}`);
  console.log(`🤔 Clarifications: ${clarificationCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📈 Success Rate: ${((successCount / testQuestions.length) * 100).toFixed(1)}%`);
  
  console.log("\n🔍 DETAILED BREAKDOWN:");
  
  // Group by type
  const byType = {};
  results.forEach(r => {
    if (r.status !== 'ERROR') {
      byType[r.type] = (byType[r.type] || 0) + 1;
    }
  });
  
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} questions`);
  });
  
  console.log("\n🚨 POTENTIAL ISSUES:");
  
  // Check for unexpected clarifications
  const unexpectedClarifications = results.filter(r => 
    r.isClarification && (
      r.question.includes('what is') || 
      r.question.includes('recommendations') ||
      r.question.includes('when is') ||
      r.question.includes('about alan')
    )
  );
  
  if (unexpectedClarifications.length > 0) {
    console.log(`  ${unexpectedClarifications.length} questions unexpectedly triggered clarification:`);
    unexpectedClarifications.forEach(r => {
      console.log(`    - "${r.question}" (${r.confidence}% confidence)`);
    });
  }
  
  // Check for missing answers
  const missingAnswers = results.filter(r => 
    !r.isClarification && !r.hasAnswer && !r.hasAnswerMarkdown && r.status !== 'ERROR'
  );
  
  if (missingAnswers.length > 0) {
    console.log(`  ${missingAnswers.length} questions returned no answer:`);
    missingAnswers.forEach(r => {
      console.log(`    - "${r.question}" (${r.type}, ${r.confidence}% confidence)`);
    });
  }
  
  // Check for errors
  if (errorCount > 0) {
    console.log(`  ${errorCount} questions failed with errors:`);
    results.filter(r => r.status === 'ERROR').forEach(r => {
      console.log(`    - "${r.question}": ${r.error}`);
    });
  }
  
  console.log("\n✅ Test completed!");
  return results;
}

// Run the comprehensive test
runComprehensiveTest().catch(console.error);
