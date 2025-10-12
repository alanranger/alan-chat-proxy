// Test script to compare JSON-LD data sources for chat bot performance
// Using built-in fetch

// Test questions that should benefit from JSON-LD FAQ data
const testQuestions = [
  "what is iso",
  "what is aperture", 
  "what is shutter speed",
  "what is raw photography",
  "what is depth of field",
  "how to use manual mode",
  "what is white balance",
  "what is exposure triangle",
  "what is focal length",
  "what is composition in photography",
  "what is macro photography",
  "what is landscape photography",
  "what is portrait photography",
  "what is street photography",
  "what is long exposure",
  "what is hdr photography",
  "what is bokeh",
  "what is histogram",
  "what is metering",
  "what is focus stacking"
];

async function testChatBot(question, sessionId) {
  try {
    const response = await fetch('https://chat-ai-bot-eta.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: question,
        sessionId: sessionId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      question: question,
      confidence: data.confidence || 0,
      intent: data.intent || 'unknown',
      answerLength: data.answer_markdown ? data.answer_markdown.length : 0,
      hasArticles: data.structured?.articles?.length > 0,
      hasPills: data.structured?.pills?.length > 0,
      debugInfo: data.debugInfo || []
    };
  } catch (error) {
    return {
      success: false,
      question: question,
      error: error.message
    };
  }
}

async function runComprehensiveTest() {
  console.log('=== JSON-LD SOURCE COMPARISON TEST ===\n');
  
  const results = [];
  const sessionId = 'test-session-' + Date.now();
  
  console.log(`Testing ${testQuestions.length} questions...\n`);
  
  for (let i = 0; i < testQuestions.length; i++) {
    const question = testQuestions[i];
    console.log(`[${i + 1}/${testQuestions.length}] Testing: "${question}"`);
    
    const result = await testChatBot(question, sessionId);
    results.push(result);
    
    if (result.success) {
      console.log(`  ✅ Confidence: ${result.confidence}, Intent: ${result.intent}, Answer: ${result.answerLength} chars`);
      if (result.debugInfo.length > 0) {
        console.log(`  🔍 Debug: ${result.debugInfo.join(', ')}`);
      }
    } else {
      console.log(`  ❌ Error: ${result.error}`);
    }
    
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Analyze results
  console.log('\n=== ANALYSIS ===');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`Total Questions: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  
  if (successful.length > 0) {
    const avgConfidence = successful.reduce((sum, r) => sum + r.confidence, 0) / successful.length;
    const avgAnswerLength = successful.reduce((sum, r) => sum + r.answerLength, 0) / successful.length;
    const hasArticlesCount = successful.filter(r => r.hasArticles).length;
    const hasPillsCount = successful.filter(r => r.hasPills).length;
    
    console.log(`\nAverage Confidence: ${avgConfidence.toFixed(2)}`);
    console.log(`Average Answer Length: ${avgAnswerLength.toFixed(0)} characters`);
    console.log(`Questions with Articles: ${hasArticlesCount}/${successful.length}`);
    console.log(`Questions with Pills: ${hasPillsCount}/${successful.length}`);
    
    // Intent breakdown
    const intentCounts = {};
    successful.forEach(r => {
      intentCounts[r.intent] = (intentCounts[r.intent] || 0) + 1;
    });
    console.log('\nIntent Breakdown:');
    Object.entries(intentCounts).forEach(([intent, count]) => {
      console.log(`  ${intent}: ${count}`);
    });
    
    // Low confidence questions
    const lowConfidence = successful.filter(r => r.confidence < 0.7);
    if (lowConfidence.length > 0) {
      console.log('\nLow Confidence Questions (< 0.7):');
      lowConfidence.forEach(r => {
        console.log(`  "${r.question}" - ${r.confidence}`);
      });
    }
    
    // Debug info analysis
    const debugInfoCounts = {};
    successful.forEach(r => {
      r.debugInfo.forEach(info => {
        debugInfoCounts[info] = (debugInfoCounts[info] || 0) + 1;
      });
    });
    if (Object.keys(debugInfoCounts).length > 0) {
      console.log('\nDebug Info Frequency:');
      Object.entries(debugInfoCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([info, count]) => {
          console.log(`  ${info}: ${count}`);
        });
    }
  }
  
  if (failed.length > 0) {
    console.log('\nFailed Questions:');
    failed.forEach(r => {
      console.log(`  "${r.question}" - ${r.error}`);
    });
  }
  
  console.log('\n=== RECOMMENDATIONS ===');
  
  if (successful.length > 0) {
    const avgConfidence = successful.reduce((sum, r) => sum + r.confidence, 0) / successful.length;
    
    if (avgConfidence < 0.7) {
      console.log('⚠️  Average confidence is low - JSON-LD extraction may not be working properly');
    } else if (avgConfidence < 0.8) {
      console.log('⚠️  Average confidence is moderate - some improvement needed');
    } else {
      console.log('✅ Average confidence is good');
    }
    
    const adviceQuestions = successful.filter(r => r.intent === 'advice');
    if (adviceQuestions.length > 0) {
      const avgAdviceConfidence = adviceQuestions.reduce((sum, r) => sum + r.confidence, 0) / adviceQuestions.length;
      console.log(`📚 Advice questions average confidence: ${avgAdviceConfidence.toFixed(2)}`);
      
      if (avgAdviceConfidence < 0.8) {
        console.log('🔧 Consider investigating JSON-LD data source for advice questions');
      }
    }
  }
}

// Run the test
runComprehensiveTest().catch(console.error);
