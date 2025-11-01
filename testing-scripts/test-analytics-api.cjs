#!/usr/bin/env node
/**
 * Test analytics API to verify data is being recorded
 */

const https = require('https');

const DEPLOYED_API_URL = 'https://alan-chat-proxy.vercel.app';
const AUTH_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';

function makeRequest(path, params = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, DEPLOYED_API_URL);
    Object.keys(params).forEach(key => url.searchParams.set(key, params[key]));
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': AUTH_TOKEN
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (error) {
          resolve({ status: res.statusCode, data: data, error: error.message });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function testAnalytics() {
  console.log('\n🔍 Testing Analytics API Endpoints...');
  console.log('='.repeat(80));
  
  try {
    // Test overview
    console.log('\n📊 Testing Overview endpoint...');
    const overview = await makeRequest('/api/analytics', { action: 'overview', days: 7 });
    console.log(`Status: ${overview.status}`);
    if (overview.status === 200 && overview.data.overview) {
      const { totals } = overview.data.overview;
      console.log(`✅ Total Sessions: ${totals.sessions}`);
      console.log(`✅ Total Questions: ${totals.questions}`);
      console.log(`✅ Avg Confidence: ${(totals.avgConfidence * 100).toFixed(1)}%`);
      console.log(`✅ Avg Response Time: ${Math.round(totals.avgResponseTime)}ms`);
    } else {
      console.log(`❌ Error: ${JSON.stringify(overview.data)}`);
    }
    
    // Test questions
    console.log('\n📋 Testing Questions endpoint...');
    const questions = await makeRequest('/api/analytics', { action: 'questions' });
    console.log(`Status: ${questions.status}`);
    if (questions.status === 200 && questions.data.questions) {
      const { topQuestions } = questions.data.questions;
      console.log(`✅ Found ${topQuestions.length} top questions`);
      if (topQuestions.length > 0) {
        console.log(`   Sample: "${topQuestions[0].question_text.substring(0, 50)}..."`);
        console.log(`   Frequency: ${topQuestions[0].frequency}, Confidence: ${(topQuestions[0].avg_confidence * 100).toFixed(1)}%`);
      }
    } else {
      console.log(`❌ Error: ${JSON.stringify(questions.data)}`);
    }
    
    // Test sessions
    console.log('\n👥 Testing Sessions endpoint...');
    const sessions = await makeRequest('/api/analytics', { action: 'sessions', page: 1, limit: 5 });
    console.log(`Status: ${sessions.status}`);
    if (sessions.status === 200 && sessions.data.sessions) {
      const { data: sessionsList, pagination } = sessions.data.sessions;
      console.log(`✅ Found ${sessionsList.length} sessions (page ${pagination.page} of ${pagination.pages})`);
      if (sessionsList.length > 0) {
        console.log(`   Sample Session: ${sessionsList[0].session_id.substring(0, 20)}...`);
        console.log(`   Questions: ${sessionsList[0].total_questions || 0}`);
      }
    } else {
      console.log(`❌ Error: ${JSON.stringify(sessions.data)}`);
    }
    
    // Test admin counts
    console.log('\n🔧 Testing Admin Counts endpoint...');
    const admin = await makeRequest('/api/analytics', { action: 'admin_counts' });
    console.log(`Status: ${admin.status}`);
    if (admin.status === 200 && admin.data.counts) {
      const { counts } = admin.data;
      console.log(`✅ Total Questions: ${counts.questions || 0}`);
      console.log(`✅ Total Sessions: ${counts.sessions || 0}`);
      console.log(`✅ Total Interactions: ${counts.interactions || 0}`);
    } else {
      console.log(`❌ Error: ${JSON.stringify(admin.data)}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Analytics API test complete!');
    console.log('💡 Now check https://alan-chat-proxy.vercel.app/analytics.html');
    console.log('   The page should display all the data we just verified.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testAnalytics();

