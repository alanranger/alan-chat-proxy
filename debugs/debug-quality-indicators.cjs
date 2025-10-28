// Test quality indicators for technical queries
const http = require('http');

function makeRequest(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query });
    
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
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function testQualityIndicators() {
  console.log('🔍 Testing quality indicators for technical queries...\n');
  
  const queries = [
    'what is exposure triangle',
    'what tripod do you recommend', 
    'who is alan ranger'
  ];
  
  for (const query of queries) {
    console.log(`\n📝 Testing: "${query}"`);
    console.log('=' .repeat(50));
    
    try {
      const result = await makeRequest(query);
      console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`Answer length: ${result.answer?.length || 0} characters`);
      console.log(`Answer preview: ${result.answer?.substring(0, 150)}...`);
      
      // Check if we can see quality indicators in the response
      if (result.qualityIndicators) {
        console.log(`Quality Indicators:`);
        console.log(`  hasDirectAnswer: ${result.qualityIndicators.hasDirectAnswer}`);
        console.log(`  hasRelevantEvents: ${result.qualityIndicators.hasRelevantEvents}`);
        console.log(`  hasRelevantArticles: ${result.qualityIndicators.hasRelevantArticles}`);
        console.log(`  hasActionableInfo: ${result.qualityIndicators.hasActionableInfo}`);
        console.log(`  responseCompleteness: ${result.qualityIndicators.responseCompleteness}`);
        console.log(`  responseAccuracy: ${result.qualityIndicators.responseAccuracy}`);
      }
      
      // Wait a moment for server logs to appear
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Error testing "${query}":`, error.message);
    }
  }
}

testQualityIndicators();
