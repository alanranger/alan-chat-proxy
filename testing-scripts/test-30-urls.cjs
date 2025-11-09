#!/usr/bin/env node
/**
 * Test light-refresh with 30 URLs to verify optimizations work
 */

const https = require('https');

const API_URL = 'https://alan-chat-proxy.vercel.app';
const API_PATH = '/api/light-refresh';
const INGEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: 60000 // 60 second timeout
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: null, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

async function test30Urls() {
  console.log('🧪 Testing light-refresh with 30 URLs (batch 0)...\n');
  console.log('This will verify the optimizations work correctly.\n');
  
  const startTime = Date.now();
  
  try {
    const response = await makeRequest(`${API_PATH}?action=run&batch=0&maxUrls=30`, {
      headers: {
        'Authorization': `Bearer ${INGEST_TOKEN}`,
        'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || ''
      }
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Status: ${response.status}`);
    console.log(`Duration: ${duration}s\n`);
    
    if (response.body && response.body.ok) {
      console.log('✅ Test completed successfully!\n');
      console.log(`Started: ${response.body.started_at}`);
      console.log(`Finished: ${response.body.finished_at}`);
      console.log(`Total URLs in CSV: ${response.body.urls || 0}`);
      console.log(`URLs checked: ${response.body.urlsChecked || 0}`);
      console.log(`Batch: ${(response.body.batchIndex || 0) + 1}/${response.body.totalBatches || 3}`);
      console.log(`URLs changed: ${response.body.urls_changed || response.body.changedUrls || 0}`);
      console.log(`Ingested: ${response.body.ingested || 0}`);
      console.log(`Failed: ${response.body.failed || 0}`);
      console.log(`Mode: ${response.body.mode || 'unknown'}\n`);
      
      if (response.body.batches && response.body.batches.length > 0) {
        console.log('Batch details:');
        response.body.batches.forEach((batch, i) => {
          console.log(`  ${i + 1}. ${batch.ok ? '✅' : '❌'} ${batch.note || batch.error || 'N/A'}`);
        });
      }
      
      console.log(`\n⏱️  Performance: ${duration}s for ${response.body.urlsChecked || 0} URLs`);
      console.log(`   Average: ${(duration / (response.body.urlsChecked || 1)).toFixed(2)}s per URL\n`);
      
      return { success: true, duration, ...response.body };
    } else {
      console.log(`❌ Failed: ${response.body?.error || response.body?.detail || 'Unknown error'}`);
      if (response.raw) {
        console.log(`Raw response: ${response.raw.substring(0, 500)}`);
      }
      return { success: false, error: response.body };
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`❌ Error after ${duration}s: ${error.message}`);
    return { success: false, error: error.message, duration };
  }
}

// Run
test30Urls().then(result => {
  if (result.success) {
    console.log('✅ Test passed! Optimizations are working.');
    console.log('\nNext: Check Supabase for updated crawls:');
    console.log('  - url_last_processed table (should have ~30 recent entries)');
    console.log('  - light_refresh_runs table (should have new run with batch info)');
    process.exit(0);
  } else {
    console.log('\n❌ Test failed');
    process.exit(1);
  }
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

