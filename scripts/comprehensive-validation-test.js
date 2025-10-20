// Comprehensive validation test against baseline
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load questions from both CSV files
const loadQuestions = () => {
  const questions = [];
  
  // Load main questions CSV
  const mainCsvPath = path.join(__dirname, '..', 'CSVSs from website', 'photography_questions_cleaned_ALL.csv');
  if (fs.existsSync(mainCsvPath)) {
    const csvContent = fs.readFileSync(mainCsvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    lines.forEach((line, index) => {
      const question = line.trim();
      if (question) {
        questions.push({
          index: questions.length + 1,
          question,
          source: 'photography_questions_cleaned_ALL'
        });
      }
    });
  }
  
  // Load additional test questions
  const testCsvPath = path.join(__dirname, '..', 'new test question batch.csv');
  if (fs.existsSync(testCsvPath)) {
    const csvContent = fs.readFileSync(testCsvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    // Skip header if present
    const startIndex = lines[0]?.includes('question') ? 1 : 0;
    
    lines.slice(startIndex).forEach((line, index) => {
      const question = line.trim();
      if (question) {
        questions.push({
          index: questions.length + 1,
          question,
          source: 'new_test_batch'
        });
      }
    });
  }
  
  return questions;
};

// Test a single question
const testQuestion = async (questionData) => {
  try {
    const response = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: questionData.question,
        topK: 5
      })
    });
    
    if (!response.ok) {
      return {
        ...questionData,
        responseType: 'error',
        confidence: 0,
        hasAnswer: false,
        answerLength: 0,
        optionsCount: 0,
        hasPills: false,
        pillsCount: 0,
        error: `HTTP ${response.status}: ${response.statusText}`,
        timestamp: new Date().toISOString()
      };
    }
    
    const data = await response.json();
    
    return {
      ...questionData,
      responseType: data.type || 'unknown',
      confidence: data.confidence || 0,
      hasAnswer: !!(data.answer_markdown || data.answer),
      answerLength: (data.answer_markdown || data.answer || '').length,
      optionsCount: data.structured?.options?.length || 0,
      hasPills: !!(data.pills && data.pills.length > 0),
      pillsCount: data.pills?.length || 0,
      debug: data.debug || {},
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      ...questionData,
      responseType: 'error',
      confidence: 0,
      hasAnswer: false,
      answerLength: 0,
      optionsCount: 0,
      hasPills: false,
      pillsCount: 0,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// Main test function
const runComprehensiveTest = async () => {
  console.log('🧪 COMPREHENSIVE VALIDATION TEST');
  console.log('================================');
  console.log('Testing against baseline from refactoring...\n');
  
  const questions = loadQuestions();
  console.log(`📊 Loaded ${questions.length} questions for testing\n`);
  
  const results = [];
  const startTime = Date.now();
  
  // Test each question
  for (let i = 0; i < questions.length; i++) {
    const questionData = questions[i];
    console.log(`📊 Testing ${i + 1}/${questions.length}: "${questionData.question.substring(0, 50)}${questionData.question.length > 50 ? '...' : ''}"`);
    
    const result = await testQuestion(questionData);
    results.push(result);
    
    // Small delay to avoid overwhelming the API
    if (i % 10 === 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  const endTime = Date.now();
  const testDuration = Math.round((endTime - startTime) / 1000);
  
  // Calculate summary statistics
  const summary = {
    totalQuestions: results.length,
    testDuration,
    responseTypes: {},
    confidenceLevels: {
      low: 0,    // < 50%
      medium: 0, // 50-79%
      high: 0    // 80%+
    },
    hasAnswers: {
      yes: 0,
      no: 0
    },
    hasPills: {
      yes: 0,
      no: 0
    },
    problematicCount: 0
  };
  
  // Analyze results
  results.forEach(result => {
    // Response types
    summary.responseTypes[result.responseType] = (summary.responseTypes[result.responseType] || 0) + 1;
    
    // Confidence levels
    if (result.confidence >= 80) {
      summary.confidenceLevels.high++;
    } else if (result.confidence >= 50) {
      summary.confidenceLevels.medium++;
    } else {
      summary.confidenceLevels.low++;
    }
    
    // Answer availability
    if (result.hasAnswer) {
      summary.hasAnswers.yes++;
    } else {
      summary.hasAnswers.no++;
    }
    
    // Pills availability
    if (result.hasPills) {
      summary.hasPills.yes++;
    } else {
      summary.hasPills.no++;
    }
    
    // Problematic responses (low confidence + no answer + no pills)
    if (result.confidence < 50 && !result.hasAnswer && !result.hasPills) {
      summary.problematicCount++;
    }
  });
  
  // Create final result object
  const testResults = {
    summary,
    results,
    baseline: {
      totalQuestions: 364,
      problematicCount: 338,
      directAnswers: 59,
      highConfidence: 24,
      withPills: 28
    },
    improvements: {
      problematicReduction: summary.problematicCount - 338,
      problematicReductionPercent: Math.round(((338 - summary.problematicCount) / 338) * 100),
      directAnswerImprovement: summary.hasAnswers.yes - 59,
      highConfidenceImprovement: summary.confidenceLevels.high - 24,
      pillsImprovement: summary.hasPills.yes - 28
    },
    timestamp: new Date().toISOString()
  };
  
  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `comprehensive-validation-${timestamp}.json`;
  const filepath = path.join(__dirname, '..', 'results', filename);
  
  fs.writeFileSync(filepath, JSON.stringify(testResults, null, 2));
  
  // Display summary
  console.log('\n📊 COMPREHENSIVE TEST RESULTS');
  console.log('==============================');
  console.log(`Total Questions: ${summary.totalQuestions}`);
  console.log(`Test Duration: ${testDuration}s`);
  console.log(`\nResponse Types:`);
  Object.entries(summary.responseTypes).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} (${Math.round((count / summary.totalQuestions) * 100)}%)`);
  });
  
  console.log(`\nConfidence Levels:`);
  console.log(`  High (80%+): ${summary.confidenceLevels.high} (${Math.round((summary.confidenceLevels.high / summary.totalQuestions) * 100)}%)`);
  console.log(`  Medium (50-79%): ${summary.confidenceLevels.medium} (${Math.round((summary.confidenceLevels.medium / summary.totalQuestions) * 100)}%)`);
  console.log(`  Low (<50%): ${summary.confidenceLevels.low} (${Math.round((summary.confidenceLevels.low / summary.totalQuestions) * 100)}%)`);
  
  console.log(`\nAnswer Availability:`);
  console.log(`  With Answers: ${summary.hasAnswers.yes} (${Math.round((summary.hasAnswers.yes / summary.totalQuestions) * 100)}%)`);
  console.log(`  Without Answers: ${summary.hasAnswers.no} (${Math.round((summary.hasAnswers.no / summary.totalQuestions) * 100)}%)`);
  
  console.log(`\nPills Availability:`);
  console.log(`  With Pills: ${summary.hasPills.yes} (${Math.round((summary.hasPills.yes / summary.totalQuestions) * 100)}%)`);
  console.log(`  Without Pills: ${summary.hasPills.no} (${Math.round((summary.hasPills.no / summary.totalQuestions) * 100)}%)`);
  
  console.log(`\nProblematic Responses: ${summary.problematicCount} (${Math.round((summary.problematicCount / summary.totalQuestions) * 100)}%)`);
  
  console.log('\n🎯 IMPROVEMENT COMPARISON');
  console.log('=========================');
  console.log(`Baseline Problematic: 338 (93%)`);
  console.log(`Current Problematic: ${summary.problematicCount} (${Math.round((summary.problematicCount / summary.totalQuestions) * 100)}%)`);
  console.log(`Improvement: ${testResults.improvements.problematicReduction} fewer problematic responses`);
  console.log(`Improvement: ${testResults.improvements.problematicReductionPercent}% reduction`);
  
  console.log(`\nBaseline Direct Answers: 59 (16%)`);
  console.log(`Current Direct Answers: ${summary.hasAnswers.yes} (${Math.round((summary.hasAnswers.yes / summary.totalQuestions) * 100)}%)`);
  console.log(`Improvement: +${testResults.improvements.directAnswerImprovement} more direct answers`);
  
  console.log(`\nBaseline High Confidence: 24 (7%)`);
  console.log(`Current High Confidence: ${summary.confidenceLevels.high} (${Math.round((summary.confidenceLevels.high / summary.totalQuestions) * 100)}%)`);
  console.log(`Improvement: +${testResults.improvements.highConfidenceImprovement} more high confidence responses`);
  
  console.log(`\nBaseline With Pills: 28 (8%)`);
  console.log(`Current With Pills: ${summary.hasPills.yes} (${Math.round((summary.hasPills.yes / summary.totalQuestions) * 100)}%)`);
  console.log(`Improvement: +${testResults.improvements.pillsImprovement} more responses with pills`);
  
  console.log(`\n✅ Results saved to: ${filename}`);
  
  return testResults;
};

// Run the test
runComprehensiveTest().catch(console.error);



