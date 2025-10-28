#!/usr/bin/env node

/**
 * Debug script to test 1-day workshops specifically
 */

const API_URL = 'https://alan-chat-proxy.vercel.app/api/chat';

async function debugOneDayWorkshops() {
  console.log('🔍 Debugging 1-day workshops...');
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: "one day photography workshops",
        pageContext: {
          clarificationLevel: 1,
          previousQuery: "What photography workshops do you have?"
        },
        sessionId: "debug-one-day"
      })
    });

    const data = await response.json();
    
    console.log('📊 Response:', JSON.stringify(data, null, 2));
    
    if (data.events && data.events.length === 0) {
      console.log('❌ No events found - this suggests findEventsByDuration is not working');
    } else {
      console.log(`✅ Found ${data.events?.length || 0} events`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugOneDayWorkshops();




