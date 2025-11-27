const API_ENDPOINT = 'https://alan-chat-proxy.vercel.app/api/chat';

// Test queries for Batch 1 fixes (queries that should NOT show articles)
const testQueries = [
  {
    q: 'Q16',
    query: 'Do you I get a certificate with the photography course',
    expected: { articles: 0, hasServices: true }
  },
  {
    q: 'Q18',
    query: 'Is the online photography course really free',
    expected: { articles: 0, hasServices: true }
  },
  {
    q: 'Q19',
    query: 'What courses do you offer for complete beginners?',
    expected: { articles: 0, hasEvents: true } // Events are fine, articles should be 0
  },
  {
    q: 'Q21',
    query: 'How do I get personalised feedback on my images',
    expected: { articles: 0, hasServices: true }
  },
  {
    q: 'Q33',
    query: 'Can I hire you as a professional photographer in Coventry?',
    expected: { articles: 0, hasServices: true }
  },
  {
    q: 'Q36',
    query: 'How do I subscribe to the free online photography course?',
    expected: { articles: 0, hasServices: true }
  }
];

async function testQuery(qInfo) {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: qInfo.query, sessionId: 'batch1-test' })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const articles = data.structured?.articles || [];
    const services = data.structured?.services || [];
    const events = data.structured?.events || [];
    
    const result = {
      q: qInfo.q,
      query: qInfo.query,
      articlesCount: articles.length,
      servicesCount: services.length,
      eventsCount: events.length,
      hasArticles: articles.length > 0,
      hasServices: services.length > 0,
      hasEvents: events.length > 0,
      passed: true,
      issues: []
    };
    
    // Check expectations
    if (qInfo.expected.articles !== undefined && articles.length !== qInfo.expected.articles) {
      result.passed = false;
      result.issues.push(`Expected ${qInfo.expected.articles} articles, got ${articles.length}`);
    }
    
    if (qInfo.expected.hasServices && services.length === 0) {
      result.passed = false;
      result.issues.push('Expected services but got 0');
    }
    
    if (qInfo.expected.hasEvents && events.length === 0) {
      result.passed = false;
      result.issues.push('Expected events but got 0');
    }
    
    return result;
  } catch (error) {
    return {
      q: qInfo.q,
      query: qInfo.query,
      error: error.message,
      passed: false
    };
  }
}

async function runTests() {
  console.log('Testing Batch 1 Fixes: Prevent articles for queries that should only show services/events\n');
  console.log('='.repeat(80));
  
  const results = [];
  for (const qInfo of testQueries) {
    const result = await testQuery(qInfo);
    results.push(result);
    
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`\n${status} ${result.q}: "${result.query}"`);
    console.log(`   Articles: ${result.articlesCount}, Services: ${result.servicesCount}, Events: ${result.eventsCount}`);
    if (result.issues && result.issues.length > 0) {
      result.issues.forEach(issue => console.log(`   ⚠️  ${issue}`));
    }
    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(80));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nSummary: ${passed}/${results.length} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ${r.q}: ${r.issues?.join(', ') || r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
  }
}

runTests().catch(console.error);

