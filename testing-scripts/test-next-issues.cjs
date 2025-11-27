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
    console.log(`Answer preview: ${(data.answer || '').substring(0, 200)}...`);
    console.log(`Articles: ${data.structured?.articles?.length || 0}`);
    console.log(`Services: ${data.structured?.services?.length || 0}`);
    console.log(`Events: ${data.structured?.events?.length || 0}`);
    console.log(`Products: ${data.structured?.products?.length || 0}`);
    
    if (data.structured?.articles && data.structured.articles.length > 0) {
      console.log('Top 3 articles:');
      data.structured.articles.slice(0, 3).forEach((a, i) => {
        console.log(`  ${i+1}. ${a.title || 'NO TITLE'}`);
      });
    }
    
    return data;
  } catch (error) {
    console.error(`Error:`, error.message);
    return null;
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('TESTING FIXES FOR Q7 AND Q10');
  console.log('========================================\n');
  
  // Test the fixes we just made
  await testQuery('Do you do astrophotography workshops', 'Q7: Astrophotography workshops (should exclude generic workshop articles)');
  await testQuery('What types of photography services do you offer?', 'Q10: Photography services (should exclude assignment articles)');
  
  console.log('\n========================================');
  console.log('TESTS COMPLETE');
  console.log('========================================\n');
}

runTests().catch(console.error);

