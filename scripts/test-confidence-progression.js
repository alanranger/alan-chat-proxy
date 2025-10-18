// Test script to verify confidence progression: 10% → 50% → 80%
import fetch from 'node-fetch';

const API_URL = 'https://alan-chat-proxy.vercel.app/api/chat';

// Test the confidence progression system
async function testConfidenceProgression() {
  console.log('🧪 Testing Confidence Progression System\n');
  
  const testQuery = "What photography workshops do you have?";
  console.log(`📝 Test Query: "${testQuery}"`);
  
  try {
    // Step 1: Initial query (should be 20% confidence)
    console.log('\n1️⃣ Initial Query (Expected: 20% confidence)');
    const response1 = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: testQuery })
    });
    
    const result1 = await response1.json();
    console.log(`   Response Type: ${result1.type}`);
    console.log(`   Confidence: ${result1.confidence}%`);
    console.log(`   Options: ${result1.options?.length || 0} options`);
    
    if (result1.options && result1.options.length > 0) {
      console.log('   📋 Options:');
      result1.options.forEach((option, i) => {
        console.log(`      ${i + 1}. ${option.text}`);
      });
      
      // Step 2: User selects first option (should be 50% confidence)
      console.log('\n2️⃣ User Selection (Expected: 50% confidence)');
      const selectedOption = result1.options[0].query;
      console.log(`   Selected: "${selectedOption}"`);
      
      const response2 = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: selectedOption,
          previousQuery: testQuery,
          intent: 'clarification'
        })
      });
      
      const result2 = await response2.json();
      console.log(`   Response Type: ${result2.type}`);
      console.log(`   Confidence: ${result2.confidence}%`);
      console.log(`   Options: ${result2.options?.length || 0} options`);
      
      if (result2.options && result2.options.length > 0) {
        console.log('   📋 Options:');
        result2.options.forEach((option, i) => {
          console.log(`      ${i + 1}. ${option.text}`);
        });
        
        // Step 3: User selects second option (should be 80% confidence or results)
        console.log('\n3️⃣ Second User Selection (Expected: 80% confidence or results)');
        const selectedOption2 = result2.options[0].query;
        console.log(`   Selected: "${selectedOption2}"`);
        
        const response3 = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: selectedOption2,
            previousQuery: selectedOption,
            intent: 'clarification'
          })
        });
        
        const result3 = await response3.json();
        console.log(`   Response Type: ${result3.type}`);
        console.log(`   Confidence: ${result3.confidence}%`);
        
        if (result3.type === 'events' || result3.type === 'advice') {
          console.log('   ✅ System provided final results (confidence progression working)');
          if (result3.events) {
            console.log(`   📊 Events Found: ${result3.events.length}`);
          }
        } else if (result3.type === 'clarification') {
          console.log('   ⚠️ System still asking for clarification (may need more levels)');
        }
      }
    }
    
    // Analysis
    console.log('\n📊 Analysis:');
    const confidence1 = result1.confidence;
    const confidence2 = result2?.confidence;
    const confidence3 = result3?.confidence;
    
    console.log(`   • Initial confidence: ${confidence1}%`);
    console.log(`   • After 1st selection: ${confidence2}%`);
    console.log(`   • After 2nd selection: ${confidence3}%`);
    
    // Check if confidence is progressing
    if (confidence2 > confidence1) {
      console.log('   ✅ Confidence is progressing upward');
    } else {
      console.log('   ❌ Confidence is not progressing (stuck at same level)');
    }
    
    // Check if we're getting meaningful options
    const hasMeaningfulOptions = result1.options?.some(opt => 
      opt.text.includes('workshops') && !opt.text.includes('services')
    );
    
    if (hasMeaningfulOptions) {
      console.log('   ✅ Evidence-based clarification is generating meaningful options');
    } else {
      console.log('   ❌ Evidence-based clarification is still generating generic options');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  console.log('\n✅ Test Complete');
}

// Run the test
testConfidenceProgression().catch(console.error);
