#!/usr/bin/env node

// Simple test to check if the chat API is working
import fetch from 'node-fetch';

async function testChatAPI() {
  console.log('🧪 Testing Chat API...');
  
  try {
    const response = await fetch('https://chat-ai-bot-eta.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'what is iso',
        sessionId: 'test-session'
      })
    });
    
    if (!response.ok) {
      console.log(`❌ API Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log(`Error details: ${errorText}`);
      return;
    }
    
    const data = await response.json();
    console.log('✅ API Response received');
    console.log(`Response: ${data.response ? data.response.substring(0, 100) + '...' : 'undefined'}`);
    console.log(`Confidence: ${data.confidence}%`);
    console.log(`Intent: ${data.intent}`);
    
  } catch (error) {
    console.log(`❌ Network Error: ${error.message}`);
  }
}

testChatAPI();
