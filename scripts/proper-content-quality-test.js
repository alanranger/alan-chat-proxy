import fetch from 'node-fetch';

// Comprehensive content quality testing system
const testCases = [
  {
    query: "who is alan ranger",
    expectedType: "advice",
    expectedContent: ["alan ranger", "bipp", "qualified", "photographer", "20+ years", "experience", "teaching"],
    expectedEvents: false, // Should NOT show events
    minExpectedLength: 200,
    description: "About Query - Should show Alan's background and qualifications",
    criticalIssues: [
      "Generic response like 'Yes, Alan Ranger offers the services you're asking about'",
      "Showing irrelevant events like macro workshops or beginner courses",
      "Missing key information about BIPP qualification, experience, reviews"
    ]
  },
  {
    query: "what tripod do you recommend",
    expectedType: "advice",
    expectedContent: ["tripod", "recommendations", "equipment", "professional", "budget"],
    expectedEvents: false,
    minExpectedLength: 300,
    description: "Equipment Query - Should show detailed tripod recommendations",
    criticalIssues: [
      "Generic response without specific tripod advice",
      "Missing equipment guide links",
      "No structured recommendations"
    ]
  },
  {
    query: "photo editing courses",
    expectedType: "events", // This is the key - should be events, not advice
    expectedContent: ["lightroom", "course", "dates", "times", "locations"],
    expectedEvents: true, // Should show course events
    minExpectedLength: 100,
    description: "Course Query - Should show course events with dates/times",
    criticalIssues: [
      "Returning advice instead of events",
      "Missing course dates and times",
      "No event cards showing"
    ]
  },
  {
    query: "when is your next wales workshop",
    expectedType: "events",
    expectedContent: ["wales", "workshop", "dates", "landscape"],
    expectedEvents: true,
    minExpectedLength: 50,
    description: "Workshop Query - Should show Wales workshop events",
    criticalIssues: [
      "Returning clarification instead of events",
      "Missing Wales-specific workshops",
      "No event cards showing"
    ]
  },
  {
    query: "do you provide refunds",
    expectedType: "advice",
    expectedContent: ["refund", "cancellation", "policy", "terms"],
    expectedEvents: false,
    minExpectedLength: 150,
    description: "Policy Query - Should show refund policy information",
    criticalIssues: [
      "Generic response without specific policy details",
      "Missing refund/cancellation information",
      "No clear policy guidance"
    ]
  },
  {
    query: "how to use aperture",
    expectedType: "advice",
    expectedContent: ["aperture", "f-stop", "depth of field", "technical"],
    expectedEvents: false,
    minExpectedLength: 200,
    description: "Technical Query - Should show aperture guidance",
    criticalIssues: [
      "Generic response without technical details",
      "Missing aperture explanation",
      "No technical guidance"
    ]
  }
];

async function analyzeContentQuality(testCase, response) {
  const issues = [];
  const score = { content: 0, relevance: 0, structure: 0, events: 0, total: 0 };
  
  const answer = response.answer_markdown || response.answer || '';
  const answerLower = answer.toLowerCase();
  
  // 1. Check response type
  if (response.type !== testCase.expectedType) {
    issues.push(`❌ WRONG TYPE: Got "${response.type}", expected "${testCase.expectedType}"`);
    score.content = 0;
  } else {
    score.content = 20;
  }
  
  // 2. Check content relevance
  const expectedContentFound = testCase.expectedContent.filter(keyword =>
    answerLower.includes(keyword.toLowerCase())
  );
  const relevancePercentage = (expectedContentFound.length / testCase.expectedContent.length) * 100;
  
  if (relevancePercentage >= 80) {
    score.relevance = 30;
  } else if (relevancePercentage >= 50) {
    score.relevance = 20;
    issues.push(`⚠️ PARTIAL RELEVANCE: Only found ${expectedContentFound.length}/${testCase.expectedContent.length} expected keywords`);
  } else {
    score.relevance = 0;
    issues.push(`❌ POOR RELEVANCE: Only found ${expectedContentFound.length}/${testCase.expectedContent.length} expected keywords`);
  }
  
  // 3. Check for critical issues
  testCase.criticalIssues.forEach(issue => {
    if (answerLower.includes(issue.toLowerCase()) || 
        (issue.includes("Generic response") && answer.includes("Yes, Alan Ranger offers the services you're asking about"))) {
      issues.push(`❌ CRITICAL: ${issue}`);
      score.relevance = Math.max(0, score.relevance - 10);
    }
  });
  
  // 4. Check response length
  if (answer.length < testCase.minExpectedLength) {
    issues.push(`❌ TOO SHORT: ${answer.length} chars (expected ${testCase.minExpectedLength}+)`);
    score.structure = 0;
  } else {
    score.structure = 20;
  }
  
  // 5. Check events (if expected)
  if (testCase.expectedEvents) {
    if (response.structured && response.structured.events && response.structured.events.length > 0) {
      score.events = 30;
    } else {
      score.events = 0;
      issues.push(`❌ MISSING EVENTS: Expected events but got none`);
    }
  } else {
    // Should NOT have events
    if (response.structured && response.structured.events && response.structured.events.length > 0) {
      score.events = 0;
      issues.push(`❌ UNWANTED EVENTS: Got ${response.structured.events.length} events when none expected`);
    } else {
      score.events = 30;
    }
  }
  
  score.total = score.content + score.relevance + score.structure + score.events;
  
  return { score, issues, relevancePercentage, expectedContentFound };
}

async function runProperContentQualityTest() {
  console.log('🔍 PROPER CONTENT QUALITY TEST');
  console.log('============================================================\n');
  
  let totalScore = 0;
  let totalTests = 0;
  const results = [];
  
  for (const testCase of testCases) {
    console.log(`📝 Testing: "${testCase.query}"`);
    console.log(`   Expected: ${testCase.description}`);
    
    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: testCase.query }),
      }).then(res => res.json());
      
      const analysis = await analyzeContentQuality(testCase, response);
      
      console.log(`   Type: ${response.type} (expected: ${testCase.expectedType})`);
      console.log(`   Confidence: ${response.confidence}`);
      console.log(`   Answer Length: ${(response.answer_markdown || response.answer || '').length} chars`);
      console.log(`   Events: ${response.structured?.events?.length || 0} (expected: ${testCase.expectedEvents ? 'some' : 'none'})`);
      
      // Quality assessment
      console.log(`   🎯 Content Score: ${analysis.score.content}/20`);
      console.log(`   🎯 Relevance Score: ${analysis.score.relevance}/30 (${analysis.relevancePercentage.toFixed(0)}% keywords found)`);
      console.log(`   🎯 Structure Score: ${analysis.score.structure}/20`);
      console.log(`   🎯 Events Score: ${analysis.score.events}/30`);
      console.log(`   📊 TOTAL SCORE: ${analysis.score.total}/100`);
      
      if (analysis.issues.length > 0) {
        console.log(`   ❌ Issues:`);
        analysis.issues.forEach(issue => console.log(`      ${issue}`));
      } else {
        console.log(`   ✅ No issues found`);
      }
      
      console.log(`   📄 Preview: ${(response.answer_markdown || response.answer || '').substring(0, 100)}...\n`);
      
      totalScore += analysis.score.total;
      totalTests++;
      results.push({ testCase, analysis, response });
      
    } catch (error) {
      console.error(`   ❌ Error testing "${testCase.query}":`, error.message);
      console.log('\n');
    }
  }
  
  const averageScore = totalScore / totalTests;
  
  console.log('🏆 OVERALL RESULTS');
  console.log('============================================================');
  console.log(`📊 Average Score: ${averageScore.toFixed(1)}/100`);
  console.log(`📊 Total Tests: ${totalTests}`);
  console.log(`📊 Passing Tests (80+): ${results.filter(r => r.analysis.score.total >= 80).length}/${totalTests}`);
  console.log(`📊 Failing Tests (<50): ${results.filter(r => r.analysis.score.total < 50).length}/${totalTests}\n`);
  
  console.log('❌ CRITICAL ISSUES SUMMARY:');
  const allIssues = results.flatMap(r => r.analysis.issues);
  const criticalIssues = allIssues.filter(issue => issue.includes('❌'));
  criticalIssues.forEach(issue => console.log(`   ${issue}`));
  
  console.log('\n💡 RECOMMENDATIONS:');
  if (averageScore < 50) {
    console.log('   🚨 SYSTEM NEEDS MAJOR OVERHAUL - Most responses are failing quality checks');
  } else if (averageScore < 80) {
    console.log('   ⚠️ SYSTEM NEEDS SIGNIFICANT IMPROVEMENTS - Many responses have quality issues');
  } else {
    console.log('   ✅ SYSTEM IS WORKING WELL - Most responses meet quality standards');
  }
  
  return results;
}

runProperContentQualityTest();
