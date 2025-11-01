const http = require('http');
const https = require('https');

// Test query that user reported having different answers
const testQuery = "Where is your gallery and can I submit my images for feedback?";

function makeRequest(url, payload) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            response: JSON.parse(data)
          });
        } catch (error) {
          reject(new Error(`Parse error: ${error.message}, Data: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  console.log('🔍 TESTING: Localhost vs Deployed endpoint comparison');
  console.log('='.repeat(80));
  console.log(`Query: "${testQuery}"\n`);

  const payload = JSON.stringify({
    query: testQuery,
    sessionId: 'comparison-test-session'
  });

  try {
    // Test localhost
    console.log('📡 Testing localhost:3000...');
    const localhostResult = await makeRequest('http://localhost:3000/api/chat', payload);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test deployed (update this URL to match your actual deployed URL)
    console.log('📡 Testing deployed endpoint...');
    const deployedResult = await makeRequest('https://alan-chat-proxy.vercel.app/api/chat', payload);
    
    console.log('\n📊 RESULTS:');
    console.log('='.repeat(80));
    
    const localAnswer = localhostResult.response.answer || '';
    const deployedAnswer = deployedResult.response.answer || '';
    
    console.log('\n✅ LOCALHOST Response:');
    console.log(`   Status: ${localhostResult.status}`);
    console.log(`   Type: ${localhostResult.response.type}`);
    console.log(`   Confidence: ${localhostResult.response.confidence}`);
    console.log(`   Answer (${localAnswer.length} chars):`);
    console.log(`   ${localAnswer.substring(0, 300)}${localAnswer.length > 300 ? '...' : ''}`);
    
    console.log('\n🌐 DEPLOYED Response:');
    console.log(`   Status: ${deployedResult.status}`);
    console.log(`   Type: ${deployedResult.response.type}`);
    console.log(`   Confidence: ${deployedResult.response.confidence}`);
    console.log(`   Answer (${deployedAnswer.length} chars):`);
    console.log(`   ${deployedAnswer.substring(0, 300)}${deployedAnswer.length > 300 ? '...' : ''}`);
    
    console.log('\n🔍 COMPARISON:');
    console.log('='.repeat(80));
    
    const answersMatch = localAnswer === deployedAnswer;
    const typesMatch = localhostResult.response.type === deployedResult.response.type;
    const confidenceMatch = localhostResult.response.confidence === deployedResult.response.confidence;
    
    console.log(`Answer match: ${answersMatch ? '✅ YES' : '❌ NO'}`);
    if (!answersMatch) {
      console.log('\n⚠️  ANSWERS DIFFER:');
      console.log(`\nLocalhost (first 500 chars):`);
      console.log(localAnswer.substring(0, 500));
      console.log(`\nDeployed (first 500 chars):`);
      console.log(deployedAnswer.substring(0, 500));
      
      // Find first difference
      const minLen = Math.min(localAnswer.length, deployedAnswer.length);
      for (let i = 0; i < minLen; i++) {
        if (localAnswer[i] !== deployedAnswer[i]) {
          console.log(`\n🔍 First difference at position ${i}:`);
          console.log(`   Localhost: "${localAnswer.substring(i, i + 50)}"`);
          console.log(`   Deployed:  "${deployedAnswer.substring(i, i + 50)}"`);
          break;
        }
      }
      if (localAnswer.length !== deployedAnswer.length) {
        console.log(`\n⚠️  Length difference: Localhost=${localAnswer.length}, Deployed=${deployedAnswer.length}`);
      }
    }
    
    console.log(`\nType match: ${typesMatch ? '✅ YES' : '❌ NO'}`);
    if (!typesMatch) {
      console.log(`   Localhost: ${localhostResult.response.type}`);
      console.log(`   Deployed: ${deployedResult.response.type}`);
    }
    
    console.log(`\nConfidence match: ${confidenceMatch ? '✅ YES' : '❌ NO'}`);
    if (!confidenceMatch) {
      console.log(`   Localhost: ${localhostResult.response.confidence}`);
      console.log(`   Deployed: ${deployedResult.response.confidence}`);
    }

    if (answersMatch && typesMatch && confidenceMatch) {
      console.log('\n✅ Both endpoints produce IDENTICAL responses');
      console.log('   If you\'re seeing differences, check:');
      console.log('   1. Is interactive testing actually using the deployed URL?');
      console.log('   2. Is there any frontend transformation of the answer?');
      console.log('   3. Is there caching involved?');
    } else {
      console.log('\n❌ RESPONSES DIFFER between localhost and deployed!');
      console.log('   This explains why baseline tests (localhost) differ from interactive testing (deployed)');
      console.log('   Possible causes:');
      console.log('   1. Deployed code is different from local');
      console.log('   2. Different database data');
      console.log('   3. Different environment variables');
      console.log('   4. Caching on deployed endpoint');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n⚠️  Could not connect to localhost:3000');
      console.error('   Make sure your local server is running: npm run dev');
    } else if (error.message.includes('getaddrinfo ENOTFOUND')) {
      console.error('\n⚠️  Could not resolve deployed URL');
      console.error('   Update the deployed URL in this script if it\'s different');
    }
    process.exit(1);
  }
})();

