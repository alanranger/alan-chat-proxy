#!/usr/bin/env node

/**
 * Test Live System Directly
 * Test the actual API endpoints to see what's really happening
 */

const API_BASE = 'https://alan-chat-proxy.vercel.app';

async function testLiveSystem() {
  console.log("🧪 Testing Live System Directly\n");
  
  // Test 1: Direct technical question
  console.log("Test 1: Direct technical question - 'what is iso'");
  try {
    const response1 = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: "what is iso",
        topK: 8,
        sessionId: "test-session-1"
      })
    });
    
    const data1 = await response1.json();
    console.log(`  Status: ${response1.status}`);
    console.log(`  Type: ${data1.type}`);
    console.log(`  Confidence: ${data1.confidence}%`);
    console.log(`  Has Answer: ${!!data1.answer}`);
    console.log(`  Debug: ${JSON.stringify(data1.debug || {}, null, 2)}\n`);
  } catch (error) {
    console.log(`  Error: ${error.message}\n`);
  }
  
  // Test 2: Events query
  console.log("Test 2: Events query - 'when is the next devon workshop'");
  try {
    const response2 = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: "when is the next devon workshop",
        topK: 8,
        sessionId: "test-session-2"
      })
    });
    
    const data2 = await response2.json();
    console.log(`  Status: ${response2.status}`);
    console.log(`  Type: ${data2.type}`);
    console.log(`  Confidence: ${data2.confidence}%`);
    console.log(`  Has Answer: ${!!data2.answer}`);
    console.log(`  Debug: ${JSON.stringify(data2.debug || {}, null, 2)}\n`);
  } catch (error) {
    console.log(`  Error: ${error.message}\n`);
  }
  
  // Test 3: Equipment query
  console.log("Test 3: Equipment query - 'tripod recommendations'");
  try {
    const response3 = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: "tripod recommendations",
        topK: 8,
        sessionId: "test-session-3"
      })
    });
    
    const data3 = await response3.json();
    console.log(`  Status: ${response3.status}`);
    console.log(`  Type: ${data3.type}`);
    console.log(`  Confidence: ${data3.confidence}%`);
    console.log(`  Has Answer: ${!!data3.answer}`);
    console.log(`  Debug: ${JSON.stringify(data3.debug || {}, null, 2)}\n`);
  } catch (error) {
    console.log(`  Error: ${error.message}\n`);
  }
  
  // Test 4: Clarification follow-up simulation
  console.log("Test 4: Clarification follow-up - 'tripod recommendations' with previous query");
  try {
    const response4 = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: "tripod recommendations",
        previousQuery: "photography equipment advice",
        topK: 8,
        sessionId: "test-session-4"
      })
    });
    
    const data4 = await response4.json();
    console.log(`  Status: ${response4.status}`);
    console.log(`  Type: ${data4.type}`);
    console.log(`  Confidence: ${data4.confidence}%`);
    console.log(`  Has Answer: ${!!data4.answer}`);
    console.log(`  Original Query: ${data4.original_query}`);
    console.log(`  Debug: ${JSON.stringify(data4.debug || {}, null, 2)}\n`);
  } catch (error) {
    console.log(`  Error: ${error.message}\n`);
  }
  
  console.log("✅ Live system testing complete!");
}

// Run the tests
testLiveSystem().catch(console.error);
