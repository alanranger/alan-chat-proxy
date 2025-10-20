#!/usr/bin/env node

/**
 * Debug script to test pageContext handling
 */

const API_URL = 'https://alan-chat-proxy.vercel.app/api/chat';

async function debugPageContext() {
  console.log('🔍 Debugging pageContext handling...');
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: "1 day workshops",
        pageContext: {
          clarificationLevel: 1,
          previousQuery: "What photography workshops do you have?"
        },
        sessionId: "debug-pagecontext"
      })
    });

    const data = await response.json();
    
    console.log('📊 Response:', JSON.stringify(data, null, 2));
    
    // Check if we can see the debug logs in the response
    if (data.debug && data.debug.debugInfo) {
      console.log('🔍 Debug Info:', JSON.stringify(data.debug.debugInfo, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugPageContext();




