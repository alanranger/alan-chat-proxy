// Simple test of exhaustive clarification paths
import fetch from 'node-fetch';

async function testSingleQuery() {
  console.log('🧪 Testing single query with clarification paths...');
  
  const query = "What is your refund and cancellation policy?";
  const sessionId = 'test-session-' + Date.now();
  
  try {
    console.log(`📝 Query: "${query}"`);
    
    const response = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        sessionId: sessionId
      })
    });
    
    const data = await response.json();
    console.log(`✅ Response type: ${data.type}`);
    console.log(`📊 Confidence: ${data.confidence}%`);
    
    if (data.type === 'clarification' && data.options) {
      console.log(`🤔 Found ${data.options.length} clarification options:`);
      data.options.forEach((option, i) => {
        console.log(`   ${i+1}. ${option.text}`);
      });
      
      // Test first clarification option
      if (data.options.length > 0) {
        const firstOption = data.options[0];
        console.log(`\n🌿 Testing first option: "${firstOption.text}"`);
        
        const followupResponse = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: firstOption.query || firstOption.text,
            sessionId: sessionId
          })
        });
        
        const followupData = await followupResponse.json();
        console.log(`✅ Followup response type: ${followupData.type}`);
        console.log(`📊 Followup confidence: ${followupData.confidence}%`);
        
        if (followupData.type === 'clarification' && followupData.options) {
          console.log(`🤔 Followup has ${followupData.options.length} more options`);
        } else {
          console.log(`🎯 Final response reached`);
        }
      }
    } else {
      console.log(`🎯 Direct response (no clarification needed)`);
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

testSingleQuery();
