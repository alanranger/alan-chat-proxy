#!/usr/bin/env node
/**
 * Regression test for "How do I get personalised feedback on my images" query
 * This ensures the query matches the correct SERVICE_PATTERN and returns the expected answer
 */

const http = require('http');
const API_URL = 'localhost';
const API_PORT = 3000;
const API_PATH = '/api/chat';

const TEST_QUERY = "How do I get personalised feedback on my images";
const EXPECTED_ANSWER_SNIPPET = "**Personalised Feedback**";
const EXPECTED_ANSWER_CONTAINS = [
  "1-2-1 private photography lessons",
  "face-to-face",
  "online via Zoom",
  "personalised feedback",
  "Book Private Lessons for Feedback"
];

async function testQuery(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: query,
      sessionId: `regression-test-${Date.now()}`
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

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            status: res.statusCode,
            response: response
          });
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

function validateResponse(response, query) {
  const errors = [];
  const warnings = [];

  // Check response structure
  if (!response.response) {
    errors.push('❌ No response object in response');
    return { success: false, errors, warnings };
  }

  const data = response.response;
  const answer = String(data.answer || '');

  // Check 1: Response must be successful
  if (response.status !== 200) {
    errors.push(`❌ HTTP status is ${response.status}, expected 200`);
  }

  if (!data.ok && !data.answer) {
    errors.push('❌ Response indicates failure and has no answer');
  }

  // Check 2: Answer must start with expected snippet
  if (!answer.includes(EXPECTED_ANSWER_SNIPPET)) {
    errors.push(`❌ Answer does not start with "${EXPECTED_ANSWER_SNIPPET}"`);
    errors.push(`   Actual answer start: "${answer.substring(0, 100)}..."`);
  }

  // Check 3: Answer must contain all expected content
  for (const expected of EXPECTED_ANSWER_CONTAINS) {
    if (!answer.includes(expected)) {
      warnings.push(`⚠️  Answer missing expected content: "${expected}"`);
    }
  }

  // Check 4: Type should be "advice" or "services" (not wrong type)
  const wrongTypes = ['unknown', 'events'];
  if (wrongTypes.includes(data.type)) {
    errors.push(`❌ Response type is "${data.type}", should be "advice" or "services"`);
  }

  // Check 5: Should NOT contain wrong content
  const wrongContentIndicators = [
    'ISO',
    'Noise Clinic',
    'exposure triangle',
    'aperture',
    'shutter'
  ];
  
  const answerLower = answer.toLowerCase();
  for (const wrong of wrongContentIndicators) {
    if (answerLower.includes(wrong.toLowerCase())) {
      // Only error if it's prominent (not just a minor mention)
      const wrongLower = wrong.toLowerCase();
      if (answerLower.indexOf(wrongLower) < 200) {
        errors.push(`❌ Answer contains wrong content: "${wrong}"`);
        errors.push(`   This suggests wrong routing (ISO/technical instead of service)`);
      }
    }
  }

  // Check 6: Sources should be articles: [] or services: [] (not articles with wrong content)
  if (data.sources && data.sources.articles && data.sources.articles.length > 0) {
    const articleTitles = data.sources.articles.map(a => a.title || '').join(', ');
    if (articleTitles.toLowerCase().includes('iso') && !articleTitles.toLowerCase().includes('private') && !articleTitles.toLowerCase().includes('lesson')) {
      warnings.push(`⚠️  Articles found contain ISO content: "${articleTitles}"`);
    }
  }

  const success = errors.length === 0;

  return {
    success,
    errors,
    warnings,
    answer: answer.substring(0, 300),
    type: data.type,
    confidence: data.confidence
  };
}

(async () => {
  console.log('🧪 REGRESSION TEST: Personalised Feedback Query');
  console.log('=' .repeat(80));
  console.log(`Query: "${TEST_QUERY}"\n`);
  console.log('⚠️  NOTE: Check server console logs for [DEBUG] messages to see routing');
  console.log('');

  try {
    console.log('📡 Sending request to localhost:3000...');
    console.log('   (Check server console for debug logs showing which handler processes this query)\n');
    const result = await testQuery(TEST_QUERY);
    
    console.log('📊 RESPONSE RECEIVED:\n');
    console.log(`   Status: ${result.status}`);
    console.log(`   Type: ${result.response.type || 'unknown'}`);
    console.log(`   Confidence: ${result.response.confidence || 'unknown'}`);
    console.log(`   Answer length: ${String(result.response.answer || '').length} chars\n`);

    const validation = validateResponse(result, TEST_QUERY);

    console.log('✅ VALIDATION RESULTS:');
    console.log('=' .repeat(80));

    if (validation.success) {
      console.log('✅ PASSED: All checks passed!\n');
      console.log('Answer preview:');
      console.log(validation.answer);
      console.log('...\n');
    } else {
      console.log('❌ FAILED: Validation errors found\n');
    }

    if (validation.errors.length > 0) {
      console.log('❌ ERRORS:');
      validation.errors.forEach(err => console.log(`   ${err}`));
      console.log('');
    }

    if (validation.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      validation.warnings.forEach(warn => console.log(`   ${warn}`));
      console.log('');
    }

    if (validation.success) {
      console.log('✅ REGRESSION TEST PASSED - Query is working correctly');
      process.exit(0);
    } else {
      console.log('❌ REGRESSION TEST FAILED - Query needs to be fixed');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ TEST ERROR:', error.message);
    console.error('\nMake sure the local server is running on localhost:3000');
    process.exit(1);
  }
})();

