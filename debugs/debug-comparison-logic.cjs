const http = require('http');

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
            answer: typeof result.answer === 'string' ? result.answer : result.answer_markdown || '',
            answerLength: (typeof result.answer === 'string' ? result.answer : result.answer_markdown || '')?.length || 0,
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

async function debugComparisonLogic() {
  console.log('🔍 DEBUGGING COMPARISON LOGIC');
  console.log('==============================');
  
  const testQueries = [
    "what is exposure triangle",
    "what tripod do you recommend"
  ];
  
  for (const query of testQueries) {
    console.log(`\n📝 Testing: "${query}"`);
    
    try {
      // Test both servers
      const [original, current] = await Promise.all([
        testQuery(query, 3001, 'ORIGINAL').catch(err => ({ 
          label: 'ORIGINAL', 
          query, 
          error: err.message, 
          confidence: null, 
          answer: 'ERROR',
          answerLength: 0,
          events: 0,
          articles: 0
        })),
        testQuery(query, 3000, 'CURRENT').catch(err => ({ 
          label: 'CURRENT', 
          query, 
          error: err.message, 
          confidence: null, 
          answer: 'ERROR',
          answerLength: 0,
          events: 0,
          articles: 0
        }))
      ]);
      
      console.log(`\n🔍 RAW DATA:`);
      console.log(`Original:`, JSON.stringify(original, null, 2));
      console.log(`Current:`, JSON.stringify(current, null, 2));
      
      // Test the comparison logic
      const originalAnswer = original.answer || 'ERROR';
      const currentAnswer = current.answer || 'ERROR';
      
      console.log(`\n🔍 COMPARISON LOGIC:`);
      console.log(`Original answer: "${originalAnswer.substring(0, 30)}..."`);
      console.log(`Current answer: "${currentAnswer.substring(0, 30)}..."`);
      console.log(`Original length: ${originalAnswer.length}`);
      console.log(`Current length: ${currentAnswer.length}`);
      
      // Compare responses (normalize for comparison)
      const originalNormalized = originalAnswer.replace(/\s+/g, ' ').trim().toLowerCase();
      const currentNormalized = currentAnswer.replace(/\s+/g, ' ').trim().toLowerCase();
      const isSame = originalNormalized === currentNormalized;
      
      console.log(`\n🔍 NORMALIZED COMPARISON:`);
      console.log(`Original normalized: "${originalNormalized.substring(0, 50)}..."`);
      console.log(`Current normalized: "${currentNormalized.substring(0, 50)}..."`);
      console.log(`Are they the same? ${isSame}`);
      
      // Test the display logic
      const questionShort = query.length > 20 ? query.substring(0, 17) + '...' : query;
      const originalShort = originalAnswer.length > 20 ? originalAnswer.substring(0, 17) + '...' : originalAnswer;
      const currentShort = currentAnswer.length > 20 ? currentAnswer.substring(0, 17) + '...' : currentAnswer;
      const sameIcon = isSame ? '✓' : '✗';
      
      console.log(`\n🔍 DISPLAY FORMATTING:`);
      console.log(`Question short: "${questionShort}"`);
      console.log(`Original short: "${originalShort}"`);
      console.log(`Current short: "${currentShort}"`);
      console.log(`Same icon: "${sameIcon}"`);
      
      console.log(`\n📊 FINAL TABLE ROW:`);
      console.log(`${questionShort.padEnd(20)} | ${originalShort.padEnd(17)} | ${currentShort.padEnd(16)} | ${sameIcon}`);
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

debugComparisonLogic().catch(console.error);


