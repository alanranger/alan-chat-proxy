// Using built-in fetch (Node 18+)

async function testExposureTriangle() {
  console.log('🔍 Testing "what is exposure triangle" with debug logging...\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'what is exposure triangle'
      })
    });
    
    const result = await response.json();
    
    console.log('📊 RESULT:');
    console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`Answer length: ${result.answer?.length || 0} characters`);
    console.log(`Answer preview: ${result.answer?.substring(0, 200)}...`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testExposureTriangle();