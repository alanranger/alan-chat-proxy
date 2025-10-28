const fs = require('fs');
const path = require('path');

// Read baseline and current results
const resultsDir = path.join(__dirname, 'test results');
const baselineFile = path.join(resultsDir, 'quality-benchmark-before-2025-10-28T16-39-06-874Z.json');
const currentFile = path.join(resultsDir, 'quality-benchmark-before-2025-10-28T17-07-43-041Z.json');

const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
const current = JSON.parse(fs.readFileSync(currentFile, 'utf8'));

console.log('🔍 DETAILED COMPARISON: BASELINE vs AFTER REFACTOR');
console.log('==================================================');
console.log('');

let differencesFound = 0;
let totalQuestions = 0;

baseline.results.forEach((baselineResult, index) => {
  const currentResult = current.results[index];
  totalQuestions++;
  
  if (!currentResult) {
    console.log(`❌ MISSING: Question ${index + 1} - "${baselineResult.query}"`);
    console.log('   Current result is missing!');
    differencesFound++;
    return;
  }
  
  const differences = [];
  
  // Compare all fields
  if (baselineResult.query !== currentResult.query) {
    differences.push(`Query: "${baselineResult.query}" vs "${currentResult.query}"`);
  }
  
  if (baselineResult.status !== currentResult.status) {
    differences.push(`Status: ${baselineResult.status} vs ${currentResult.status}`);
  }
  
  if (baselineResult.quality?.overall !== currentResult.quality?.overall) {
    differences.push(`Quality Score: ${baselineResult.quality?.overall} vs ${currentResult.quality?.overall}`);
  }
  
  if (baselineResult.quality?.botResponse !== currentResult.quality?.botResponse) {
    differences.push(`Bot Response Score: ${baselineResult.quality?.botResponse} vs ${currentResult.quality?.botResponse}`);
  }
  
  if (baselineResult.quality?.related !== currentResult.quality?.related) {
    differences.push(`Related Score: ${baselineResult.quality?.related} vs ${currentResult.quality?.related}`);
  }
  
  if (baselineResult.quality?.focus !== currentResult.quality?.focus) {
    differences.push(`Focus: "${baselineResult.quality?.focus}" vs "${currentResult.quality?.focus}"`);
  }
  
  if (baselineResult.quality?.issues !== currentResult.quality?.issues) {
    differences.push(`Issues: "${baselineResult.quality?.issues}" vs "${currentResult.quality?.issues}"`);
  }
  
  if (baselineResult.response?.confidence !== currentResult.response?.confidence) {
    differences.push(`Confidence: ${baselineResult.response?.confidence} vs ${currentResult.response?.confidence}`);
  }
  
  if (baselineResult.response?.answerLength !== currentResult.response?.answerLength) {
    differences.push(`Answer Length: ${baselineResult.response?.answerLength} vs ${currentResult.response?.answerLength}`);
  }
  
  if (baselineResult.response?.events !== currentResult.response?.events) {
    differences.push(`Events Count: ${baselineResult.response?.events} vs ${currentResult.response?.events}`);
  }
  
  if (baselineResult.response?.articles !== currentResult.response?.articles) {
    differences.push(`Articles Count: ${baselineResult.response?.articles} vs ${currentResult.response?.articles}`);
  }
  
  // Compare actual answer content
  if (baselineResult.response?.answer !== currentResult.response?.answer) {
    differences.push(`Answer Content: DIFFERENT`);
    differences.push(`  Baseline: "${baselineResult.response?.answer?.substring(0, 100)}..."`);
    differences.push(`  Current:  "${currentResult.response?.answer?.substring(0, 100)}..."`);
  }
  
  if (baselineResult.response?.answer_markdown !== currentResult.response?.answer_markdown) {
    differences.push(`Answer Markdown: DIFFERENT`);
    differences.push(`  Baseline: "${baselineResult.response?.answer_markdown?.substring(0, 100)}..."`);
    differences.push(`  Current:  "${currentResult.response?.answer_markdown?.substring(0, 100)}..."`);
  }
  
  // Compare sources
  if (JSON.stringify(baselineResult.response?.sources) !== JSON.stringify(currentResult.response?.sources)) {
    differences.push(`Sources: DIFFERENT`);
    differences.push(`  Baseline: ${JSON.stringify(baselineResult.response?.sources)}`);
    differences.push(`  Current:  ${JSON.stringify(currentResult.response?.sources)}`);
  }
  
  // Compare events
  if (JSON.stringify(baselineResult.response?.events_data) !== JSON.stringify(currentResult.response?.events_data)) {
    differences.push(`Events Data: DIFFERENT`);
  }
  
  if (differences.length > 0) {
    console.log(`❌ DIFFERENCES FOUND in Question ${index + 1}: "${baselineResult.query}"`);
    differences.forEach(diff => console.log(`   ${diff}`));
    console.log('');
    differencesFound++;
  }
});

console.log('📊 DETAILED COMPARISON SUMMARY');
console.log('==============================');
console.log(`Total Questions: ${totalQuestions}`);
console.log(`Questions with Differences: ${differencesFound}`);
console.log(`Questions Identical: ${totalQuestions - differencesFound}`);
console.log(`Percentage Identical: ${((totalQuestions - differencesFound) / totalQuestions * 100).toFixed(1)}%`);

if (differencesFound === 0) {
  console.log('');
  console.log('✅ PERFECT MATCH! No differences found between baseline and after refactor.');
  console.log('   The refactoring maintained 100% functional equivalence.');
} else {
  console.log('');
  console.log(`⚠️  ${differencesFound} questions had differences. Review the details above.`);
}

