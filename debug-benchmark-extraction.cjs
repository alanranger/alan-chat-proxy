// Debug benchmark extraction logic
const http = require('http');

function debugBenchmarkExtraction() {
  const postData = JSON.stringify({
    query: 'when is your next devon workshop',
    sessionId: 'debug-session'
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/chat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        
        console.log('Benchmark Extraction Debug:');
        console.log('─'.repeat(50));
        
        // Test the extraction logic from the benchmark test
        let answer = '';
        if (Array.isArray(response.answer)) {
          console.log('✅ Array.isArray(response.answer) = true');
          answer = response.answer_markdown || response.answer.map(e => e.title || e.event_title || '').join(' ');
          console.log(`📝 Using answer_markdown: "${response.answer_markdown}"`);
          console.log(`📝 Fallback mapping: "${response.answer.map(e => e.title || e.event_title || '').join(' ')}"`);
        } else if (typeof response.answer === 'string') {
          console.log('✅ typeof response.answer === "string" = true');
          answer = response.answer;
        } else if (response.answer_markdown) {
          console.log('✅ response.answer_markdown exists');
          answer = response.answer_markdown;
        } else {
          console.log('❌ No valid answer found');
          answer = '';
        }
        
        console.log(`📝 Final answer: "${answer}"`);
        console.log(`📝 Answer length: ${answer.length}`);
        
        // Test relevance scoring
        const queryLower = 'when is your next devon workshop'.toLowerCase();
        const queryWords = queryLower.split(' ').filter(w => w.length > 2);
        const answerLower = answer.toLowerCase();
        
        console.log(`🔍 Query words: ${JSON.stringify(queryWords)}`);
        console.log(`🔍 Answer lower: "${answerLower}"`);
        
        let matchedWords = 0;
        queryWords.forEach(word => {
          if (answerLower.includes(word)) {
            matchedWords++;
            console.log(`✅ Matched word: "${word}"`);
          } else {
            console.log(`❌ No match for word: "${word}"`);
          }
        });
        
        console.log(`📊 Matched words: ${matchedWords}/${queryWords.length}`);
        
      } catch (error) {
        console.log(`❌ Parse Error: ${error.message}`);
      }
    });
  });

  req.on('error', (error) => {
    console.error(`Request error: ${error.message}`);
  });

  req.write(postData);
  req.end();
}

debugBenchmarkExtraction();
