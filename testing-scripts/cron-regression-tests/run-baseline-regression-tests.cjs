#!/usr/bin/env node
/**
 * Run baseline regression tests for all risky cron jobs
 * This establishes a baseline before any changes are made
 */

const https = require('https');

const API_BASE = 'https://alan-chat-proxy.vercel.app';
const INGEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';

const RISKY_JOBS = [
  { id: 21, name: 'refresh-product-pricing-hourly' },
  { id: 26, name: 'light_refresh_batch0' },
  { id: 27, name: 'light_refresh_batch1' },
  { id: 28, name: 'light_refresh_batch2' },
  { id: 31, name: 'cleanup-orphaned-records' }
];

function makeRequest(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INGEST_TOKEN}`
      }
    };

    if (body) {
      const postData = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runBaselineTest(jobId, jobName) {
  console.log(`\n📊 Running baseline test for Job ${jobId} (${jobName})...`);
  
  try {
    const response = await makeRequest(
      `${API_BASE}/api/admin?action=run_regression_test`,
      'POST',
      {
        job_id: jobId,
        job_name: jobName,
        test_phase: 'before'
      }
    );

    if (response.status === 200 && response.data.ok) {
      console.log(`  ✅ Baseline test completed`);
      console.log(`     Test ID: ${response.data.test_result_id}`);
      console.log(`     Success Rate: ${response.data.successful_tests}/${response.data.total_questions} (${((response.data.successful_tests / response.data.total_questions) * 100).toFixed(1)}%)`);
      console.log(`     Avg Confidence: ${(response.data.avg_confidence * 100).toFixed(1)}%`);
      console.log(`     Duration: ${response.data.duration}`);
      return response.data.test_result_id;
    } else {
      console.log(`  ❌ Baseline test failed: ${response.data.error || 'Unknown error'}`);
      return null;
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🚀 BASELINE REGRESSION TEST RUNNER');
  console.log('='.repeat(80));
  console.log(`Running baseline tests for ${RISKY_JOBS.length} risky jobs...`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  const results = {};

  for (const job of RISKY_JOBS) {
    const testId = await runBaselineTest(job.id, job.name);
    results[job.id] = {
      jobName: job.name,
      baselineTestId: testId,
      success: testId !== null
    };
    
    // Small delay between jobs
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n' + '='.repeat(80));
  console.log('📋 BASELINE TEST SUMMARY');
  console.log('='.repeat(80));
  
  let successCount = 0;
  for (const [jobId, result] of Object.entries(results)) {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} Job ${jobId} (${result.jobName}): ${result.success ? `Test ID ${result.baselineTestId}` : 'Failed'}`);
    if (result.success) successCount++;
  }

  console.log(`\n✅ Successful: ${successCount}/${RISKY_JOBS.length}`);
  console.log(`❌ Failed: ${RISKY_JOBS.length - successCount}/${RISKY_JOBS.length}`);
  console.log(`\n💡 Baseline tests complete! These will be used for comparison when jobs run.`);
  console.log(`   Check the cron dashboard to see regression test results.`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

