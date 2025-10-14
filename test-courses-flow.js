#!/usr/bin/env node

/**
 * Test Courses Flow - The Issue Shown in the Image
 */

const API_BASE = 'https://alan-chat-proxy.vercel.app';

async function testCoursesFlow() {
  console.log("🧪 Testing Courses Flow - The Issue from the Image\n");
  
  // Test 1: Initial query "do you do courses"
  console.log("Test 1: Initial query - 'do you do courses'");
  try {
    const response1 = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: "do you do courses",
        topK: 8,
        sessionId: "test-courses-1"
      })
    });
    
    const data1 = await response1.json();
    console.log(`  Status: ${response1.status}`);
    console.log(`  Type: ${data1.type}`);
    console.log(`  Confidence: ${data1.confidence}%`);
    console.log(`  Has Answer: ${!!data1.answer}`);
    console.log(`  Is Clarification: ${data1.type === 'clarification'}`);
    if (data1.type === 'clarification') {
      console.log(`  Question: ${data1.question}`);
      console.log(`  Options: ${data1.options?.map(o => o.text).join(', ')}`);
    }
    console.log();
  } catch (error) {
    console.log(`  Error: ${error.message}\n`);
  }
  
  // Test 2: Follow-up "Beginner courses" (as shown in image)
  console.log("Test 2: Follow-up - 'Beginner courses' with previous query");
  try {
    const response2 = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: "Beginner courses",
        previousQuery: "do you do courses",
        topK: 8,
        sessionId: "test-courses-2"
      })
    });
    
    const data2 = await response2.json();
    console.log(`  Status: ${response2.status}`);
    console.log(`  Type: ${data2.type}`);
    console.log(`  Confidence: ${data2.confidence}%`);
    console.log(`  Has Answer: ${!!data2.answer}`);
    console.log(`  Has Answer Markdown: ${!!data2.answer_markdown}`);
    console.log(`  Original Query: ${data2.original_query}`);
    console.log(`  Original Intent: ${data2.original_intent}`);
    if (data2.answer_markdown) {
      console.log(`  Answer Preview: ${data2.answer_markdown.substring(0, 100)}...`);
    }
    console.log();
  } catch (error) {
    console.log(`  Error: ${error.message}\n`);
  }
  
  // Test 3: Follow-up "In-person courses in Coventry"
  console.log("Test 3: Follow-up - 'In-person courses in Coventry' with previous query");
  try {
    const response3 = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: "In-person courses in Coventry",
        previousQuery: "do you do courses",
        topK: 8,
        sessionId: "test-courses-3"
      })
    });
    
    const data3 = await response3.json();
    console.log(`  Status: ${response3.status}`);
    console.log(`  Type: ${data3.type}`);
    console.log(`  Confidence: ${data3.confidence}%`);
    console.log(`  Has Answer: ${!!data3.answer}`);
    console.log(`  Has Answer Markdown: ${!!data3.answer_markdown}`);
    if (data3.answer_markdown) {
      console.log(`  Answer Preview: ${data3.answer_markdown.substring(0, 100)}...`);
    }
    console.log();
  } catch (error) {
    console.log(`  Error: ${error.message}\n`);
  }
  
  // Test 4: Follow-up "Online courses (free and paid)"
  console.log("Test 4: Follow-up - 'Online courses (free and paid)' with previous query");
  try {
    const response4 = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: "Online courses (free and paid)",
        previousQuery: "do you do courses",
        topK: 8,
        sessionId: "test-courses-4"
      })
    });
    
    const data4 = await response4.json();
    console.log(`  Status: ${response4.status}`);
    console.log(`  Type: ${data4.type}`);
    console.log(`  Confidence: ${data4.confidence}%`);
    console.log(`  Has Answer: ${!!data4.answer}`);
    console.log(`  Has Answer Markdown: ${!!data4.answer_markdown}`);
    if (data4.answer_markdown) {
      console.log(`  Answer Preview: ${data4.answer_markdown.substring(0, 100)}...`);
    }
    console.log();
  } catch (error) {
    console.log(`  Error: ${error.message}\n`);
  }
  
  console.log("✅ Courses flow testing complete!");
}

// Run the test
testCoursesFlow().catch(console.error);
