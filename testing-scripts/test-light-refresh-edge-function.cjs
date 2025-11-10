#!/usr/bin/env node
/**
 * Test the light-refresh Edge Function directly
 */

const https = require('https');

const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
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

async function testEdgeFunction() {
  console.log('🚀 Testing light-refresh Edge Function with ETag support...\n');
  console.log('Testing batch 0 with 10 URLs...\n');
  
  const edgeUrl = `${SUPABASE_URL}/functions/v1/light-refresh?batch=0&maxUrls=10`;
  
  try {
    const response = await makeRequest(edgeUrl, {
      method: 'POST'
    });
    
    console.log(`Status: ${response.status}\n`);
    
    if (response.status === 200 && response.body && response.body.ok) {
      console.log('✅ Edge Function completed successfully!\n');
      console.log(`Batch: ${response.body.batchIndex + 1}/${response.body.totalBatches}`);
      console.log(`URLs checked: ${response.body.urlsChecked || 0}`);
      console.log(`Successful (with headers): ${response.body.ingested || 0}`);
      console.log(`Failed (no headers): ${response.body.failed || 0}`);
      console.log(`Changed: ${response.body.changed || 0}\n`);
      
      if (response.body.failed === 0 && response.body.ingested > 0) {
        console.log('🎉 SUCCESS! All URLs now have change detection (ETag headers)!');
      } else if (response.body.ingested > 0) {
        console.log(`✅ Progress! ${response.body.ingested} URLs now tracked (previously 0)`);
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
testEdgeFunction().then(result => {
  if (result.success) {
    console.log('\n✅ Test completed!');
    console.log('\nNext step: Check Supabase for updated records in:');
    console.log('  - url_last_processed table (should have etag_header values)');
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

