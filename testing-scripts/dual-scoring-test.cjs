const http = require('http');
const fs = require('fs');

// Enhanced dual scoring system - Bot Response + Related Information
function assessBotResponseQuality(response, query, qualityFocus) {
  let score = 0;
  const issues = [];
  
  // Get the main answer
  let answer = '';
  if (Array.isArray(response.answer)) {
    answer = response.answer_markdown || response.answer.map(e => e.title || e.event_title || '').join(' ');
  } else if (typeof response.answer === 'string') {
    answer = response.answer;
  } else if (response.answer_markdown) {
    answer = response.answer_markdown;
  }
  
  // 1. Answer Quality (40 points)
  if (answer.length > 50) score += 10;
  if (answer.length > 200) score += 10;
  if (answer.length > 400) score += 10;
  if (answer.includes('**') || answer.includes('*')) score += 5; // Markdown formatting
  if (answer.includes('http') || answer.includes('www')) score += 5; // Links
  
  // 2. Relevance to Query (30 points)
  const queryLower = query.toLowerCase();
  const answerLower = answer.toLowerCase();
  const queryWords = queryLower.split(' ').filter(w => w.length > 2);
  
  let matchedWords = 0;
  queryWords.forEach(word => {
    if (answerLower.includes(word)) matchedWords++;
  });
  
  score += (matchedWords / queryWords.length) * 20;
  
  // Check for quality focus keywords
  if (qualityFocus) {
    const focusWords = qualityFocus.toLowerCase().split(' ').filter(w => w.length > 3);
    let focusMatches = 0;
    focusWords.forEach(word => {
      if (answerLower.includes(word)) focusMatches++;
    });
    score += (focusMatches / focusWords.length) * 10;
  }
  
  // 3. Response Type Appropriateness (30 points)
  if (response.type === 'clarification' && answer.includes('specific')) {
    score += 15; // Good clarification
  } else if (response.type === 'advice' && answer.length > 100) {
    score += 20; // Good advice
  } else if (response.type === 'events' && Array.isArray(response.answer)) {
    score += 25; // Good events list
  } else if (response.type === 'advice' && answer.length < 50) {
    score += 5; // Short advice
    issues.push('Very short response');
  }
  
  // Penalties
  if (answer.includes('I\'d be happy to help! Could you be more specific?')) {
    score = Math.min(score, 20);
    issues.push('Generic clarification response');
  }
  
  if (answer.length < 30) {
    score = Math.min(score, 15);
    issues.push('Extremely short response');
  }
  
  return {
    score: Math.min(100, Math.max(0, score)),
    issues: issues
  };
}

function assessRelatedInformationQuality(response, query) {
  let score = 0;
  const issues = [];
  
  // Check articles
  const articles = response.structured?.articles || [];
  const events = response.structured?.events || [];
  const sources = response.sources || [];
  
  // 1. Article Relevance (40 points)
  if (articles.length > 0) {
    score += Math.min(20, articles.length * 5); // Up to 20 points for multiple articles
    
    // Check article relevance to query
    const queryLower = query.toLowerCase();
    let relevantArticles = 0;
    
    articles.forEach(article => {
      const title = (article.title || '').toLowerCase();
      const description = (article.description || '').toLowerCase();
      const queryWords = queryLower.split(' ').filter(w => w.length > 2);
      
      let matches = 0;
      queryWords.forEach(word => {
        if (title.includes(word) || description.includes(word)) matches++;
      });
      
      if (matches > 0) relevantArticles++;
    });
    
    score += (relevantArticles / articles.length) * 20;
  } else {
    issues.push('No articles provided');
  }
  
  // 2. Event Relevance (30 points)
  if (events.length > 0) {
    score += Math.min(15, events.length * 3); // Up to 15 points for multiple events
    
    // Check event relevance
    const queryLower = query.toLowerCase();
    let relevantEvents = 0;
    
    events.forEach(event => {
      const title = (event.title || event.event_title || '').toLowerCase();
      const queryWords = queryLower.split(' ').filter(w => w.length > 2);
      
      let matches = 0;
      queryWords.forEach(word => {
        if (title.includes(word)) matches++;
      });
      
      if (matches > 0) relevantEvents++;
    });
    
    score += (relevantEvents / events.length) * 15;
  } else if (query.includes('workshop') || query.includes('course') || query.includes('event')) {
    issues.push('No events provided for event-related query');
  }
  
  // 3. Source Quality (30 points)
  if (sources.length > 0) {
    score += Math.min(15, sources.length * 3); // Up to 15 points for multiple sources
    
    // Check source quality (alanranger.com domains are good)
    let qualitySources = 0;
    sources.forEach(source => {
      if (source.includes('alanranger.com')) qualitySources++;
    });
    
    score += (qualitySources / sources.length) * 15;
  } else {
    issues.push('No sources provided');
  }
  
  return {
    score: Math.min(100, Math.max(0, score)),
    issues: issues
  };
}

// Test questions
const TEST_QUESTIONS = [
  { query: "what is exposure triangle", expectedType: "advice", qualityFocus: "Should explain the relationship between aperture, shutter speed, and ISO" },
  { query: "what is iso", expectedType: "advice", qualityFocus: "Should explain ISO sensitivity and its role in exposure" },
  { query: "what is aperture", expectedType: "advice", qualityFocus: "Should explain aperture, f-stops, and depth of field" },
  { query: "what is shutter speed", expectedType: "advice", qualityFocus: "Should explain shutter speed and motion control" },
  { query: "what tripod do you recommend", expectedType: "advice", qualityFocus: "Should provide specific tripod recommendations with reasoning" },
  { query: "what camera should I buy", expectedType: "advice", qualityFocus: "Should provide camera recommendations based on needs" },
  { query: "peter orton", expectedType: "advice", qualityFocus: "Should find Peter Orton article and connect to related RPS content" },
  { query: "who is alan ranger", expectedType: "advice", qualityFocus: "Should provide biographical information about Alan" },
  { query: "when is your next devon workshop", expectedType: "events", qualityFocus: "Should list Devon workshops with dates and details" },
  { query: "when is your next photography course", expectedType: "events", qualityFocus: "Should list photography courses with dates" },
  { query: "how to take sharp photos", expectedType: "advice", qualityFocus: "Should provide practical tips for sharp photography" },
  { query: "what is long exposure photography", expectedType: "advice", qualityFocus: "Should explain long exposure techniques and applications" },
  { query: "do I need a laptop for lightroom course", expectedType: "advice", qualityFocus: "Should answer equipment requirements for the course" },
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
      sessionId: 'dual-scoring-test-session'
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
          
          // Dual scoring assessment
          const botResponse = assessBotResponseQuality(response, query, qualityFocus);
          const relatedInfo = assessRelatedInformationQuality(response, query);
          
          // Combined score (weighted: 60% bot response, 40% related info)
          const combinedScore = Math.round((botResponse.score * 0.6) + (relatedInfo.score * 0.4));
          
          resolve({
            query,
            expectedType,
            qualityFocus,
            status: res.statusCode,
            response: response,
            scoring: {
              botResponse: botResponse,
              relatedInfo: relatedInfo,
              combined: combinedScore,
              apiConfidence: response.confidence || 0
            }
          });
        } catch (e) {
          resolve({
            query,
            expectedType,
            qualityFocus,
            status: res.statusCode,
            error: e.message,
            scoring: {
              botResponse: { score: 0, issues: ['Parse error'] },
              relatedInfo: { score: 0, issues: ['Parse error'] },
              combined: 0,
              apiConfidence: 0
            }
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
        scoring: {
          botResponse: { score: 0, issues: ['Network error'] },
          relatedInfo: { score: 0, issues: ['Network error'] },
          combined: 0,
          apiConfidence: 0
        }
      });
    });

    req.write(postData);
    req.end();
  });
}

async function runDualScoringTest() {
  console.log('🔍 DUAL SCORING QUALITY TEST - Bot Response + Related Information');
  console.log('============================================================');
  
  const results = [];
  let totalBotScore = 0;
  let totalRelatedScore = 0;
  let totalCombinedScore = 0;
  
  for (let i = 0; i < TEST_QUESTIONS.length; i++) {
    const question = TEST_QUESTIONS[i];
    console.log(`\n📝 Testing: "${question.query}"`);
    console.log(`   Focus: ${question.qualityFocus}`);
    
    const result = await testQuery(question.query, question.expectedType, question.qualityFocus);
    
    if (result.status === 200) {
      const botScore = result.scoring.botResponse.score;
      const relatedScore = result.scoring.relatedInfo.score;
      const combinedScore = result.scoring.combined;
      
      console.log(`   ✅ Status: ${result.status}`);
      console.log(`   🤖 Bot Response Score: ${botScore}/100`);
      console.log(`   📚 Related Info Score: ${relatedScore}/100`);
      console.log(`   📊 Combined Score: ${combinedScore}/100`);
      console.log(`   🔍 API Confidence: ${(result.scoring.apiConfidence * 100).toFixed(1)}%`);
      
      if (result.scoring.botResponse.issues.length > 0) {
        console.log(`   ⚠️  Bot Issues: ${result.scoring.botResponse.issues.join(', ')}`);
      }
      
      if (result.scoring.relatedInfo.issues.length > 0) {
        console.log(`   ⚠️  Related Issues: ${result.scoring.relatedInfo.issues.join(', ')}`);
      }
      
      totalBotScore += botScore;
      totalRelatedScore += relatedScore;
      totalCombinedScore += combinedScore;
    } else {
      console.log(`   ❌ Status: ${result.status}`);
      console.log(`   Error: ${result.error || 'Unknown error'}`);
    }
    
    results.push(result);
  }
  
  const avgBotScore = Math.round(totalBotScore / TEST_QUESTIONS.length);
  const avgRelatedScore = Math.round(totalRelatedScore / TEST_QUESTIONS.length);
  const avgCombinedScore = Math.round(totalCombinedScore / TEST_QUESTIONS.length);
  
  console.log('\n📊 DUAL SCORING RESULTS SUMMARY');
  console.log('==============================');
  console.log(`📈 Average Bot Response Score: ${avgBotScore}/100`);
  console.log(`📚 Average Related Info Score: ${avgRelatedScore}/100`);
  console.log(`📊 Average Combined Score: ${avgCombinedScore}/100`);
  console.log(`🎯 Target: 80+ combined score`);
  
  // Save results
  const timestamp = new Date().toISOString();
  const filename = `testing-scripts/test results/dual-scoring-test-${timestamp}.json`;
  
  const output = {
    timestamp,
    testType: 'dual_scoring',
    summary: {
      totalQuestions: TEST_QUESTIONS.length,
      averageBotScore: avgBotScore,
      averageRelatedScore: avgRelatedScore,
      averageCombinedScore: avgCombinedScore,
      targetMet: avgCombinedScore >= 80
    },
    results: results
  };
  
  fs.writeFileSync(filename, JSON.stringify(output, null, 2));
  console.log(`💾 Results saved to: ${filename}`);
  
  return output;
}

// Run the test
runDualScoringTest().catch(console.error);
