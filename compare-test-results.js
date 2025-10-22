const fs = require('fs');

// Read baseline and current results
const baselineFile = 'results/quality-benchmark-before-2025-10-22T17-04-41-287Z.json';
const currentFile = 'results/quality-benchmark-before-2025-10-22T17-26-44-940Z.json';

const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
const current = JSON.parse(fs.readFileSync(currentFile, 'utf8'));

console.log('🔍 COMPARING TEST RESULTS');
console.log('========================');
console.log(`Baseline: ${baseline.passedTests}/${baseline.totalTests} passed (${baseline.averageScore}/100)`);
console.log(`Current:  ${current.passedTests}/${current.totalTests} passed (${current.averageScore}/100)`);
console.log('');

// Find regressions (passed in baseline, failed in current)
const regressions = [];
const improvements = [];

baseline.results.forEach((baselineResult, index) => {
  const currentResult = current.results[index];
  
  if (!currentResult) return;
  
  const baselinePassed = baselineResult.quality.overall >= 60; // Assuming 60+ is passing
  const currentPassed = currentResult.quality.overall >= 60;
  
  if (baselinePassed && !currentPassed) {
    regressions.push({
      query: baselineResult.query,
      baselineScore: baselineResult.quality.overall,
      currentScore: currentResult.quality.overall,
      difference: baselineResult.quality.overall - currentResult.quality.overall
    });
  } else if (!baselinePassed && currentPassed) {
    improvements.push({
      query: baselineResult.query,
      baselineScore: baselineResult.quality.overall,
      currentScore: currentResult.quality.overall,
      difference: currentResult.quality.overall - baselineResult.quality.overall
    });
  }
});

console.log('📉 REGRESSIONS (Passed in baseline, failed in current):');
console.log('=====================================================');
if (regressions.length === 0) {
  console.log('✅ No regressions found!');
} else {
  regressions.forEach(r => {
    console.log(`❌ "${r.query}"`);
    console.log(`   Baseline: ${r.baselineScore}/100 → Current: ${r.currentScore}/100 (${r.difference} point drop)`);
  });
}

console.log('');
console.log('📈 IMPROVEMENTS (Failed in baseline, passed in current):');
console.log('======================================================');
if (improvements.length === 0) {
  console.log('No improvements found.');
} else {
  improvements.forEach(i => {
    console.log(`✅ "${i.query}"`);
    console.log(`   Baseline: ${i.baselineScore}/100 → Current: ${i.currentScore}/100 (+${i.difference} points)`);
  });
}

console.log('');
console.log('📊 SUMMARY:');
console.log(`Regressions: ${regressions.length}`);
console.log(`Improvements: ${improvements.length}`);
console.log(`Net change: ${improvements.length - regressions.length} tests`);








