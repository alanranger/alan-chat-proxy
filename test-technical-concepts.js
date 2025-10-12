#!/usr/bin/env node

// Focused test for technical photography concepts to verify online course content prioritization

const TEST_QUERIES = [
  "what is iso",
  "what is aperture in photography", 
  "what is shutter speed",
  "what is depth of field",
  "what is white balance",
  "what is exposure triangle",
  "what is focal length",
  "what is composition in photography",
  "what is long exposure",
  "what is macro photography"
];

async function testTechnicalQuery(query) {
  console.log(`\n🧪 Testing: "${query}"`);
  
  try {
    const response = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        sessionId: "test-technical"
      })
    });
    
    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status}`);
      return false;
    }
    
    const data = await response.json();
    const confidence = Math.round((data.confidence || 0) * 100);
    const articles = data.structured?.articles || data.articles || [];
    
    console.log(`   Confidence: ${confidence}%`);
    console.log(`   Articles found: ${articles.length}`);
    
    // Check for online course content
    const onlineCourseArticles = articles.filter(a => 
      a.categories && a.categories.includes("online photography course")
    );
    
    console.log(`   Online course articles: ${onlineCourseArticles.length}`);
    
    if (onlineCourseArticles.length > 0) {
      console.log(`   ✅ Found online course content!`);
      onlineCourseArticles.forEach(article => {
        console.log(`      - ${article.title}`);
      });
    }
    
    // Check for "What is..." format articles
    const whatIsArticles = articles.filter(a => 
      a.title && a.title.toLowerCase().includes("what is")
    );
    
    console.log(`   "What is..." articles: ${whatIsArticles.length}`);
    
    // Check for PDF/checklist content
    const pdfArticles = articles.filter(a => 
      a.title && (a.title.toLowerCase().includes("pdf") || a.title.toLowerCase().includes("checklist"))
    );
    
    console.log(`   PDF/Checklist articles: ${pdfArticles.length}`);
    
    // Success criteria: confidence >= 60% and found relevant content
    const success = confidence >= 60 && articles.length > 0;
    console.log(`   ${success ? '✅' : '❌'} ${success ? 'PASS' : 'FAIL'}`);
    
    return success;
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function runTechnicalTests() {
  console.log("🚀 Testing Technical Photography Concepts with Online Course Prioritization\n");
  console.log("=" * 80);
  
  let passedTests = 0;
  let totalTests = TEST_QUERIES.length;
  
  for (const query of TEST_QUERIES) {
    const passed = await testTechnicalQuery(query);
    if (passed) passedTests++;
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log("\n" + "=" * 80);
  console.log(`📊 TECHNICAL CONCEPTS TEST SUMMARY: ${passedTests}/${totalTests} tests passed`);
  console.log(`   Success Rate: ${((passedTests/totalTests)*100).toFixed(1)}%`);
  
  if (passedTests >= totalTests * 0.8) {
    console.log("🎉 EXCELLENT: Online course content prioritization is working!");
  } else if (passedTests >= totalTests * 0.6) {
    console.log("⚠️ GOOD: Some improvement, but more optimization needed");
  } else {
    console.log("❌ NEEDS WORK: Technical concepts still need better prioritization");
  }
}

runTechnicalTests().catch(console.error);
