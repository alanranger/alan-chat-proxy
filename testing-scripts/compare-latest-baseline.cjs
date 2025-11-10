#!/usr/bin/env node
/**
 * Compare latest test results with Nov 1 baseline
 */

const fs = require('fs');
const path = require('path');

const resultsDir = 'testing-scripts/test results';

// Baseline from Nov 1 (official baseline)
const baselinePath = path.join(resultsDir, 'baseline-40-question-interactive-subset-2025-11-01T13-32-45-780Z.json');
// Latest test results
const currentPath = path.join(resultsDir, 'deployed-analytics-test-2025-11-10T22-57-04-965Z.json');

console.log('📊 COMPARING BASELINE (Nov 1) vs CURRENT (Nov 10 - After All Improvements)\n');
console.log(`📋 Baseline: ${path.basename(baselinePath)}`);
console.log(`📋 Current:  ${path.basename(currentPath)}\n`);

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));

const baselineMap = new Map();
baseline.results.forEach(r => {
  baselineMap.set(r.query.toLowerCase().trim(), r);
});

const comparison = {
  summary: {
    baselineDate: baseline.timestamp,
    currentDate: current.timestamp,
    baselineSuccess: baseline.successfulTests,
    currentSuccess: current.successfulTests,
    baselineConfidence: parseFloat(baseline.averageConfidence),
    currentConfidence: parseFloat(current.avgConfidence),
    totalQuestions: baseline.totalQuestions || 40
  },
  improvements: [],
  regressions: [],
  unchanged: [],
  changes: []
};

current.results.forEach((currentResult) => {
  const query = currentResult.query.trim();
  const lcQuery = query.toLowerCase();
  const baselineResult = baselineMap.get(lcQuery);
  
  if (!baselineResult) {
    console.warn(`⚠️  No baseline found for: "${query}"`);
    return;
  }

  const baselineAnswer = String(baselineResult.response?.answer || '').trim();
  const currentAnswer = String(currentResult.response?.answer || '').trim();
  const baselineConfidence = baselineResult.response?.confidence || 0;
  const currentConfidence = currentResult.response?.confidence || 0;
  const baselineType = baselineResult.response?.type || 'unknown';
  const currentType = currentResult.response?.type || 'unknown';
  
  const answerLengthDiff = currentAnswer.length - baselineAnswer.length;
  const confidenceDiff = currentConfidence - baselineConfidence;
  
  const change = {
    query,
    category: currentResult.category,
    baselineAnswerLength: baselineAnswer.length,
    currentAnswerLength: currentAnswer.length,
    answerLengthDiff,
    baselineConfidence: (baselineConfidence * 100).toFixed(1) + '%',
    currentConfidence: (currentConfidence * 100).toFixed(1) + '%',
    confidenceDiff: (confidenceDiff * 100).toFixed(1) + '%',
    baselineType,
    currentType,
    typeChanged: baselineType !== currentType,
    answerChanged: baselineAnswer !== currentAnswer
  };

  // Categorize changes
  if (Math.abs(answerLengthDiff) < 10 && Math.abs(confidenceDiff) < 0.01 && !change.typeChanged) {
    comparison.unchanged.push(change);
  } else if (answerLengthDiff > 50 || confidenceDiff > 0.05 || (baselineAnswer.length < 50 && currentAnswer.length > 100)) {
    comparison.improvements.push(change);
  } else if (answerLengthDiff < -50 || confidenceDiff < -0.05 || (baselineAnswer.length > 100 && currentAnswer.length < 50)) {
    comparison.regressions.push(change);
  } else {
    comparison.changes.push(change);
  }
});

// Print summary
console.log('='.repeat(80));
console.log('📊 SUMMARY');
console.log('='.repeat(80));
console.log(`Success Rate: ${comparison.summary.baselineSuccess}/${comparison.summary.totalQuestions} → ${comparison.summary.currentSuccess}/${comparison.summary.totalQuestions} (${comparison.summary.baselineSuccess === comparison.summary.currentSuccess ? '✅ Same' : '⚠️ Changed'})`);
console.log(`Avg Confidence: ${comparison.summary.baselineConfidence}% → ${comparison.summary.currentConfidence}% (${comparison.summary.currentConfidence > comparison.summary.baselineConfidence ? '📈 +' + (comparison.summary.currentConfidence - comparison.summary.baselineConfidence).toFixed(1) + '%' : comparison.summary.currentConfidence < comparison.summary.baselineConfidence ? '📉 ' + (comparison.summary.currentConfidence - comparison.summary.baselineConfidence).toFixed(1) + '%' : '✅ Same'})`);
console.log(`\n📈 Improvements: ${comparison.improvements.length}`);
console.log(`📉 Regressions: ${comparison.regressions.length}`);
console.log(`🔄 Changes: ${comparison.changes.length}`);
console.log(`✅ Unchanged: ${comparison.unchanged.length}`);

if (comparison.improvements.length > 0) {
  console.log('\n' + '='.repeat(80));
  console.log('📈 IMPROVEMENTS');
  console.log('='.repeat(80));
  comparison.improvements.slice(0, 10).forEach(imp => {
    console.log(`\n✅ "${imp.query}"`);
    console.log(`   Answer Length: ${imp.baselineAnswerLength} → ${imp.currentAnswerLength} (${imp.answerLengthDiff > 0 ? '+' : ''}${imp.answerLengthDiff})`);
    console.log(`   Confidence: ${imp.baselineConfidence} → ${imp.currentConfidence} (${imp.confidenceDiff > 0 ? '+' : ''}${imp.confidenceDiff})`);
    if (imp.typeChanged) {
      console.log(`   Type: ${imp.baselineType} → ${imp.currentType}`);
    }
  });
  if (comparison.improvements.length > 10) {
    console.log(`\n... and ${comparison.improvements.length - 10} more improvements`);
  }
}

if (comparison.regressions.length > 0) {
  console.log('\n' + '='.repeat(80));
  console.log('📉 REGRESSIONS');
  console.log('='.repeat(80));
  comparison.regressions.forEach(reg => {
    console.log(`\n❌ "${reg.query}"`);
    console.log(`   Answer Length: ${reg.baselineAnswerLength} → ${reg.currentAnswerLength} (${reg.answerLengthDiff})`);
    console.log(`   Confidence: ${reg.baselineConfidence} → ${reg.currentConfidence} (${reg.confidenceDiff})`);
    if (reg.typeChanged) {
      console.log(`   Type: ${reg.baselineType} → ${reg.currentType}`);
    }
  });
}

if (comparison.changes.length > 0 && comparison.changes.length <= 10) {
  console.log('\n' + '='.repeat(80));
  console.log('🔄 MINOR CHANGES');
  console.log('='.repeat(80));
  comparison.changes.forEach(chg => {
    console.log(`\n🔄 "${chg.query}"`);
    console.log(`   Answer Length: ${chg.baselineAnswerLength} → ${chg.currentAnswerLength} (${chg.answerLengthDiff > 0 ? '+' : ''}${chg.answerLengthDiff})`);
    console.log(`   Confidence: ${chg.baselineConfidence} → ${chg.currentConfidence} (${chg.confidenceDiff > 0 ? '+' : ''}${chg.confidenceDiff})`);
    if (chg.typeChanged) {
      console.log(`   Type: ${chg.baselineType} → ${chg.currentType}`);
    }
  });
}

// Save comparison to file
const outputPath = path.join(resultsDir, `baseline-comparison-nov1-vs-latest-${Date.now()}.json`);
fs.writeFileSync(outputPath, JSON.stringify(comparison, null, 2));
console.log(`\n💾 Comparison saved to: ${path.basename(outputPath)}`);

// Overall assessment
console.log('\n' + '='.repeat(80));
console.log('🎯 OVERALL ASSESSMENT');
console.log('='.repeat(80));
if (comparison.regressions.length === 0 && comparison.improvements.length >= 0) {
  console.log('✅ NO REGRESSIONS DETECTED - All improvements are positive or neutral');
} else if (comparison.regressions.length > 0) {
  console.log(`⚠️  ${comparison.regressions.length} REGRESSION(S) DETECTED - Review required`);
} else {
  console.log('✅ System is stable with improvements');
}

