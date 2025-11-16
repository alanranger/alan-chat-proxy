const fs = require('fs');
const path = require('path');

const resultsDir = 'testing-scripts/test results';

// Find the latest baseline for 430Q test
const baselineFiles = fs.readdirSync(resultsDir)
  .filter(f => f.startsWith('baseline-430-question-comprehensive-set-') && f.endsWith('.json'))
  .sort()
  .reverse();

// Use the most recent baseline before today's test (or the one from Nov 1 if available)
const todayBaseline = baselineFiles.find(f => f.includes('2025-11-01T13') || f.includes('2025-11-01T09'));
const baselineJsonPath = todayBaseline 
  ? path.join(resultsDir, todayBaseline)
  : path.join(resultsDir, baselineFiles[0]); // Fallback to most recent

// Find the latest current baseline
const currentFiles = fs.readdirSync(resultsDir)
  .filter(f => f.startsWith('baseline-430-question-comprehensive-set-') && f.endsWith('.json'))
  .sort()
  .reverse();
const currentJsonFile = currentFiles[0];
const currentJsonPath = path.join(resultsDir, currentJsonFile);

console.log(`📋 Baseline: ${path.basename(baselineJsonPath)}`);
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

  // Handle both response.success and response.ok
  const baselineSuccess = baseline.response?.success === true || baseline.response?.ok === true;
  const currentSuccess = current.response?.success === true || current.response?.ok === true;
  const baselineStatus = baselineSuccess && String(baseline.response?.answer || '').length > 0 ? 'Pass' : 'Fail';
  const currentStatus = currentSuccess && String(current.response?.answer || '').length > 0 ? 'Pass' : 'Fail';
  
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

  const baselineAnswerLength = String(baseline.response?.answer || '').length;
  const currentAnswerLength = String(current.response?.answer || '').length;
  const answerLengthChange = currentAnswerLength - baselineAnswerLength;
  
  const baselineConfidence = baseline.response?.confidence || 0;
  const currentConfidence = current.response?.confidence || 0;
  const confidenceChange = currentConfidence - baselineConfidence;

  // Determine if content quality improved
  let contentQualityChange = '';
  if (answerLengthChange > 50 && currentStatus === 'Pass') {
    contentQualityChange = 'Improved';
  } else if (answerLengthChange < -50 && baselineStatus === 'Pass') {
    contentQualityChange = 'Worsened';
  } else {
    contentQualityChange = 'Similar';
  }

  // Check routing changes
  const baselineType = baseline.response?.type || 'unknown';
  const currentType = current.response?.type || 'unknown';
  const baselineEvents = baseline.response?.structured?.events?.length || 0;
  const currentEvents = current.response?.structured?.events?.length || 0;
  const baselineServices = baseline.response?.structured?.services?.length || 0;
  const currentServices = current.response?.structured?.services?.length || 0;
  
  // Compare articles
  const baselineArticles = (baseline.response?.structured?.articles || []).map(a => ({
    id: a.id,
    title: a.title || a.page_url || 'NO_TITLE'
  }));
  const currentArticles = (current.response?.structured?.articles || []).map(a => ({
    id: a.id,
    title: a.title || a.page_url || 'NO_TITLE'
  }));
  
  const baselineArticleIds = new Set(baselineArticles.map(a => a.id));
  const currentArticleIds = new Set(currentArticles.map(a => a.id));
  
  const addedArticles = currentArticles.filter(a => !baselineArticleIds.has(a.id));
  const removedArticles = baselineArticles.filter(a => !currentArticleIds.has(a.id));
  const sameArticles = baselineArticles.filter(a => currentArticleIds.has(a.id));
  
  let routingChange = '';
  if (baselineType !== currentType) {
    routingChange = `${baselineType} → ${currentType}`;
  } else if (baselineEvents !== currentEvents && (baselineEvents === 0 || currentEvents === 0)) {
    routingChange = `Events: ${baselineEvents} → ${currentEvents}`;
  } else if (baselineServices !== currentServices && (baselineServices === 0 || currentServices === 0)) {
    routingChange = `Services: ${baselineServices} → ${currentServices}`;
  } else {
    routingChange = 'Same';
  }
  
  let articleChange = '';
  if (addedArticles.length > 0 || removedArticles.length > 0) {
    articleChange = `+${addedArticles.length}/-${removedArticles.length}`;
  } else {
    articleChange = 'Same';
  }

  comparison.push({
    query,
    baselineStatus,
    currentStatus,
    statusChange,
    baselineAnswerLength,
    currentAnswerLength,
    answerLengthChange,
    baselineConfidence,
    currentConfidence,
    confidenceChange,
    contentQualityChange,
    baselineType,
    currentType,
    routingChange,
    baselineEvents,
    currentEvents,
    baselineServices,
    currentServices,
    baselineArticles: baselineArticles.length,
    currentArticles: currentArticles.length,
    articleChange,
    addedArticles: addedArticles.map(a => `${a.id}:${a.title.substring(0, 50)}`).join('; '),
    removedArticles: removedArticles.map(a => `${a.id}:${a.title.substring(0, 50)}`).join('; '),
    baselineAnswer: String(baseline.response?.answer || '').substring(0, 200),
    currentAnswer: String(current.response?.answer || '').substring(0, 200)
  });
});

// Generate CSV
const csvHeader = [
  'Query',
  'Baseline Status',
  'Current Status',
  'Status Change',
  'Baseline Answer Length',
  'Current Answer Length',
  'Answer Length Change',
  'Baseline Confidence',
  'Current Confidence',
  'Confidence Change',
  'Content Quality Change',
  'Baseline Type',
  'Current Type',
  'Routing Change',
  'Baseline Events',
  'Current Events',
  'Baseline Services',
  'Current Services',
  'Baseline Articles',
  'Current Articles',
  'Article Change',
  'Added Articles',
  'Removed Articles',
  'Baseline Answer Preview',
  'Current Answer Preview'
].join(',');

const csvRows = comparison.map(row => [
  `"${row.query.replace(/"/g, '""')}"`,
  row.baselineStatus,
  row.currentStatus,
  row.statusChange,
  row.baselineAnswerLength,
  row.currentAnswerLength,
  row.answerLengthChange,
  (row.baselineConfidence * 100).toFixed(1),
  (row.currentConfidence * 100).toFixed(1),
  (row.confidenceChange * 100).toFixed(1),
  row.contentQualityChange,
  row.baselineType,
  row.currentType,
  row.routingChange,
  row.baselineEvents,
  row.currentEvents,
  row.baselineServices,
  row.currentServices,
  row.baselineArticles,
  row.currentArticles,
  row.articleChange,
  `"${(row.addedArticles || '').replace(/"/g, '""')}"`,
  `"${(row.removedArticles || '').replace(/"/g, '""')}"`,
  `"${row.baselineAnswer.replace(/"/g, '""')}"`,
  `"${row.currentAnswer.replace(/"/g, '""')}"`
].join(','));

const csvContent = [csvHeader, ...csvRows].join('\n');

// Save CSV
const timestamp = Date.now();
const csvFilename = `side-by-side-430q-nov1-baseline-vs-current-${timestamp}.csv`;
const csvPath = path.join(resultsDir, csvFilename);
fs.writeFileSync(csvPath, csvContent, 'utf8');

// Calculate summary statistics
const improved = comparison.filter(r => r.statusChange === 'Improved').length;
const worsened = comparison.filter(r => r.statusChange === 'Worsened').length;
const contentImproved = comparison.filter(r => r.contentQualityChange === 'Improved').length;
const answersChanged = comparison.filter(r => r.routingChange !== 'Same' || Math.abs(r.answerLengthChange) > 50).length;
const articlesChanged = comparison.filter(r => r.articleChange !== 'Same').length;

console.log('\n📊 SIDE-BY-SIDE COMPARISON GENERATED');
console.log('================================================================================');
console.log(`📋 Baseline (Nov 1, 2025): ${path.basename(baselineJsonPath)}`);
console.log(`📋 Current: ${path.basename(currentJsonPath)}`);
console.log(`💾 Output: ${csvFilename}`);
console.log(`📈 Questions compared: ${comparison.length}`);
console.log('\n📊 SUMMARY:');
console.log(`   ✅ Fixed (Fail → Pass): ${improved}`);
console.log(`   📈 Content Quality Improved: ${contentImproved}`);
console.log(`   ❌ Worsened: ${worsened}`);
console.log(`   🔄 Answers Changed: ${answersChanged}`);
console.log(`   📰 Articles Changed: ${articlesChanged} (${((articlesChanged / comparison.length) * 100).toFixed(1)}%)`);
console.log(`   ✅ File saved: ${csvPath}`);

