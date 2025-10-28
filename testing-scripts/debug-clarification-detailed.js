// Debug the clarification system in detail
import fetch from 'node-fetch';

const API_URL = 'https://alan-chat-proxy.vercel.app/api/chat';

async function debugClarificationDetailed(query) {
  console.log(`🔍 DETAILED DEBUG for: "${query}"`);
  console.log('=====================================');
  
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
    console.log(`📊 Has Question: ${!!result.question}`);
    console.log(`📊 Has Options: ${!!result.options}`);
    console.log(`📊 Options Count: ${result.options?.length || 0}`);
    console.log(`📊 Confidence: ${result.confidence || 'N/A'}`);
    console.log(`📊 Debug Version: ${result.debug?.version || 'N/A'}`);
    console.log(`📊 Debug Intent: ${result.debug?.intent || 'N/A'}`);
    
    if (result.question) {
      console.log(`❓ Question: ${result.question}`);
    }
    
    if (result.options && result.options.length > 0) {
      console.log(`📋 Options:`);
      result.options.forEach((option, index) => {
        if (typeof option === 'string') {
          console.log(`   ${index + 1}. ${option}`);
        } else if (option.text) {
          console.log(`   ${index + 1}. ${option.text}`);
        } else {
          console.log(`   ${index + 1}. ${JSON.stringify(option)}`);
        }
      });
    }
    
    if (result.events) {
      console.log(`📅 Events Count: ${result.events.length}`);
    }
    
    console.log(`\n📋 Full Response:`);
    console.log(JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

async function debugAllQueries() {
  console.log('🔍 DETAILED CLARIFICATION DEBUG');
  console.log('===============================\n');
  
  const testQueries = [
    'photography workshops',
    'do you run workshops',
    'what workshops do you have'
  ];
  
  for (const query of testQueries) {
    await debugClarificationDetailed(query);
    console.log('\n' + '='.repeat(50) + '\n');
  }
}

debugAllQueries().catch(console.error);



