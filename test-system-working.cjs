const http = require('http');

const testQuery = async (query) => {
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
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
};

async function test() {
  try {
    console.log('🧪 Testing "what is exposure" query...');
    const response = await testQuery('what is exposure');
    console.log('✅ Test passed: "what is exposure" query returned a valid response.');
    console.log('Answer:', response.answer_markdown?.substring(0, 200) + '...');
    console.log('Articles found:', response.structured?.articles?.length || 0);
    console.log('Confidence:', response.confidence);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

test();
