async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  let body = null;
  try {
    body = await res.json();
  } catch {
    // ignore JSON parse error here
  }
  if (!res.ok) {
    const msg = body && body.error ? body.error : res.statusText;
    throw new Error(`HTTP ${res.status} for ${url}: ${msg}`);
  }
  return body;
}

async function testQuery(query, expectedDescription) {
  try {
    const API_ENDPOINT = 'https://alan-chat-proxy.vercel.app/api/chat';
    const data = await fetchJson(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    
    console.log(`\n=== ${expectedDescription} ===`);
    console.log(`Query: "${query}"`);
    console.log(`Answer preview: ${(data.answer || '').substring(0, 150)}...`);
    console.log(`Confidence: ${(data.confidence * 100).toFixed(0)}%`);
    console.log(`Articles: ${data.structured?.articles?.length || 0}`);
    console.log(`Events: ${data.structured?.events?.length || 0}`);
    console.log(`Products: ${data.structured?.products?.length || 0}`);
    
    if (data.structured?.articles && data.structured.articles.length > 0) {
      console.log('Top articles:');
      data.structured.articles.slice(0, 3).forEach((a, i) => {
        console.log(`  ${i+1}. ${a.title || 'NO TITLE'}`);
      });
    }
    
    if (data.structured?.events && data.structured.events.length > 0) {
      console.log('Events:');
      data.structured.events.slice(0, 3).forEach((e, i) => {
        console.log(`  ${i+1}. ${e.title || e.event_title || 'NO TITLE'}`);
      });
    }
    
    if (data.structured?.products && data.structured.products.length > 0) {
      console.log('Products:');
      data.structured.products.slice(0, 3).forEach((p, i) => {
        console.log(`  ${i+1}. ${p.title || 'NO TITLE'}`);
      });
    }
    
    return data;
  } catch (error) {
    console.error(`Error testing "${query}":`, error.message);
    return null;
  }
}

async function runAllTests() {
  console.log('\n========================================');
  console.log('TESTING ALL FIXES');
  console.log('========================================\n');
  
  // Q15: Memory card - should return low-confidence fallback
  await testQuery('What memory card should I buy?', 'Q15: Memory Card (should return low-confidence fallback)');
  
  // Q30: HDR - should prefer articles about bracketing, dynamic range, HDR, exposure, histogram
  await testQuery('What is HDR photography?', 'Q30: HDR Photography (should prefer bracketing/dynamic range articles)');
  
  // Q39: RAW editing - should include Lightroom course events/products
  await testQuery('How do I edit RAW files?', 'Q39: RAW Editing (should include Lightroom course events/products)');
  
  console.log('\n========================================');
  console.log('ALL TESTS COMPLETE');
  console.log('========================================\n');
}

runAllTests().catch(console.error);


