#!/usr/bin/env node
/**
 * Quick check of light-refresh status and recent runs
 */

const https = require('https');

const API_URL = 'https://alan-chat-proxy.vercel.app';
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
      timeout: 10000
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
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

async function checkStatus() {
  console.log('📊 Checking light-refresh status...\n');
  
  try {
    const response = await makeRequest('/api/light-refresh?action=status&limit=5', {
      headers: { 'Authorization': `Bearer ${INGEST_TOKEN}` }
    });
    
    if (response.status === 200 && response.body && response.body.ok) {
      console.log('✅ API is responding\n');
      const runs = response.body.rows || [];
      console.log(`Recent runs: ${runs.length}\n`);
      
      if (runs.length > 0) {
        console.log('Latest runs:');
        runs.slice(0, 3).forEach((run, i) => {
          console.log(`\n${i + 1}. Started: ${run.started_at}`);
          console.log(`   Finished: ${run.finished_at || 'N/A'}`);
          console.log(`   URLs checked: ${run.urls_checked || 'N/A'}`);
          console.log(`   Batch: ${run.batch_index !== undefined ? run.batch_index + 1 : 'N/A'}/${run.total_batches || 'N/A'}`);
          console.log(`   Changed: ${run.urls_changed || 0}, Ingested: ${run.ingested_count || 0}, Failed: ${run.failed_count || 0}`);
        });
      } else {
        console.log('No runs found yet.');
      }
    } else {
      console.log(`❌ Status check failed: ${response.status}`);
      if (response.raw) console.log(response.raw.substring(0, 200));
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

checkStatus();


