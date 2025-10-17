#!/usr/bin/env node

/**
 * Deployment Safety Check Script
 * 
 * This script runs comprehensive tests before any deployment
 * to ensure no regressions occur. It should be run as part
 * of the deployment pipeline.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const API_ENDPOINT = 'https://alan-chat-proxy.vercel.app/api/chat';

async function runDeploymentSafetyCheck() {
  console.log('🛡️  DEPLOYMENT SAFETY CHECK');
  console.log('='.repeat(50));
  console.log(`📅 Check started: ${new Date().toISOString()}`);
  console.log(`📡 Testing against: ${API_ENDPOINT}`);

  const results = {
    timestamp: new Date().toISOString(),
    endpoint: API_ENDPOINT,
    checks: []
  };

  // Check 1: API Health Check
  console.log('\n🔍 Check 1: API Health Check');
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'test' })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.type) {
      throw new Error('Invalid response structure - missing type field');
    }

    results.checks.push({
      name: 'API Health Check',
      status: 'PASS',
      details: `API responding correctly (${response.status})`
    });
    console.log('   ✅ API is healthy');

  } catch (error) {
    results.checks.push({
      name: 'API Health Check',
      status: 'FAIL',
      details: error.message
    });
    console.log(`   ❌ API health check failed: ${error.message}`);
  }

  // Check 2: Critical Query Tests
  console.log('\n🔍 Check 2: Critical Query Tests');
  const criticalQueries = [
    'When is the next Lightroom course in Coventry?',
    'What tripod do you recommend?',
    'How much is a residential photography workshop and does it include B&B?'
  ];

  let criticalPassed = 0;
  for (const query of criticalQueries) {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.type || data.confidence === undefined) {
        throw new Error('Invalid response structure');
      }

      criticalPassed++;
      console.log(`   ✅ "${query}" - ${data.type} (${data.confidence})`);

    } catch (error) {
      console.log(`   ❌ "${query}" - ${error.message}`);
    }
  }

  results.checks.push({
    name: 'Critical Query Tests',
    status: criticalPassed === criticalQueries.length ? 'PASS' : 'FAIL',
    details: `${criticalPassed}/${criticalQueries.length} queries passed`
  });

  // Check 3: Response Structure Validation
  console.log('\n🔍 Check 3: Response Structure Validation');
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'test query' })
    });

    const data = await response.json();
    
    // Validate required fields
    const requiredFields = ['type', 'confidence', 'ok'];
    const missingFields = requiredFields.filter(field => !(field in data));
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate field types
    if (typeof data.type !== 'string') {
      throw new Error('type field must be a string');
    }
    if (typeof data.confidence !== 'number') {
      throw new Error('confidence field must be a number');
    }
    if (typeof data.ok !== 'boolean') {
      throw new Error('ok field must be a boolean');
    }

    results.checks.push({
      name: 'Response Structure Validation',
      status: 'PASS',
      details: 'All required fields present with correct types'
    });
    console.log('   ✅ Response structure is valid');

  } catch (error) {
    results.checks.push({
      name: 'Response Structure Validation',
      status: 'FAIL',
      details: error.message
    });
    console.log(`   ❌ Response structure validation failed: ${error.message}`);
  }

  // Check 4: Performance Check
  console.log('\n🔍 Check 4: Performance Check');
  try {
    const startTime = Date.now();
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'performance test' })
    });
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    if (responseTime > 10000) { // 10 seconds
      throw new Error(`Response time too slow: ${responseTime}ms`);
    }

    results.checks.push({
      name: 'Performance Check',
      status: 'PASS',
      details: `Response time: ${responseTime}ms`
    });
    console.log(`   ✅ Performance check passed: ${responseTime}ms`);

  } catch (error) {
    results.checks.push({
      name: 'Performance Check',
      status: 'FAIL',
      details: error.message
    });
    console.log(`   ❌ Performance check failed: ${error.message}`);
  }

  // Check 5: Error Handling
  console.log('\n🔍 Check 5: Error Handling');
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: '' }) // Empty query
    });

    const data = await response.json();
    if (data.ok === false && !data.error) {
      throw new Error('Error response missing error field');
    }

    results.checks.push({
      name: 'Error Handling',
      status: 'PASS',
      details: 'Error handling working correctly'
    });
    console.log('   ✅ Error handling is working');

  } catch (error) {
    results.checks.push({
      name: 'Error Handling',
      status: 'FAIL',
      details: error.message
    });
    console.log(`   ❌ Error handling check failed: ${error.message}`);
  }

  // Generate summary
  const passedChecks = results.checks.filter(check => check.status === 'PASS').length;
  const totalChecks = results.checks.length;

  console.log('\n📊 DEPLOYMENT SAFETY SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${passedChecks}`);
  console.log(`❌ Failed: ${totalChecks - passedChecks}`);
  console.log(`📈 Success Rate: ${((passedChecks / totalChecks) * 100).toFixed(1)}%`);

  // Save results
  const resultsPath = `deployment-safety-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Safety check results saved to: ${resultsPath}`);

  // Exit with error code if any checks failed
  if (passedChecks < totalChecks) {
    console.log('\n❌ DEPLOYMENT SAFETY CHECK FAILED - DO NOT DEPLOY');
    console.log('💡 Fix the failing checks before deploying');
    process.exit(1);
  } else {
    console.log('\n✅ DEPLOYMENT SAFETY CHECK PASSED - SAFE TO DEPLOY');
    process.exit(0);
  }
}

// Run safety check
runDeploymentSafetyCheck().catch(error => {
  console.error('💥 Deployment safety check failed:', error);
  process.exit(1);
});
