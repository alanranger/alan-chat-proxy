const http = require('http');

const worstDeviations = [
  "why are my images always grainy and noisy", // Alan=10, Current=76 (+66.0)
  "do you do commercial photography",          // Alan=10, Current=51 (+41.0)
  "do you do portrait photography",            // Alan=10, Current=51 (+41.0)
  "is your photography academy really free",   // Alan=10, Current=51 (+41.0)
  "what camera do i need for your courses and workshops" // Alan=10, Current=51 (+41.0)
];

async function testQuery(query) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({query, sessionId: 'test-session'});
    const options = {
      hostname: 'localhost',
      port: 3000, // Test current server
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve({
            query,
            status: res.statusCode,
            confidence: result.confidence,
            answer: result.answer,
            answerLength: result.answer?.length || 0,
            events: result.events?.length || 0,
            articles: result.sources?.articles?.length || 0,
            type: result.type
          });
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Connection error: ${err.message}`));
    });

    req.write(data);
    req.end();
  });
}

async function testWorstDeviations() {
  console.log('🔍 TESTING WORST DEVIATION QUESTIONS');
  console.log('====================================');
  console.log('Alan rates these as 10/100 (very poor) but system gives high confidence\n');
  
  for (const query of worstDeviations) {
    try {
      const result = await testQuery(query);
      
      console.log(`📝 QUESTION: "${query}"`);
      console.log(`🎯 Alan's Score: 10/100 (very poor)`);
      console.log(`🤖 System Confidence: ${(result.confidence * 100).toFixed(0)}%`);
      console.log(`📊 Deviation: +${((result.confidence * 100) - 10).toFixed(0)} points`);
      console.log(`📄 Response Type: ${result.type}`);
      console.log(`📏 Response Length: ${result.answerLength} chars`);
      console.log(`🎪 Events Found: ${result.events}`);
      console.log(`📚 Articles Found: ${result.articles}`);
      console.log(`\n💬 FULL RESPONSE:`);
      console.log(`"${result.answer}"`);
      console.log('\n' + '─'.repeat(80) + '\n');
      
    } catch (error) {
      console.log(`❌ Error testing "${query}": ${error.message}\n`);
    }
  }
}

testWorstDeviations().catch(console.error);


