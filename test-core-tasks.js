// Test script for the three core tasks I implemented
// This tests the key functionality changes

const testQueries = [
  // Task 1: Multi-day residential workshop tiles
  {
    query: "How much is a residential photography workshop and does it include B&B?",
    expectedType: "events",
    description: "Should show multi-day residential workshop tiles with pricing and residential indicators"
  },
  {
    query: "residential workshop pricing",
    expectedType: "events", 
    description: "Should show residential workshop events with proper tiles"
  },
  
  // Task 2: Tripod article tiles with fallbacks
  {
    query: "What tripod do you recommend?",
    expectedType: "advice",
    description: "Should show tripod article tiles with proper title/URL fallbacks"
  },
  {
    query: "tripod recommendations",
    expectedType: "advice",
    description: "Should show tripod articles with enhanced fallback logic"
  },
  
  // Task 3: Evidence-based clarification options
  {
    query: "photography equipment",
    expectedType: "clarification",
    description: "Should show clarification options sourced from evidence buckets"
  },
  {
    query: "photography events",
    expectedType: "clarification", 
    description: "Should show evidence-based clarification options for events"
  }
];

async function testQuery(query, expectedType, description) {
  console.log(`\n🧪 Testing: "${query}"`);
  console.log(`📝 Expected: ${expectedType} - ${description}`);
  
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        sessionId: 'test-session-' + Date.now()
      })
    });
    
    const data = await response.json();
    
    console.log(`✅ Response type: ${data.type}`);
    console.log(`📊 Confidence: ${data.confidence}%`);
    
    if (data.type === expectedType) {
      console.log(`✅ PASS: Correct response type`);
    } else {
      console.log(`❌ FAIL: Expected ${expectedType}, got ${data.type}`);
    }
    
    // Check for specific improvements
    if (data.type === 'events' && data.events) {
      const hasResidential = data.events.some(e => 
        e.date_start && e.date_end && new Date(e.date_end) > new Date(e.date_start)
      );
      console.log(`🏠 Multi-day events found: ${hasResidential}`);
      
      const hasPricing = data.events.some(e => e.price_gbp);
      console.log(`💰 Pricing info found: ${hasPricing}`);
    }
    
    if (data.type === 'advice' && data.structured?.articles) {
      const hasValidTitles = data.structured.articles.every(a => 
        a.title && a.title !== 'Photography Guide' && a.title !== 'Alan Ranger Photography'
      );
      console.log(`📰 Valid article titles: ${hasValidTitles}`);
    }
    
    if (data.type === 'clarification' && data.options) {
      console.log(`🤔 Clarification options: ${data.options.length}`);
      data.options.forEach((opt, i) => {
        console.log(`   ${i+1}. ${opt.text}`);
      });
    }
    
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
  }
}

async function runTests() {
  console.log('🚀 Starting Core Tasks Test Suite');
  console.log('=====================================');
  
  for (const test of testQueries) {
    await testQuery(test.query, test.expectedType, test.description);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between tests
  }
  
  console.log('\n🏁 Test suite completed');
}

// Run tests if this script is executed directly
if (typeof window === 'undefined') {
  // Node.js environment
  console.log('This test script should be run in a browser environment');
  console.log('Open chat.html and run: testCoreTasks()');
} else {
  // Browser environment
  window.testCoreTasks = runTests;
  console.log('Test function available as: testCoreTasks()');
}
