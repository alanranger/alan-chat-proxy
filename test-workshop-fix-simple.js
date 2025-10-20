// Simple test for workshop classification fix
const testQueries = [
  "when is your next wales workshop",
  "when is your next devon workshop", 
  "when is your next yorkshire workshop"
];

console.log('Testing workshop classification fix...\n');

for (const query of testQueries) {
  console.log(`Testing: "${query}"`);
  
  try {
    const response = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    
    if (!response.ok) {
      console.log(`❌ HTTP Error: ${response.status}`);
      continue;
    }
    
    const data = await response.json();
    console.log(`✅ Type: ${data.type}, Confidence: ${data.confidence}%`);
    console.log(`   Debug Intent: ${data.debug?.debugInfo?.intent || data.debug?.intent}`);
    console.log(`   Events: ${data.events?.length || 0}`);
    console.log('');
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
  }
}

console.log('Test complete');
