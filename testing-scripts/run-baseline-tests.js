// Baseline Regression Test Suite - Run all 15 questions from BASELINE_REGRESSION_SUITE.md
// This tests the core functionality after my changes

const baselineQueries = [
  {
    id: 1,
    category: "General Policy",
    query: "What is your refund and cancellation policy?",
    expectedPattern: "Short summary; link to Terms/Policy page on alanranger.com; no hallucinated fees."
  },
  {
    id: 2,
    category: "Course Event", 
    query: "When is the next Lightroom course in Coventry?",
    expectedPattern: "One or more course events with title, date(s), location; working URL to the course page."
  },
  {
    id: 3,
    category: "Workshop Event",
    query: "Do you still run Lake District photography workshops?",
    expectedPattern: "Workshop tiles/list; next available dates or 'join waitlist' if none; valid page URL."
  },
  {
    id: 4,
    category: "Product (Course)",
    query: "How much is the Lightroom beginners course?",
    expectedPattern: "Price (or range) and CTA link; no currency mismatch; avoid stale prices."
  },
  {
    id: 5,
    category: "Service (1-to-1)",
    query: "Can I book a 1-to-1 mentoring session with Alan?",
    expectedPattern: "Availability/format/price (if public) + booking/contact path; links work."
  },
  {
    id: 6,
    category: "Article",
    query: "Do you have tips for composition or leading lines?",
    expectedPattern: "One or more blog/article links; short preview; titles must match site."
  },
  {
    id: 7,
    category: "Article",
    query: "Show me an article about the exposure triangle.",
    expectedPattern: "At least one relevant article; avoid generic web content; site links only."
  },
  {
    id: 8,
    category: "Technical",
    query: "How do I set ISO manually on my camera?",
    expectedPattern: "Concise steps; avoids brand-specific assumptions; suggests practice guidance."
  },
  {
    id: 9,
    category: "Technical",
    query: "What's the difference between aperture and shutter speed?",
    expectedPattern: "Correct definitions; examples; no contradictions; avoids heavy jargon."
  },
  {
    id: 10,
    category: "Advice",
    query: "When is the best time of day for landscape photography?",
    expectedPattern: "'Golden hour/blue hour' guidance; weather caveats; practical tips."
  },
  {
    id: 11,
    category: "Logistics",
    query: "Where do your workshops meet and start from?",
    expectedPattern: "Meeting point policy; typical locations or 'see event page' link; no stale venues."
  },
  {
    id: 12,
    category: "Logistics",
    query: "Do you provide transport or accommodation?",
    expectedPattern: "Clear policy; if residential, explain B&B/partner options; avoids over-promising."
  },
  {
    id: 13,
    category: "Photography Academy",
    query: "How do I join the Photography Academy?",
    expectedPattern: "Join path/URL; brief value prop; next intake if applicable."
  },
  {
    id: 14,
    category: "Photography Academy",
    query: "How do module exams and certificates work?",
    expectedPattern: "Assessment flow; pass criteria; certificate details; link to Academy overview."
  },
  {
    id: 15,
    category: "About/General",
    query: "Who is Alan Ranger?",
    expectedPattern: "Short bio; specialties; link to About page; avoids invented accolades."
  }
];

async function testQuery(queryData) {
  console.log(`\n🧪 Test ${queryData.id}: ${queryData.category}`);
  console.log(`📝 Query: "${queryData.query}"`);
  console.log(`🎯 Expected: ${queryData.expectedPattern}`);
  
  try {
    const response = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: queryData.query,
        sessionId: 'baseline-test-' + Date.now()
      })
    });
    
    const data = await response.json();
    
    console.log(`✅ Response type: ${data.type}`);
    console.log(`📊 Confidence: ${data.confidence}%`);
    
    // Analyze response structure
    if (data.events && data.events.length > 0) {
      console.log(`📅 Events found: ${data.events.length}`);
      data.events.forEach((event, i) => {
        console.log(`   ${i+1}. ${event.title} - ${event.when} - ${event.location || 'No location'}`);
        if (event.price_gbp) console.log(`      💰 Price: £${event.price_gbp}`);
        if (event.date_start && event.date_end && new Date(event.date_end) > new Date(event.date_start)) {
          console.log(`      🏠 Multi-day event detected`);
        }
      });
    }
    
    if (data.structured && data.structured.articles && data.structured.articles.length > 0) {
      console.log(`📰 Articles found: ${data.structured.articles.length}`);
      data.structured.articles.forEach((article, i) => {
        console.log(`   ${i+1}. ${article.title || 'No title'} - ${article.page_url || 'No URL'}`);
      });
    }
    
    if (data.options && data.options.length > 0) {
      console.log(`🤔 Clarification options: ${data.options.length}`);
      data.options.forEach((option, i) => {
        console.log(`   ${i+1}. ${option.text}`);
      });
    }
    
    if (data.answer_markdown) {
      console.log(`📝 Answer preview: ${data.answer_markdown.substring(0, 100)}...`);
    }
    
    return {
      id: queryData.id,
      query: queryData.query,
      category: queryData.category,
      response: data,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return {
      id: queryData.id,
      query: queryData.query,
      category: queryData.category,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

async function runBaselineTests() {
  console.log('🚀 Starting Baseline Regression Test Suite');
  console.log('==========================================');
  console.log(`📅 Test run: ${new Date().toISOString()}`);
  console.log(`🔧 Testing after core tasks implementation`);
  
  const results = [];
  
  for (const queryData of baselineQueries) {
    const result = await testQuery(queryData);
    results.push(result);
    
    // Wait 1 second between tests to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `results/baseline-after-core-tasks-${timestamp}.json`;
  
  // Create results directory if it doesn't exist
  const fs = await import('fs');
  const path = await import('path');
  const resultsDir = path.dirname(filename);
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));
  
  console.log('\n🏁 Baseline test suite completed');
  console.log(`📁 Results saved to: ${filename}`);
  
  // Summary
  const successful = results.filter(r => !r.error).length;
  const failed = results.filter(r => r.error).length;
  
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Successful: ${successful}/15`);
  console.log(`   ❌ Failed: ${failed}/15`);
  
  if (failed > 0) {
    console.log(`\n❌ Failed tests:`);
    results.filter(r => r.error).forEach(r => {
      console.log(`   ${r.id}. ${r.query} - ${r.error}`);
    });
  }
  
  return results;
}

// Export for use in browser or Node.js
if (typeof window !== 'undefined') {
  window.runBaselineTests = runBaselineTests;
  window.baselineQueries = baselineQueries;
}

// Run if executed directly
if (typeof window === 'undefined') {
  runBaselineTests().catch(console.error);
}
