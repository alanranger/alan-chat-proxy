const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load the 40 questions
const testData = JSON.parse(fs.readFileSync('testing-scripts/interactive-testing-data.json', 'utf8'));
// Flatten the nested structure: questions are nested in categories
const questions = [];
testData.questions.forEach(category => {
  if (category.questions && Array.isArray(category.questions)) {
    category.questions.forEach(q => {
      questions.push(q);
    });
  } else if (category.question) {
    // Handle flat structure too
    questions.push(category);
  }
});

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
      },
      timeout: 30000 // 30 second timeout
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
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(payload);
    req.end();
  });
}

async function testQuestion(question, questionNum) {
  const payload = JSON.stringify({
    query: question.question,
    sessionId: `comparison-test-q${questionNum}`
  });

  try {
    // Test both endpoints
    const [localhostResult, deployedResult] = await Promise.all([
      makeRequest('http://localhost:3000/api/chat', payload),
      makeRequest('https://alan-chat-proxy.vercel.app/api/chat', payload)
    ]);

    const localAnswer = localhostResult.response.answer || '';
    const deployedAnswer = deployedResult.response.answer || '';
    const answersMatch = localAnswer === deployedAnswer;
    const typesMatch = localhostResult.response.type === deployedResult.response.type;
    const confidenceMatch = Math.abs((localhostResult.response.confidence || 0) - (deployedResult.response.confidence || 0)) < 0.01;

    return {
      questionNum,
      question: question.question,
      match: answersMatch && typesMatch && confidenceMatch,
      localhost: {
        status: localhostResult.status,
        answer: localAnswer,
        answerLength: localAnswer.length,
        type: localhostResult.response.type,
        confidence: localhostResult.response.confidence
      },
      deployed: {
        status: deployedResult.status,
        answer: deployedAnswer,
        answerLength: deployedAnswer.length,
        type: deployedResult.response.type,
        confidence: deployedResult.response.confidence
      },
      differences: {
        answerDifferent: !answersMatch,
        typeDifferent: !typesMatch,
        confidenceDifferent: !confidenceMatch
      }
    };
  } catch (error) {
    return {
      questionNum,
      question: question.question,
      match: false,
      error: error.message,
      localhost: null,
      deployed: null
    };
  }
}

(async () => {
  console.log('🔍 TESTING ALL 40 QUESTIONS: Localhost vs Deployed');
  console.log('='.repeat(80));
  console.log(`Total questions: ${questions.length}\n`);

  const results = [];
  let passed = 0;
  let failed = 0;
  let errors = 0;

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const questionNum = i + 1;
    
    process.stdout.write(`\rTesting ${questionNum}/40: "${question.question.substring(0, 50)}..."`);
    
    const result = await testQuestion(question, questionNum);
    results.push(result);
    
    if (result.error) {
      errors++;
    } else if (result.match) {
      passed++;
    } else {
      failed++;
    }

    // Small delay between requests to avoid overwhelming servers
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n\n📊 SUMMARY:');
  console.log('='.repeat(80));
  console.log(`✅ Passed (identical): ${passed}/${questions.length}`);
  console.log(`❌ Failed (different): ${failed}/${questions.length}`);
  console.log(`⚠️  Errors: ${errors}/${questions.length}`);

  // Show detailed differences
  const differences = results.filter(r => !r.match && !r.error);
  if (differences.length > 0) {
    console.log(`\n🔍 DETAILED DIFFERENCES (${differences.length} questions):`);
    console.log('='.repeat(80));
    
    differences.forEach(result => {
      console.log(`\nQ${result.questionNum}: "${result.question}"`);
      console.log(`  Match: ❌ NO`);
      
      if (result.differences.answerDifferent) {
        console.log(`  Answer length - Localhost: ${result.localhost.answerLength}, Deployed: ${result.deployed.answerLength}`);
        console.log(`  Localhost answer (first 150 chars):`);
        console.log(`    ${result.localhost.answer.substring(0, 150)}...`);
        console.log(`  Deployed answer (first 150 chars):`);
        console.log(`    ${result.deployed.answer.substring(0, 150)}...`);
      }
      
      if (result.differences.typeDifferent) {
        console.log(`  Type - Localhost: ${result.localhost.type}, Deployed: ${result.deployed.type}`);
      }
      
      if (result.differences.confidenceDifferent) {
        console.log(`  Confidence - Localhost: ${result.localhost.confidence}, Deployed: ${result.deployed.confidence}`);
      }
    });
  }

  // Show errors
  const errorResults = results.filter(r => r.error);
  if (errorResults.length > 0) {
    console.log(`\n⚠️  ERRORS (${errorResults.length} questions):`);
    console.log('='.repeat(80));
    errorResults.forEach(result => {
      console.log(`Q${result.questionNum}: "${result.question}"`);
      console.log(`  Error: ${result.error}`);
    });
  }

  // Save detailed results to JSON
  const outputPath = path.join('testing-scripts/test results', `localhost-vs-deployed-comparison-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: questions.length,
      passed,
      failed,
      errors
    },
    results
  }, null, 2));

  console.log(`\n💾 Detailed results saved to: ${outputPath}`);

  // Final verdict
  if (passed === questions.length) {
    console.log('\n✅ SUCCESS: All questions produce identical responses between localhost and deployed!');
    process.exit(0);
  } else {
    console.log(`\n❌ FAILURE: ${failed} question(s) produce different responses.`);
    console.log('   Review the differences above to identify the root cause.');
    process.exit(1);
  }
})();

