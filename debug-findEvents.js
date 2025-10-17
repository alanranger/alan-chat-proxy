// Debug the findEvents function to see what's happening
import fetch from 'node-fetch';

async function debugFindEvents() {
  console.log('🔍 Debugging findEvents function...');
  
  const query = "When is the next Lightroom course in Coventry?";
  
  try {
    const response = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: query,
        pageContext: null,
        debug: true // Add debug flag if the API supports it
      })
    });
    
    const data = await response.json();
    
    console.log('📊 Full API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    // Check if there's debug info
    if (data.debug) {
      console.log('\n🔍 Debug Info:');
      console.log(JSON.stringify(data.debug, null, 2));
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

debugFindEvents();
