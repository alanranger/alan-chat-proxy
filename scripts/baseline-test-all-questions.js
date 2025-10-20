import fs from 'fs';
import csv from 'csv-parser';
import https from 'https';

const questions = [];
const results = [];
const startTime = Date.now();

console.log('🔍 BASELINE TEST: Current System Responses to All Questions');
console.log('==========================================================');

// Read all questions from both CSV files
async function loadAllQuestions() {
  return new Promise((resolve, reject) => {
    // Load from new test question batch (171 questions)
    fs.createReadStream('CSVSs from website/new test question batch.csv')
      .pipe(csv())
      .on('data', (row) => {
        const question = Object.values(row)[0];
        if (question && typeof question === 'string') {
          questions.push({ question, source: 'new_test_batch' });
        }
      })
      .on('end', () => {
        console.log(`Loaded ${questions.length} questions from new test batch`);
        
        // Load from photography questions cleaned ALL (356 questions)
        fs.createReadStream('CSVSs from website/photography_questions_cleaned_ALL.csv')
          .pipe(csv({ headers: false }))
          .on('data', (row) => {
            const question = Object.values(row)[0];
            if (question && typeof question === 'string') {
              // Avoid duplicates
              if (!questions.find(q => q.question === question)) {
                questions.push({ question, source: 'photography_cleaned_all' });
              }
            }
          })
          .on('end', () => {
            console.log(`Total unique questions loaded: ${questions.length}`);
            resolve();
          })
          .on('error', reject);
      })
      .on('error', reject);
  });
}

// Test a single question
async function testQuestion(questionObj, index) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      query: questionObj.question,
      topK: 10,
      sessionId: `baseline-test-${Date.now()}`,
      pageContext: null
    });

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
          const result = {
            index: index + 1,
            question: questionObj.question,
            source: questionObj.source,
            responseType: response.type || 'unknown',
            confidence: response.confidence || 0,
            hasAnswer: !!(response.answer || response.answer_markdown),
            answerLength: (response.answer || response.answer_markdown || '').length,
            optionsCount: (response.options || []).length,
            hasPills: !!(response.structured && response.structured.pills && response.structured.pills.length > 0),
            pillsCount: (response.structured && response.structured.pills) ? response.structured.pills.length : 0,
            debug: response.debug || {},
            timestamp: new Date().toISOString()
          };
          resolve(result);
        } catch (error) {
          resolve({
            index: index + 1,
            question: questionObj.question,
            source: questionObj.source,
            responseType: 'error',
            confidence: 0,
            hasAnswer: false,
            answerLength: 0,
            optionsCount: 0,
            hasPills: false,
            pillsCount: 0,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        index: index + 1,
        question: questionObj.question,
        source: questionObj.source,
        responseType: 'network_error',
        confidence: 0,
        hasAnswer: false,
        answerLength: 0,
        optionsCount: 0,
        hasPills: false,
        pillsCount: 0,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });

    req.write(postData);
    req.end();
  });
}

// Main execution
async function runBaselineTest() {
  try {
    // Load all questions
    await loadAllQuestions();
    
    console.log(`\n🚀 Starting baseline test of ${questions.length} questions...`);
    console.log('This will take several minutes. Testing in batches of 10...\n');
    
    // Test questions in batches to avoid overwhelming the API
    const batchSize = 10;
    const totalBatches = Math.ceil(questions.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, questions.length);
      const batch = questions.slice(startIndex, endIndex);
      
      console.log(`📊 Testing batch ${batchIndex + 1}/${totalBatches} (questions ${startIndex + 1}-${endIndex})`);
      
      // Test all questions in this batch concurrently
      const batchPromises = batch.map((questionObj, index) => 
        testQuestion(questionObj, startIndex + index)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Show progress
      const completed = results.length;
      const percentage = Math.round((completed / questions.length) * 100);
      console.log(`   ✅ Completed ${completed}/${questions.length} (${percentage}%)`);
      
      // Small delay between batches to be respectful to the API
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Generate comprehensive report
    generateReport();
    
  } catch (error) {
    console.error('❌ Error running baseline test:', error);
  }
}

function generateReport() {
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);
  
  console.log('\n📊 BASELINE TEST RESULTS SUMMARY');
  console.log('=================================');
  console.log(`Total questions tested: ${results.length}`);
  console.log(`Test duration: ${duration} seconds`);
  console.log('');
  
  // Response type analysis
  const responseTypes = {};
  const confidenceLevels = { low: 0, medium: 0, high: 0 };
  const hasAnswers = { yes: 0, no: 0 };
  const hasPills = { yes: 0, no: 0 };
  
  results.forEach(result => {
    // Response types
    responseTypes[result.responseType] = (responseTypes[result.responseType] || 0) + 1;
    
    // Confidence levels
    if (result.confidence < 50) confidenceLevels.low++;
    else if (result.confidence < 80) confidenceLevels.medium++;
    else confidenceLevels.high++;
    
    // Has answers
    if (result.hasAnswer) hasAnswers.yes++;
    else hasAnswers.no++;
    
    // Has pills
    if (result.hasPills) hasPills.yes++;
    else hasPills.no++;
  });
  
  console.log('📈 RESPONSE TYPE DISTRIBUTION:');
  Object.entries(responseTypes).forEach(([type, count]) => {
    const percentage = Math.round((count / results.length) * 100);
    console.log(`  ${type}: ${count} (${percentage}%)`);
  });
  console.log('');
  
  console.log('🎯 CONFIDENCE LEVEL DISTRIBUTION:');
  console.log(`  Low (<50%): ${confidenceLevels.low} (${Math.round(confidenceLevels.low/results.length*100)}%)`);
  console.log(`  Medium (50-79%): ${confidenceLevels.medium} (${Math.round(confidenceLevels.medium/results.length*100)}%)`);
  console.log(`  High (80%+): ${confidenceLevels.high} (${Math.round(confidenceLevels.high/results.length*100)}%)`);
  console.log('');
  
  console.log('✅ ANSWER AVAILABILITY:');
  console.log(`  Has Answer: ${hasAnswers.yes} (${Math.round(hasAnswers.yes/results.length*100)}%)`);
  console.log(`  No Answer: ${hasAnswers.no} (${Math.round(hasAnswers.no/results.length*100)}%)`);
  console.log('');
  
  console.log('🔗 PILL AVAILABILITY:');
  console.log(`  Has Pills: ${hasPills.yes} (${Math.round(hasPills.yes/results.length*100)}%)`);
  console.log(`  No Pills: ${hasPills.no} (${Math.round(hasPills.no/results.length*100)}%)`);
  console.log('');
  
  // Identify problematic responses
  const problematic = results.filter(r => 
    !r.hasAnswer || 
    r.confidence < 50 || 
    r.responseType === 'error' || 
    r.responseType === 'network_error'
  );
  
  console.log('❌ PROBLEMATIC RESPONSES:');
  console.log('========================');
  console.log(`Total problematic: ${problematic.length} (${Math.round(problematic.length/results.length*100)}%)`);
  console.log('');
  
  if (problematic.length > 0) {
    console.log('Sample problematic questions:');
    problematic.slice(0, 10).forEach((result, i) => {
      console.log(`${i+1}. "${result.question}"`);
      console.log(`   Type: ${result.responseType}, Confidence: ${result.confidence}%, Answer: ${result.hasAnswer ? 'Yes' : 'No'}`);
    });
    if (problematic.length > 10) {
      console.log(`   ... and ${problematic.length - 10} more`);
    }
  }
  
  // Save detailed results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `results/baseline-test-results-${timestamp}.json`;
  
  const reportData = {
    summary: {
      totalQuestions: results.length,
      testDuration: duration,
      responseTypes,
      confidenceLevels,
      hasAnswers,
      hasPills,
      problematicCount: problematic.length
    },
    results: results,
    problematic: problematic
  };
  
  // Ensure results directory exists
  if (!fs.existsSync('results')) {
    fs.mkdirSync('results');
  }
  
  fs.writeFileSync(filename, JSON.stringify(reportData, null, 2));
  console.log(`\n💾 Detailed results saved to: ${filename}`);
  
  console.log('\n🎯 BASELINE ESTABLISHED');
  console.log('======================');
  console.log('This baseline shows the current system performance.');
  console.log('Use this to measure improvements after implementing changes.');
}

// Start the test
runBaselineTest();



