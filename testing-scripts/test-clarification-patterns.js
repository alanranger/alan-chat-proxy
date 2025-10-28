import https from 'https';

// Systematic pattern-based testing for clarification system
// Tests the core logic, not individual queries

const testPatterns = [
  // Workshop patterns (should work - our model)
  {
    category: "workshops",
    patterns: [
      { query: "photography workshops", expectedType: "clarification", expectedConfidence: 20 },
      { query: "workshops", expectedType: "clarification", expectedConfidence: 20 },
      { query: "photography training", expectedType: "clarification", expectedConfidence: 20 }
    ]
  },
  
  // Course patterns (needs testing)
  {
    category: "courses", 
    patterns: [
      { query: "photography courses", expectedType: "clarification", expectedConfidence: 20 },
      { query: "online courses", expectedType: "clarification", expectedConfidence: 20 },
      { query: "photography training", expectedType: "clarification", expectedConfidence: 20 }
    ]
  },
  
  // Article patterns (needs testing)
  {
    category: "articles",
    patterns: [
      { query: "photography articles", expectedType: "clarification", expectedConfidence: 20 },
      { query: "photography tips", expectedType: "clarification", expectedConfidence: 20 },
      { query: "photography guides", expectedType: "clarification", expectedConfidence: 20 }
    ]
  },
  
  // Service patterns (needs testing)
  {
    category: "services",
    patterns: [
      { query: "photography services", expectedType: "clarification", expectedConfidence: 20 },
      { query: "photography for hire", expectedType: "clarification", expectedConfidence: 20 },
      { query: "professional photography", expectedType: "clarification", expectedConfidence: 20 }
    ]
  },
  
  // Direct answer patterns (should bypass clarification)
  {
    category: "direct_answers",
    patterns: [
      { query: "explain the exposure triangle", expectedType: "direct", expectedConfidence: 80 },
      { query: "what tripod do you recommend", expectedType: "direct", expectedConfidence: 80 },
      { query: "camera settings for low light", expectedType: "direct", expectedConfidence: 80 }
    ]
  }
];

async function testQuery(query, expectedType, expectedConfidence) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query });
    
    const options = {
      hostname: 'alan-chat-proxy.vercel.app',
      port: 443,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            query,
            expectedType,
            expectedConfidence,
            actualType: response.type || 'unknown',
            actualConfidence: response.confidence || 0,
            options: response.options || [],
            passed: response.type === expectedType && 
                   Math.abs((response.confidence || 0) - expectedConfidence) <= 10
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function testPatternCategory(category) {
  console.log(`\n=== TESTING ${category.toUpperCase()} PATTERNS ===`);
  
  const categoryData = testPatterns.find(p => p.category === category);
  if (!categoryData) {
    console.log(`❌ No patterns found for category: ${category}`);
    return;
  }
  
  const results = [];
  
  for (const pattern of categoryData.patterns) {
    console.log(`\n🔍 Testing: "${pattern.query}"`);
    console.log(`   Expected: ${pattern.expectedType} (${pattern.expectedConfidence}%)`);
    
    try {
      const result = await testQuery(pattern.query, pattern.expectedType, pattern.expectedConfidence);
      results.push(result);
      
      console.log(`   Actual: ${result.actualType} (${result.actualConfidence}%)`);
      console.log(`   Options: ${result.options.length} options`);
      console.log(`   Status: ${result.passed ? '✅ PASS' : '❌ FAIL'}`);
      
      if (result.options.length > 0) {
        console.log(`   Sample options: ${result.options.slice(0, 3).map(o => o.text || o).join(', ')}`);
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      results.push({
        query: pattern.query,
        expectedType: pattern.expectedType,
        expectedConfidence: pattern.expectedConfidence,
        actualType: 'error',
        actualConfidence: 0,
        options: [],
        passed: false,
        error: error.message
      });
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}

async function runComprehensiveTest() {
  console.log('🚀 Starting Comprehensive Clarification Pattern Testing');
  console.log('=' .repeat(60));
  
  const allResults = [];
  
  // Test each category
  for (const category of ['workshops', 'courses', 'articles', 'services', 'direct_answers']) {
    const results = await testPatternCategory(category);
    allResults.push(...results);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 COMPREHENSIVE TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  
  const passed = allResults.filter(r => r.passed).length;
  const total = allResults.length;
  const passRate = ((passed / total) * 100).toFixed(1);
  
  console.log(`\nOverall Pass Rate: ${passed}/${total} (${passRate}%)`);
  
  // Category breakdown
  const categories = ['workshops', 'courses', 'articles', 'services', 'direct_answers'];
  for (const category of categories) {
    const categoryResults = allResults.filter(r => 
      testPatterns.find(p => p.category === category)?.patterns.some(p => p.query === r.query)
    );
    const categoryPassed = categoryResults.filter(r => r.passed).length;
    const categoryTotal = categoryResults.length;
    const categoryPassRate = categoryTotal > 0 ? ((categoryPassed / categoryTotal) * 100).toFixed(1) : '0';
    
    console.log(`${category.padEnd(15)}: ${categoryPassed}/${categoryTotal} (${categoryPassRate}%)`);
  }
  
  // Failed tests
  const failed = allResults.filter(r => !r.passed);
  if (failed.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    failed.forEach(f => {
      console.log(`   "${f.query}" - Expected: ${f.expectedType} (${f.expectedConfidence}%), Got: ${f.actualType} (${f.actualConfidence}%)`);
    });
  }
  
  // Evidence quality analysis
  console.log('\n🔍 EVIDENCE QUALITY ANALYSIS:');
  const clarificationResults = allResults.filter(r => r.actualType === 'clarification');
  const avgOptions = clarificationResults.reduce((sum, r) => sum + r.options.length, 0) / clarificationResults.length;
  console.log(`   Average clarification options: ${avgOptions.toFixed(1)}`);
  
  const evidenceBasedOptions = clarificationResults.filter(r => 
    r.options.length > 0 && 
    !r.options.some(o => {
      const text = o.text || o;
      return text.includes('photography-classes') || text.includes('photography-courses');
    })
  ).length;
  
  console.log(`   Evidence-based options: ${evidenceBasedOptions}/${clarificationResults.length} (${((evidenceBasedOptions/clarificationResults.length)*100).toFixed(1)}%)`);
  
  return allResults;
}

// Run the test
runComprehensiveTest().catch(console.error);



