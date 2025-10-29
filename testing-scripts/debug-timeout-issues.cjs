const http = require('http');

const API_URL = 'localhost';
const API_PORT = 3000;
const API_PATH = '/api/chat';

// Test the 2 timeout questions
const timeoutQuestions = [
  "what is histogram",
  "what is long exposure photography"
];

async function testQuestion(query, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: query,
      sessionId: `debug-timeout-${Date.now()}`
    });

    const options = {
      hostname: API_URL,
      port: API_PORT,
      path: API_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: timeoutMs
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log(`\n=== Testing: "${query}" ===`);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Answer Length: ${JSON.parse(data).answer?.length || 0}`);
        console.log(`Confidence: ${(JSON.parse(data).confidence * 100).toFixed(1)}%`);
        
        if (res.statusCode === 200) {
          console.log(`✅ SUCCESS - No timeout`);
        } else {
          console.log(`❌ ERROR - Status ${res.statusCode}`);
        }
        
        resolve({
          query,
          status: res.statusCode,
          response: JSON.parse(data)
        });
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Request Error for "${query}":`, error.message);
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      console.log(`❌ TIMEOUT for "${query}" after ${timeoutMs}ms`);
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    });

    req.write(postData);
    req.end();
  });
}

async function debugTimeoutIssues() {
  console.log(`🔍 Testing timeout issues for specific questions...`);
  console.log(`Testing against: http://${API_URL}:${API_PORT}${API_PATH}`);
  console.log(`Timeout per request: 30 seconds`);
  
  for (const question of timeoutQuestions) {
    try {
      await testQuestion(question, 30000);
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
    } catch (error) {
      console.log(`❌ Error testing "${question}":`, error.message);
    }
  }
}

debugTimeoutIssues().catch(console.error);
