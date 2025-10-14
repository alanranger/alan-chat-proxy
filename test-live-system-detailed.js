#!/usr/bin/env node

/**
 * Test Live System with Detailed Error Handling
 */

const API_BASE = 'https://alan-chat-proxy.vercel.app';

async function testWithDetailedLogging() {
  console.log("🔍 Testing Live System with Detailed Logging\n");
  
  const testQuery = "what is iso";
  console.log(`Testing: "${testQuery}"`);
  
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: testQuery,
        topK: 8,
        sessionId: "test-detailed"
      })
    });
    
    console.log(`Response Status: ${response.status}`);
    console.log(`Response Headers:`, Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log(`Raw Response:`, responseText);
    
    try {
      const data = JSON.parse(responseText);
      console.log(`Parsed JSON:`, JSON.stringify(data, null, 2));
    } catch (parseError) {
      console.log(`JSON Parse Error:`, parseError.message);
    }
    
  } catch (error) {
    console.log(`Fetch Error:`, error.message);
    console.log(`Error Stack:`, error.stack);
  }
}

testWithDetailedLogging().catch(console.error);
