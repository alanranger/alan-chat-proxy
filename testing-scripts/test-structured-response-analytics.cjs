#!/usr/bin/env node
/**
 * Test script to verify structured_response is stored and displayed in analytics
 * Tests: Chat API response → Database storage → Analytics API retrieval
 */

const https = require('https');

const API_URL = 'https://alan-chat-proxy.vercel.app';
const AUTH_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';

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

async function testChatAPI(question) {
  console.log(`\n💬 Testing Chat API with question: "${question}"`);
  console.log('='.repeat(80));
  
  const sessionId = `test-structured-${Date.now()}`;
  
  const response = await makeRequest('/api/chat', {
    method: 'POST',
    body: {
      query: question,
      sessionId: sessionId,
      pageContext: { pathname: '/test' }
    }
  });
  
  console.log(`   Status: ${response.status}`);
  
  if (response.status === 200 && response.body && response.body.ok) {
    console.log(`   ✅ Chat API responded successfully`);
    console.log(`   Type: ${response.body.type || 'unknown'}`);
    console.log(`   Confidence: ${response.body.confidence ? (response.body.confidence * 100).toFixed(1) + '%' : 'N/A'}`);
    
    // Check for structured data in response
    if (response.body.structured) {
      const structured = response.body.structured;
      console.log(`   ✅ Structured data present:`);
      console.log(`      - Intent: ${structured.intent || 'N/A'}`);
      console.log(`      - Articles: ${structured.articles?.length || 0}`);
      console.log(`      - Services: ${structured.services?.length || 0}`);
      console.log(`      - Events: ${structured.events?.length || 0}`);
      console.log(`      - Products: ${structured.products?.length || 0}`);
      
      return {
        success: true,
        sessionId: sessionId,
        question: question,
        structured: structured
      };
    } else {
      console.log(`   ⚠️  No structured data in response`);
      return {
        success: true,
        sessionId: sessionId,
        question: question,
        structured: null
      };
    }
  } else {
    console.log(`   ❌ Chat API failed: ${response.body?.error || 'Unknown error'}`);
    return {
      success: false,
      error: response.body?.error || 'Unknown error'
    };
  }
}

async function testAnalyticsRetrieval(question) {
  console.log(`\n📊 Testing Analytics API retrieval for: "${question}"`);
  console.log('='.repeat(80));
  
  // Wait a moment for database to update
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const response = await makeRequest('/api/analytics', {
    method: 'GET',
    headers: {
      'Authorization': AUTH_TOKEN
    }
  }, { action: 'question_detail', question: question });
  
  // Fix the URL construction
  const url = new URL('/api/analytics', API_URL);
  url.searchParams.set('action', 'question_detail');
  url.searchParams.set('question', question);
  
  const response2 = await makeRequest(url.pathname + url.search, {
    method: 'GET',
    headers: {
      'Authorization': AUTH_TOKEN
    }
  });
  
  console.log(`   Status: ${response2.status}`);
  
  if (response2.status === 200 && response2.body && response2.body.ok) {
    const interactions = response2.body.question?.interactions || [];
    console.log(`   ✅ Found ${interactions.length} interaction(s)`);
    
    if (interactions.length > 0) {
      const latest = interactions[0];
      console.log(`   Question: "${latest.question}"`);
      console.log(`   Answer: "${latest.answer?.substring(0, 100)}..."`);
      console.log(`   Confidence: ${latest.confidence ? (latest.confidence * 100).toFixed(1) + '%' : 'N/A'}`);
      
      if (latest.structured_response) {
        console.log(`   ✅ structured_response is stored!`);
        const structured = latest.structured_response;
        console.log(`      - Intent: ${structured.intent || 'N/A'}`);
        console.log(`      - Articles: ${structured.articles?.length || 0}`);
        console.log(`      - Services: ${structured.services?.length || 0}`);
        console.log(`      - Events: ${structured.events?.length || 0}`);
        console.log(`      - Products: ${structured.products?.length || 0}`);
        
        // Show sample data
        if (structured.articles && structured.articles.length > 0) {
          console.log(`      Sample Article: "${structured.articles[0].title || 'N/A'}"`);
        }
        if (structured.services && structured.services.length > 0) {
          console.log(`      Sample Service: "${structured.services[0].title || 'N/A'}"`);
        }
        if (structured.events && structured.events.length > 0) {
          console.log(`      Sample Event: "${structured.events[0].title || 'N/A'}"`);
        }
        
        return {
          success: true,
          structuredResponse: structured,
          hasArticles: (structured.articles?.length || 0) > 0,
          hasServices: (structured.services?.length || 0) > 0,
          hasEvents: (structured.events?.length || 0) > 0
        };
      } else {
        console.log(`   ❌ structured_response is NOT stored`);
        console.log(`   ⚠️  This means logAnswer() is not passing the structured data`);
        return {
          success: false,
          error: 'structured_response not found in database'
        };
      }
    } else {
      console.log(`   ⚠️  No interactions found (may need to wait longer)`);
      return {
        success: false,
        error: 'No interactions found'
      };
    }
  } else {
    console.log(`   ❌ Analytics API failed: ${response2.body?.error || 'Unknown error'}`);
    return {
      success: false,
      error: response2.body?.error || 'Unknown error'
    };
  }
}

async function runTests() {
  console.log('\n🧪 Testing Structured Response Storage and Analytics Display');
  console.log('='.repeat(80));
  console.log('This test verifies:');
  console.log('  1. Chat API returns structured data');
  console.log('  2. structured_response is stored in database');
  console.log('  3. Analytics API returns structured_response');
  console.log('  4. Analytics dashboard can display related information tiles');
  
  // Test with a question that should return structured data
  const testQuestions = [
    'What photography workshops do you offer?',
    'How do I shoot in low light?',
    'What tripod do you recommend?'
  ];
  
  let allPassed = true;
  
  for (const question of testQuestions) {
    try {
      // Step 1: Test Chat API
      const chatResult = await testChatAPI(question);
      
      if (!chatResult.success) {
        console.log(`\n❌ Chat API test failed for: "${question}"`);
        allPassed = false;
        continue;
      }
      
      if (!chatResult.structured) {
        console.log(`\n⚠️  Chat API didn't return structured data for: "${question}"`);
        console.log(`   This might be expected for some question types`);
        continue;
      }
      
      // Step 2: Test Analytics Retrieval
      const analyticsResult = await testAnalyticsRetrieval(question);
      
      if (analyticsResult.success && analyticsResult.structuredResponse) {
        console.log(`\n✅ SUCCESS: structured_response is working for "${question}"`);
        console.log(`   You can now view this question in the analytics dashboard to see the tiles!`);
      } else {
        console.log(`\n❌ FAILED: structured_response not stored for "${question}"`);
        allPassed = false;
      }
      
      // Wait between questions
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`\n❌ Error testing "${question}": ${error.message}`);
      allPassed = false;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  if (allPassed) {
    console.log('🎉 All tests passed! Structured response is working correctly.');
    console.log('\n💡 Next steps:');
    console.log('   1. Open https://alan-chat-proxy.vercel.app/analytics.html');
    console.log('   2. Go to the Questions tab');
    console.log('   3. Click "View" on one of the test questions');
    console.log('   4. Verify that related information tiles appear below the answer');
  } else {
    console.log('⚠️  Some tests failed. Review the output above.');
    console.log('\n💡 If structured_response is not stored:');
    console.log('   - Check that logAnswer() calls are passing the structured data');
    console.log('   - Verify the database column exists');
    console.log('   - Check server logs for errors');
  }
  console.log('='.repeat(80));
}

runTests().catch((error) => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});

