import https from 'https';

// Test script for broader, more specific queries that should return direct answers
// These should bypass clarification and provide direct, helpful responses

const broaderQueries = [
  "free online photography academy",
  "what are your terms and conditions", 
  "who is alan ranger",
  "where can i read your customer reviews",
  "do you do commercial photography",
  "how long have you been professional",
  "what is your cancellation policy",
  "do you offer gift vouchers",
  "what equipment do i need for workshops",
  "how do i book a workshop"
];

async function testBroaderQuery(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query });
    
    const options = {
      hostname: 'alan-chat-proxy.vercel.app',
      port: 443,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            query,
            type: response.type,
            confidence: response.confidence,
            hasAnswer: !!(response.answer || response.answer_markdown),
            answerLength: (response.answer || response.answer_markdown || '').length,
            options: response.options || [],
            debug: response.debug || {}
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runBroaderQueryTest() {
  console.log('🔍 TESTING BROADER, SPECIFIC QUERIES');
  console.log('=' .repeat(70));
  console.log('These queries should return DIRECT ANSWERS, not clarification');
  console.log('=' .repeat(70));
  
  const results = [];
  
  for (const query of broaderQueries) {
    console.log(`\n📋 Testing: "${query}"`);
    console.log('-'.repeat(50));
    
    try {
      const result = await testBroaderQuery(query);
      results.push(result);
      
      console.log(`Response Type: ${result.type}`);
      console.log(`Confidence: ${result.confidence}%`);
      console.log(`Has Answer: ${result.hasAnswer ? '✅ YES' : '❌ NO'}`);
      console.log(`Answer Length: ${result.answerLength} characters`);
      console.log(`Options Count: ${result.options.length}`);
      
      if (result.options.length > 0) {
        console.log('Options:');
        result.options.forEach((opt, i) => {
          const text = opt.text || opt;
          console.log(`  ${i+1}. ${text}`);
        });
      }
      
      // Analyze the response
      let analysis = '';
      if (result.type === 'clarification' && result.options.length > 0) {
        analysis = '❌ WRONG - Should be direct answer, not clarification';
      } else if (result.type === 'advice' && result.hasAnswer) {
        analysis = '✅ CORRECT - Direct answer provided';
      } else if (result.type === 'events' && result.hasAnswer) {
        analysis = '✅ CORRECT - Event-based answer provided';
      } else if (result.hasAnswer) {
        analysis = '✅ CORRECT - Direct answer provided';
      } else {
        analysis = '❌ WRONG - No answer provided';
      }
      
      console.log(`Analysis: ${analysis}`);
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      results.push({
        query,
        type: 'error',
        confidence: 0,
        hasAnswer: false,
        answerLength: 0,
        options: [],
        error: error.message
      });
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 BROADER QUERIES TEST SUMMARY');
  console.log('='.repeat(70));
  
  const total = results.length;
  const directAnswers = results.filter(r => r.hasAnswer && r.type !== 'clarification').length;
  const clarifications = results.filter(r => r.type === 'clarification').length;
  const noAnswers = results.filter(r => !r.hasAnswer && r.type !== 'clarification').length;
  const errors = results.filter(r => r.type === 'error').length;
  
  console.log(`\nOverall Results:`);
  console.log(`  Total Queries: ${total}`);
  console.log(`  Direct Answers: ${directAnswers} (${((directAnswers/total)*100).toFixed(1)}%)`);
  console.log(`  Clarifications: ${clarifications} (${((clarifications/total)*100).toFixed(1)}%)`);
  console.log(`  No Answers: ${noAnswers} (${((noAnswers/total)*100).toFixed(1)}%)`);
  console.log(`  Errors: ${errors} (${((errors/total)*100).toFixed(1)}%)`);
  
  // Failed queries
  const failed = results.filter(r => r.type === 'clarification' || (!r.hasAnswer && r.type !== 'error'));
  if (failed.length > 0) {
    console.log('\n❌ FAILED QUERIES (Should be direct answers):');
    failed.forEach(f => {
      console.log(`   "${f.query}" - Got: ${f.type} (${f.hasAnswer ? 'with answer' : 'no answer'})`);
    });
  }
  
  // Successful queries
  const successful = results.filter(r => r.hasAnswer && r.type !== 'clarification');
  if (successful.length > 0) {
    console.log('\n✅ SUCCESSFUL QUERIES (Correct direct answers):');
    successful.forEach(s => {
      console.log(`   "${s.query}" - ${s.type} (${s.answerLength} chars)`);
    });
  }
  
  console.log('\n🎯 KEY FINDINGS:');
  console.log('1. Broader queries should return direct answers, not clarification');
  console.log('2. If queries are going to clarification, the direct answer logic is failing');
  console.log('3. If queries have no answers, the content search is failing');
  console.log('4. These queries test the system\'s ability to provide helpful, specific information');
  
  console.log('\n🚀 NEXT STEPS:');
  console.log('1. Fix direct answer routing for broader queries');
  console.log('2. Improve content search for specific information');
  console.log('3. Ensure these queries bypass clarification system');
  console.log('4. Test that answers are relevant and helpful');
  
  return results;
}

runBroaderQueryTest().catch(console.error);



