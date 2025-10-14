#!/usr/bin/env node

/**
 * Test the live system to see what's actually happening with course follow-ups
 */

const API_BASE = 'https://alan-chat-proxy.vercel.app';

async function testLiveSystem() {
  console.log("🔍 Testing Live System - Course Follow-ups\n");
  
  try {
    // Test 1: Initial query
    console.log("1. Testing initial query: 'do you do courses'");
    const response1 = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: "do you do courses",
        topK: 8,
        sessionId: "test-live-debug"
      })
    });
    
    const data1 = await response1.json();
    console.log(`   Type: ${data1.type}`);
    console.log(`   Confidence: ${data1.confidence}%`);
    console.log(`   Question: ${data1.question}`);
    console.log(`   Options: ${data1.options?.map(o => o.text).join(', ')}`);
    
    // Test 2: Follow-up query
    console.log("\n2. Testing follow-up: 'Online courses (free and paid)'");
    const response2 = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: "Online courses (free and paid)",
        previousQuery: "do you do courses",
        topK: 8,
        sessionId: "test-live-debug"
      })
    });
    
    const data2 = await response2.json();
    console.log(`   Type: ${data2.type}`);
    console.log(`   Confidence: ${data2.confidence}%`);
    console.log(`   Has Answer: ${!!data2.answer}`);
    console.log(`   Has Events: ${data2.structured?.events?.length || 0}`);
    console.log(`   Has Products: ${data2.structured?.products?.length || 0}`);
    
    if (data2.debug) {
      console.log(`   Debug Info:`, JSON.stringify(data2.debug, null, 2));
    }
    
    console.log("\n📋 Full Response:");
    console.log(JSON.stringify(data2, null, 2));
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

testLiveSystem().catch(console.error);
