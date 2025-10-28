const http = require('http');

function testQuery(query) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔍 Testing: "${query}"`);
    console.log('='.repeat(50));
    
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
          console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
          console.log(`Answer length: ${result.answer?.length || 0} characters`);
          console.log(`Answer preview: ${result.answer?.substring(0, 100) || 'No answer'}...`);
          resolve(result);
        } catch (error) {
          console.error(`Error parsing response for "${query}":`, error.message);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`Error testing "${query}":`, error.message);
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🔍 Testing accuracy debug for technical queries...\n');
  
  await testQuery('what is exposure triangle');
  await testQuery('what is iso');
  await testQuery('what is aperture');
}

main().catch(console.error);
