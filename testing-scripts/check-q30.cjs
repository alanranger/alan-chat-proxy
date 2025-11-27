const fetch = require('node-fetch');

(async () => {
  const res = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'What is HDR photography?' })
  });
  const d = await res.json();
  console.log('Q30 Articles:', d.structured?.articles?.length || 0);
  if (d.structured?.articles) {
    d.structured.articles.forEach((a, i) => {
      console.log(`  ${i+1}. ${a.title}`);
    });
  }
})();


