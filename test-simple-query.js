// Test simple query to see if API is working
const query = "test";
console.log(`Testing simple query: "${query}"`);

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
  console.log(`✅ Response type: ${data.type}`);
  console.log(`✅ Confidence: ${data.confidence}%`);
  
} catch (error) {
  console.log(`❌ Error: ${error.message}`);
}


