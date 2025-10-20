// Test live chat with all workshop category permutations
import fetch from 'node-fetch';

const API_URL = 'https://alan-chat-proxy.vercel.app/api/chat';

// Test queries for all workshop category permutations
const testQueries = [
  // Initial workshop queries (should trigger clarification)
  {
    query: "photography workshops",
    expectedClarification: true,
    description: "Initial workshop query - should trigger clarification"
  },
  {
    query: "workshops near me",
    expectedClarification: true,
    description: "Location-based workshop query - should trigger clarification"
  },
  {
    query: "short photography workshops",
    expectedClarification: true,
    description: "Duration-based workshop query - should trigger clarification"
  },
  
  // Direct category queries (should bypass clarification)
  {
    query: "2.5hr - 4hr workshops",
    expectedClarification: false,
    expectedCategory: "2.5hrs-4hrs",
    description: "Direct 2.5hr-4hr query - should show both early and late sessions"
  },
  {
    query: "1 day workshops",
    expectedClarification: false,
    expectedCategory: "1-day",
    description: "Direct 1-day query - should show only full-day sessions"
  },
  {
    query: "multi day residential workshops",
    expectedClarification: false,
    expectedCategory: "2-5-days",
    description: "Direct multi-day query - should show residential workshops"
  },
  
  // Follow-up clarification selections
  {
    query: "2.5hr - 4hr workshops",
    pageContext: { clarificationLevel: 1, selectedOption: "2.5hr - 4hr workshops" },
    expectedClarification: false,
    expectedCategory: "2.5hrs-4hrs",
    description: "Follow-up selection for 2.5hr-4hr - should show both sessions"
  },
  {
    query: "1 day workshops",
    pageContext: { clarificationLevel: 1, selectedOption: "1 day workshops" },
    expectedClarification: false,
    expectedCategory: "1-day",
    description: "Follow-up selection for 1-day - should show only full-day"
  },
  {
    query: "Multi day residential workshops",
    pageContext: { clarificationLevel: 1, selectedOption: "Multi day residential workshops" },
    expectedClarification: false,
    expectedCategory: "2-5-days",
    description: "Follow-up selection for multi-day - should show residential"
  }
];

async function testChatQuery(query, pageContext = null) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        pageContext
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`❌ Error testing query "${query}":`, error.message);
    return { error: error.message };
  }
}

async function analyzeResponse(result, testCase) {
  const analysis = {
    query: testCase.query,
    description: testCase.description,
    success: false,
    issues: [],
    details: {}
  };

  // Check for errors
  if (result.error) {
    analysis.issues.push(`API Error: ${result.error}`);
    return analysis;
  }

  // Check if clarification was triggered
  const hasClarification = result.clarification && result.clarification.length > 0;
  if (testCase.expectedClarification && !hasClarification) {
    analysis.issues.push("Expected clarification but none was triggered");
  } else if (!testCase.expectedClarification && hasClarification) {
    analysis.issues.push("Unexpected clarification triggered");
  }

  // Check for events in response
  const hasEvents = result.events && result.events.length > 0;
  if (!testCase.expectedClarification && !hasEvents) {
    analysis.issues.push("Expected events but none were returned");
  }

  // Analyze events if present
  if (hasEvents) {
    analysis.details.eventCount = result.events.length;
    analysis.details.events = result.events.map(event => ({
      title: event.title,
      start_time: event.start_time,
      end_time: event.end_time,
      categories: event.categories,
      duration: event.duration
    }));

    // Check for correct category filtering
    if (testCase.expectedCategory) {
      const correctCategoryEvents = result.events.filter(event => 
        event.categories && event.categories.includes(testCase.expectedCategory)
      );
      
      if (correctCategoryEvents.length === 0) {
        analysis.issues.push(`No events found with expected category: ${testCase.expectedCategory}`);
      } else if (correctCategoryEvents.length !== result.events.length) {
        analysis.issues.push(`Mixed categories found - expected only ${testCase.expectedCategory}`);
      }
    }

    // Check for session types (for Bluebell events)
    const bluebellEvents = result.events.filter(event => 
      event.title && event.title.toLowerCase().includes('bluebell')
    );
    
    if (bluebellEvents.length > 0) {
      analysis.details.bluebellSessions = bluebellEvents.map(event => ({
        title: event.title,
        start_time: event.start_time,
        end_time: event.end_time,
        session_type: getSessionType(event.start_time, event.end_time)
      }));
    }
  }

  // Check confidence progression
  if (result.confidence !== undefined) {
    analysis.details.confidence = result.confidence;
    if (testCase.pageContext && result.confidence < 80) {
      analysis.issues.push(`Low confidence (${result.confidence}%) for follow-up query`);
    }
  }

  analysis.success = analysis.issues.length === 0;
  return analysis;
}

function getSessionType(startTime, endTime) {
  if (startTime === '05:45:00' && endTime === '09:45:00') return 'Early 4hr';
  if (startTime === '10:30:00' && endTime === '14:30:00') return 'Late 4hr';
  if (startTime === '05:45:00' && endTime === '14:30:00') return 'Full Day';
  return 'Other';
}

async function runComprehensiveTest() {
  console.log('🧪 COMPREHENSIVE LIVE CHAT WORKSHOP CATEGORY TEST');
  console.log('================================================');
  console.log(`Testing ${testQueries.length} query permutations...\n`);

  const results = [];
  
  for (const testCase of testQueries) {
    console.log(`🔍 Testing: "${testCase.query}"`);
    console.log(`   Description: ${testCase.description}`);
    
    const result = await testChatQuery(testCase.query, testCase.pageContext);
    const analysis = await analyzeResponse(result, testCase);
    
    results.push(analysis);
    
    if (analysis.success) {
      console.log(`   ✅ PASSED`);
    } else {
      console.log(`   ❌ FAILED`);
      analysis.issues.forEach(issue => console.log(`      - ${issue}`));
    }
    
    if (analysis.details.eventCount > 0) {
      console.log(`   📊 Events: ${analysis.details.eventCount}`);
    }
    
    if (analysis.details.bluebellSessions) {
      console.log(`   🌸 Bluebell Sessions: ${analysis.details.bluebellSessions.length}`);
      analysis.details.bluebellSessions.forEach(session => {
        console.log(`      - ${session.session_type}: ${session.start_time}-${session.end_time}`);
      });
    }
    
    console.log('');
    
    // Add delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('📊 TEST SUMMARY');
  console.log('===============');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\n🔍 FAILED TESTS:');
    results.filter(r => !r.success).forEach(result => {
      console.log(`\n❌ "${result.query}"`);
      console.log(`   ${result.description}`);
      result.issues.forEach(issue => console.log(`   - ${issue}`));
    });
  }

  // Specific category analysis
  console.log('\n📈 CATEGORY ANALYSIS:');
  const categoryResults = results.filter(r => r.details.eventCount > 0);
  
  if (categoryResults.length > 0) {
    console.log(`Events returned in ${categoryResults.length} tests`);
    
    // Check for Bluebell session distribution
    const bluebellTests = categoryResults.filter(r => r.details.bluebellSessions);
    if (bluebellTests.length > 0) {
      console.log('\n🌸 Bluebell Session Analysis:');
      bluebellTests.forEach(test => {
        const sessions = test.details.bluebellSessions;
        const earlyCount = sessions.filter(s => s.session_type === 'Early 4hr').length;
        const lateCount = sessions.filter(s => s.session_type === 'Late 4hr').length;
        const fullDayCount = sessions.filter(s => s.session_type === 'Full Day').length;
        
        console.log(`   "${test.query}": Early=${earlyCount}, Late=${lateCount}, FullDay=${fullDayCount}`);
      });
    }
  }

  return results;
}

// Run the test
runComprehensiveTest().catch(console.error);



