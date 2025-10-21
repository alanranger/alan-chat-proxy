// Content Quality Analyzer - Tests actual response relevance and quality
async function analyzeContentQuality() {
  const testCases = [
    {
      question: "what tripod do you recommend",
      expectedContent: ["tripod", "recommendation", "equipment", "specific models"],
      expectedType: "advice",
      shouldHaveArticles: true,
      shouldHaveStructuredBlocks: true
    },
    {
      question: "how to use aperture", 
      expectedContent: ["aperture", "f-stop", "depth of field", "technical explanation"],
      expectedType: "advice",
      shouldHaveArticles: true,
      shouldHaveStructuredBlocks: true
    },
    {
      question: "photo editing courses",
      expectedContent: ["lightroom", "course", "dates", "times", "schedule"],
      expectedType: "events", // Should show course events
      shouldHaveEvents: true,
      shouldHaveStructuredBlocks: true
    },
    {
      question: "do you provide refunds",
      expectedContent: ["refund", "policy", "cancellation", "terms"],
      expectedType: "advice",
      shouldHaveSpecificInfo: true
    },
    {
      question: "who is alan ranger",
      expectedContent: ["alan ranger", "background", "experience", "qualifications"],
      expectedType: "advice",
      shouldHaveSpecificInfo: true,
      shouldNotHaveEvents: true // Should NOT show random events
    }
  ];

  console.log('🔍 CONTENT QUALITY ANALYSIS');
  console.log('='.repeat(50));

  for (const testCase of testCases) {
    try {
      console.log(`\n📝 Testing: "${testCase.question}"`);
      
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: testCase.question })
      });
      
      const data = await response.json();
      
      // Analyze response quality
      const analysis = analyzeResponseQuality(testCase, data);
      
      console.log(`   Type: ${data.type} (expected: ${testCase.expectedType})`);
      console.log(`   Confidence: ${data.confidence}`);
      console.log(`   Answer Length: ${(data.answer_markdown || data.answer || '').length} chars`);
      
      // Quality assessment
      console.log(`   🎯 Content Relevance: ${analysis.contentRelevance}`);
      console.log(`   📊 Response Quality: ${analysis.overallQuality}`);
      console.log(`   ❌ Issues: ${analysis.issues.length > 0 ? analysis.issues.join(', ') : 'None'}`);
      
      if (analysis.issues.length > 0) {
        console.log(`   💡 Recommendations: ${analysis.recommendations.join(', ')}`);
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }
}

function analyzeResponseQuality(testCase, response) {
  const issues = [];
  const recommendations = [];
  let contentRelevance = 'Poor';
  let overallQuality = 'Poor';
  
      const answer = response.answer_markdown || response.answer || '';
      const answerLower = answer.toLowerCase();
  
  // Check content relevance
  const expectedContentFound = testCase.expectedContent.filter(keyword => 
    answerLower.includes(keyword.toLowerCase())
  );
  
  const contentMatchRatio = expectedContentFound.length / testCase.expectedContent.length;
  
  if (contentMatchRatio >= 0.8) {
    contentRelevance = 'Excellent';
  } else if (contentMatchRatio >= 0.6) {
    contentRelevance = 'Good';
  } else if (contentMatchRatio >= 0.4) {
    contentRelevance = 'Fair';
  } else {
    contentRelevance = 'Poor';
    issues.push('Missing expected keywords');
  }
  
  // Check response type
  if (response.type !== testCase.expectedType) {
    issues.push(`Wrong response type (got ${response.type}, expected ${testCase.expectedType})`);
    recommendations.push('Fix intent classification');
  }
  
  // Check for structured content
  if (testCase.shouldHaveArticles && !answer.includes('article') && !answer.includes('guide')) {
    issues.push('Missing article recommendations');
    recommendations.push('Add structured article blocks');
  }
  
  if (testCase.shouldHaveEvents && response.type !== 'events') {
    issues.push('Should show events but got advice');
    recommendations.push('Fix event routing');
  }
  
  if (testCase.shouldNotHaveEvents && response.type === 'events') {
    issues.push('Showing irrelevant events');
    recommendations.push('Fix content filtering');
  }
  
  // Check for specific information
  if (testCase.shouldHaveSpecificInfo && answer.length < 200) {
    issues.push('Response too generic/short');
    recommendations.push('Provide more specific information');
  }
  
  // Check for database dumps
  if (answer.includes('[/') || answer.includes('[[[') || answer.includes('0 Likes')) {
    issues.push('Contains unformatted database content');
    recommendations.push('Clean and format content properly');
  }
  
  // Overall quality assessment
  if (issues.length === 0 && contentMatchRatio >= 0.8) {
    overallQuality = 'Excellent';
  } else if (issues.length <= 1 && contentMatchRatio >= 0.6) {
    overallQuality = 'Good';
  } else if (issues.length <= 2 && contentMatchRatio >= 0.4) {
    overallQuality = 'Fair';
  } else {
    overallQuality = 'Poor';
  }
  
  return {
    contentRelevance,
    overallQuality,
    issues,
    recommendations,
    contentMatchRatio
  };
}

// Run the analysis
analyzeContentQuality().catch(console.error);
