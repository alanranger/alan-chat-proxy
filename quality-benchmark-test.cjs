const http = require('http');
const fs = require('fs');

// Quality assessment criteria
const QUALITY_CRITERIA = {
  RELEVANCE: 'relevance',           // Does the answer directly address the question?
  COMPLETENESS: 'completeness',     // Is the answer complete and informative?
  ACCURACY: 'accuracy',            // Is the information accurate and helpful?
  STRUCTURE: 'structure',           // Is the response well-structured?
  ACTIONABILITY: 'actionability'    // Does it provide actionable information?
};

// Test questions covering different query types and quality aspects
const TEST_QUESTIONS = [
  // Technical photography concepts
  { query: "what is exposure triangle", expectedType: "advice", qualityFocus: "Should explain the relationship between aperture, shutter speed, and ISO" },
  { query: "what is iso", expectedType: "advice", qualityFocus: "Should explain ISO sensitivity and its role in exposure" },
  { query: "what is aperture", expectedType: "advice", qualityFocus: "Should explain aperture, f-stops, and depth of field" },
  { query: "what is shutter speed", expectedType: "advice", qualityFocus: "Should explain shutter speed and motion control" },
  
  // Equipment recommendations
  { query: "what tripod do you recommend", expectedType: "advice", qualityFocus: "Should provide specific tripod recommendations with reasoning" },
  { query: "what camera should I buy", expectedType: "advice", qualityFocus: "Should provide camera recommendations based on needs" },
  
  // Person queries
  { query: "peter orton", expectedType: "advice", qualityFocus: "Should find Peter Orton article and connect to related RPS content" },
  { query: "who is alan ranger", expectedType: "advice", qualityFocus: "Should provide biographical information about Alan" },
  
  // Event queries
  { query: "when is your next devon workshop", expectedType: "events", qualityFocus: "Should list Devon workshops with dates and details" },
  { query: "when is your next photography course", expectedType: "events", qualityFocus: "Should list photography courses with dates" },
  
  // Technical advice
  { query: "how to take sharp photos", expectedType: "advice", qualityFocus: "Should provide practical tips for sharp photography" },
  { query: "what is long exposure photography", expectedType: "advice", qualityFocus: "Should explain long exposure techniques and applications" },
  
  // Course/workshop logistics
  { query: "do I need a laptop for lightroom course", expectedType: "advice", qualityFocus: "Should answer equipment requirements for the course" },
  
  // NEW REALISTIC QUESTIONS
  { query: "do you provide photography courses", expectedType: "advice", qualityFocus: "Should list available photography courses" },
  { query: "do you have online lessons", expectedType: "advice", qualityFocus: "Should mention online lesson options" },
  { query: "where i can see your terms and conditions", expectedType: "advice", qualityFocus: "Should provide terms and conditions information" },
  { query: "when are your next bluebell workshops", expectedType: "events", qualityFocus: "Should list bluebell workshop dates" },
  { query: "do you have autumn workshops", expectedType: "events", qualityFocus: "Should list autumn workshop options" },
  { query: "tell me about rps mentoring", expectedType: "advice", qualityFocus: "Should explain RPS mentoring services" },
  { query: "do you have a lightroom course", expectedType: "advice", qualityFocus: "Should list Lightroom course options" },
  { query: "do you do commercial photography", expectedType: "advice", qualityFocus: "Should explain commercial photography services" },
  { query: "do you do portrait photography", expectedType: "advice", qualityFocus: "Should explain portrait photography services" },
  { query: "why are my images always grainy and noisy", expectedType: "advice", qualityFocus: "Should provide solutions for grainy/noisy images" },
  { query: "why arent my images sharp", expectedType: "advice", qualityFocus: "Should provide tips for sharper images" },
  { query: "what camera do i need for your courses and workshops", expectedType: "advice", qualityFocus: "Should specify camera requirements for courses" },
  { query: "what camera do you recommend for a beginner", expectedType: "advice", qualityFocus: "Should provide beginner camera recommendations" },
  { query: "whats your online photography course", expectedType: "advice", qualityFocus: "Should describe online course offerings" },
  { query: "is your photography academy really free", expectedType: "advice", qualityFocus: "Should clarify free vs paid academy content" }
];

async function testQuery(query, expectedType, qualityFocus) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: query,
      sessionId: 'quality-test-session'
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
          const qualityAssessment = assessResponseQuality(response, query, expectedType, qualityFocus);
          
          resolve({
            query,
            expectedType,
            qualityFocus,
            status: res.statusCode,
            response: response,
            quality: qualityAssessment
          });
        } catch (e) {
          resolve({
            query,
            expectedType,
            qualityFocus,
            status: res.statusCode,
            error: e.message,
            quality: { overall: 0, issues: ['Parse error'] }
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        query,
        expectedType,
        qualityFocus,
        error: e.message,
        quality: { overall: 0, issues: ['Network error'] }
      });
    });

    req.write(postData);
    req.end();
  });
}

function assessResponseQuality(response, query, expectedType, qualityFocus) {
  const issues = [];
  let score = 0;
  let maxScore = 100;

  // Check if we got a response
  if (!response.ok) {
    issues.push('No response received');
    return { overall: 0, issues, breakdown: {} };
  }

  // 1. RELEVANCE (25 points)
  const relevanceScore = assessRelevance(response, query, qualityFocus);
  score += relevanceScore;
  if (relevanceScore < 20) issues.push('Poor relevance to question');

  // 2. COMPLETENESS (25 points)
  const completenessScore = assessCompleteness(response, expectedType);
  score += completenessScore;
  if (completenessScore < 20) issues.push('Incomplete response');

  // 3. ACCURACY (20 points)
  const accuracyScore = assessAccuracy(response);
  score += accuracyScore;
  if (accuracyScore < 15) issues.push('Accuracy concerns');

  // 4. STRUCTURE (15 points)
  const structureScore = assessStructure(response);
  score += structureScore;
  if (structureScore < 10) issues.push('Poor structure');

  // 5. ACTIONABILITY (15 points)
  const actionabilityScore = assessActionability(response, query);
  score += actionabilityScore;
  if (actionabilityScore < 10) issues.push('Not actionable');

  return {
    overall: Math.round(score),
    issues,
    breakdown: {
      relevance: relevanceScore,
      completeness: completenessScore,
      accuracy: accuracyScore,
      structure: structureScore,
      actionability: actionabilityScore
    }
  };
}

function assessRelevance(response, query, qualityFocus) {
  let score = 0;
  
  // Handle different response types
  let answer = '';
  if (Array.isArray(response.answer)) {
    // For event queries, answer is an array of events
    answer = response.answer_markdown || response.answer.map(e => e.title || e.event_title || '').join(' ');
  } else if (typeof response.answer === 'string') {
    answer = response.answer;
  } else if (response.answer_markdown) {
    // Use answer_markdown if available (for event responses)
    answer = response.answer_markdown;
  } else {
    answer = '';
  }
  
  const queryLower = query.toLowerCase();
  
  // Check if answer directly addresses the question
  if (answer.length > 50) score += 10;
  if (answer.length > 200) score += 5;
  
  // Check for key terms from the query
  const queryWords = queryLower.split(' ').filter(w => w.length > 2);
  const answerLower = answer.toLowerCase();
  
  let matchedWords = 0;
  queryWords.forEach(word => {
    if (answerLower.includes(word)) matchedWords++;
  });
  
  score += (matchedWords / queryWords.length) * 10;
  
  // Check if answer matches the quality focus
  if (qualityFocus && answerLower.includes(qualityFocus.toLowerCase().split(' ')[0])) {
    score += 5;
  }
  
  return Math.min(25, score);
}

function assessCompleteness(response, expectedType) {
  let score = 0;
  
  // Handle different response types
  let answer = '';
  if (Array.isArray(response.answer)) {
    // For event queries, answer is an array of events
    answer = response.answer_markdown || response.answer.map(e => e.title || e.event_title || '').join(' ');
  } else if (typeof response.answer === 'string') {
    answer = response.answer;
  } else if (response.answer_markdown) {
    // Use answer_markdown if available (for event responses)
    answer = response.answer_markdown;
  } else {
    answer = '';
  }
  
  // Basic completeness
  if (answer.length > 100) score += 10;
  if (answer.length > 300) score += 5;
  
  // Type-specific completeness
  if (expectedType === 'events') {
    const hasEvents = response.structured?.events?.length > 0;
    if (hasEvents) score += 10;
  } else if (expectedType === 'advice') {
    const hasArticles = response.structured?.articles?.length > 0;
    if (hasArticles) score += 10;
  }
  
  // Check for structured content
  if (response.structured) score += 5;
  
  return Math.min(25, score);
}

function assessAccuracy(response) {
  let score = 15; // Start with base score
  
  // Handle different response types
  let answer = '';
  if (Array.isArray(response.answer)) {
    // For event queries, answer is an array of events
    answer = response.answer_markdown || response.answer.map(e => e.title || e.event_title || '').join(' ');
  } else if (typeof response.answer === 'string') {
    answer = response.answer;
  } else if (response.answer_markdown) {
    // Use answer_markdown if available (for event responses)
    answer = response.answer_markdown;
  } else {
    answer = '';
  }
  
  // Check for generic responses
  if (answer.includes('Based on Alan Ranger\'s expertise')) {
    score -= 5; // Generic response penalty
  }
  
  // Check for technical accuracy indicators
  if (answer.includes('f/') || answer.includes('ISO') || answer.includes('shutter')) {
    score += 5; // Technical content bonus
  }
  
  return Math.min(20, Math.max(0, score));
}

function assessStructure(response) {
  let score = 0;
  
  // Handle different response types
  let answer = '';
  if (Array.isArray(response.answer)) {
    // For event queries, answer is an array of events
    answer = response.answer_markdown || response.answer.map(e => e.title || e.event_title || '').join(' ');
  } else if (typeof response.answer === 'string') {
    answer = response.answer;
  } else if (response.answer_markdown) {
    // Use answer_markdown if available (for event responses)
    answer = response.answer_markdown;
  } else {
    answer = '';
  }
  
  // Check for proper formatting
  if (answer.includes('\n')) score += 5; // Has line breaks
  if (answer.includes('•') || answer.includes('-')) score += 5; // Has bullet points
  if (answer.length > 200 && answer.length < 1000) score += 5; // Good length
  
  return Math.min(15, score);
}

function assessActionability(response, query) {
  let score = 0;
  
  // Handle different response types
  let answer = '';
  if (Array.isArray(response.answer)) {
    // For event queries, answer is an array of events
    answer = response.answer_markdown || response.answer.map(e => e.title || e.event_title || '').join(' ');
  } else if (typeof response.answer === 'string') {
    answer = response.answer;
  } else if (response.answer_markdown) {
    // Use answer_markdown if available (for event responses)
    answer = response.answer_markdown;
  } else {
    answer = '';
  }
  
  // Check for actionable content
  if (answer.includes('how to') || answer.includes('steps') || answer.includes('tips')) {
    score += 5;
  }
  
  // Check for specific recommendations
  if (answer.includes('recommend') || answer.includes('suggest')) {
    score += 5;
  }
  
  // Check for practical advice
  if (answer.includes('try') || answer.includes('use') || answer.includes('set')) {
    score += 5;
  }
  
  return Math.min(15, score);
}

async function runQualityBenchmark() {
  console.log('🔍 QUALITY BENCHMARK TEST - BEFORE IMPROVEMENTS');
  console.log('='.repeat(60));
  
  const results = [];
  let totalScore = 0;
  let totalTests = TEST_QUESTIONS.length;
  
  for (const testCase of TEST_QUESTIONS) {
    console.log(`\n📝 Testing: "${testCase.query}"`);
    console.log(`   Focus: ${testCase.qualityFocus}`);
    
    try {
      const result = await testQuery(testCase.query, testCase.expectedType, testCase.qualityFocus);
      results.push(result);
      
      const quality = result.quality;
      totalScore += quality.overall;
      
      console.log(`   ✅ Status: ${result.status}`);
      console.log(`   📊 Quality Score: ${quality.overall}/100`);
      console.log(`   📝 Answer Length: ${result.response?.answer?.length || 0} chars`);
      console.log(`   📚 Articles: ${result.response?.structured?.articles?.length || 0}`);
      console.log(`   📅 Events: ${result.response?.structured?.events?.length || 0}`);
      
      if (quality.issues.length > 0) {
        console.log(`   ⚠️  Issues: ${quality.issues.join(', ')}`);
      }
      
      // Show quality breakdown
      console.log(`   📈 Breakdown: R:${quality.breakdown.relevance} C:${quality.breakdown.completeness} A:${quality.breakdown.accuracy} S:${quality.breakdown.structure} Ac:${quality.breakdown.actionability}`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.push({
        query: testCase.query,
        error: error.message,
        quality: { overall: 0, issues: ['Test error'] }
      });
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const averageScore = Math.round(totalScore / totalTests);
  
  // Calculate quality score distribution using Alan's benchmarks
  const perfectScores = results.filter(r => r.quality.overall >= 95).length;
  const nearlyPerfectScores = results.filter(r => r.quality.overall >= 90 && r.quality.overall < 95).length;
  const veryGoodScores = results.filter(r => r.quality.overall >= 75 && r.quality.overall < 90).length;
  const goodScores = results.filter(r => r.quality.overall >= 50 && r.quality.overall < 75).length;
  const poorScores = results.filter(r => r.quality.overall >= 30 && r.quality.overall < 50).length;
  const veryPoorScores = results.filter(r => r.quality.overall < 30).length;
  
  console.log(`\n📊 BENCHMARK RESULTS - ALAN'S QUALITY DISTRIBUTION`);
  console.log('='.repeat(60));
  console.log(`📈 Average Quality Score: ${averageScore}/100`);
  console.log(`🎯 Alan's Baseline: 52/100 (from manual testing)`);
  console.log(`📊 Quality Distribution:`);
  console.log(`   Perfect (95-100):     ${perfectScores}/${totalTests} (${Math.round(perfectScores/totalTests*100)}%)`);
  console.log(`   Nearly Perfect (90-94): ${nearlyPerfectScores}/${totalTests} (${Math.round(nearlyPerfectScores/totalTests*100)}%)`);
  console.log(`   Very Good (75-89):    ${veryGoodScores}/${totalTests} (${Math.round(veryGoodScores/totalTests*100)}%)`);
  console.log(`   Good (50-74):         ${goodScores}/${totalTests} (${Math.round(goodScores/totalTests*100)}%)`);
  console.log(`   Poor (30-49):         ${poorScores}/${totalTests} (${Math.round(poorScores/totalTests*100)}%)`);
  console.log(`   Very Poor (0-29):     ${veryPoorScores}/${totalTests} (${Math.round(veryPoorScores/totalTests*100)}%)`);
  console.log(`🎯 Target: 15+ perfect (50%+), <3 very poor (10% or less)`);
  console.log(`✅ Tests Passed (70+): ${results.filter(r => r.quality.overall >= 70).length}/${totalTests}`);
  console.log(`❌ Tests Failed (<70): ${results.filter(r => r.quality.overall < 70).length}/${totalTests}`);
  
  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = `results/quality-benchmark-before-${timestamp}.json`;
  
  const benchmarkResults = {
    timestamp: new Date().toISOString(),
    phase: 'before_improvements',
    averageScore,
    alanBaseline: 52, // Alan's manual testing baseline
    totalTests,
    passedTests: results.filter(r => r.quality.overall >= 70).length,
    failedTests: results.filter(r => r.quality.overall < 70).length,
    qualityDistribution: {
      perfect: perfectScores,
      nearlyPerfect: nearlyPerfectScores,
      veryGood: veryGoodScores,
      good: goodScores,
      poor: poorScores,
      veryPoor: veryPoorScores
    },
    targets: {
      perfectTarget: 15, // 50%+ perfect scores
      veryPoorTarget: 3, // <10% very poor scores
      averageTarget: 80  // 80+ average score
    },
    results: results
  };
  
  // Ensure results directory exists
  if (!fs.existsSync('results')) {
    fs.mkdirSync('results');
  }
  
  fs.writeFileSync(resultsFile, JSON.stringify(benchmarkResults, null, 2));
  console.log(`💾 Results saved to: ${resultsFile}`);
  
  // Run regression analysis if baseline exists
  const baselineFile = 'results/quality-benchmark-before-2025-10-22T17-04-41-287Z.json';
  if (fs.existsSync(baselineFile)) {
    console.log('\n🔍 COMPREHENSIVE REGRESSION ANALYSIS');
    console.log('====================================');
    
    try {
      const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
      console.log(`Baseline: ${baseline.passedTests}/${baseline.totalTests} passed (${baseline.averageScore}/100)`);
      console.log(`Current:  ${benchmarkResults.passedTests}/${benchmarkResults.totalTests} passed (${benchmarkResults.averageScore}/100)`);
      console.log('');
      
      const regressions = [];
      const improvements = [];
      const unchanged = [];
      
      baseline.results.forEach((baselineResult, index) => {
        const currentResult = benchmarkResults.results[index];
        if (!currentResult) return;
        
        const baselinePassed = baselineResult.quality.overall >= 70;
        const currentPassed = currentResult.quality.overall >= 70;
        const scoreDiff = currentResult.quality.overall - baselineResult.quality.overall;
        
        if (baselinePassed && !currentPassed) {
          regressions.push({
            query: baselineResult.query,
            baselineScore: baselineResult.quality.overall,
            currentScore: currentResult.quality.overall,
            diff: scoreDiff
          });
        } else if (!baselinePassed && currentPassed) {
          improvements.push({
            query: baselineResult.query,
            baselineScore: baselineResult.quality.overall,
            currentScore: currentResult.quality.overall,
            diff: scoreDiff
          });
        } else if (Math.abs(scoreDiff) >= 5) {
          unchanged.push({
            query: baselineResult.query,
            baselineScore: baselineResult.quality.overall,
            currentScore: currentResult.quality.overall,
            diff: scoreDiff
          });
        }
      });
      
      console.log('📉 REGRESSIONS (Passed → Failed):');
      regressions.forEach(r => console.log(`  ❌ "${r.query}" ${r.baselineScore}→${r.currentScore} (${r.diff})`));
      
      console.log('📈 IMPROVEMENTS (Failed → Passed):');
      improvements.forEach(i => console.log(`  ✅ "${i.query}" ${i.baselineScore}→${i.currentScore} (+${i.diff})`));
      
      console.log('📊 SIGNIFICANT CHANGES (≥5 points):');
      unchanged.forEach(u => console.log(`  🔄 "${u.query}" ${u.baselineScore}→${u.currentScore} (${u.diff > 0 ? '+' : ''}${u.diff})`));
      
      console.log('');
      console.log(`Total Regressions: ${regressions.length}`);
      console.log(`Total Improvements: ${improvements.length}`);
      console.log(`Total Significant Changes: ${unchanged.length}`);
      
      if (regressions.length > 0) {
        console.log('\n⚠️  WARNING: Regressions detected! Review changes before proceeding.');
      } else {
        console.log('\n✅ No regressions detected. Safe to proceed.');
      }
      
    } catch (error) {
      console.log(`❌ Regression analysis failed: ${error.message}`);
    }
  } else {
    console.log('\n📝 No baseline found for comparison. This will be used as the new baseline.');
  }
  
  return benchmarkResults;
}

// Run the benchmark
runQualityBenchmark().catch(console.error);
