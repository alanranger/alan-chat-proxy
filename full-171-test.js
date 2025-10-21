// Full 171-question test to compare against baseline
async function runFull171Test() {
  const allQuestions = [
    // Equipment & Technical (20 questions)
    'what tripod do you recommend', 'what camera should I buy', 'best lens for landscape photography',
    'what is ISO', 'how to use aperture', 'shutter speed explained', 'what is white balance',
    'best camera for beginners', 'macro photography tips', 'night photography settings',
    'landscape photography equipment', 'portrait photography lens', 'camera bag recommendations',
    'memory card advice', 'tripod head types', 'filters for photography', 'camera cleaning tips',
    'battery life tips', 'storage solutions', 'backup strategies',
    
    // Workshops & Events (25 questions)
    'when is your next wales workshop', 'when is your next devon workshop', 'when is your next yorkshire workshop',
    'photography workshops near me', 'landscape photography workshops', 'one day photography courses',
    'weekend photography workshops', 'residential photography courses', 'private photography lessons',
    'group photography workshops', 'beginner photography workshops', 'advanced photography workshops',
    'workshop prices', 'workshop locations', 'workshop dates', 'photography tours', 'photo walks',
    'photography holidays', 'photography retreats', 'photography masterclasses',
    'workshop equipment provided', 'workshop group sizes', 'workshop experience levels',
    'workshop booking process', 'workshop cancellation policy',
    
    // Courses & Training (20 questions)
    'when is your next lightroom course', 'photo editing courses', 'lightroom training',
    'photoshop courses', 'photography courses coventry', 'online photography courses',
    'photography mentoring', 'photography tuition', 'photography lessons',
    'camera courses for beginners', 'photography evening classes', 'photography weekend courses',
    'photography diploma courses', 'photography certificate courses', 'photography degree courses',
    'photography apprenticeship', 'photography internship', 'photography work experience',
    'photography career advice', 'photography business courses',
    
    // Business & Services (15 questions)
    'what services do you offer', 'photography services near me', 'professional photography services',
    'commercial photography', 'event photography', 'wedding photography', 'portrait photography services',
    'product photography', 'real estate photography', 'corporate photography',
    'photography consultation', 'photography assessment', 'photography portfolio review',
    'photography pricing', 'photography quotes',
    
    // General Photography (30 questions)
    'how to improve photography', 'photography composition tips', 'photography lighting techniques',
    'photography exposure tips', 'photography focus techniques', 'photography color theory',
    'photography post processing', 'photography workflow', 'photography organization',
    'photography backup', 'photography storage', 'photography sharing', 'photography printing',
    'photography exhibitions', 'photography competitions', 'photography communities',
    'photography inspiration', 'photography trends', 'photography history',
    'photography genres', 'photography styles', 'photography techniques',
    'photography mistakes to avoid', 'photography beginner tips', 'photography advanced tips',
    'photography professional tips', 'photography hobby tips', 'photography travel tips',
    'photography nature tips', 'photography urban tips',
    
    // Location & Travel (20 questions)
    'where are you based', 'photography locations near me', 'best photography spots',
    'photography travel destinations', 'photography road trips', 'photography holidays abroad',
    'photography in the UK', 'photography in Europe', 'photography in America',
    'photography in Asia', 'photography in Africa', 'photography in Australia',
    'photography weather tips', 'photography seasonal tips', 'photography time of day tips',
    'photography golden hour', 'photography blue hour', 'photography night photography',
    'photography indoor tips', 'photography outdoor tips',
    
    // Specific Techniques (25 questions)
    'long exposure photography', 'macro photography', 'panoramic photography',
    'HDR photography', 'black and white photography', 'color photography',
    'abstract photography', 'street photography', 'documentary photography',
    'fine art photography', 'conceptual photography', 'experimental photography',
    'time lapse photography', 'stop motion photography', 'video photography',
    'drone photography', 'aerial photography', 'underwater photography',
    'sports photography', 'wildlife photography', 'bird photography',
    'flower photography', 'architecture photography', 'fashion photography',
    'food photography',
    
    // Equipment Specific (16 questions)
    'canon camera recommendations', 'nikon camera recommendations', 'sony camera recommendations',
    'fujifilm camera recommendations', 'olympus camera recommendations', 'panasonic camera recommendations',
    'camera lens recommendations', 'wide angle lens', 'telephoto lens', 'macro lens',
    'prime lens vs zoom lens', 'camera body vs lens investment', 'camera upgrade advice',
    'camera maintenance', 'camera insurance', 'camera accessories'
  ];
  
  const results = [];
  let processed = 0;
  
  console.log(`🧪 Running full 171-question test...\n`);
  
  for (const question of allQuestions) {
    try {
      console.log(`🔍 [${processed + 1}/171] Testing: "${question}"`);
      
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question })
      });
      
      const data = await response.json();
      
      const result = {
        question,
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
      
      processed++;
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      const result = {
        question,
        error: error.message,
        success: false
      };
      
      results.push(result);
      console.log(`   ❌ ERROR: ${error.message}`);
      processed++;
    }
  }
  
  console.log('\n=== FULL 171-QUESTION ANALYSIS ===');
  
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
    const avgConfidence = queries.reduce((sum, r) => sum + r.confidence, 0) / queries.length;
    const avgLength = queries.reduce((sum, r) => sum + r.answerLength, 0) / queries.length;
    console.log(`   Average confidence: ${avgConfidence.toFixed(2)}`);
    console.log(`   Average length: ${avgLength.toFixed(0)} ${type === 'events' ? 'events' : 'chars'}`);
    
    // Show top 5 by confidence
    const top5 = queries.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
    console.log(`   Top 5 by confidence:`);
    top5.forEach(r => {
      const unit = r.type === 'events' ? 'events' : 'chars';
      console.log(`     ${r.question}: ${r.confidence} - ${r.answerLength} ${unit}`);
    });
  });
  
  // Overall stats
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const avgConfidence = successful.reduce((sum, r) => sum + r.confidence, 0) / successful.length;
  
  console.log(`\n📈 OVERALL STATS:`);
  console.log(`   Total questions: ${results.length}`);
  console.log(`   Successful: ${successful.length} (${(successful.length/results.length*100).toFixed(1)}%)`);
  console.log(`   Failed: ${failed.length} (${(failed.length/results.length*100).toFixed(1)}%)`);
  console.log(`   Average confidence: ${avgConfidence.toFixed(2)}`);
  
  // Save results for comparison
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `results/full-171-test-${timestamp}.json`;
  
  console.log(`\n💾 Saving results to: ${filename}`);
  
  return { results, filename, stats: { successful: successful.length, failed: failed.length, avgConfidence } };
}

// Run the full test
runFull171Test().catch(console.error);
