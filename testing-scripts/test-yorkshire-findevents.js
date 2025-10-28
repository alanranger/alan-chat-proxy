// Test findEvents function for Yorkshire workshop query
const query = "when is your next yorkshire workshop";
console.log(`Testing findEvents for: "${query}"`);

try {
  const response = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  
  if (!response.ok) {
    console.log(`❌ HTTP Error: ${response.status}`);
    process.exit(1);
  }
  
  const data = await response.json();
  console.log(`Response type: ${data.type}`);
  console.log(`Confidence: ${data.confidence}%`);
  console.log(`Debug Intent: ${data.debug?.debugInfo?.intent || data.debug?.intent}`);
  console.log(`Events found: ${data.events?.length || 0}`);
  
  if (data.debug?.debugInfo) {
    console.log(`Debug Info:`, JSON.stringify(data.debug.debugInfo, null, 2));
  }
  
  if (data.events && data.events.length > 0) {
    console.log(`First event:`, JSON.stringify(data.events[0], null, 2));
  }
  
} catch (error) {
  console.log(`❌ Error: ${error.message}`);
}


