// Test script to diagnose timeout behavior
// This will help us understand if responses are arriving but timing out, or never arriving

const https = require('https');
const { URL } = require('url');

const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const INGEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';

// Test URL that we know completes quickly
const TEST_URL = 'https://www.alanranger.com/fine-art-prints';

async function testIngestWithTimeout(timeoutMs) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const controller = { aborted: false };
    const timeoutId = setTimeout(() => {
      controller.aborted = true;
      resolve({
        success: false,
        error: 'timeout',
        elapsed: Date.now() - startTime,
        timeoutMs
      });
    }, timeoutMs);

    const ingestUrl = 'https://alan-chat-proxy.vercel.app/api/ingest';
    const parsedUrl = new URL(ingestUrl);
    
    const postData = JSON.stringify({ url: TEST_URL });
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INGEST_TOKEN}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      const responseStartTime = Date.now();
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        clearTimeout(timeoutId);
        const totalTime = Date.now() - startTime;
        const responseTime = Date.now() - responseStartTime;
        
        try {
          const json = JSON.parse(data);
          resolve({
            success: true,
            status: res.statusCode,
            ok: json.ok,
            elapsed: totalTime,
            responseTime: responseTime,
            dataLength: data.length,
            result: json
          });
        } catch (e) {
          resolve({
            success: false,
            error: 'parse_error',
            elapsed: totalTime,
            responseTime: responseTime,
            dataLength: data.length,
            rawData: data.substring(0, 200)
          });
        }
      });
    });

    req.on('error', (e) => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        error: e.message,
        elapsed: Date.now() - startTime
      });
    });

    req.on('timeout', () => {
      req.destroy();
      clearTimeout(timeoutId);
      resolve({
        success: false,
        error: 'request_timeout',
        elapsed: Date.now() - startTime
      });
    });

    req.setTimeout(timeoutMs);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing ingest timeout behavior...\n');
  console.log(`Test URL: ${TEST_URL}\n`);

  // Test 1: 30 second timeout (should succeed)
  console.log('Test 1: 30 second timeout (should succeed)');
  const result1 = await testIngestWithTimeout(30000);
  console.log('Result:', JSON.stringify(result1, null, 2));
  console.log('');

  // Test 2: 65 second timeout (current frontend setting)
  console.log('Test 2: 65 second timeout (current frontend setting)');
  const result2 = await testIngestWithTimeout(65000);
  console.log('Result:', JSON.stringify(result2, null, 2));
  console.log('');

  // Test 3: 90 second timeout (proposed fix)
  console.log('Test 3: 90 second timeout (proposed fix)');
  const result3 = await testIngestWithTimeout(90000);
  console.log('Result:', JSON.stringify(result3, null, 2));
  console.log('');

  // Summary
  console.log('📊 Summary:');
  console.log(`30s timeout: ${result1.success ? '✅ SUCCESS' : '❌ FAILED'} (${result1.elapsed}ms)`);
  console.log(`65s timeout: ${result2.success ? '✅ SUCCESS' : '❌ FAILED'} (${result2.elapsed}ms)`);
  console.log(`90s timeout: ${result3.success ? '✅ SUCCESS' : '❌ FAILED'} (${result3.elapsed}ms)`);
  
  if (result1.success && result2.success && result3.success) {
    console.log('\n✅ All timeouts are sufficient - issue may be elsewhere');
  } else if (!result1.success && !result2.success && !result3.success) {
    console.log('\n❌ All timeouts failed - backend may be taking too long');
  } else {
    console.log('\n⚠️  Mixed results - timeout threshold may be the issue');
  }
}

runTests().catch(console.error);

