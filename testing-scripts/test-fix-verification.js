// Quick test to verify the fix works
import fetch from 'node-fetch';

async function testLightroomCourseQuery() {
  console.log('🧪 Testing Lightroom course query fix...');
  
  const query = "When is the next Lightroom course in Coventry?";
  
  try {
    const response = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: query,
        pageContext: null
      })
    });
    
    const data = await response.json();
    
    console.log('📊 API Response:');
    console.log(`   Type: ${data.type}`);
    console.log(`   Confidence: ${data.confidence}`);
    console.log(`   Events count: ${data.structured?.events?.length || 0}`);
    console.log(`   Answer: ${data.answer_markdown || data.answer || 'No answer'}`);
    
    if (data.structured?.events?.length > 0) {
      console.log('✅ SUCCESS: Events found in API response');
      console.log('   Events:');
      data.structured.events.forEach((event, i) => {
        console.log(`     ${i + 1}. ${event.title} - ${event.date} - ${event.location}`);
      });
    } else {
      console.log('❌ FAILED: No events in API response');
      console.log('   This means the fix did not work');
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

testLightroomCourseQuery();
