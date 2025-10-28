const http = require('http');

// All questions from Alan's CSV
const allQuestions = [
  "what is exposure triangle",
  "what is iso", 
  "what is aperture",
  "what is shutter speed",
  "what tripod do you recommend",
  "what camera should I buy",
  "what camera do you recommend for a beginner",
  "peter orton",
  "who is alan ranger",
  "when is your next devon workshop",
  "when is your next photography course",
  "when are your next bluebell workshops",
  "do you have autumn workshops",
  "how to take sharp photos",
  "what is long exposure photography",
  "why are my images always grainy and noisy",
  "why arent my images sharp",
  "do I need a laptop for lightroom course",
  "do you provide photography courses",
  "do you have online lessons",
  "do you have a lightroom course",
  "whats your online photography course",
  "where i can see your terms and conditions",
  "tell me about rps mentoring",
  "do you do commercial photography",
  "do you do portrait photography",
  "is your photography academy really free",
  "what camera do i need for your courses and workshops"
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

async function testAllQuestions() {
  console.log('🔍 TESTING ALL QUESTIONS - ORIGINAL vs CURRENT');
  console.log('===============================================');
  
  const results = {};
  
  for (const query of allQuestions) {
    console.log(`\n📝 Testing: "${query}"`);
    
    try {
      // Test both servers
      const [original, current] = await Promise.all([
        testQuery(query, 3001, 'ORIGINAL').catch(err => ({ label: 'ORIGINAL', query, error: err.message, confidence: null })),
        testQuery(query, 3000, 'CURRENT').catch(err => ({ label: 'CURRENT', query, error: err.message, confidence: null }))
      ]);
      
      results[query] = {
        original: original.confidence,
        current: current.confidence,
        originalError: original.error || null,
        currentError: current.error || null
      };
      
      const origConf = original.confidence ? `${(original.confidence * 100).toFixed(0)}%` : 'ERROR';
      const currConf = current.confidence ? `${(current.confidence * 100).toFixed(0)}%` : 'ERROR';
      
      console.log(`   ORIGINAL: ${origConf} | CURRENT: ${currConf}`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results[query] = {
        original: null,
        current: null,
        originalError: error.message,
        currentError: error.message
      };
    }
  }
  
  return results;
}

testAllQuestions().then(results => {
  console.log('\n📊 COMPLETE RESULTS:');
  console.log('===================');
  Object.keys(results).forEach(query => {
    const r = results[query];
    const orig = r.original ? (r.original * 100).toFixed(0) + '%' : 'ERROR';
    const curr = r.current ? (r.current * 100).toFixed(0) + '%' : 'ERROR';
    console.log(`${query}: Original=${orig}, Current=${curr}`);
  });
}).catch(console.error);


