import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/chat';

// Expanded test suite covering more question types
const testQuestions = [
  // About Alan queries
  { query: "who is alan ranger", expected: "about", category: "About Alan" },
  { query: "tell me about alan", expected: "about", category: "About Alan" },
  { query: "alan ranger background", expected: "about", category: "About Alan" },
  
  // Equipment recommendations
  { query: "what tripod do you recommend", expected: "equipment", category: "Equipment" },
  { query: "best camera for beginners", expected: "equipment", category: "Equipment" },
  { query: "what lens should I buy", expected: "equipment", category: "Equipment" },
  { query: "camera bag recommendations", expected: "equipment", category: "Equipment" },
  
  // Technical photography advice
  { query: "how to use aperture", expected: "technical", category: "Technical" },
  { query: "what is ISO", expected: "technical", category: "Technical" },
  { query: "shutter speed explained", expected: "technical", category: "Technical" },
  { query: "composition tips", expected: "technical", category: "Technical" },
  { query: "exposure triangle", expected: "technical", category: "Technical" },
  
  // Course/workshop queries
  { query: "photo editing courses", expected: "events", category: "Courses" },
  { query: "when is your next wales workshop", expected: "events", category: "Workshops" },
  { query: "devon photography workshop", expected: "events", category: "Workshops" },
  { query: "yorkshire photography course", expected: "events", category: "Workshops" },
  { query: "lightroom course", expected: "events", category: "Courses" },
  { query: "beginner photography classes", expected: "events", category: "Courses" },
  
  // Business/policy queries
  { query: "do you provide refunds", expected: "policy", category: "Business" },
  { query: "cancellation policy", expected: "policy", category: "Business" },
  { query: "booking process", expected: "policy", category: "Business" },
  { query: "private lessons", expected: "service", category: "Business" },
  { query: "gift vouchers", expected: "service", category: "Business" },
  
  // Location-specific queries
  { query: "photography courses coventry", expected: "events", category: "Location" },
  { query: "workshops near me", expected: "events", category: "Location" },
  { query: "photography classes warwickshire", expected: "events", category: "Location" },
  
  // General advice
  { query: "photography tips", expected: "advice", category: "General" },
  { query: "how to improve my photography", expected: "advice", category: "General" },
  { query: "best time to photograph", expected: "advice", category: "General" },
  
  // Specific techniques
  { query: "macro photography tips", expected: "technical", category: "Techniques" },
  { query: "landscape photography", expected: "technical", category: "Techniques" },
  { query: "portrait photography", expected: "technical", category: "Techniques" },
  
  // Pricing/cost queries
  { query: "how much do courses cost", expected: "pricing", category: "Business" },
  { query: "workshop prices", expected: "pricing", category: "Business" },
  { query: "private lesson rates", expected: "pricing", category: "Business" }
];

// Expected keywords for each category
const expectedKeywords = {
  about: ["alan", "ranger", "photographer", "qualified", "experience", "background"],
  equipment: ["tripod", "camera", "lens", "recommend", "best", "equipment"],
  technical: ["aperture", "iso", "shutter", "exposure", "composition", "technique"],
  events: ["course", "workshop", "class", "event", "date", "time", "location"],
  policy: ["refund", "cancellation", "policy", "booking", "terms"],
  service: ["private", "lesson", "voucher", "service", "tuition"],
  advice: ["tip", "advice", "improve", "help", "guidance"],
  pricing: ["cost", "price", "rate", "fee", "charge"]
};

// Minimum expected lengths for each category
const minLengths = {
  about: 200,
  equipment: 300,
  technical: 200,
  events: 100,
  policy: 150,
  service: 150,
  advice: 200,
  pricing: 100
};

async function testQuery(testCase) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: testCase.query })
    });
    
    const data = await response.json();
    
    // Basic response validation
    if (!data || typeof data !== 'object') {
      return {
        ...testCase,
        error: 'Invalid response format',
        score: 0
      };
    }
    
    const answer = data.answer_markdown || '';
    const events = data.structured?.events || [];
    const type = data.type || 'unknown';
    const confidence = data.confidence || 0;
    
    // Calculate scores
    const contentScore = answer.length > 0 ? 20 : 0;
    
    // Relevance scoring
    const expectedWords = expectedKeywords[testCase.expected] || [];
    const foundKeywords = expectedWords.filter(word => 
      answer.toLowerCase().includes(word.toLowerCase())
    );
    const relevanceScore = expectedWords.length > 0 ? 
      Math.round((foundKeywords.length / expectedWords.length) * 30) : 30;
    
    // Structure scoring
    const minLength = minLengths[testCase.expected] || 100;
    const structureScore = answer.length >= minLength ? 20 : 
      Math.round((answer.length / minLength) * 20);
    
    // Events scoring
    let eventsScore = 30;
    if (testCase.expected === 'events') {
      eventsScore = events.length > 0 ? 30 : 0;
    } else {
      eventsScore = events.length === 0 ? 30 : 0; // No events expected
    }
    
    const totalScore = contentScore + relevanceScore + structureScore + eventsScore;
    
    return {
      ...testCase,
      type,
      confidence,
      answerLength: answer.length,
      eventsCount: events.length,
      contentScore,
      relevanceScore,
      structureScore,
      eventsScore,
      totalScore,
      foundKeywords,
      expectedKeywords: expectedWords,
      answerPreview: answer.substring(0, 100) + (answer.length > 100 ? '...' : ''),
      issues: []
    };
    
  } catch (error) {
    return {
      ...testCase,
      error: error.message,
      score: 0
    };
  }
}

function analyzePatterns(results) {
  const patterns = {
    byCategory: {},
    byExpectedType: {},
    commonIssues: {},
    lowScoring: [],
    highScoring: []
  };
  
  results.forEach(result => {
    if (result.error) return;
    
    // Group by category
    if (!patterns.byCategory[result.category]) {
      patterns.byCategory[result.category] = { total: 0, scores: [], issues: [] };
    }
    patterns.byCategory[result.category].total++;
    patterns.byCategory[result.category].scores.push(result.totalScore);
    
    // Group by expected type
    if (!patterns.byExpectedType[result.expected]) {
      patterns.byExpectedType[result.expected] = { total: 0, scores: [], issues: [] };
    }
    patterns.byExpectedType[result.expected].total++;
    patterns.byExpectedType[result.expected].scores.push(result.totalScore);
    
    // Track low/high scoring
    if (result.totalScore < 60) {
      patterns.lowScoring.push(result);
    } else if (result.totalScore >= 80) {
      patterns.highScoring.push(result);
    }
    
    // Identify issues
    if (result.contentScore < 20) patterns.commonIssues['No content'] = (patterns.commonIssues['No content'] || 0) + 1;
    if (result.relevanceScore < 15) patterns.commonIssues['Poor relevance'] = (patterns.commonIssues['Poor relevance'] || 0) + 1;
    if (result.structureScore < 15) patterns.commonIssues['Poor structure'] = (patterns.commonIssues['Poor structure'] || 0) + 1;
    if (result.eventsScore < 15) patterns.commonIssues['Wrong events'] = (patterns.commonIssues['Wrong events'] || 0) + 1;
  });
  
  // Calculate averages
  Object.keys(patterns.byCategory).forEach(category => {
    const scores = patterns.byCategory[category].scores;
    patterns.byCategory[category].average = scores.reduce((a, b) => a + b, 0) / scores.length;
  });
  
  Object.keys(patterns.byExpectedType).forEach(type => {
    const scores = patterns.byExpectedType[type].scores;
    patterns.byExpectedType[type].average = scores.reduce((a, b) => a + b, 0) / scores.length;
  });
  
  return patterns;
}

async function runExpandedTest() {
  console.log('🔍 EXPANDED CONTENT QUALITY TEST');
  console.log('============================================================');
  console.log(`📊 Testing ${testQuestions.length} questions across multiple categories\n`);
  
  const results = [];
  
  for (const testCase of testQuestions) {
    console.log(`📝 Testing: "${testCase.query}"`);
    console.log(`   Category: ${testCase.category} | Expected: ${testCase.expected}`);
    
    const result = await testQuery(testCase);
    results.push(result);
    
    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
    } else {
      console.log(`   Type: ${result.type} (expected: ${result.expected})`);
      console.log(`   Confidence: ${result.confidence}`);
      console.log(`   Answer Length: ${result.answerLength} chars`);
      console.log(`   Events: ${result.eventsCount} (expected: ${result.expected === 'events' ? 'some' : 'none'})`);
      console.log(`   🎯 Content Score: ${result.contentScore}/20`);
      console.log(`   🎯 Relevance Score: ${result.relevanceScore}/30 (${result.foundKeywords.length}/${result.expectedKeywords.length} keywords found)`);
      console.log(`   🎯 Structure Score: ${result.structureScore}/20`);
      console.log(`   🎯 Events Score: ${result.eventsScore}/30`);
      console.log(`   📊 TOTAL SCORE: ${result.totalScore}/100`);
      
      if (result.totalScore < 60) {
        console.log(`   ❌ Issues:`);
        if (result.contentScore < 20) console.log(`      ❌ NO CONTENT: Answer is empty or undefined`);
        if (result.relevanceScore < 15) console.log(`      ❌ POOR RELEVANCE: Only found ${result.foundKeywords.length}/${result.expectedKeywords.length} expected keywords`);
        if (result.structureScore < 15) console.log(`      ❌ POOR STRUCTURE: Answer too short (${result.answerLength} chars)`);
        if (result.eventsScore < 15) console.log(`      ❌ WRONG EVENTS: ${result.eventsCount} events when ${result.expected === 'events' ? 'none' : 'some'} expected`);
      } else if (result.totalScore >= 80) {
        console.log(`   ✅ No issues found`);
      } else {
        console.log(`   ⚠️ Some issues found`);
      }
      
      console.log(`   📄 Preview: ${result.answerPreview}`);
    }
    console.log('');
  }
  
  // Analyze patterns
  const patterns = analyzePatterns(results);
  
  console.log('🏆 OVERALL RESULTS');
  console.log('============================================================');
  
  const validResults = results.filter(r => !r.error);
  const averageScore = validResults.reduce((sum, r) => sum + r.totalScore, 0) / validResults.length;
  const passingTests = validResults.filter(r => r.totalScore >= 80).length;
  const failingTests = validResults.filter(r => r.totalScore < 50).length;
  
  console.log(`📊 Average Score: ${averageScore.toFixed(1)}/100`);
  console.log(`📊 Total Tests: ${validResults.length}`);
  console.log(`📊 Passing Tests (80+): ${passingTests}/${validResults.length}`);
  console.log(`📊 Failing Tests (<50): ${failingTests}/${validResults.length}`);
  
  console.log('\n📈 PERFORMANCE BY CATEGORY:');
  Object.entries(patterns.byCategory)
    .sort((a, b) => b[1].average - a[1].average)
    .forEach(([category, data]) => {
      console.log(`   ${category}: ${data.average.toFixed(1)}/100 (${data.total} tests)`);
    });
  
  console.log('\n📈 PERFORMANCE BY EXPECTED TYPE:');
  Object.entries(patterns.byExpectedType)
    .sort((a, b) => b[1].average - a[1].average)
    .forEach(([type, data]) => {
      console.log(`   ${type}: ${data.average.toFixed(1)}/100 (${data.total} tests)`);
    });
  
  console.log('\n❌ COMMON ISSUES:');
  Object.entries(patterns.commonIssues)
    .sort((a, b) => b[1] - a[1])
    .forEach(([issue, count]) => {
      console.log(`   ❌ ${issue}: ${count} occurrences`);
    });
  
  console.log('\n🔍 LOWEST SCORING QUERIES:');
  patterns.lowScoring
    .sort((a, b) => a.totalScore - b.totalScore)
    .slice(0, 5)
    .forEach(result => {
      console.log(`   "${result.query}" - ${result.totalScore}/100 (${result.category})`);
    });
  
  console.log('\n✅ HIGHEST SCORING QUERIES:');
  patterns.highScoring
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 5)
    .forEach(result => {
      console.log(`   "${result.query}" - ${result.totalScore}/100 (${result.category})`);
    });
  
  console.log('\n💡 RECOMMENDATIONS:');
  if (averageScore < 60) {
    console.log('   ⚠️ SYSTEM NEEDS MAJOR IMPROVEMENTS - Most responses have quality issues');
  } else if (averageScore < 80) {
    console.log('   ⚠️ SYSTEM NEEDS SIGNIFICANT IMPROVEMENTS - Many responses have quality issues');
  } else {
    console.log('   ✅ SYSTEM IS WORKING WELL - Most responses meet quality standards');
  }
  
  return { results, patterns, averageScore };
}

runExpandedTest().catch(console.error);
