const http = require('http');

// Test specific questions to analyze actual content quality
const testQuestions = [
  {
    query: 'what is raw format',
    expectedAnswer: 'RAW format explanation with technical details',
    category: 'Technical Definition'
  },
  {
    query: 'how do I use lighting effectively', 
    expectedAnswer: 'Practical lighting tips and techniques',
    category: 'Instructional'
  },
  {
    query: 'do I need expensive equipment',
    expectedAnswer: 'Equipment advice based on needs and budget',
    category: 'Decision Support'
  },
  {
    query: 'when should I use a tripod',
    expectedAnswer: 'Specific scenarios when tripod is needed',
    category: 'Practical Advice'
  }
];

async function testContentQuality() {
  console.log('🔍 CONTENT QUALITY ANALYSIS');
  console.log('================================================================================');
  
  for (let i = 0; i < testQuestions.length; i++) {
    const test = testQuestions[i];
    console.log(`\n🔍 Testing ${i + 1}/${testQuestions.length}: "${test.query}"`);
    console.log('================================================================================');
    
    try {
      const response = await makeRequest(test.query);
      const data = JSON.parse(response);
      
      console.log(`📝 ACTUAL ANSWER CONTENT:`);
      console.log(`Answer Length: ${data.answer?.length || 0} chars`);
      console.log(`Answer Preview: ${data.answer?.substring(0, 200) || 'NO ANSWER'}...`);
      
      // Analyze content quality
      const qualityAnalysis = analyzeContentQuality(data.answer, test.query, test.expectedAnswer);
      
      console.log(`\n📊 CONTENT QUALITY ANALYSIS:`);
      console.log(`- Direct Answer: ${qualityAnalysis.hasDirectAnswer ? '✅ YES' : '❌ NO'}`);
      console.log(`- Relevant Content: ${qualityAnalysis.isRelevant ? '✅ YES' : '❌ NO'}`);
      console.log(`- Conversational: ${qualityAnalysis.isConversational ? '✅ YES' : '❌ NO'}`);
      console.log(`- Contains Article Links: ${qualityAnalysis.hasArticleLinks ? '❌ YES' : '✅ NO'}`);
      console.log(`- Quality Score: ${qualityAnalysis.qualityScore}/100`);
      
      if (qualityAnalysis.issues.length > 0) {
        console.log(`\n⚠️ ISSUES FOUND:`);
        qualityAnalysis.issues.forEach(issue => console.log(`- ${issue}`));
      }
      
      console.log(`\n🎯 VERDICT: ${qualityAnalysis.qualityScore >= 70 ? '✅ GOOD' : '❌ POOR'}`);
      
    } catch (error) {
      console.log(`❌ Error testing "${test.query}": ${error.message}`);
    }
  }
}

function analyzeContentQuality(answer, query, expectedAnswer) {
  if (!answer || answer.length < 50) {
    return {
      hasDirectAnswer: false,
      isRelevant: false,
      isConversational: false,
      hasArticleLinks: false,
      qualityScore: 0,
      issues: ['Answer too short or missing']
    };
  }
  
  const analysis = {
    hasDirectAnswer: false,
    isRelevant: false,
    isConversational: false,
    hasArticleLinks: false,
    qualityScore: 0,
    issues: []
  };
  
  // Check for direct answer (not just generic greeting)
  const genericGreetings = [
    'Hi! I can help with workshops',
    'I can help with workshops, tuition',
    'Ask me anything about Alan\'s services'
  ];
  
  const hasGenericGreeting = genericGreetings.some(greeting => 
    answer.toLowerCase().includes(greeting.toLowerCase())
  );
  
  if (!hasGenericGreeting && answer.length > 100) {
    analysis.hasDirectAnswer = true;
  } else if (hasGenericGreeting) {
    analysis.issues.push('Contains generic greeting instead of direct answer');
  }
  
  // Check for article links
  const hasArticleLinks = answer.includes('[http') || 
                         answer.includes('](http') ||
                         answer.includes('check out these guides') ||
                         answer.includes('For detailed reviews');
  
  analysis.hasArticleLinks = hasArticleLinks;
  if (hasArticleLinks) {
    analysis.issues.push('Contains article links instead of direct answer');
  }
  
  // Check if conversational
  const conversationalIndicators = [
    'I recommend', 'I suggest', 'You should', 'For beginners',
    'The best', 'Look for', 'Consider', 'Here\'s what'
  ];
  
  analysis.isConversational = conversationalIndicators.some(indicator => 
    answer.toLowerCase().includes(indicator.toLowerCase())
  );
  
  if (!analysis.isConversational) {
    analysis.issues.push('Not conversational - sounds robotic or generic');
  }
  
  // Check relevance to query
  const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 3);
  const answerWords = answer.toLowerCase();
  
  const relevantWords = queryWords.filter(word => answerWords.includes(word));
  analysis.isRelevant = relevantWords.length >= queryWords.length * 0.5;
  
  if (!analysis.isRelevant) {
    analysis.issues.push('Answer doesn\'t seem relevant to the specific question');
  }
  
  // Calculate quality score
  let score = 0;
  if (analysis.hasDirectAnswer) score += 30;
  if (analysis.isRelevant) score += 25;
  if (analysis.isConversational) score += 25;
  if (!analysis.hasArticleLinks) score += 20;
  
  analysis.qualityScore = score;
  
  return analysis;
}

function makeRequest(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query });
    
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
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Run the test
testContentQuality().catch(console.error);
