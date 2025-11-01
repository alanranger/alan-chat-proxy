#!/usr/bin/env node
/**
 * Test only Q36 to see debug logs
 */

const http = require('http');

const API_URL = 'localhost';
const API_PORT = 3000;
const API_PATH = '/api/chat';

const query = "How do I subscribe to the free online photography course?";

function testQuery() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: query,
      sessionId: `test-q36-${Date.now()}`
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

    console.log(`\n🔍 Testing Q36: "${query}"`);
    console.log(`📡 Sending request to http://${API_URL}:${API_PORT}${API_PATH}`);
    console.log(`\n⚠️  Check your SERVER CONSOLE for [Q36-DEBUG] logs!\n`);

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          console.log(`\n✅ Response received:`);
          console.log(`   Status: ${res.statusCode}`);
          console.log(`   Type: ${response.type || 'unknown'}`);
          console.log(`   Confidence: ${((response.confidence || 0) * 100).toFixed(1)}%`);
          console.log(`   Answer Length: ${(response.answer || '').length} chars`);
          console.log(`   Answer Preview: ${(response.answer || '').substring(0, 150)}...`);
          
          if (response.debugInfo) {
            console.log(`\n📋 DEBUG INFO PRESENT:`);
            console.log(JSON.stringify(response.debugInfo, null, 2));
            if (response.debugInfo.q36Debug) {
              console.log(`\n📋 Q36 DEBUG LOGS:`);
              response.debugInfo.q36Debug.forEach(line => console.log(`   ${line}`));
            }
          } else {
            console.log(`\n⚠️  No debugInfo in response`);
          }
          
          if ((response.answer || '').includes("I can't find a reliable answer")) {
            console.log(`\n❌ Generic fallback detected!`);
          } else if ((response.answer || '').includes("How to Subscribe")) {
            console.log(`\n✅ Correct answer detected!`);
          }
          
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
}

testQuery().then(() => {
  console.log(`\n✅ Test complete. Please check your SERVER CONSOLE for [Q36-DEBUG] logs.`);
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

