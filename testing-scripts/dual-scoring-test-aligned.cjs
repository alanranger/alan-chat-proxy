const http = require('http');
const fs = require('fs');
const path = require('path');

// User's scoring criteria from interactive testing analysis
const SCORING_CRITERIA = {
  botResponse: {
    // Bot Response Score: How good is the bot's initial answer? (0-100)
    // 100=Perfect direct answer, 50=Partial answer, 0=Wrong/no answer
    perfect: 100,      // Perfect direct answer, short and relevant
    good: 75,          // Good response but some issues
    partial: 50,        // Partial answer
    poor: 30,          // Shows article link instead of chat response
    wrong: 10,         // Wrong answer or very poor response
    none: 0            // No answer at all
  },
  relatedInfo: {
    // Related Score: How relevant are the articles/events shown? (0-100)
    // 100=All relevant, 50=Some relevant, 0=All irrelevant
    perfect: 100,      // Perfect, all relevant events/articles shown
    good: 75,          // Good articles but missing some expected ones
    partial: 50,       // Some relevant, some not
    poor: 30,          // Better articles available but not showing
    wrong: 10,         // Wrong articles or very poor selection
    none: 0            // No related information at all
  }
};

// Test questions with expected focus and category
const TEST_QUESTIONS = [
  {
    question: "what is exposure triangle",
    category: "Technical Photography Concepts",
    focus: "Should explain the relationship between aperture, shutter speed, and ISO",
    expectedBotResponse: "perfect", // User scored 100
    expectedRelatedInfo: "none"      // User scored 0
  },
  {
    question: "what is iso",
    category: "Technical Photography Concepts", 
    focus: "Should explain ISO sensitivity and its role in exposure",
    expectedBotResponse: "poor",    // User scored 30 (article link)
    expectedRelatedInfo: "good"     // User scored 75
  },
  {
    question: "what is aperture",
    category: "Technical Photography Concepts",
    focus: "Should explain aperture, f-stops, and depth of field", 
    expectedBotResponse: "poor",    // User scored 30 (article link)
    expectedRelatedInfo: "good"     // User scored 75
  },
  {
    question: "what is shutter speed",
    category: "Technical Photography Concepts",
    focus: "Should explain shutter speed and motion control",
    expectedBotResponse: "poor",    // User scored 30 (article link)
    expectedRelatedInfo: "partial"  // User scored 50
  },
  {
    question: "what tripod do you recommend",
    category: "Equipment Recommendations",
    focus: "Should provide specific tripod recommendations with reasoning",
    expectedBotResponse: "perfect", // User scored 100
    expectedRelatedInfo: "perfect"  // User scored 100
  },
  {
    question: "what camera should I buy",
    category: "Equipment Recommendations",
    focus: "Should provide camera recommendations based on needs",
    expectedBotResponse: "good",    // User scored 75
    expectedRelatedInfo: "wrong"    // User scored 10
  },
  {
    question: "what camera do you recommend for a beginner",
    category: "Equipment Recommendations",
    focus: "Should provide beginner camera recommendations",
    expectedBotResponse: "good",    // User scored 75
    expectedRelatedInfo: "wrong"    // User scored 10
  },
  {
    question: "peter orton",
    category: "Person Queries",
    focus: "Should find Peter Orton article and connect to related RPS content",
    expectedBotResponse: "good",    // User scored 75
    expectedRelatedInfo: "good"     // User scored 75
  },
  {
    question: "who is alan ranger",
    category: "Person Queries",
    focus: "Should provide biographical information about Alan",
    expectedBotResponse: "perfect", // User scored 100
    expectedRelatedInfo: "wrong"    // User scored 10
  },
  {
    question: "when is your next devon workshop",
    category: "Event Queries",
    focus: "Should list Devon workshops with dates and details",
    expectedBotResponse: "good",    // User scored 75
    expectedRelatedInfo: "perfect"  // User scored 100
  },
  {
    question: "when is your next photography course",
    category: "Event Queries",
    focus: "Should list photography courses with dates",
    expectedBotResponse: "wrong",   // User scored 10
    expectedRelatedInfo: "poor"     // User scored 30
  },
  {
    question: "when are your next bluebell workshops",
    category: "Event Queries",
    focus: "Should list bluebell workshop dates",
    expectedBotResponse: "perfect", // User scored 100
    expectedRelatedInfo: "perfect"  // User scored 100
  },
  {
    question: "do you have autumn workshops",
    category: "Event Queries",
    focus: "Should list autumn workshop options",
    expectedBotResponse: "perfect", // User scored 100
    expectedRelatedInfo: "good"    // User scored 75
  },
  {
    question: "how to take sharp photos",
    category: "Technical Advice",
    focus: "Should provide practical tips for sharp photography",
    expectedBotResponse: "perfect", // User scored 100
    expectedRelatedInfo: "wrong"    // User scored 10
  },
  {
    question: "what is long exposure photography",
    category: "Technical Photography Concepts",
    focus: "Should explain long exposure techniques and applications",
    expectedBotResponse: "good",    // User scored 75
    expectedRelatedInfo: "good"    // User scored 75
  },
  {
    question: "do I need a laptop for lightroom course",
    category: "Course Requirements",
    focus: "Should answer equipment requirements for the course",
    expectedBotResponse: "partial", // User scored 50
    expectedRelatedInfo: "partial" // User scored 50
  },
  {
    question: "do you provide photography courses",
    category: "Service Queries",
    focus: "Should list available photography courses",
    expectedBotResponse: "wrong",  // User scored 20
    expectedRelatedInfo: "none"    // User scored 0
  },
  {
    question: "do you have online lessons",
    category: "Service Queries",
    focus: "Should mention online lesson options",
    expectedBotResponse: "partial", // User scored 50
    expectedRelatedInfo: "partial"  // User scored 50
  },
  {
    question: "where i can see your terms and conditions",
    category: "Policy Queries",
    focus: "Should provide terms and conditions information",
    expectedBotResponse: "partial", // User scored 50
    expectedRelatedInfo: "none"    // User scored 0
  },
  {
    question: "tell me about rps mentoring",
    category: "Service Queries",
    focus: "Should explain RPS mentoring services",
    expectedBotResponse: "poor",   // User scored 40
    expectedRelatedInfo: "none"    // User scored 0
  },
  {
    question: "do you have a lightroom course",
    category: "Service Queries",
    focus: "Should list Lightroom course options",
    expectedBotResponse: "perfect", // User scored 100
    expectedRelatedInfo: "partial"  // User scored 50
  },
  {
    question: "do you do commercial photography",
    category: "Service Queries",
    focus: "Should explain commercial photography services",
    expectedBotResponse: "good",    // User scored 75
    expectedRelatedInfo: "none"    // User scored 0
  },
  {
    question: "do you do portrait photography",
    category: "Service Queries",
    focus: "Should explain portrait photography services",
    expectedBotResponse: "good",    // User scored 75
    expectedRelatedInfo: "none"    // User scored 0
  },
  {
    question: "why are my images always grainy and noisy",
    category: "Technical Advice",
    focus: "Should provide solutions for grainy/noisy images",
    expectedBotResponse: "good",    // User scored 75
    expectedRelatedInfo: "partial"  // User scored 50
  },
  {
    question: "why arent my images sharp",
    category: "Technical Advice",
    focus: "Should provide tips for sharper images",
    expectedBotResponse: "good",    // User scored 75
    expectedRelatedInfo: "partial"  // User scored 50
  },
  {
    question: "what camera do i need for your courses and workshops",
    category: "Course Requirements",
    focus: "Should specify camera requirements for courses",
    expectedBotResponse: "good",    // User scored 75
    expectedRelatedInfo: "good"    // User scored 75
  },
  {
    question: "what camera do you recommend for a beginner",
    category: "Equipment Recommendations",
    focus: "Should provide beginner camera recommendations",
    expectedBotResponse: "good",    // User scored 75
    expectedRelatedInfo: "wrong"    // User scored 10
  },
  {
    question: "whats your online photography course",
    category: "Service Queries",
    focus: "Should describe online course offerings",
    expectedBotResponse: "wrong",  // User scored 20
    expectedRelatedInfo: "none"    // User scored 0
  },
  {
    question: "is your photography academy really free",
    category: "Service Queries",
    focus: "Should clarify free vs paid academy content",
    expectedBotResponse: "good",    // User scored 75
    expectedRelatedInfo: "none"    // User scored 0
  }
];

function testQuery(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: query,
      sessionId: 'dual-scoring-test-' + Date.now()
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);
          resolve({
            query,
            status: res.statusCode,
            answer: response.answer,
            answer_markdown: response.answer_markdown,
            type: response.type,
            confidence: response.confidence,
            sources: response.sources,
            structured: response.structured
          });
        } catch (e) {
          resolve({
            query,
            status: res.statusCode,
            error: e.message,
            rawResponse: responseData
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        query,
        error: e.message
      });
    });

    req.write(postData);
    req.end();
  });
}

// Automated scoring functions that match user's criteria
function scoreBotResponse(response, query, expectedLevel) {
  const answer = response.answer || '';
  const answerMarkdown = response.answer_markdown || '';
  
  // Check for article links instead of direct answers
  if (answer.includes('http') || answer.includes('www') || answer.includes('[Article]')) {
    return SCORING_CRITERIA.botResponse.poor; // 30 - shows article link
  }
  
  // Check for direct formatted answers (like "**ISO** (International Organization...")
  if (answer.includes('**') && answer.length > 50) {
    return SCORING_CRITERIA.botResponse.perfect; // 100 - perfect direct answer
  }
  
  // Check for good responses
  if (answer.length > 100 && !answer.includes('http')) {
    return SCORING_CRITERIA.botResponse.good; // 75 - good response
  }
  
  // Check for partial answers
  if (answer.length > 50) {
    return SCORING_CRITERIA.botResponse.partial; // 50 - partial answer
  }
  
  // Check for poor responses
  if (answer.length > 20) {
    return SCORING_CRITERIA.botResponse.poor; // 30 - poor response
  }
  
  // No answer
  return SCORING_CRITERIA.botResponse.none; // 0 - no answer
}

function scoreRelatedInfo(response, query, expectedLevel) {
  const sources = response.sources || {};
  const structured = response.structured || {};
  
  const articles = sources.articles || structured.articles || [];
  const events = sources.events || structured.events || [];
  
  const totalRelated = articles.length + events.length;
  
  // No related information
  if (totalRelated === 0) {
    return SCORING_CRITERIA.relatedInfo.none; // 0
  }
  
  // Perfect related information (many relevant items)
  if (totalRelated >= 5) {
    return SCORING_CRITERIA.relatedInfo.perfect; // 100
  }
  
  // Good related information (some relevant items)
  if (totalRelated >= 3) {
    return SCORING_CRITERIA.relatedInfo.good; // 75
  }
  
  // Partial related information (few items)
  if (totalRelated >= 1) {
    return SCORING_CRITERIA.relatedInfo.partial; // 50
  }
  
  return SCORING_CRITERIA.relatedInfo.none; // 0
}

function calculateCombinedScore(botScore, relatedScore) {
  // Weighted combination: 60% bot response, 40% related info
  return Math.round((botScore * 0.6) + (relatedScore * 0.4));
}

function determinePassFail(combinedScore) {
  // Pass threshold: 70+ (matching user's criteria)
  return combinedScore >= 70 ? 'Pass' : 'Fail';
}

async function runDualScoringTest() {
  console.log('🎯 DUAL SCORING TEST - Matching User\'s Manual Assessment');
  console.log('============================================================\n');
  
  const results = [];
  let totalPassed = 0;
  let totalFailed = 0;
  
  for (const testCase of TEST_QUESTIONS) {
    console.log(`📝 Testing: "${testCase.question}"`);
    console.log(`   Category: ${testCase.category}`);
    console.log(`   Focus: ${testCase.focus}`);
    
    const response = await testQuery(testCase.question);
    
    if (response.status === 200) {
      // Score bot response
      const botScore = scoreBotResponse(response, testCase.question, testCase.expectedBotResponse);
      
      // Score related information
      const relatedScore = scoreRelatedInfo(response, testCase.question, testCase.expectedRelatedInfo);
      
      // Calculate combined score
      const combinedScore = calculateCombinedScore(botScore, relatedScore);
      
      // Determine pass/fail
      const status = determinePassFail(combinedScore);
      
      if (status === 'Pass') totalPassed++;
      else totalFailed++;
      
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   🤖 Bot Response Score: ${botScore}/100 (Expected: ${SCORING_CRITERIA.botResponse[testCase.expectedBotResponse]})`);
      console.log(`   📚 Related Info Score: ${relatedScore}/100 (Expected: ${SCORING_CRITERIA.relatedInfo[testCase.expectedRelatedInfo]})`);
      console.log(`   🎯 Combined Score: ${combinedScore}/100`);
      console.log(`   📊 Result: ${status}`);
      
      // Show answer preview
      if (response.answer) {
        const preview = response.answer.substring(0, 100) + '...';
        console.log(`   📝 Answer Preview: ${preview}`);
      }
      
      // Show related info count
      const articles = (response.sources?.articles || []).length;
      const events = (response.sources?.events || []).length;
      console.log(`   📚 Related: ${articles} articles, ${events} events`);
      
      results.push({
        question: testCase.question,
        category: testCase.category,
        focus: testCase.focus,
        status: status,
        botResponseScore: botScore,
        relatedInfoScore: relatedScore,
        combinedScore: combinedScore,
        expectedBotResponse: testCase.expectedBotResponse,
        expectedRelatedInfo: testCase.expectedRelatedInfo,
        actualBotResponse: response.answer,
        actualRelatedInfo: {
          articles: response.sources?.articles || [],
          events: response.sources?.events || []
        },
        confidence: response.confidence,
        timestamp: new Date().toISOString()
      });
      
    } else {
      console.log(`   ❌ Status: ${response.status}`);
      console.log(`   Error: ${response.error || 'Unknown error'}`);
      totalFailed++;
      
      results.push({
        question: testCase.question,
        category: testCase.category,
        focus: testCase.focus,
        status: 'Fail',
        botResponseScore: 0,
        relatedInfoScore: 0,
        combinedScore: 0,
        error: response.error || 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log('');
  }
  
  // Summary
  console.log('📊 DUAL SCORING TEST RESULTS');
  console.log('============================================================');
  console.log(`✅ Tests Passed: ${totalPassed}/${TEST_QUESTIONS.length} (${Math.round(totalPassed/TEST_QUESTIONS.length*100)}%)`);
  console.log(`❌ Tests Failed: ${totalFailed}/${TEST_QUESTIONS.length} (${Math.round(totalFailed/TEST_QUESTIONS.length*100)}%)`);
  
  // Calculate average scores
  const avgBotScore = results.reduce((sum, r) => sum + r.botResponseScore, 0) / results.length;
  const avgRelatedScore = results.reduce((sum, r) => sum + r.relatedInfoScore, 0) / results.length;
  const avgCombinedScore = results.reduce((sum, r) => sum + r.combinedScore, 0) / results.length;
  
  console.log(`🤖 Average Bot Response Score: ${Math.round(avgBotScore)}/100`);
  console.log(`📚 Average Related Info Score: ${Math.round(avgRelatedScore)}/100`);
  console.log(`🎯 Average Combined Score: ${Math.round(avgCombinedScore)}/100`);
  
  // Save results
  const resultsDir = path.join(__dirname, 'test results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString();
  const filename = path.join(resultsDir, `dual-scoring-test-${timestamp}.json`);
  
  const output = {
    testType: 'dual-scoring-test',
    timestamp: timestamp,
    summary: {
      totalQuestions: TEST_QUESTIONS.length,
      passed: totalPassed,
      failed: totalFailed,
      passRate: Math.round(totalPassed/TEST_QUESTIONS.length*100),
      averageBotScore: Math.round(avgBotScore),
      averageRelatedScore: Math.round(avgRelatedScore),
      averageCombinedScore: Math.round(avgCombinedScore)
    },
    results: results
  };
  
  fs.writeFileSync(filename, JSON.stringify(output, null, 2));
  console.log(`💾 Results saved to: ${filename}`);
  
  return output;
}

runDualScoringTest().catch(console.error);
