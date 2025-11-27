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

async function test() {
  try {
    const API_ENDPOINT = 'https://alan-chat-proxy.vercel.app/api/chat';
    const data = await fetchJson(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'who is alan ranger' })
    });
    
    console.log('\n=== TEST: "who is alan ranger" ===\n');
    console.log('Articles returned:', data.structured?.articles?.length || 0);
    console.log('\nArticle details:');
    
    if (data.structured?.articles && data.structured.articles.length > 0) {
      data.structured.articles.forEach((a, i) => {
        console.log(`\n${i+1}. Title: ${a.title || 'NO TITLE'}`);
        console.log(`   URL: ${a.page_url || a.url || 'NO URL'}`);
      });
    } else {
      console.log('No articles returned');
    }
    
    console.log('\n=== END TEST ===\n');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();

