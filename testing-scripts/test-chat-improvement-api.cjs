#!/usr/bin/env node
/**
 * Test script to verify chat-improvement API endpoints work correctly after refactoring
 */

const https = require('https');

const API_URL = 'https://alan-chat-proxy.vercel.app';
const API_PATH = '/api/chat-improvement';
const INGEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';

async function testEndpoint(action, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_PATH}?action=${action}`, API_URL);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${INGEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            action,
            status: res.statusCode,
            ok: response.ok || false,
            error: response.error || null,
            hasData: !!response.analysis || !!response.recommendations || !!response.contentGaps || !!response.improvementPlan
          });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function runTests() {
  console.log('\n🧪 Testing chat-improvement API endpoints after refactoring...\n');
  
  const tests = [
    { action: 'analyze', method: 'GET' },
    { action: 'recommendations', method: 'GET' },
    { action: 'content_gaps', method: 'GET' },
    { action: 'improvement_plan', method: 'GET' },
    { action: 'improvement_status', method: 'GET' },
    { action: 'list_implemented', method: 'GET' },
    { action: 'generate_content', method: 'POST', body: { question: 'test question' } },
    { action: 'preview_improvements', method: 'GET' }
  ];

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await testEndpoint(test.action, test.method, test.body);
      results.push(result);
      
      if (result.status === 200 && result.ok) {
        console.log(`✅ ${test.action}: OK (status ${result.status})`);
        passed++;
      } else {
        console.log(`❌ ${test.action}: FAILED (status ${result.status}, ok: ${result.ok}, error: ${result.error})`);
        failed++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.log(`❌ ${test.action}: ERROR - ${error.message}`);
      failed++;
      results.push({ action: test.action, error: error.message });
    }
  }

  console.log(`\n📊 Test Results:`);
  console.log(`   ✅ Passed: ${passed}/${tests.length}`);
  console.log(`   ❌ Failed: ${failed}/${tests.length}`);
  
  if (failed === 0) {
    console.log(`\n🎉 All tests passed! Refactoring successful, no regressions detected.`);
  } else {
    console.log(`\n⚠️  Some tests failed. Review the results above.`);
  }
}

runTests().catch((error) => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});

