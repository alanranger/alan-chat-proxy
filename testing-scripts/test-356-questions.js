// Comprehensive test of 356 questions from photography_questions_cleaned_ALL.csv
import fs from 'fs';
import path from 'path';

const csvFile = 'CSVSs from website/photography_questions_cleaned_ALL.csv';
const resultsFile = `results/356-question-test-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

// Read the CSV file
const csvContent = fs.readFileSync(csvFile, 'utf8');
const lines = csvContent.trim().split('\n');
const questions = lines.map(line => line.trim()).filter(line => line.length > 0);

console.log(`📋 Loaded ${questions.length} questions from CSV`);

// Test configuration
const API_URL = 'http://localhost:3000/api/chat';
const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds
const DELAY_BETWEEN_REQUESTS = 500; // 0.5 seconds

// Results tracking
const results = {
  totalQuestions: questions.length,
  startTime: new Date().toISOString(),
  summary: {
    success: 0,
    failed: 0,
    clarification: 0,
    events: 0,
    advice: 0,
    directAnswer: 0,
    averageConfidence: 0,
    averageAnswerLength: 0
  },
  detailedResults: [],
  issues: [],
  lowQualityResponses: []
};

// Quality assessment function
function assessQuality(question, response) {
  const issues = [];
  let score = 100;
  
  // Check for generic responses
  if (response.type === 'clarification' && response.confidence < 0.3) {
    issues.push('Low confidence clarification');
    score -= 30;
  }
  
  // Check for very short answers
  if (response.type === 'advice' && (!response.answer || response.answer.length < 100)) {
    issues.push('Very short advice answer');
    score -= 20;
  }
  
  // Check for missing events when expected
  if (question.toLowerCase().includes('workshop') && response.type !== 'events') {
    issues.push('Workshop query not returning events');
    score -= 25;
  }
  
  // Check for missing events when expected
  if (question.toLowerCase().includes('course') && response.type !== 'events') {
    issues.push('Course query not returning events');
    score -= 25;
  }
  
  // Check for low confidence
  if (response.confidence < 0.5) {
    issues.push('Low confidence response');
    score -= 15;
  }
  
  return { score, issues };
}

// Make API request with error handling
async function testQuestion(question, index) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: question })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Assess quality
    const quality = assessQuality(question, data);
    
    const result = {
      index: index + 1,
      question,
      type: data.type,
      confidence: data.confidence,
      answerLength: data.answer ? data.answer.length : 0,
      eventsCount: data.events ? data.events.length : 0,
      qualityScore: quality.score,
      qualityIssues: quality.issues,
      success: data.ok === true,
      timestamp: new Date().toISOString()
    };
    
    // Track issues
    if (quality.score < 70) {
      results.lowQualityResponses.push({
        question,
        score: quality.score,
        issues: quality.issues,
        type: data.type,
        confidence: data.confidence
      });
    }
    
    if (!data.ok) {
      results.issues.push({
        question,
        error: 'API returned ok: false',
        response: data
      });
    }
    
    return result;
    
  } catch (error) {
    console.error(`❌ Error testing question ${index + 1}: ${error.message}`);
    results.issues.push({
      question,
      error: error.message
    });
    
    return {
      index: index + 1,
      question,
      type: 'error',
      confidence: 0,
      answerLength: 0,
      eventsCount: 0,
      qualityScore: 0,
      qualityIssues: ['API Error'],
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Process questions in batches
async function runTest() {
  console.log(`🚀 Starting comprehensive test of ${questions.length} questions...`);
  console.log(`📊 Results will be saved to: ${resultsFile}`);
  
  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(questions.length / BATCH_SIZE);
    
    console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (questions ${i + 1}-${Math.min(i + BATCH_SIZE, questions.length)})`);
    
    // Process batch
    const batchPromises = batch.map((question, batchIndex) => 
      testQuestion(question, i + batchIndex)
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.detailedResults.push(...batchResults);
    
    // Update summary
    batchResults.forEach(result => {
      if (result.success) results.summary.success++;
      else results.summary.failed++;
      
      if (result.type === 'clarification') results.summary.clarification++;
      else if (result.type === 'events') results.summary.events++;
      else if (result.type === 'advice') results.summary.advice++;
      else if (result.type === 'direct_answer') results.summary.directAnswer++;
    });
    
    // Show progress
    const completed = Math.min(i + BATCH_SIZE, questions.length);
    const progress = ((completed / questions.length) * 100).toFixed(1);
    console.log(`✅ Completed ${completed}/${questions.length} questions (${progress}%)`);
    
    // Delay between batches
    if (i + BATCH_SIZE < questions.length) {
      console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES/1000}s before next batch...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
  
  // Calculate final statistics
  const successfulResults = results.detailedResults.filter(r => r.success);
  results.summary.averageConfidence = successfulResults.length > 0 
    ? (successfulResults.reduce((sum, r) => sum + (r.confidence || 0), 0) / successfulResults.length).toFixed(3)
    : 0;
  results.summary.averageAnswerLength = successfulResults.length > 0
    ? Math.round(successfulResults.reduce((sum, r) => sum + r.answerLength, 0) / successfulResults.length)
    : 0;
  
  results.endTime = new Date().toISOString();
  
  // Save results
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  
  // Print summary
  console.log('\n🎯 TEST COMPLETE - SUMMARY:');
  console.log(`📊 Total Questions: ${results.summary.success + results.summary.failed}`);
  console.log(`✅ Successful: ${results.summary.success}`);
  console.log(`❌ Failed: ${results.summary.failed}`);
  console.log(`📝 Clarification: ${results.summary.clarification}`);
  console.log(`🎪 Events: ${results.summary.events}`);
  console.log(`💡 Advice: ${results.summary.advice}`);
  console.log(`🎯 Direct Answer: ${results.summary.directAnswer}`);
  console.log(`📈 Average Confidence: ${results.summary.averageConfidence}`);
  console.log(`📏 Average Answer Length: ${results.summary.averageAnswerLength} chars`);
  console.log(`⚠️  Low Quality Responses: ${results.lowQualityResponses.length}`);
  console.log(`🐛 Issues Found: ${results.issues.length}`);
  console.log(`💾 Results saved to: ${resultsFile}`);
  
  // Show top issues
  if (results.lowQualityResponses.length > 0) {
    console.log('\n🔍 TOP LOW QUALITY RESPONSES:');
    results.lowQualityResponses
      .sort((a, b) => a.score - b.score)
      .slice(0, 10)
      .forEach((item, i) => {
        console.log(`${i + 1}. [${item.score}/100] "${item.question}"`);
        console.log(`   Type: ${item.type}, Confidence: ${item.confidence}, Issues: ${item.issues.join(', ')}`);
      });
  }
}

// Run the test
runTest().catch(console.error);
