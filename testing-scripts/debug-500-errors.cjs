const http = require('http');

const API_URL = 'localhost';
const API_PORT = 3000;
const API_PATH = '/api/chat';

// Test the 3 failing questions
const failingQuestions = [
  "Do you offer a black and white photography course?",
  "do you provide photography courses", 
  "whats your online photography course"
];

async function testQuestion(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: query,
      sessionId: `debug-500-${Date.now()}`
    });

    const options = {
      hostname: API_URL,
      port: API_PORT,
      path: API_PATH,
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
        console.log(`\n=== Testing: "${query}" ===`);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Headers:`, res.headers);
        console.log(`Response Body:`, data);
        
        if (res.statusCode === 500) {
          console.log(`❌ 500 ERROR - Full response:`, data);
        } else {
          console.log(`✅ Success`);
        }
        
        resolve({
          query,
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Request Error for "${query}":`, error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function debug500Errors() {
  console.log(`🔍 Debugging 500 errors for course-related questions...`);
  console.log(`Testing against: http://${API_URL}:${API_PORT}${API_PATH}`);
  
  for (const question of failingQuestions) {
    try {
      await testQuestion(question);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    } catch (error) {
      console.log(`❌ Error testing "${question}":`, error.message);
    }
  }
}

debug500Errors().catch(console.error);
