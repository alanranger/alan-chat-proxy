// Debug the actual API response to see what's happening
import fetch from 'node-fetch';

const API_URL = 'https://alan-chat-proxy.vercel.app/api/chat';

async function debugApiResponse(query) {
  console.log(`🔍 Debugging API response for: "${query}"`);
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log(`📊 Full API Response:`);
    console.log(JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

async function debugAllQueries() {
  console.log('🔍 DEBUGGING API RESPONSES');
  console.log('==========================\n');
  
  // Test 1: Initial workshop query
  console.log('TEST 1: "photography workshops"');
  console.log('===============================');
  await debugApiResponse('photography workshops');
  console.log('\n');
  
  // Test 2: Direct category query
  console.log('TEST 2: "2.5hr - 4hr workshops"');
  console.log('===============================');
  await debugApiResponse('2.5hr - 4hr workshops');
  console.log('\n');
  
  // Test 3: 1-day query
  console.log('TEST 3: "1 day workshops"');
  console.log('========================');
  await debugApiResponse('1 day workshops');
}

debugAllQueries().catch(console.error);



