// Test the complete clarification flow
import handler from './api/chat.js';

async function testClarificationFlow() {
  console.log('🧪 Testing Clarification Flow...\n');
  
  // Mock request/response objects
  const mockReq = {
    method: 'POST',
    body: {
      query: 'photography equipment advice',
      sessionId: 'test-session-123'
    }
  };
  
  const mockRes = {
    status: (code) => ({ json: (data) => {
      console.log(`📤 Response (${code}):`, JSON.stringify(data, null, 2));
      return data;
    }})
  };
  
  try {
    console.log('🔍 Test 1: Initial vague query "photography equipment advice"');
    await handler(mockReq, mockRes);
    
    console.log('\n🔍 Test 2: Follow-up "General photography equipment advice"');
    mockReq.body.query = 'General photography equipment advice';
    await handler(mockReq, mockRes);
    
    console.log('\n🔍 Test 3: Follow-up "Camera recommendations"');
    mockReq.body.query = 'Camera recommendations';
    await handler(mockReq, mockRes);
    
    console.log('\n🔍 Test 4: Course path "Equipment for photography courses/workshops"');
    mockReq.body.query = 'Equipment for photography courses/workshops';
    await handler(mockReq, mockRes);
    
    console.log('\n🔍 Test 5: Course follow-up "Beginners camera course"');
    mockReq.body.query = 'Beginners camera course';
    await handler(mockReq, mockRes);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testClarificationFlow();
