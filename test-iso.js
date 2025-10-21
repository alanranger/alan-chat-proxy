const https = require('https');

const data = JSON.stringify({
  query: "what is iso",
  sessionId: "test-session"
});

const options = {
  hostname: 'alan-ranger-chat-bot.vercel.app',
  port: 443,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(responseData);
      console.log('Answer:', response.answer);
      console.log('Confidence:', response.confidence);
      console.log('Type:', response.type);
      if (response.structured && response.structured.articles) {
        console.log('Articles found:', response.structured.articles.length);
        response.structured.articles.forEach((article, i) => {
          console.log(`Article ${i+1}: ${article.title}`);
        });
      }
    } catch (e) {
      console.log('Response:', responseData);
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(data);
req.end();

