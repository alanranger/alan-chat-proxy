#!/usr/bin/env node

/**
 * Debug Response Type Issue
 */

const API_BASE = 'https://alan-chat-proxy.vercel.app';

async function debugResponseType() {
  console.log("🔍 Debugging Response Type Issue\n");
  
  const testQuery = "photography help"; // This should trigger clarification
  
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: testQuery,
        topK: 8,
        sessionId: "debug-session"
      })
    });
    
    const data = await response.json();
    
    console.log(`Query: "${testQuery}"`);
    console.log(`Response Status: ${response.status}`);
    console.log(`Response Type: ${data.type}`);
    console.log(`Confidence: ${data.confidence}`);
    console.log(`Has Answer: ${!!data.answer}`);
    console.log(`Has Answer Markdown: ${!!data.answer_markdown}`);
    console.log(`Is Clarification: ${data.type === 'clarification'}`);
    
    console.log("\n📋 Full Response Structure:");
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

debugResponseType().catch(console.error);
