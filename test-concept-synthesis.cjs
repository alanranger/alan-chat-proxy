const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testConceptSynthesis() {
  console.log('🧪 Testing concept synthesis for "exposure triangle"...\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'what is exposure triangle',
        sessionId: 'test-session'
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('📊 Response Analysis:');
    console.log(`✅ Success: ${data.success}`);
    console.log(`📝 Answer Length: ${data.answer?.length || 0} characters`);
    console.log(`🎯 Type: ${data.type}`);
    console.log(`📚 Sources: ${data.sources?.length || 0} sources`);
    
    console.log('\n📝 Answer Content:');
    console.log('─'.repeat(50));
    console.log(data.answer || 'No answer provided');
    console.log('─'.repeat(50));
    
    // Check for concept synthesis indicators
    const answer = data.answer?.toLowerCase() || '';
    const hasRelationship = answer.includes('relationship') || answer.includes('triangle');
    const hasAperture = answer.includes('aperture');
    const hasShutter = answer.includes('shutter');
    const hasIso = answer.includes('iso');
    const hasSynthesis = answer.includes('work together') || answer.includes('compensate');
    
    console.log('\n🔍 Concept Synthesis Analysis:');
    console.log(`✅ Mentions relationship/triangle: ${hasRelationship}`);
    console.log(`✅ Mentions aperture: ${hasAperture}`);
    console.log(`✅ Mentions shutter: ${hasShutter}`);
    console.log(`✅ Mentions ISO: ${hasIso}`);
    console.log(`✅ Has synthesis language: ${hasSynthesis}`);
    
    const synthesisScore = [hasRelationship, hasAperture, hasShutter, hasIso, hasSynthesis].filter(Boolean).length;
    console.log(`\n📊 Synthesis Score: ${synthesisScore}/5`);
    
    if (synthesisScore >= 4) {
      console.log('🎉 EXCELLENT: Concept synthesis is working!');
    } else if (synthesisScore >= 3) {
      console.log('✅ GOOD: Some concept synthesis detected');
    } else {
      console.log('⚠️ POOR: Limited concept synthesis');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testConceptSynthesis();
