// Test script to run key queries and collect results
async function testQueries() {
  const queries = [
    'what tripod do you recommend',
    'when is your next wales workshop', 
    'when is your next lightroom course',
    'what is ISO'
  ];
  
  const results = [];
  
  console.log('🧪 Testing key queries...\n');
  
  for (const query of queries) {
    try {
      console.log(`🔍 Testing: "${query}"`);
      
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      const data = await response.json();
      
      const result = {
        query,
        type: data.type,
        confidence: data.confidence,
        answerLength: data.type === 'events' 
          ? (data.structured?.events?.length || 0)
          : (data.answer_markdown || data.answer || '').length,
        debugIntent: data.debugInfo?.intent,
        debugApproach: data.debugInfo?.approach,
        success: true
      };
      
      results.push(result);
      
      console.log(`✅ ${query}:`);
      console.log(`   Type: ${data.type}`);
      console.log(`   Confidence: ${data.confidence}`);
      const answerLength = data.type === 'events' 
        ? (data.structured?.events?.length || 0)
        : (data.answer_markdown || data.answer || '').length;
      console.log(`   Answer Length: ${answerLength} ${data.type === 'events' ? 'events' : 'chars'}`);
      console.log(`   Debug Intent: ${data.debugInfo?.intent}`);
      console.log(`   Debug Approach: ${data.debugInfo?.approach}`);
      console.log('');
      
    } catch (error) {
      const result = {
        query,
        error: error.message,
        success: false
      };
      
      results.push(result);
      console.log(`❌ ${query}: ${error.message}\n`);
    }
  }
  
  console.log('=== SUMMARY ===');
  results.forEach(r => {
    if (r.success) {
      const unit = r.type === 'events' ? 'events' : 'chars';
      console.log(`${r.query}: ${r.type} (${r.confidence}) - ${r.answerLength} ${unit}`);
    } else {
      console.log(`${r.query}: ERROR - ${r.error}`);
    }
  });
  
  return results;
}

// Run the tests
testQueries().catch(console.error);
