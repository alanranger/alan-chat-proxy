#!/usr/bin/env node
/**
 * Test a specific query to verify fixes
 */

const https = require('https');

const query = process.argv[2] || 'when is golden hour';
const sessionId = `test-${Date.now()}`;

const postData = JSON.stringify({
  query: query,
  sessionId: sessionId
});

const options = {
  hostname: 'alan-chat-proxy.vercel.app',
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': postData.length
  }
};

console.log(`\n🔍 Testing query: "${query}"`);
console.log('='.repeat(80));

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      console.log(`\n✅ Status: ${res.statusCode}`);
      console.log(`\n📝 Answer:`);
      console.log(response.answer || response.answer_markdown || 'No answer');
      console.log(`\n🎯 Type: ${response.type || 'unknown'}`);
      console.log(`📊 Confidence: ${response.confidence ? (response.confidence * 100).toFixed(1) + '%' : 'unknown'}`);
      
      if (response.sources) {
        console.log(`\n📚 Sources: ${Array.isArray(response.sources) ? response.sources.length : 'object'}`);
      }
      
      if (response.structured) {
        const s = response.structured;
        console.log(`\n📋 Structured Response:`);
        console.log(`  Articles: ${s.articles?.length || 0}`);
        console.log(`  Services: ${s.services?.length || 0}`);
        console.log(`  Events: ${s.events?.length || 0}`);
        console.log(`  Products: ${s.products?.length || 0}`);
      }
      
      // Check for wrong content
      const answer = response.answer || response.answer_markdown || '';
      if (answer.includes('Q7') || answer.includes('Q8') || answer.includes('dynamic range')) {
        console.log(`\n❌ ERROR: Answer contains wrong content (Q7/Q8/dynamic range)!`);
        console.log(`   This indicates FAQ matching is still broken.`);
      } else if (answer.toLowerCase().includes('golden hour')) {
        console.log(`\n✅ SUCCESS: Answer contains "golden hour" - looks correct!`);
      } else {
        console.log(`\n⚠️  WARNING: Answer doesn't mention "golden hour"`);
      }
      
    } catch (e) {
      console.error('Error parsing response:', e.message);
      console.log('Raw response:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
});

req.write(postData);
req.end();
