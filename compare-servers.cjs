const http = require('http');

const testQueries = [
  "what is exposure triangle",
  "when is your next devon workshop", 
  "do you do commercial photography",
  "what camera do you recommend for a beginner",
  "do you have autumn workshops"
];

async function testQuery(query, port, label) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({query, sessionId: 'test-session'});
    const options = {
      hostname: 'localhost',
      port: port,
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
            label,
            query,
            status: res.statusCode,
            confidence: result.confidence,
            answerLength: (typeof result.answer === 'string' ? result.answer : result.answer_markdown || '')?.length || 0,
            answerPreview: (typeof result.answer === 'string' ? result.answer : result.answer_markdown || '')?.substring(0, 150) || '',
            events: result.events?.length || 0,
            articles: result.sources?.articles?.length || 0
          });
        } catch (e) {
          reject(new Error(`${label} - Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`${label} - Connection error: ${err.message}`));
    });

    req.write(data);
    req.end();
  });
}

async function runComparison() {
  console.log('🔍 SIDE-BY-SIDE COMPARISON');
  console.log('===========================');
  console.log('Original (port 3001) vs Current (port 3000)');
  console.log('');

  for (const query of testQueries) {
    console.log(`📝 Testing: "${query}"`);
    console.log('─'.repeat(80));
    
    try {
      // Test both servers
      const [original, current] = await Promise.all([
        testQuery(query, 3001, 'ORIGINAL'),
        testQuery(query, 3000, 'CURRENT')
      ]);
      
      // Display results
      console.log(`ORIGINAL:  Status=${original.status} | Conf=${(original.confidence * 100).toFixed(1)}% | Len=${original.answerLength} | Events=${original.events} | Articles=${original.articles}`);
      console.log(`CURRENT:   Status=${current.status} | Conf=${(current.confidence * 100).toFixed(1)}% | Len=${current.answerLength} | Events=${current.events} | Articles=${current.articles}`);
      
      const confDiff = ((current.confidence - original.confidence) * 100).toFixed(1);
      const lenDiff = current.answerLength - original.answerLength;
      
      console.log(`DIFFERENCE: Confidence ${confDiff >= 0 ? '+' : ''}${confDiff}% | Length ${lenDiff >= 0 ? '+' : ''}${lenDiff} chars`);
      
      if (Math.abs(parseFloat(confDiff)) > 10) {
        console.log(`⚠️  SIGNIFICANT CONFIDENCE DIFFERENCE: ${confDiff}%`);
      }
      
      console.log(`ORIGINAL:  "${original.answerPreview}..."`);
      console.log(`CURRENT:   "${current.answerPreview}..."`);
      console.log('');
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      console.log('');
    }
  }
}

runComparison().catch(console.error);
