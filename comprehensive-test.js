// Comprehensive test script to validate the system across different query types
async function runComprehensiveTest() {
  const testQueries = [
    // Equipment queries
    'what tripod do you recommend',
    'what camera should I buy',
    'best lens for landscape photography',
    
    // Workshop queries  
    'when is your next wales workshop',
    'when is your next devon workshop',
    'when is your next yorkshire workshop',
    
    // Course queries
    'when is your next lightroom course',
    'photo editing courses',
    
    // Technical queries
    'what is ISO',
    'how to use aperture',
    'shutter speed explained',
    
    // General business queries
    'what services do you offer',
    'how much do workshops cost',
    'where are you based'
  ];
  
  const results = [];
  
  console.log('🧪 Running comprehensive test across different query types...\n');
  
  for (const query of testQueries) {
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
      
      const unit = data.type === 'events' ? 'events' : 'chars';
      console.log(`   ✅ ${data.type} (${data.confidence}) - ${result.answerLength} ${unit}`);
      
    } catch (error) {
      const result = {
        query,
        error: error.message,
        success: false
      };
      
      results.push(result);
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }
  
  console.log('\n=== COMPREHENSIVE SUMMARY ===');
  
  // Group by type
  const byType = results.reduce((acc, r) => {
    if (r.success) {
      if (!acc[r.type]) acc[r.type] = [];
      acc[r.type].push(r);
    }
    return acc;
  }, {});
  
  Object.entries(byType).forEach(([type, queries]) => {
    console.log(`\n📊 ${type.toUpperCase()} (${queries.length} queries):`);
    queries.forEach(r => {
      const unit = r.type === 'events' ? 'events' : 'chars';
      console.log(`   ${r.query}: ${r.confidence} confidence - ${r.answerLength} ${unit}`);
    });
  });
  
  // Overall stats
  const successful = results.filter(r => r.success);
  const avgConfidence = successful.reduce((sum, r) => sum + r.confidence, 0) / successful.length;
  
  console.log(`\n📈 OVERALL STATS:`);
  console.log(`   Total queries: ${results.length}`);
  console.log(`   Successful: ${successful.length}`);
  console.log(`   Failed: ${results.length - successful.length}`);
  console.log(`   Average confidence: ${avgConfidence.toFixed(2)}`);
  
  return results;
}

// Run the comprehensive test
runComprehensiveTest().catch(console.error);
