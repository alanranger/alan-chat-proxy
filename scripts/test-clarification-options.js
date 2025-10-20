#!/usr/bin/env node

/**
 * Test script to verify all clarification options work correctly
 * Tests each option from the initial workshop clarification
 */

const API_URL = 'https://alan-chat-proxy.vercel.app/api/chat';

async function testClarificationOption(optionText, expectedType = 'events') {
  console.log(`\n🧪 Testing: "${optionText}"`);
  console.log('─'.repeat(50));
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: optionText,
        pageContext: {
          clarificationLevel: 1,
          previousQuery: "What photography workshops do you have?"
        },
        sessionId: "test-clarification"
      })
    });

    const data = await response.json();
    
    console.log(`✅ Response Type: ${data.type}`);
    console.log(`📊 Confidence: ${data.confidence}%`);
    console.log(`🔖 Version: ${data.debug?.version || 'unknown'}`);
    
    if (data.type === 'events') {
      console.log(`📅 Events Found: ${data.events?.length || 0}`);
      if (data.events?.length > 0) {
        console.log(`🎯 First Event: ${data.events[0].title || data.events[0].event_title || 'Unknown'}`);
        console.log(`💰 Price: £${data.events[0].price_gbp || data.events[0].price || 'Unknown'}`);
      }
    } else if (data.type === 'clarification') {
      console.log(`❓ Clarification Options: ${data.options?.length || 0}`);
      if (data.options?.length > 0) {
        console.log(`📝 Options: ${data.options.map(o => o.text).join(', ')}`);
      }
    }
    
    // Check if this matches expected behavior
    const isCorrect = data.type === expectedType;
    console.log(`${isCorrect ? '✅' : '❌'} Expected: ${expectedType}, Got: ${data.type}`);
    
    return {
      option: optionText,
      type: data.type,
      confidence: data.confidence,
      version: data.debug?.version,
      eventsCount: data.events?.length || 0,
      optionsCount: data.options?.length || 0,
      isCorrect: isCorrect
    };
    
  } catch (error) {
    console.error(`❌ Error testing "${optionText}":`, error.message);
    return {
      option: optionText,
      error: error.message,
      isCorrect: false
    };
  }
}

async function runAllTests() {
  console.log('🚀 Starting Comprehensive Clarification Options Test');
  console.log('='.repeat(60));
  
  const testCases = [
    { option: "2.5hr - 4hr workshops", expected: "events" },
    { option: "1 day workshops", expected: "events" },
    { option: "Multi day residential workshops", expected: "clarification" },
    { option: "Workshops by location", expected: "clarification" },
    { option: "Workshops by month", expected: "clarification" }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    const result = await testClarificationOption(testCase.option, testCase.expected);
    results.push(result);
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.isCorrect).length;
  const failed = results.filter(r => !r.isCorrect).length;
  
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => !r.isCorrect).forEach(r => {
      console.log(`  - "${r.option}": ${r.error || `Expected events, got ${r.type}`}`);
    });
  }
  
  console.log('\n📋 DETAILED RESULTS:');
  results.forEach(r => {
    const status = r.isCorrect ? '✅' : '❌';
    console.log(`${status} "${r.option}" → ${r.type} (${r.confidence}%)`);
  });
  
  return results;
}

// Run the tests
runAllTests().catch(console.error);




