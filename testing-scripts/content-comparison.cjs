const fs = require('fs');
const path = require('path');

// Read baseline and current results
const resultsDir = path.join(__dirname, 'test results');
const baselineFile = path.join(resultsDir, 'quality-benchmark-before-2025-10-28T16-39-06-874Z.json');
const currentFile = path.join(resultsDir, 'quality-benchmark-before-2025-10-28T17-07-43-041Z.json');

const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
const current = JSON.parse(fs.readFileSync(currentFile, 'utf8'));

console.log('🔍 CONTENT-FOCUSED COMPARISON: BASELINE vs AFTER REFACTOR');
console.log('========================================================');
console.log('');

let significantDifferences = 0;
let totalQuestions = 0;

baseline.results.forEach((baselineResult, index) => {
  const currentResult = current.results[index];
  totalQuestions++;
  
  if (!currentResult) {
    console.log(`❌ MISSING: Question ${index + 1} - "${baselineResult.query}"`);
    significantDifferences++;
    return;
  }
  
  const significantDiffs = [];
  
  // Check for significant differences in core functionality
  if (baselineResult.status !== currentResult.status) {
    significantDiffs.push(`Status: ${baselineResult.status} vs ${currentResult.status}`);
  }
  
  if (baselineResult.quality?.overall !== currentResult.quality?.overall) {
    significantDiffs.push(`Quality Score: ${baselineResult.quality?.overall} vs ${currentResult.quality?.overall}`);
  }
  
  if (baselineResult.response?.confidence !== currentResult.response?.confidence) {
    significantDiffs.push(`Confidence: ${baselineResult.response?.confidence} vs ${currentResult.response?.confidence}`);
  }
  
  if (baselineResult.response?.answerLength !== currentResult.response?.answerLength) {
    significantDiffs.push(`Answer Length: ${baselineResult.response?.answerLength} vs ${currentResult.response?.answerLength}`);
  }
  
  // Compare actual answer content (the most important part)
  if (baselineResult.response?.answer !== currentResult.response?.answer) {
    significantDiffs.push(`Answer Content: DIFFERENT`);
    console.log(`\n📝 ANSWER COMPARISON for "${baselineResult.query}":`);
    console.log(`Baseline: "${baselineResult.response?.answer}"`);
    console.log(`Current:  "${currentResult.response?.answer}"`);
    console.log(`Length: ${baselineResult.response?.answer?.length} vs ${currentResult.response?.answer?.length}`);
  }
  
  if (baselineResult.response?.answer_markdown !== currentResult.response?.answer_markdown) {
    significantDiffs.push(`Answer Markdown: DIFFERENT`);
    console.log(`\n📝 MARKDOWN COMPARISON for "${baselineResult.query}":`);
    console.log(`Baseline: "${baselineResult.response?.answer_markdown}"`);
    console.log(`Current:  "${currentResult.response?.answer_markdown}"`);
  }
  
  // Compare article counts (important for functionality)
  if (baselineResult.response?.articles !== currentResult.response?.articles) {
    significantDiffs.push(`Articles Count: ${baselineResult.response?.articles} vs ${currentResult.response?.articles}`);
  }
  
  // Compare event counts (important for functionality)
  const baselineEventCount = Array.isArray(baselineResult.response?.events) ? baselineResult.response.events.length : baselineResult.response?.events || 0;
  const currentEventCount = Array.isArray(currentResult.response?.events) ? currentResult.response.events.length : currentResult.response?.events || 0;
  
  if (baselineEventCount !== currentEventCount) {
    significantDiffs.push(`Event Count: ${baselineEventCount} vs ${currentEventCount}`);
  }
  
  if (significantDiffs.length > 0) {
    console.log(`\n❌ SIGNIFICANT DIFFERENCES in Question ${index + 1}: "${baselineResult.query}"`);
    significantDiffs.forEach(diff => console.log(`   ${diff}`));
    significantDifferences++;
  }
});

console.log('\n📊 CONTENT COMPARISON SUMMARY');
console.log('==============================');
console.log(`Total Questions: ${totalQuestions}`);
console.log(`Questions with Significant Differences: ${significantDifferences}`);
console.log(`Questions with Identical Core Content: ${totalQuestions - significantDifferences}`);
console.log(`Percentage Identical: ${((totalQuestions - significantDifferences) / totalQuestions * 100).toFixed(1)}%`);

if (significantDifferences === 0) {
  console.log('\n✅ PERFECT MATCH! No significant differences found.');
  console.log('   The refactoring maintained 100% functional equivalence.');
} else {
  console.log(`\n⚠️  ${significantDifferences} questions had significant differences.`);
  console.log('   Review the detailed comparisons above.');
}

