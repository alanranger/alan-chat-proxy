#!/usr/bin/env node

/**
 * Test that "do you do courses" now triggers clarification instead of direct answer
 */

const API_BASE = 'https://alan-chat-proxy.vercel.app';

async function testDoYouDoCourses() {
  console.log("🔍 Testing 'do you do courses' Clarification\n");
  
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: "do you do courses",
        topK: 8,
        sessionId: "test-do-you-do-courses"
      })
    });
    
    const data = await response.json();
    
    console.log(`Response Type: ${data.type}`);
    console.log(`Confidence: ${data.confidence}%`);
    console.log(`Question: ${data.question}`);
    console.log(`\nClarification Options:`);
    
    if (data.options) {
      data.options.forEach((option, index) => {
        console.log(`  ${index + 1}. "${option.text}" → "${option.query}"`);
      });
    }
    
    console.log(`\nAnalysis:`);
    if (data.type === "clarification") {
      console.log(`✅ SUCCESS: "do you do courses" now triggers clarification!`);
      console.log(`✅ User will be guided to specific course types instead of being overwhelmed`);
    } else {
      console.log(`❌ FAILED: Still returning direct answer instead of clarification`);
      console.log(`❌ Response type: ${data.type}`);
    }
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

testDoYouDoCourses().catch(console.error);
