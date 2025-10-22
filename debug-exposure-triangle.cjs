const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function debugExposureTriangle() {
  console.log('🔍 Debugging "exposure triangle" response...\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'what is exposure triangle',
        sessionId: 'debug-session'
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
    
    console.log('\n📝 Full Answer Content:');
    console.log('═'.repeat(80));
    console.log(data.answer || 'No answer provided');
    console.log('═'.repeat(80));
    
    // Check for specific concept synthesis indicators
    const answer = data.answer?.toLowerCase() || '';
    console.log('\n🔍 Concept Analysis:');
    console.log(`Contains "triangle": ${answer.includes('triangle')}`);
    console.log(`Contains "relationship": ${answer.includes('relationship')}`);
    console.log(`Contains "aperture": ${answer.includes('aperture')}`);
    console.log(`Contains "shutter": ${answer.includes('shutter')}`);
    console.log(`Contains "iso": ${answer.includes('iso')}`);
    console.log(`Contains "work together": ${answer.includes('work together')}`);
    console.log(`Contains "compensate": ${answer.includes('compensate')}`);
    console.log(`Contains "f-stop": ${answer.includes('f-stop')}`);
    console.log(`Contains "f/": ${answer.includes('f/')}`);
    
    // Check if it's talking about F-stops instead of the relationship
    if (answer.includes('f-stop') || answer.includes('f/')) {
      console.log('\n⚠️ ISSUE: Response is focusing on F-stops instead of the exposure triangle relationship');
    }
    
    if (answer.includes('triangle') && answer.includes('relationship')) {
      console.log('\n✅ GOOD: Response mentions both triangle and relationship');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugExposureTriangle();
