// Test only the clarification system
import fetch from 'node-fetch';

const API_URL = 'https://alan-chat-proxy.vercel.app/api/chat';

async function testClarification(query) {
  console.log(`🔍 Testing clarification for: "${query}"`);
  
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
    
    console.log(`📊 Response Type: ${result.type || 'unknown'}`);
    console.log(`📊 Has Clarification: ${!!result.clarification}`);
    console.log(`📊 Has Events: ${!!result.events}`);
    console.log(`📊 Confidence: ${result.confidence || 'N/A'}`);
    
    if (result.clarification) {
      console.log(`❓ Clarification Question: ${result.question}`);
      console.log(`📋 Options:`);
      result.clarification.forEach((option, index) => {
        console.log(`   ${index + 1}. ${option}`);
      });
    }
    
    if (result.events) {
      console.log(`📅 Events Count: ${result.events.length}`);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

async function testClarificationQueries() {
  console.log('🔍 TESTING CLARIFICATION SYSTEM');
  console.log('===============================\n');
  
  const testQueries = [
    'photography workshops',
    'workshops near me', 
    'short photography workshops',
    'do you run workshops',
    'what workshops do you have',
    'workshop courses'
  ];
  
  for (const query of testQueries) {
    await testClarification(query);
    console.log('\n');
  }
}

testClarificationQueries().catch(console.error);



