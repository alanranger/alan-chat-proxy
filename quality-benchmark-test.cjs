const http = require('http');
const fs = require('fs');

// Quality assessment criteria based on Alan's manual testing
const QUALITY_CRITERIA = {
  RELEVANCE: 'relevance',           // Does the answer directly address the question?
  COMPLETENESS: 'completeness',     // Is the answer complete and informative?
  ACCURACY: 'accuracy',            // Is the information accurate and helpful?
  STRUCTURE: 'structure',           // Is the response well-structured?
  ACTIONABILITY: 'actionability',   // Does it provide actionable information?
  CONFIDENCE_ALIGNMENT: 'confidence_alignment', // Is bot confidence aligned with response quality?
  ARTICLE_RELEVANCE: 'article_relevance', // Are related articles relevant and helpful?
  CLASSIFICATION_SUCCESS: 'classification_success' // Does classification work properly?
};

// Alan's quality scoring criteria
const ALAN_QUALITY_BENCHMARKS = {
  PERFECT: { min: 95, max: 100, label: 'Perfect' },
  NEARLY_PERFECT: { min: 90, max: 94, label: 'Nearly Perfect' },
  VERY_GOOD: { min: 75, max: 89, label: 'Very Good' },
  GOOD: { min: 50, max: 74, label: 'Good' },
  POOR: { min: 30, max: 49, label: 'Poor' },
  VERY_POOR: { min: 0, max: 29, label: 'Very Poor' }
};

// Confidence pills analysis criteria
const CONFIDENCE_PILLS_CRITERIA = {
  CONFIDENCE_SCORE: 'confidence_score',     // What is the confidence percentage?
  CONFIDENCE_FACTORS: 'confidence_factors', // What factors contributed to confidence?
  PILLS_PRESENT: 'pills_present',          // Are confidence pills present in response?
  PILLS_COUNT: 'pills_count',              // How many confidence pills are there?
  PILLS_CONTENT: 'pills_content'           // What is the content of confidence pills?
};

// Alan's 28 test questions with expected quality scores and confidence alignment
const TEST_QUESTIONS = [
  // Technical photography concepts
  { 
    query: "what is exposure triangle", 
    expectedType: "advice", 
    qualityFocus: "Should explain the relationship between aperture, shutter speed, and ISO",
    alanExpectedScore: 90,
    alanExpectedConfidence: 90,
    alanNotes: "should have higher confidence - gave a good right answer and show perfectly matched article tiles"
  },
  { 
    query: "what is iso", 
    expectedType: "advice", 
    qualityFocus: "Should explain ISO sensitivity and its role in exposure",
    alanExpectedScore: 75,
    alanExpectedConfidence: 75,
    alanNotes: "didn't answer the question it referenced the article but did show relevant articles in article block"
  },
  { 
    query: "what is aperture", 
    expectedType: "advice", 
    qualityFocus: "Should explain aperture, f-stops, and depth of field",
    alanExpectedScore: 10,
    alanExpectedConfidence: 10,
    alanNotes: "didn't even attempt to answer question and no related articles section"
  },
  { 
    query: "what is shutter speed", 
    expectedType: "advice", 
    qualityFocus: "Should explain shutter speed and motion control",
    alanExpectedScore: 50,
    alanExpectedConfidence: 50,
    alanNotes: "didn't answer the question showed one correct article but the pdf field checklist was from wrong blog and topic"
  },
  
  // Equipment recommendations
  { 
    query: "what tripod do you recommend", 
    expectedType: "advice", 
    qualityFocus: "Should provide specific tripod recommendations with reasoning",
    alanExpectedScore: 95,
    alanExpectedConfidence: 95,
    alanNotes: "should have higher confidence - gave a good right answer and show perfectly matched article tiles"
  },
  { 
    query: "what camera should I buy", 
    expectedType: "advice", 
    qualityFocus: "Should provide camera recommendations based on needs",
    alanExpectedScore: 50,
    alanExpectedConfidence: 50,
    alanNotes: "initial response good but related article tiles not great and there were better ones available not showing"
  },
  { 
    query: "what camera do you recommend for a beginner", 
    expectedType: "advice", 
    qualityFocus: "Should provide beginner camera recommendations",
    alanExpectedScore: 50,
    alanExpectedConfidence: 50,
    alanNotes: "initial response good but related article tiles not great and there were better ones available not showing"
  },
  
  // Person queries
  { 
    query: "peter orton", 
    expectedType: "advice", 
    qualityFocus: "Should find Peter Orton article and connect to related RPS content",
    alanExpectedScore: 75,
    alanExpectedConfidence: 75,
    alanNotes: "good but could have shown more related articles for other case studies too"
  },
  { 
    query: "who is alan ranger", 
    expectedType: "advice", 
    qualityFocus: "Should provide biographical information about Alan",
    alanExpectedScore: 75,
    alanExpectedConfidence: 75,
    alanNotes: "good initial response but shouldn't have shown related articles, should shown orange pill linked to about-alan page"
  },
  
  // Event queries
  { 
    query: "when is your next devon workshop", 
    expectedType: "events", 
    qualityFocus: "Should list Devon workshops with dates and details",
    alanExpectedScore: 95,
    alanExpectedConfidence: 95,
    alanNotes: "no changes required"
  },
  { 
    query: "when is your next photography course", 
    expectedType: "events", 
    qualityFocus: "Should list photography courses with dates",
    alanExpectedScore: 30,
    alanExpectedConfidence: 30,
    alanNotes: "it lists workshops not courses in the events block"
  },
  { 
    query: "when are your next bluebell workshops", 
    expectedType: "events", 
    qualityFocus: "Should list bluebell workshop dates",
    alanExpectedScore: 100,
    alanExpectedConfidence: 100,
    alanNotes: "no changes required"
  },
  { 
    query: "do you have autumn workshops", 
    expectedType: "events", 
    qualityFocus: "Should list autumn workshop options",
    alanExpectedScore: 50,
    alanExpectedConfidence: 50,
    alanNotes: "missing some events for autumn like peak district but need to check if they contain enough clues to be classified as autumn"
  },
  
  // Technical advice
  { 
    query: "how to take sharp photos", 
    expectedType: "advice", 
    qualityFocus: "Should provide practical tips for sharp photography",
    alanExpectedScore: 50,
    alanExpectedConfidence: 50,
    alanNotes: "initial response good but related article tiles not great and there were better ones available not showing"
  },
  { 
    query: "what is long exposure photography", 
    expectedType: "advice", 
    qualityFocus: "Should explain long exposure techniques and applications",
    alanExpectedScore: 75,
    alanExpectedConfidence: 75,
    alanNotes: "didn't answer the question it referenced the article but did show relevant articles in article block"
  },
  { 
    query: "why are my images always grainy and noisy", 
    expectedType: "advice", 
    qualityFocus: "Should provide solutions for grainy/noisy images",
    alanExpectedScore: 10,
    alanExpectedConfidence: 10,
    alanNotes: "wrong initial response that isn't related and two related articles not related at all - should have found answers on ISO"
  },
  { 
    query: "why arent my images sharp", 
    expectedType: "advice", 
    qualityFocus: "Should provide tips for sharper images",
    alanExpectedScore: 50,
    alanExpectedConfidence: 50,
    alanNotes: "initial response good but related article tiles showing two unrelated articles rather than better ones"
  },
  
  // Course/workshop logistics
  { 
    query: "do I need a laptop for lightroom course", 
    expectedType: "advice", 
    qualityFocus: "Should answer equipment requirements for the course",
    alanExpectedScore: 75,
    alanExpectedConfidence: 75,
    alanNotes: "initial response not good as didn't answer question but course tiles correct and they answer the question"
  },
  { 
    query: "do you provide photography courses", 
    expectedType: "advice", 
    qualityFocus: "Should list available photography courses",
    alanExpectedScore: 10,
    alanExpectedConfidence: 10,
    alanNotes: "confidence pill says 0.2% then classification options > go to wrong events these are not the classification options we agreed and had working before"
  },
  { 
    query: "do you have online lessons", 
    expectedType: "advice", 
    qualityFocus: "Should mention online lesson options",
    alanExpectedScore: 30,
    alanExpectedConfidence: 30,
    alanNotes: "initial response weak and links/pills to the landing pages or article tiles"
  },
  { 
    query: "do you have a lightroom course", 
    expectedType: "advice", 
    qualityFocus: "Should list Lightroom course options",
    alanExpectedScore: 75,
    alanExpectedConfidence: 75,
    alanNotes: "listed right events but could also have responded initially with a better answer"
  },
  { 
    query: "whats your online photography course", 
    expectedType: "advice", 
    qualityFocus: "Should describe online course offerings",
    alanExpectedScore: 10,
    alanExpectedConfidence: 10,
    alanNotes: "confidence pill says 0.2% then classification options > go to wrong events these are not the classification options we agreed and had working before"
  },
  
  // Business information
  { 
    query: "where i can see your terms and conditions", 
    expectedType: "advice", 
    qualityFocus: "Should provide terms and conditions information",
    alanExpectedScore: 95,
    alanExpectedConfidence: 95,
    alanNotes: "no changes required"
  },
  { 
    query: "tell me about rps mentoring", 
    expectedType: "advice", 
    qualityFocus: "Should explain RPS mentoring services",
    alanExpectedScore: 75,
    alanExpectedConfidence: 75,
    alanNotes: "perfect initial response and did show one relevant article and one not relevant and could have easily found articles with rps"
  },
  { 
    query: "do you do commercial photography", 
    expectedType: "advice", 
    qualityFocus: "Should explain commercial photography services",
    alanExpectedScore: 10,
    alanExpectedConfidence: 10,
    alanNotes: "Initial response had nothing to do with question, related articles were not about the question"
  },
  { 
    query: "do you do portrait photography", 
    expectedType: "advice", 
    qualityFocus: "Should explain portrait photography services",
    alanExpectedScore: 10,
    alanExpectedConfidence: 10,
    alanNotes: "Initial response had nothing to do with question, related articles were not about the question"
  },
  { 
    query: "is your photography academy really free", 
    expectedType: "advice", 
    qualityFocus: "Should clarify free vs paid academy content",
    alanExpectedScore: 10,
    alanExpectedConfidence: 10,
    alanNotes: "Initial response had nothing to do with question, related articles were not about the question"
  },
  { 
    query: "what camera do i need for your courses and workshops", 
    expectedType: "advice", 
    qualityFocus: "Should specify camera requirements for courses",
    alanExpectedScore: 10,
    alanExpectedConfidence: 10,
    alanNotes: "Initial response had nothing to do with question, related articles were not about the question"
  }
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
          const confidencePills = assessConfidencePills(response);
          
          resolve({
            query,
            expectedType,
            qualityFocus,
            status: res.statusCode,
            response: response,
            quality: qualityAssessment,
            confidencePills: confidencePills
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
    return { overall: 0, issues, breakdown: {}, confidencePills: {} };
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

function assessConfidencePills(response) {
  const confidencePills = {
    confidence_score: null,
    confidence_factors: [],
    pills_present: false,
    pills_count: 0,
    pills_content: []
  };

  // Extract confidence score
  if (typeof response.confidence === 'number') {
    confidencePills.confidence_score = Math.round(response.confidence * 100);
  } else if (typeof response.confidence_pct === 'number') {
    confidencePills.confidence_score = response.confidence_pct;
  }

  // Check for confidence factors in debug info
  if (response.debug?.confidenceFactors) {
    confidencePills.confidence_factors = response.debug.confidenceFactors;
  }

  // Check for pills in structured response
  if (response.structured?.pills) {
    confidencePills.pills_present = true;
    confidencePills.pills_count = response.structured.pills.length;
    confidencePills.pills_content = response.structured.pills.map(pill => ({
      label: pill.label || pill.text,
      url: pill.url || pill.href,
      priority: pill.priority || false,
      secondary: pill.secondary || false
    }));
  }

  // Check for confidence pills in other locations
  if (response.confidencePills) {
    confidencePills.pills_present = true;
    confidencePills.pills_count = response.confidencePills.length;
    confidencePills.pills_content = response.confidencePills;
  }

  return confidencePills;
}

// Enhanced assessment using Alan's quality benchmarks
function assessResponseQualityEnhanced(response, question, alanExpectedScore, alanExpectedConfidence, alanNotes) {
  const breakdown = {
    relevance: 0,
    completeness: 0,
    accuracy: 0,
    structure: 0,
    actionability: 0,
    confidenceAlignment: 0,
    articleRelevance: 0,
    classificationSuccess: 0,
    confidencePills: {}
  };

  try {
    // Basic quality assessment
    const responseText = response.answer || response.response || '';
    const hasEvents = response.structured && response.structured.events && response.structured.events.length > 0;
    const hasArticles = response.structured && response.structured.articles && response.structured.articles.length > 0;
    
    // Relevance (0-20 points)
    if (responseText.length > 50) breakdown.relevance += 10;
    if (responseText.includes('photography') || responseText.includes('camera') || responseText.includes('workshop')) breakdown.relevance += 10;
    
    // Completeness (0-20 points)
    if (responseText.length > 100) breakdown.completeness += 10;
    if (hasEvents || hasArticles) breakdown.completeness += 10;
    
    // Accuracy (0-20 points)
    if (responseText.length > 50 && !responseText.includes('error')) breakdown.accuracy += 20;
    
    // Structure (0-20 points)
    if (response.structured) breakdown.structure += 20;
    
    // Actionability (0-20 points)
    if (hasEvents || hasArticles) breakdown.actionability += 20;
    
    // Confidence alignment (0-20 points)
    const botConfidence = response.confidence ? Math.round(response.confidence * 100) : 0;
    const confidenceDiff = Math.abs(botConfidence - alanExpectedConfidence);
    if (confidenceDiff <= 20) breakdown.confidenceAlignment = 20;
    else if (confidenceDiff <= 40) breakdown.confidenceAlignment = 15;
    else if (confidenceDiff <= 60) breakdown.confidenceAlignment = 10;
    else breakdown.confidenceAlignment = 5;
    
    // Article relevance (0-20 points)
    if (hasArticles) {
      breakdown.articleRelevance = 15; // Base score for having articles
      if (response.structured.articles.length >= 2) breakdown.articleRelevance += 5;
    }
    
    // Classification success (0-20 points)
    if (response.structured && response.structured.events && response.structured.events.length > 0) {
      breakdown.classificationSuccess = 20;
    } else if (responseText.includes('workshop') || responseText.includes('course')) {
      breakdown.classificationSuccess = 10; // Partial success
    }
    
    // Assess confidence pills
    breakdown.confidencePills = assessConfidencePills(response);
    
  } catch (error) {
    console.error('Error in enhanced quality assessment:', error);
  }

  return breakdown;
}

// Calculate quality score using Alan's benchmarks
function calculateQualityScore(breakdown) {
  const totalScore = Object.values(breakdown).reduce((sum, value) => {
    if (typeof value === 'number') return sum + value;
    return sum;
  }, 0);
  
  return Math.min(100, Math.max(0, totalScore));
}

// Determine quality category based on Alan's benchmarks
function getQualityCategory(score) {
  if (score >= 95) return ALAN_QUALITY_BENCHMARKS.PERFECT;
  if (score >= 90) return ALAN_QUALITY_BENCHMARKS.NEARLY_PERFECT;
  if (score >= 75) return ALAN_QUALITY_BENCHMARKS.VERY_GOOD;
  if (score >= 50) return ALAN_QUALITY_BENCHMARKS.GOOD;
  if (score >= 30) return ALAN_QUALITY_BENCHMARKS.POOR;
  return ALAN_QUALITY_BENCHMARKS.VERY_POOR;
}

async function runQualityBenchmark() {
  console.log('🔍 ENHANCED QUALITY BENCHMARK TEST - ALAN\'S BENCHMARKS');
  console.log('='.repeat(60));
  console.log('Using Alan\'s quality scoring criteria and confidence alignment');
  console.log('='.repeat(60));
  
  const results = [];
  let totalScore = 0;
  let alanScoreTotal = 0;
  let confidenceAlignmentTotal = 0;
  let perfectScores = 0;
  let veryPoorScores = 0;
  let totalTests = TEST_QUESTIONS.length;
  
  for (const testCase of TEST_QUESTIONS) {
    console.log(`\n📝 Testing: "${testCase.query}"`);
    console.log(`   Focus: ${testCase.qualityFocus}`);
    
    try {
      const result = await testQuery(testCase.query, testCase.expectedType, testCase.qualityFocus);
      
      // Use enhanced assessment with Alan's benchmarks
      const enhancedBreakdown = assessResponseQualityEnhanced(
        result.response, 
        testCase.query, 
        testCase.alanExpectedScore, 
        testCase.alanExpectedConfidence, 
        testCase.alanNotes
      );
      
      const enhancedScore = calculateQualityScore(enhancedBreakdown);
      const qualityCategory = getQualityCategory(enhancedScore);
      
      // Update result with enhanced assessment
      result.qualityScore = enhancedScore;
      result.breakdown = enhancedBreakdown;
      result.qualityCategory = qualityCategory;
      result.alanExpectedScore = testCase.alanExpectedScore;
      result.alanExpectedConfidence = testCase.alanExpectedConfidence;
      result.alanNotes = testCase.alanNotes;
      
      results.push(result);
      totalScore += enhancedScore;
      alanScoreTotal += testCase.alanExpectedScore;
      confidenceAlignmentTotal += enhancedBreakdown.confidenceAlignment;
      
      // Track quality categories
      if (enhancedScore >= 95) perfectScores++;
      if (enhancedScore < 30) veryPoorScores++;
      
      console.log(`   ✅ Enhanced Score: ${enhancedScore}/100 (${qualityCategory.label})`);
      console.log(`   🎯 Alan Expected: ${testCase.alanExpectedScore}/100`);
      console.log(`   📊 Confidence Alignment: ${enhancedBreakdown.confidenceAlignment}/20`);
      console.log(`   📝 Answer Length: ${result.response?.answer?.length || 0} chars`);
      console.log(`   📚 Articles: ${result.response?.structured?.articles?.length || 0}`);
      console.log(`   📅 Events: ${result.response?.structured?.events?.length || 0}`);
      
      // Show confidence pills information
      if (result.confidencePills) {
        const pills = result.confidencePills;
        console.log(`   🎯 Bot Confidence: ${pills.confidence_score || 'N/A'}%`);
        console.log(`   🎯 Alan Expected: ${testCase.alanExpectedConfidence}%`);
        if (pills.pills_present) {
          console.log(`   💊 Pills: ${pills.pills_count} present`);
          if (pills.pills_content.length > 0) {
            console.log(`   💊 Pill Content: ${pills.pills_content.map(p => p.label).join(', ')}`);
          }
        } else {
          console.log(`   💊 Pills: None present`);
        }
        if (pills.confidence_factors.length > 0) {
          console.log(`   🔍 Confidence Factors: ${pills.confidence_factors.join(', ')}`);
        }
      }
      
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
  const alanAverageScore = Math.round(alanScoreTotal / totalTests);
  const averageConfidenceAlignment = Math.round(confidenceAlignmentTotal / totalTests);
  
  console.log(`\n📊 ENHANCED BENCHMARK RESULTS - ALAN'S BENCHMARKS`);
  console.log('='.repeat(60));
  console.log(`📈 Enhanced Average Score: ${averageScore}/100`);
  console.log(`🎯 Alan Expected Average: ${alanAverageScore}/100`);
  console.log(`📊 Confidence Alignment: ${averageConfidenceAlignment}/20`);
  console.log(`✅ Perfect Scores (95+): ${perfectScores}/${totalTests} (${Math.round(perfectScores/totalTests*100)}%)`);
  console.log(`❌ Very Poor Scores (<30): ${veryPoorScores}/${totalTests} (${Math.round(veryPoorScores/totalTests*100)}%)`);
  console.log(`🎯 Target: 15+ perfect scores (50%+), <3 very poor scores (10% or less)`);
  
  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = `results/quality-benchmark-before-${timestamp}.json`;
  
  const benchmarkResults = {
    timestamp: new Date().toISOString(),
    phase: 'before_improvements',
    averageScore,
    totalTests,
    passedTests: results.filter(r => r.quality.overall >= 70).length,
    failedTests: results.filter(r => r.quality.overall < 70).length,
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
