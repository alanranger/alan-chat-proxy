#!/usr/bin/env node

/**
 * Test script to verify clarification flow logic before deployment
 * Tests the cascading triangle logic: 20% → 50% → 80% confidence progression
 */

import fetch from 'node-fetch';

// const API_URL = 'http://localhost:3000/api/chat'; // Local test
const API_URL = 'https://alan-chat-proxy.vercel.app/api/chat'; // Live test

async function testClarificationFlow() {
  console.log('🧪 Testing Clarification Flow Logic\n');
  
  const testCases = [
    {
      name: 'Initial Workshop Query',
      query: 'What photography workshops do you have?',
      expectedType: 'clarification',
      expectedConfidence: 20,
      expectedOptions: ['2.5hr - 4hr workshops', '1 day workshops', 'Multi day residential workshops']
    },
    {
      name: 'Follow-up: 2.5hr Selection',
      query: 'short photography workshops 2-4 hours',
      expectedType: 'clarification',
      expectedConfidence: 50,
      expectedOptions: ['Bluebell workshops', 'Coastal workshops', 'Landscape workshops']
    },
    {
      name: 'Follow-up: Bluebell Selection',
      query: 'Bluebell workshops',
      expectedType: 'events',
      expectedConfidence: 80,
      expectedOptions: null // Should show actual events
    }
  ];

  let pageContext = null;
  
  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log(`Query: "${testCase.query}"`);
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: testCase.query,
          pageContext,
          sessionId: 'test-session'
        })
      });
      
      const data = await response.json();
      
      console.log(`✅ Response Type: ${data.type}`);
      console.log(`✅ Confidence: ${data.confidence}%`);
      console.log(`✅ Version: ${data.debug?.version}`);
      
      if (data.type === 'clarification') {
        console.log(`✅ Options: ${data.options?.map(o => o.text).join(', ')}`);
        
        // Update pageContext for next iteration
        pageContext = {
          ...pageContext,
          clarificationLevel: (pageContext?.clarificationLevel || 0) + 1
        };
      } else if (data.type === 'events') {
        console.log(`✅ Events Found: ${data.structured?.events?.length || 0}`);
      }
      
      // Verify expectations
      if (data.type !== testCase.expectedType) {
        console.log(`❌ Expected type: ${testCase.expectedType}, got: ${data.type}`);
      }
      
      if (data.confidence !== testCase.expectedConfidence) {
        console.log(`❌ Expected confidence: ${testCase.expectedConfidence}%, got: ${data.confidence}%`);
      }
      
      if (testCase.expectedOptions && data.options) {
        const hasExpectedOptions = testCase.expectedOptions.some(expected => 
          data.options.some(option => option.text.includes(expected))
        );
        if (!hasExpectedOptions) {
          console.log(`❌ Expected options containing: ${testCase.expectedOptions.join(', ')}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n🏁 Test Complete');
}

// Run the test
testClarificationFlow().catch(console.error);
