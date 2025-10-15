// Test the clarification chain to see if our debug info is working
const API_URL = 'https://alan-chat-proxy.vercel.app/api/chat';

async function testClarificationChain() {
  console.log('🧪 Testing clarification chain...\n');
  
  // Step 1: Initial question
  console.log('Step 1: "do you do courses"');
  const response1 = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'do you do courses' })
  });
  
  const result1 = await response1.json();
  console.log('Response 1:', JSON.stringify(result1, null, 2));
  
  if (result1.type === 'clarification') {
    console.log('\n✅ Got clarification response');
    
    // Step 2: Follow up with "Online courses (free and paid)"
    console.log('\nStep 2: "Online courses (free and paid)"');
    const response2 = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query: 'Online courses (free and paid)',
        previousQuery: 'do you do courses'
      })
    });
    
    const result2 = await response2.json();
    console.log('Response 2:', JSON.stringify(result2, null, 2));
    
    if (result2.type === 'clarification') {
      console.log('\n✅ Got second clarification response');
      
      // Step 3: Follow up with "Free online photography course"
      console.log('\nStep 3: "Free online photography course"');
      const response3 = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: 'Free online photography course',
          previousQuery: 'do you do courses'
        })
      });
      
      const result3 = await response3.json();
      console.log('Response 3:', JSON.stringify(result3, null, 2));
      
      if (result3.debug && result3.debug.servicesFound) {
        console.log('\n🔍 Debug info found:');
        console.log('Services found:', result3.debug.servicesFound);
        console.log('Is free course query:', result3.debug.isFreeCourseQuery);
        console.log('New query:', result3.debug.newQuery);
      }
      
      console.log('\n📊 Summary:');
      console.log('Step 1 (do you do courses):', result1.type);
      console.log('Step 2 (Online courses):', result2.type, '- Answer preview:', result2.answer_markdown?.substring(0, 100) + '...');
      console.log('Step 3 (Free online course):', result3.type, '- Answer preview:', result3.answer_markdown?.substring(0, 100) + '...');
    }
  }
}

testClarificationChain().catch(console.error);
