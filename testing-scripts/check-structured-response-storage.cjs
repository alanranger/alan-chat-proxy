#!/usr/bin/env node
/**
 * Check structured_response storage in database via Analytics API
 */

const https = require('https');

const DEPLOYED_API_URL = 'https://alan-chat-proxy.vercel.app';
const AUTH_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';

async function makeRequest(path, params = {}) {
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
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function checkStructuredResponseStorage() {
  console.log('\n🔍 CHECKING STRUCTURED_RESPONSE STORAGE IN DATABASE');
  console.log('='.repeat(80));
  
  // Get recent questions
  console.log('\n📊 Fetching recent questions from analytics...');
  const questionsResponse = await makeRequest('/api/analytics', { action: 'questions', limit: 20 });
  
  if (questionsResponse.status !== 200 || !questionsResponse.data.ok) {
    console.log('❌ Failed to fetch questions:', questionsResponse.data);
    return;
  }
  
  const questions = questionsResponse.data.questions?.topQuestions || questionsResponse.data.questions?.recentQuestions || [];
  console.log(`✅ Found ${questions.length} recent questions`);
  
  let withStructured = 0;
  let withoutStructured = 0;
  let structuredTypes = {};
  let sampleWithStructured = [];
  let sampleWithoutStructured = [];
  
  console.log('\n📋 Checking structured_response field...');
  
  for (const q of questions.slice(0, 20)) {
    // Get question detail
    const questionText = q.question_text || q.question;
    const detailResponse = await makeRequest('/api/analytics', { action: 'question_detail', question: questionText });
    
    if (detailResponse.status === 200 && detailResponse.data.ok) {
      const interactions = detailResponse.data.question?.interactions || [];
      const latest = interactions[0]; // Most recent interaction
      
      if (latest && latest.structured_response) {
        withStructured++;
        
        try {
          const structured = typeof latest.structured_response === 'string' 
            ? JSON.parse(latest.structured_response) 
            : latest.structured_response;
          
          const types = [];
          if (structured.articles && structured.articles.length > 0) types.push('articles');
          if (structured.services && structured.services.length > 0) types.push('services');
          if (structured.events && structured.events.length > 0) types.push('events');
          if (structured.products && structured.products.length > 0) types.push('products');
          
          const typeKey = types.join(',') || 'empty';
          structuredTypes[typeKey] = (structuredTypes[typeKey] || 0) + 1;
          
          if (sampleWithStructured.length < 5) {
            sampleWithStructured.push({
              question: questionText,
              types: types,
              articleCount: structured.articles?.length || 0,
              serviceCount: structured.services?.length || 0,
              eventCount: structured.events?.length || 0,
              productCount: structured.products?.length || 0
            });
          }
        } catch (e) {
          console.log(`⚠️  Error parsing structured_response for "${questionText}": ${e.message}`);
        }
      } else {
        withoutStructured++;
        if (sampleWithoutStructured.length < 5) {
          sampleWithoutStructured.push({
            question: questionText,
            intent: latest?.intent || 'unknown',
            type: latest?.type || 'unknown'
          });
        }
      }
    }
    
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📊 STRUCTURED_RESPONSE STORAGE ANALYSIS:');
  console.log(`  Questions WITH structured_response: ${withStructured} (${(withStructured/(withStructured+withoutStructured)*100).toFixed(1)}%)`);
  console.log(`  Questions WITHOUT structured_response: ${withoutStructured} (${(withoutStructured/(withStructured+withoutStructured)*100).toFixed(1)}%)`);
  
  console.log('\n📊 STRUCTURED_RESPONSE TYPE DISTRIBUTION:');
  Object.entries(structuredTypes).sort((a, b) => b[1] - a[1]).forEach(([types, count]) => {
    console.log(`  ${types || 'empty'}: ${count}`);
  });
  
  if (sampleWithStructured.length > 0) {
    console.log('\n✅ SAMPLE QUESTIONS WITH STRUCTURED_RESPONSE:');
    sampleWithStructured.forEach((s, i) => {
      console.log(`  ${i+1}. "${s.question.substring(0, 60)}${s.question.length > 60 ? '...' : ''}"`);
      console.log(`     Types: ${s.types.join(', ') || 'none'}`);
      console.log(`     Counts: Articles: ${s.articleCount}, Services: ${s.serviceCount}, Events: ${s.eventCount}, Products: ${s.productCount}`);
    });
  }
  
  if (sampleWithoutStructured.length > 0) {
    console.log('\n❌ SAMPLE QUESTIONS WITHOUT STRUCTURED_RESPONSE:');
    sampleWithoutStructured.forEach((s, i) => {
      console.log(`  ${i+1}. "${s.question.substring(0, 60)}${s.question.length > 60 ? '...' : ''}"`);
      console.log(`     Intent: ${s.intent}, Type: ${s.type}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
}

checkStructuredResponseStorage().catch(console.error);

