#!/usr/bin/env node
/**
 * Trigger batch 0 of light-refresh to test the new batch system
 */

const https = require('https');

// Use the Vercel URL from the test script
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

    req.end();
  });
}

async function triggerBatch0() {
  console.log('🚀 Triggering batch 0 of light-refresh...');
  console.log('   This may take several minutes...\n');
  
  try {
    const response = await makeRequest(`${API_PATH}?action=run&batch=0`, {
      headers: {
        'Authorization': `Bearer ${INGEST_TOKEN}`,
        'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || ''
      }
    });
    
    console.log(`Status: ${response.status}\n`);
    
    if (response.body && response.body.ok) {
      console.log('✅ Batch 0 completed successfully!\n');
      console.log(`Started: ${response.body.started_at}`);
      console.log(`Finished: ${response.body.finished_at}`);
      console.log(`Total URLs in CSV: ${response.body.urls || 0}`);
      console.log(`URLs checked in this batch: ${response.body.urlsChecked || 0}`);
      console.log(`Batch: ${(response.body.batchIndex || 0) + 1}/${response.body.totalBatches || 3}`);
      console.log(`URLs changed: ${response.body.urls_changed || response.body.changedUrls || 0}`);
      console.log(`Ingested: ${response.body.ingested || 0}`);
      console.log(`Failed: ${response.body.failed || 0}`);
      console.log(`Mode: ${response.body.mode || 'unknown'}\n`);
      
      if (response.body.batches && response.body.batches.length > 0) {
        console.log('Batch details:');
        response.body.batches.forEach((batch, i) => {
          console.log(`  Batch ${i + 1}: ${batch.ok ? '✅' : '❌'} ${batch.note || batch.error || 'N/A'}`);
        });
      }
      
      return { success: true, ...response.body };
    } else {
      console.log(`❌ Failed: ${response.body?.error || response.body?.detail || 'Unknown error'}`);
      if (response.raw) {
        console.log(`Raw response: ${response.raw.substring(0, 500)}`);
      }
      return { success: false, error: response.body };
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Run
triggerBatch0().then(result => {
  if (result.success) {
    console.log('\n✅ Test completed successfully!');
    console.log('\nNext step: Check Supabase for updated crawls in:');
    console.log('  - url_last_processed table (last_processed_at timestamps)');
    console.log('  - light_refresh_runs table (latest run record)');
    process.exit(0);
  } else {
    console.log('\n❌ Test failed');
    process.exit(1);
  }
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


