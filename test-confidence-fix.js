#!/usr/bin/env node

// Quick test to verify confidence scoring fix

async function testConfidenceFix() {
  console.log('🧪 Testing Confidence Scoring Fix\n');
  
  const testQueries = [
    'what is iso',
    'what tripod do you recommend', 
    'whens the next bluebell workshops and whats the cost',
    'beginners photography course'
  ];
  
  for (const query of testQueries) {
    try {
      const response = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, pageContext: null })
      });
      
      const data = await response.json();
      const confidence = data.confidence || 0;
      const isLowConfidence = confidence < 0.6; // Fixed threshold
      
      console.log(`Query: "${query}"`);
      console.log(`  Confidence: ${confidence} (${(confidence * 100).toFixed(1)}%)`);
      console.log(`  Is Low Confidence: ${isLowConfidence}`);
      console.log(`  Articles: ${data.structured?.articles?.length || 0}`);
      console.log(`  Events: ${data.structured?.events?.length || 0}`);
      console.log(`  Products: ${data.structured?.products?.length || 0}\n`);
      
    } catch (error) {
      console.log(`❌ Error testing "${query}": ${error.message}\n`);
    }
  }
}

testConfidenceFix().catch(console.error);

