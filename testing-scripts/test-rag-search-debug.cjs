#!/usr/bin/env node
/**
 * Test RAG search with detailed debugging to see what's happening
 * This calls the deployed API and shows what queries are being made
 */

const https = require('https');

const query = process.argv[2] || 'what tripod do you recommend for landscape photography';
const sessionId = `test-debug-${Date.now()}`;

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

console.log(`\n🔍 Testing RAG Search Debug for: "${query}"`);
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
      
      // Extract debug logs
      const debugLogs = response.debugInfo?.debugLogs || response.debug?.debugLogs || [];
      console.log(`\n📋 Debug Logs (${debugLogs.length} entries):`);
      debugLogs.forEach((log, i) => {
        console.log(`  ${i + 1}. ${log}`);
      });
      
      // Check for RAG search logs in the response
      if (response.fullPayload?.debugInfo?.debugLogs) {
        console.log(`\n📋 Full Payload Debug Logs:`);
        response.fullPayload.debugInfo.debugLogs.forEach((log, i) => {
          console.log(`  ${i + 1}. ${log}`);
        });
      }
      
      // Show chunks found
      const chunksFound = debugLogs.find(log => log.includes('Chunks found:'));
      if (chunksFound) {
        const count = chunksFound.match(/Chunks found: (\d+)/)?.[1] || '0';
        console.log(`\n${parseInt(count) === 0 ? '❌' : '✅'} ${chunksFound}`);
      }
      
      // Show answer
      console.log(`\n📝 Answer (${(response.answer || response.answer_markdown || '').length} chars):`);
      console.log(response.answer || response.answer_markdown || 'No answer');
      
      // Show sources
      if (response.sources?.articles) {
        console.log(`\n📚 Articles found: ${response.sources.articles.length}`);
        response.sources.articles.forEach((article, i) => {
          const hasTripod = article.title?.toLowerCase().includes('tripod');
          console.log(`  ${i + 1}. ${article.title} ${hasTripod ? '✅ TRIPOD ARTICLE' : ''}`);
        });
      }
      
    } catch (e) {
      console.error('Error parsing response:', e.message);
      console.log('Raw response (first 2000 chars):', data.substring(0, 2000));
    }
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
});

req.write(postData);
req.end();

