// Test the clarification logic functions without database
import fs from 'fs';

// Read the chat.js file and extract the functions we need to test
const chatCode = fs.readFileSync('./api/chat.js', 'utf8');

// Extract the functions we need to test
const extractFunction = (name) => {
  const regex = new RegExp(`function ${name}\\([^)]*\\)\\s*{([\\s\\S]*?)^}`, 'm');
  const match = chatCode.match(regex);
  return match ? match[1] : null;
};

// Test the clarification logic
function testClarificationLogic() {
  console.log('🧪 Testing Clarification Logic...\n');
  
  // Test 1: Check if generateClarificationQuestion exists and has the right patterns
  console.log('🔍 Test 1: Checking generateClarificationQuestion function');
  if (chatCode.includes('function generateClarificationQuestion')) {
    console.log('✅ generateClarificationQuestion function exists');
    
    // Check for the new clarification patterns
    if (chatCode.includes('general photography equipment advice clarification')) {
      console.log('✅ General equipment advice clarification pattern exists');
    } else {
      console.log('❌ General equipment advice clarification pattern missing');
    }
    
    if (chatCode.includes('equipment for photography course type clarification')) {
      console.log('✅ Course equipment clarification pattern exists');
    } else {
      console.log('❌ Course equipment clarification pattern missing');
    }
  } else {
    console.log('❌ generateClarificationQuestion function missing');
  }
  
  // Test 2: Check if handleClarificationFollowUp has the right routing
  console.log('\n🔍 Test 2: Checking handleClarificationFollowUp function');
  if (chatCode.includes('function handleClarificationFollowUp')) {
    console.log('✅ handleClarificationFollowUp function exists');
    
    // Check for the new routing logic
    if (chatCode.includes('general photography equipment advice clarification')) {
      console.log('✅ General equipment advice routing exists');
    } else {
      console.log('❌ General equipment advice routing missing');
    }
    
    if (chatCode.includes('camera recommendations') && chatCode.includes('lens recommendations')) {
      console.log('✅ Equipment-specific routing exists');
    } else {
      console.log('❌ Equipment-specific routing missing');
    }
  } else {
    console.log('❌ handleClarificationFollowUp function missing');
  }
  
  // Test 3: Check if RAG confidence calculation exists
  console.log('\n🔍 Test 3: Checking RAG confidence calculation');
  if (chatCode.includes('function calculateRAGConfidence')) {
    console.log('✅ calculateRAGConfidence function exists');
  } else {
    console.log('❌ calculateRAGConfidence function missing');
  }
  
  // Test 4: Check if confidence is used in responses
  console.log('\n🔍 Test 4: Checking confidence usage in responses');
  if (chatCode.includes('ragConfidence') && chatCode.includes('confidencePercent')) {
    console.log('✅ RAG-based confidence is used in responses');
  } else {
    console.log('❌ RAG-based confidence not used in responses');
  }
  
  console.log('\n🎯 Summary: Clarification logic implementation check complete');
}

testClarificationLogic();
