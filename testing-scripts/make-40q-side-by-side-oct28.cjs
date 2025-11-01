const fs = require('fs');
const path = require('path');

const resultsDir = 'testing-scripts/test results';

// Use the November 1, 2025 baseline (latest baseline)
const baselineJsonPath = path.join(resultsDir, 'baseline-40-question-interactive-subset-2025-11-01T13-32-45-780Z.json');

// Find the latest current baseline
const currentFiles = fs.readdirSync(resultsDir)
  .filter(f => f.startsWith('baseline-40-question-interactive-subset-') && f.endsWith('.json'))
  .sort()
  .reverse();
const currentJsonFile = currentFiles[0];
const currentJsonPath = path.join(resultsDir, currentJsonFile);

console.log(`📋 Baseline (Oct 28): ${path.basename(baselineJsonPath)}`);
console.log(`📋 Current: ${path.basename(currentJsonPath)}`);

const baselineResults = JSON.parse(fs.readFileSync(baselineJsonPath, 'utf8'));
const currentResults = JSON.parse(fs.readFileSync(currentJsonPath, 'utf8'));

const baselineLookup = new Map();
baselineResults.results.forEach(r => baselineLookup.set(r.query.toLowerCase().trim(), r));

const comparison = [];

currentResults.results.forEach(current => {
  const query = current.query.trim();
  const lcQuery = query.toLowerCase();
  const baseline = baselineLookup.get(lcQuery);

  if (!baseline) {
    console.warn(`[WARN] No baseline found for query: "${query}"`);
    return;
  }

  const baselineStatus = baseline.response?.success && String(baseline.response?.answer || '').length > 0 ? 'Pass' : 'Fail';
  const currentStatus = current.response?.success && String(current.response?.answer || '').length > 0 ? 'Pass' : 'Fail';
  
  let statusChange = '';
  if (baselineStatus === 'Fail' && currentStatus === 'Pass') {
    statusChange = 'Improved';
  } else if (baselineStatus === 'Pass' && currentStatus === 'Fail') {
    statusChange = 'Worsened';
  } else if (baselineStatus === currentStatus) {
    statusChange = 'Same';
  } else {
    statusChange = 'Changed';
  }

  // Check for content quality changes
  const baselineAnswer = String(baseline.response?.answer || '');
  const currentAnswer = String(current.response?.answer || '');
  const baselineGeneric = baselineAnswer.includes('Based on Alan Ranger') || baselineAnswer.includes('I offer a range');
  const currentGeneric = currentAnswer.includes('Based on Alan Ranger') || currentAnswer.includes('I offer a range');
  const contentImproved = baselineGeneric && !currentGeneric;

  // Extract structured data
  const baselineSources = baseline.response?.sources || {};
  const baselineStructured = baseline.response?.structured || {};
  const currentSources = current.response?.sources || {};
  const currentStructured = current.response?.structured || {};

  comparison.push({
    'Question #': comparison.length + 1,
    'Question': query,
    'Category': current.category || '',
    'Baseline Status (Nov 1)': baselineStatus,
    'Current Status': currentStatus,
    'Status Change': statusChange,
    'Baseline Confidence': ((baseline.response?.confidence || 0) * 100).toFixed(0),
    'Current Confidence': ((current.response?.confidence || 0) * 100).toFixed(0),
    'Baseline Answer (Snippet)': baselineAnswer.substring(0, 200),
    'Current Answer (Snippet)': currentAnswer.substring(0, 200),
    'Baseline Type': baseline.response?.type || '',
    'Current Type': current.response?.type || '',
    'Baseline Events Count': (baselineStructured.events?.length || baselineSources.events?.length || 0).toString(),
    'Current Events Count': (currentStructured.events?.length || currentSources.events?.length || 0).toString(),
    'Baseline Articles Count': (baselineStructured.articles?.length || baselineSources.articles?.length || 0).toString(),
    'Current Articles Count': (currentStructured.articles?.length || currentSources.articles?.length || 0).toString(),
    'Baseline Services Count': (baselineStructured.services?.length || baselineSources.services?.length || 0).toString(),
    'Current Services Count': (currentStructured.services?.length || currentSources.services?.length || 0).toString(),
    'Content Quality Improved': contentImproved ? 'Yes' : 'No',
    'Answer Changed': baselineAnswer !== currentAnswer ? 'Yes' : 'No'
  });
});

// Generate CSV
const outputPath = path.join(resultsDir, `side-by-side-40q-nov1-baseline-vs-current-${Date.now()}.csv`);
const csvLines = [Object.keys(comparison[0]).join(',')];
comparison.forEach(row => {
  csvLines.push(Object.values(row).map(value => `"${String(value).replace(/"/g, '""')}"`).join(','));
});

fs.writeFileSync(outputPath, csvLines.join('\n'));

console.log('\n📊 SIDE-BY-SIDE COMPARISON GENERATED');
console.log('='.repeat(80));
console.log(`📋 Baseline (Nov 1, 2025): ${path.basename(baselineJsonPath)}`);
console.log(`📋 Current: ${path.basename(currentJsonPath)}`);
console.log(`💾 Output: ${path.basename(outputPath)}`);
console.log(`📈 Questions compared: ${comparison.length}`);

const fixedCount = comparison.filter(c => c['Status Change'] === 'Improved').length;
const contentImprovedCount = comparison.filter(c => c['Content Quality Improved'] === 'Yes').length;
const worsenedCount = comparison.filter(c => c['Status Change'] === 'Worsened').length;
const answerChangedCount = comparison.filter(c => c['Answer Changed'] === 'Yes').length;

console.log(`\n📊 SUMMARY:`);
console.log(`   ✅ Fixed (Fail → Pass): ${fixedCount}`);
console.log(`   📈 Content Quality Improved: ${contentImprovedCount}`);
console.log(`   ❌ Worsened: ${worsenedCount}`);
console.log(`   🔄 Answers Changed: ${answerChangedCount}`);
console.log(`   ✅ File saved: ${outputPath}`);

