// Test the classification fix
const testClassificationFix = async () => {
  const queries = [
    "when is your next wales workshop",
    "when is your next devon workshop", 
    "when is your next yorkshire workshop"
  ];
  
  for (const query of queries) {
    try {
      const response = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      if (!response.ok) {
        console.log(`❌ HTTP Error: ${response.status} for "${query}"`);
        continue;
      }
      
      const data = await response.json();
      console.log(`🔍 "${query}"`);
      console.log(`   Type: ${data.type}, Confidence: ${data.confidence}%, Events: ${data.events?.length || 0}`);
      
      // Check if debugInfo exists and what intent it shows
      if (data.debug && data.debug.debugInfo) {
        console.log(`   Debug Intent: ${data.debug.debugInfo.intent}`);
      } else if (data.debug && data.debug.intent) {
        console.log(`   Debug Intent: ${data.debug.intent}`);
      } else {
        console.log(`   Debug Intent: NOT FOUND`);
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`❌ Error for "${query}": ${error.message}`);
    }
  }
};

testClassificationFix();


