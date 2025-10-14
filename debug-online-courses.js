#!/usr/bin/env node

/**
 * Debug Online Courses Issue
 */

const API_BASE = 'https://alan-chat-proxy.vercel.app';

async function debugOnlineCourses() {
  console.log("🔍 Debugging Online Courses Issue\n");
  
  // Test the specific failing query
  const testQuery = "Online courses (free and paid)";
  const previousQuery = "do you do courses";
  
  console.log(`Testing: "${testQuery}" with previous query: "${previousQuery}"`);
  
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: testQuery,
        previousQuery: previousQuery,
        topK: 8,
        sessionId: "debug-online-courses"
      })
    });
    
    const rawResponse = await response.text();
    console.log(`Raw Response: ${rawResponse}`);
    const data = JSON.parse(rawResponse);
    
    console.log(`Response Status: ${response.status}`);
    console.log(`Response Type: ${data.type}`);
    console.log(`Confidence: ${data.confidence}%`);
    console.log(`Has Answer: ${!!data.answer}`);
    console.log(`Has Answer Markdown: ${!!data.answer_markdown}`);
    console.log(`Original Query: ${data.original_query}`);
    console.log(`Original Intent: ${data.original_intent}`);
    
    if (data.type === 'clarification') {
      console.log(`Question: ${data.question}`);
      console.log(`Options: ${data.options?.map(o => o.text).join(', ')}`);
    }
    
    console.log("\n📋 Full Response Structure:");
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

debugOnlineCourses().catch(console.error);
