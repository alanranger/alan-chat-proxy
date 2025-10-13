#!/usr/bin/env node

// Test the new nuanced confidence scoring system

async function testNuancedConfidence() {
  console.log('🧪 Testing Nuanced Confidence Scoring System\n');
  
  const testQueries = [
    // High confidence queries
    'what is iso in photography',
    'what tripod do you recommend for beginners',
    'when is the next bluebell workshop and how much does it cost',
    'beginners photography course coventry',
    
    // Medium confidence queries
    'photography tips',
    'camera settings',
    'workshop information',
    
    // Lower confidence queries
    'random question about nothing',
    'xyz abc def',
    'completely unrelated topic'
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
      const isLowConfidence = confidence < 0.6;
      
      console.log(`Query: "${query}"`);
      console.log(`  Confidence: ${confidence} (${(confidence * 100).toFixed(1)}%)`);
      console.log(`  Is Low Confidence: ${isLowConfidence}`);
      console.log(`  Articles: ${data.structured?.articles?.length || 0}`);
      console.log(`  Events: ${data.structured?.events?.length || 0}`);
      console.log(`  Products: ${data.structured?.products?.length || 0}`);
      console.log(`  Intent: ${data.structured?.intent || 'unknown'}`);
      console.log('');
      
    } catch (error) {
      console.log(`❌ Error testing "${query}": ${error.message}\n`);
    }
  }
}

testNuancedConfidence().catch(console.error);

