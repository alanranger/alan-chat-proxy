// Import the chat module to test classification directly
const chatModule = require('./api/chat.js');

const testQuery = "what camera do i need for your courses and workshops";

console.log(`🔍 Testing classification for: "${testQuery}"`);

// Test the classification function directly
try {
  const classification = chatModule.classifyQuery(testQuery);
  console.log(`📊 Classification result:`, classification);
} catch (error) {
  console.log('❌ Error calling classifyQuery:', error.message);
  console.log('Available exports:', Object.keys(chatModule));
}


