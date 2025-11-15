#!/usr/bin/env node
/**
 * Test RAG search for tripod queries to verify chunks are being found
 */

const https = require('https');

const query = process.argv[2] || 'what tripod do you recommend for landscape photography';
const sessionId = `test-rag-${Date.now()}`;

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

console.log(`\n🔍 Testing RAG Search for query: "${query}"`);
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
      
      // Check debug info for chunks
      if (response.debugInfo || response.debug) {
        const debug = response.debugInfo || response.debug;
        console.log(`\n🔍 Debug Info:`);
        console.log(`  Intent: ${debug.intent || 'unknown'}`);
        console.log(`  Approach: ${debug.approach || 'unknown'}`);
        if (debug.debugLogs) {
          console.log(`  Debug Logs:`);
          debug.debugLogs.forEach(log => {
            console.log(`    - ${log}`);
          });
        }
      }
      
      // Check for chunks found
      const chunksFound = response.debugInfo?.debugLogs?.find(log => log.includes('Chunks found:')) || 
                         response.debug?.debugLogs?.find(log => log.includes('Chunks found:'));
      if (chunksFound) {
        const count = chunksFound.match(/Chunks found: (\d+)/)?.[1] || '0';
        if (parseInt(count) === 0) {
          console.log(`\n❌ ERROR: Chunks found: 0 - RAG search is not finding chunks!`);
        } else {
          console.log(`\n✅ SUCCESS: ${chunksFound} - RAG search is working!`);
        }
      }
      
      // Check sources
      if (response.sources) {
        console.log(`\n📚 Sources:`);
        if (response.sources.articles) {
          console.log(`  Articles: ${response.sources.articles.length}`);
          response.sources.articles.forEach((article, i) => {
            console.log(`    ${i + 1}. ${article.title}`);
            if (article.title.toLowerCase().includes('tripod')) {
              console.log(`       ✅ Found tripod article!`);
            }
          });
        }
      }
      
      // Check structured response
      if (response.structured) {
        const s = response.structured;
        console.log(`\n📋 Structured Response:`);
        console.log(`  Articles: ${s.articles?.length || 0}`);
        if (s.articles) {
          s.articles.forEach((article, i) => {
            console.log(`    ${i + 1}. ${article.title}`);
            if (article.title.toLowerCase().includes('tripod')) {
              console.log(`       ✅ Found tripod article in structured response!`);
            }
          });
        }
        console.log(`  Products: ${s.products?.length || 0}`);
        console.log(`  Events: ${s.events?.length || 0}`);
      }
      
      // Check if answer mentions tripod
      const answer = response.answer || response.answer_markdown || '';
      if (answer.toLowerCase().includes('tripod')) {
        console.log(`\n✅ Answer mentions "tripod"`);
      } else {
        console.log(`\n⚠️  Answer does NOT mention "tripod" - may indicate RAG search issue`);
      }
      
    } catch (e) {
      console.error('Error parsing response:', e.message);
      console.log('Raw response:', data.substring(0, 1000));
    }
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
});

req.write(postData);
req.end();

