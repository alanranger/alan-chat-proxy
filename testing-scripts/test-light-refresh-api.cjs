#!/usr/bin/env node
/**
 * Test script to verify light-refresh API endpoints work correctly
 * Tests: urls, status, and run/manual actions
 */

const https = require('https');

const API_URL = 'https://alan-chat-proxy.vercel.app';
const API_PATH = '/api/light-refresh';
const INGEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    
    const reqOptions = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    if (options.body) {
      const bodyStr = JSON.stringify(options.body);
      reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = https.request(reqOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: response,
            raw: data
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: null,
            raw: data,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function testUrlsAction() {
  console.log('\n📋 Testing: GET /api/light-refresh?action=urls');
  try {
    const response = await makeRequest(`${API_PATH}?action=urls`);
    console.log(`   Status: ${response.status}`);
    if (response.body && response.body.ok) {
      console.log(`   ✅ OK: Found ${response.body.count} URLs`);
      if (response.body.sample && response.body.sample.length > 0) {
        console.log(`   Sample URLs (first 3):`);
        response.body.sample.slice(0, 3).forEach((url, i) => {
          console.log(`      ${i + 1}. ${url}`);
        });
      }
      return { success: true, count: response.body.count };
    } else {
      console.log(`   ❌ Failed: ${response.body?.error || response.body?.detail || 'Unknown error'}`);
      return { success: false, error: response.body };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testStatusAction() {
  console.log('\n📊 Testing: GET /api/light-refresh?action=status');
  try {
    const response = await makeRequest(`${API_PATH}?action=status&limit=5`);
    console.log(`   Status: ${response.status}`);
    if (response.body && response.body.ok) {
      const rows = response.body.rows || [];
      console.log(`   ✅ OK: Found ${rows.length} recent runs`);
      if (rows.length > 0) {
        const latest = rows[0];
        console.log(`   Latest run:`);
        console.log(`      Started: ${latest.started_at}`);
        console.log(`      Finished: ${latest.finished_at}`);
        console.log(`      URLs Total: ${latest.urls_total}`);
        console.log(`      URLs Changed: ${latest.urls_changed || 0}`);
        console.log(`      Ingested: ${latest.ingested_count || 0}`);
        console.log(`      Failed: ${latest.failed_count || 0}`);
        console.log(`      Mode: ${latest.batches_json?.[0]?.note || 'ingest'}`);
      }
      return { success: true, runs: rows.length };
    } else {
      console.log(`   ❌ Failed: ${response.body?.error || response.body?.detail || 'Unknown error'}`);
      return { success: false, error: response.body };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function _testRunAction() {
  console.log('\n🚀 Testing: GET /api/light-refresh?action=run');
  console.log('   ⚠️  This will trigger an actual refresh run. This may take several minutes...');
  try {
    const response = await makeRequest(`${API_PATH}?action=run`, {
      headers: {
        'Authorization': `Bearer ${INGEST_TOKEN}`,
        'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || ''
      }
    });
    console.log(`   Status: ${response.status}`);
    if (response.body && response.body.ok) {
      console.log(`   ✅ OK: Refresh completed`);
      console.log(`   Started: ${response.body.started_at}`);
      console.log(`   Finished: ${response.body.finished_at}`);
      console.log(`   URLs Total: ${response.body.urls || 0}`);
      console.log(`   URLs Changed: ${response.body.urls_changed || 0}`);
      console.log(`   Ingested: ${response.body.ingested || 0}`);
      console.log(`   Failed: ${response.body.failed || 0}`);
      console.log(`   Mode: ${response.body.mode || 'unknown'}`);
      
      if (response.body.batches && response.body.batches.length > 0) {
        console.log(`   Batches: ${response.body.batches.length}`);
        response.body.batches.forEach((batch, i) => {
          if (batch.ok) {
            console.log(`      Batch ${i + 1}: ✅ ${batch.count} URLs ingested`);
          } else {
            console.log(`      Batch ${i + 1}: ❌ ${batch.error || 'Failed'}`);
          }
        });
      }
      
      if (response.body.error) {
        console.log(`   ⚠️  Warning: ${response.body.error}`);
      }
      
      return { success: true, ...response.body };
    } else {
      console.log(`   ❌ Failed: ${response.body?.error || response.body?.detail || 'Unknown error'}`);
      return { success: false, error: response.body };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function _testManualAction() {
  console.log('\n🔧 Testing: GET /api/light-refresh?action=manual');
  console.log('   ⚠️  This will trigger an actual refresh run. This may take several minutes...');
  try {
    const response = await makeRequest(`${API_PATH}?action=manual`, {
      headers: {
        'Authorization': `Bearer ${INGEST_TOKEN}`,
        'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || ''
      }
    });
    console.log(`   Status: ${response.status}`);
    if (response.body && response.body.ok) {
      console.log(`   ✅ OK: Manual refresh completed`);
      return { success: true, ...response.body };
    } else {
      console.log(`   ❌ Failed: ${response.body?.error || response.body?.detail || 'Unknown error'}`);
      return { success: false, error: response.body };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🧪 Testing light-refresh API endpoints');
  console.log('=' .repeat(60));
  
  const results = {
    urls: await testUrlsAction(),
    status: await testStatusAction(),
    // Uncomment to test actual run (will trigger ingestion):
    // run: await testRunAction(),
    // manual: await testManualAction()
  };
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary:');
  console.log(`   URLs action: ${results.urls.success ? '✅' : '❌'}`);
  console.log(`   Status action: ${results.status.success ? '✅' : '❌'}`);
  
  const allPassed = Object.values(results).every(r => r.success);
  if (allPassed) {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

