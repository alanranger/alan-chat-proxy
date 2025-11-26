#!/usr/bin/env node
/**
 * Test the recency fix locally - check if "what is ISO" and "what is depth of field" 
 * return the correct articles (older, more relevant articles should rank higher)
 */

const http = require('http');

const queries = [
  'what is ISO',
  'what is depth of field'
];

const LOCAL_URL = 'http://localhost:3000/api/chat';

async function testQuery(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: query,
      sessionId: `test-recency-${Date.now()}`
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };

    console.log(`\n🔍 Testing: "${query}"`);
    console.log('='.repeat(80));

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          console.log(`✅ Status: ${res.statusCode}`);
          console.log(`📊 Confidence: ${response.confidence ? (response.confidence * 100).toFixed(1) + '%' : 'unknown'}`);
          
          if (response.structured && response.structured.articles) {
            const articles = response.structured.articles;
            console.log(`\n📚 Articles (${articles.length}):`);
            
            articles.forEach((article, idx) => {
              const title = article.title || 'No title';
              const publishDate = article.publish_date || article.json_ld_data?.datePublished || 'Unknown';
              const isNew = publishDate.includes('2025-11-23');
              const isAssignment = title.toLowerCase().includes('assignment') || title.toLowerCase().includes('practice');
              
              console.log(`  ${idx + 1}. ${title}`);
              console.log(`     📅 Published: ${publishDate} ${isNew ? '🆕 NEW' : ''} ${isAssignment ? '📝 ASSIGNMENT' : ''}`);
            });
            
            // Check if the first article is the new assignment article
            const firstArticle = articles[0];
            const isFirstNewAssignment = firstArticle && (
              (firstArticle.publish_date && firstArticle.publish_date.includes('2025-11-23')) ||
              (firstArticle.json_ld_data?.datePublished && firstArticle.json_ld_data.datePublished.includes('2025-11-23'))
            ) && (
              firstArticle.title.toLowerCase().includes('assignment') || 
              firstArticle.title.toLowerCase().includes('practice')
            );
            
            if (isFirstNewAssignment) {
              console.log(`\n⚠️  WARNING: New assignment article is ranking first - this might indicate the fix isn't working`);
            } else {
              console.log(`\n✅ SUCCESS: Older, more relevant articles are ranking higher`);
            }
          }
          
          resolve(response);
        } catch (e) {
          console.error('❌ Error parsing response:', e.message);
          console.log('Raw response:', data.substring(0, 500));
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.error(`❌ Request error: ${e.message}`);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Recency Fix - Local Server');
  console.log('='.repeat(80));
  console.log('Testing against: http://localhost:3000');
  console.log('Expected: Older, more relevant articles should rank higher than new assignment articles');
  console.log('='.repeat(80));

  for (const query of queries) {
    try {
      await testQuery(query);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
      console.error(`Failed to test "${query}":`, e.message);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Local testing complete!');
  console.log('Next step: Deploy and run full 40Q regression test');
}

runTests().catch(console.error);


