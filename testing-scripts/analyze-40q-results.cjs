#!/usr/bin/env node
/**
 * Automatic analysis of 40Q test results
 * Detects regressions, generic fallbacks, wrong routing, and answer quality issues
 */

const fs = require('fs');
const path = require('path');

const resultsDir = 'testing-scripts/test results';

// Load baseline (Nov 1, 2025 - Latest baseline)
const baselinePath = path.join(resultsDir, 'baseline-40-question-interactive-subset-2025-11-01T13-32-45-780Z.json');
// Find latest current results
const currentFiles = fs.readdirSync(resultsDir)
  .filter(f => f.startsWith('baseline-40-question-interactive-subset-') && f.endsWith('.json'))
  .sort()
  .reverse();
const currentPath = path.join(resultsDir, currentFiles[0]);

console.log('📊 AUTOMATIC 40Q TEST ANALYSIS\n');
console.log(`📋 Baseline: ${path.basename(baselinePath)}`);
console.log(`📋 Current:  ${path.basename(currentPath)}\n`);

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));

const baselineMap = new Map();
baseline.results.forEach(r => {
  baselineMap.set(r.query.toLowerCase().trim(), r);
});

const issues = {
  regressions: [], // Answers got worse
  genericFallbacks: [], // Generic "I can't find" responses
  wrongRouting: [], // Wrong handler (e.g., events → services)
  missingAnswers: [], // Had answer before, now empty/very short
  emptyAnswers: [], // No answer content
  qualityIssues: [] // Other quality problems
};

current.results.forEach((currentResult, index) => {
  const query = currentResult.query.trim();
  const lcQuery = query.toLowerCase();
  const baselineResult = baselineMap.get(lcQuery);
  
  if (!baselineResult) {
    console.warn(`⚠️  No baseline found for: "${query}"`);
    return;
  }

  const currentAnswer = String(currentResult.response?.answer || currentResult.response?.answer_markdown || '').trim();
  const baselineAnswer = String(baselineResult.response?.answer || baselineResult.response?.answer_markdown || '').trim();
  const currentType = currentResult.response?.type || 'unknown';
  const baselineType = baselineResult.response?.type || 'unknown';
  
  // Check for generic fallback
  const isGenericFallback = currentAnswer.includes("I can't find a reliable answer") ||
                            currentAnswer.includes("contact Alan directly using the contact form") ||
                            (currentAnswer.length < 50 && currentAnswer.includes("contact"));
  
  // Check for wrong routing
  const isWrongRouting = (baselineType === 'events' && currentType === 'services' && currentAnswer.includes("I offer a range of photography services")) ||
                         (baselineType === 'events' && currentType !== 'events' && baselineResult.response?.structured?.events?.length > 0) ||
                         (baselineType === 'advice' && currentType === 'services' && currentAnswer.includes("I offer a range") && !currentAnswer.includes(query.split(' ')[0]));
  
  // Check for missing/empty answers
  const hadAnswerBefore = baselineAnswer.length > 50;
  const hasAnswerNow = currentAnswer.length > 50;
  const answerGotShorter = hadAnswerBefore && hasAnswerNow && currentAnswer.length < baselineAnswer.length * 0.5;
  
  // Check for regression (status went from Pass to Fail, or answer quality degraded significantly)
  const baselineStatus = baselineResult.response?.success && baselineAnswer.length > 0 ? 'Pass' : 'Fail';
  const currentStatus = currentResult.response?.success && currentAnswer.length > 0 ? 'Pass' : 'Fail';
  const statusRegressed = baselineStatus === 'Pass' && currentStatus === 'Fail';
  
  // Detect specific issues
  if (isGenericFallback) {
    issues.genericFallbacks.push({
      question: query,
      number: index + 1,
      answer: currentAnswer.substring(0, 150),
      baselineAnswer: baselineAnswer.substring(0, 150),
      issue: 'Generic fallback response'
    });
  }
  
  if (isWrongRouting) {
    issues.wrongRouting.push({
      question: query,
      number: index + 1,
      currentType,
      baselineType,
      answer: currentAnswer.substring(0, 150),
      baselineAnswer: baselineAnswer.substring(0, 150),
      baselineEventsCount: baselineResult.response?.structured?.events?.length || 0,
      currentEventsCount: currentResult.response?.structured?.events?.length || 0,
      issue: `Wrong routing: ${baselineType} → ${currentType}`
    });
  }
  
  if (statusRegressed) {
    issues.regressions.push({
      question: query,
      number: index + 1,
      baselineStatus,
      currentStatus,
      baselineAnswer: baselineAnswer.substring(0, 150),
      currentAnswer: currentAnswer.substring(0, 150),
      issue: 'Status regressed: Pass → Fail'
    });
  }
  
  if (hadAnswerBefore && !hasAnswerNow) {
    issues.missingAnswers.push({
      question: query,
      number: index + 1,
      baselineAnswerLength: baselineAnswer.length,
      currentAnswerLength: currentAnswer.length,
      issue: 'Answer disappeared'
    });
  }
  
  if (!currentAnswer || currentAnswer.length < 20) {
    issues.emptyAnswers.push({
      question: query,
      number: index + 1,
      answerLength: currentAnswer.length,
      issue: 'Empty or very short answer'
    });
  }
  
  if (answerGotShorter && !isGenericFallback) {
    issues.qualityIssues.push({
      question: query,
      number: index + 1,
      baselineLength: baselineAnswer.length,
      currentLength: currentAnswer.length,
      issue: 'Answer significantly shorter than before'
    });
  }
});

// Print analysis
console.log('═══════════════════════════════════════════════════════════');
console.log('🚨 CRITICAL ISSUES DETECTED\n');

if (issues.wrongRouting.length > 0) {
  console.log(`❌ WRONG ROUTING (${issues.wrongRouting.length}):`);
  issues.wrongRouting.forEach(issue => {
    console.log(`   Q${issue.number}: "${issue.question}"`);
    console.log(`      Expected: ${issue.baselineType} (${issue.baselineEventsCount} events)`);
    console.log(`      Got: ${issue.currentType} (${issue.currentEventsCount} events)`);
    console.log(`      Answer: ${issue.answer.substring(0, 100)}...`);
    console.log('');
  });
  console.log('');
}

if (issues.genericFallbacks.length > 0) {
  console.log(`⚠️  GENERIC FALLBACKS (${issues.genericFallbacks.length}):`);
  issues.genericFallbacks.forEach(issue => {
    console.log(`   Q${issue.number}: "${issue.question}"`);
    console.log(`      Issue: ${issue.issue}`);
    console.log('');
  });
  console.log('');
}

if (issues.regressions.length > 0) {
  console.log(`📉 REGRESSIONS (${issues.regressions.length}):`);
  issues.regressions.forEach(issue => {
    console.log(`   Q${issue.number}: "${issue.question}"`);
    console.log(`      ${issue.baselineStatus} → ${issue.currentStatus}`);
    console.log('');
  });
  console.log('');
}

if (issues.missingAnswers.length > 0) {
  console.log(`🔍 MISSING ANSWERS (${issues.missingAnswers.length}):`);
  issues.missingAnswers.forEach(issue => {
    console.log(`   Q${issue.number}: "${issue.question}"`);
    console.log(`      Had ${issue.baselineAnswerLength} chars, now ${issue.currentAnswerLength} chars`);
    console.log('');
  });
  console.log('');
}

if (issues.emptyAnswers.length > 0) {
  console.log(`📭 EMPTY ANSWERS (${issues.emptyAnswers.length}):`);
  issues.emptyAnswers.forEach(issue => {
    console.log(`   Q${issue.number}: "${issue.question}" (${issue.answerLength} chars)`);
    console.log('');
  });
  console.log('');
}

if (issues.qualityIssues.length > 0) {
  console.log(`📊 QUALITY ISSUES (${issues.qualityIssues.length}):`);
  issues.qualityIssues.forEach(issue => {
    console.log(`   Q${issue.number}: "${issue.question}"`);
    console.log(`      ${issue.baselineLength} → ${issue.currentLength} chars`);
    console.log('');
  });
  console.log('');
}

// Summary
const totalIssues = issues.wrongRouting.length + issues.genericFallbacks.length + 
                    issues.regressions.length + issues.missingAnswers.length + 
                    issues.emptyAnswers.length + issues.qualityIssues.length;

console.log('═══════════════════════════════════════════════════════════');
console.log('📈 SUMMARY\n');
console.log(`   Total Issues: ${totalIssues}`);
console.log(`   - Wrong Routing: ${issues.wrongRouting.length}`);
console.log(`   - Generic Fallbacks: ${issues.genericFallbacks.length}`);
console.log(`   - Regressions: ${issues.regressions.length}`);
console.log(`   - Missing Answers: ${issues.missingAnswers.length}`);
console.log(`   - Empty Answers: ${issues.emptyAnswers.length}`);
console.log(`   - Quality Issues: ${issues.qualityIssues.length}`);
console.log('');

if (totalIssues === 0) {
  console.log('✅ No critical issues detected!');
} else {
  console.log(`❌ ${totalIssues} critical issues need attention.`);
  process.exit(1);
}

// Save detailed report
const reportPath = path.join(resultsDir, `analysis-40q-${Date.now()}.json`);
fs.writeFileSync(reportPath, JSON.stringify(issues, null, 2));
console.log(`\n💾 Detailed report saved: ${path.basename(reportPath)}`);

