#!/usr/bin/env node
/**
 * Update the fixed 40Q baseline to a new test result
 * 
 * This should ONLY be run when:
 *   1. All regressions have been fixed
 *   2. System is verified to be in a good state
 *   3. You want to establish a new baseline for future comparisons
 * 
 * Usage: node update-baseline-40q.cjs [test-result-file]
 *        If no file specified, uses the most recent deployed test result
 */

const fs = require('fs');
const path = require('path');

const BASELINE_PATH = path.join(__dirname, '..', 'test results', 'baseline-40q-fixed.json');
const resultsDir = path.join(__dirname, '..', 'test results');

// Get source file
let sourceFile = process.argv[2];

if (!sourceFile) {
  // Find most recent deployed test result
  const files = fs.readdirSync(resultsDir)
    .filter(f => f.startsWith('deployed-analytics-test-') && f.endsWith('.json'))
    .map(f => ({
      name: f,
      path: path.join(resultsDir, f),
      time: fs.statSync(path.join(resultsDir, f)).mtimeMs
    }))
    .sort((a, b) => b.time - a.time);
  
  if (files.length === 0) {
    console.error('❌ Error: No deployed test results found');
    console.error('   Run test-40q-deployed.cjs first to generate a test result');
    process.exit(1);
  }
  
  sourceFile = files[0].path;
  console.log(`📋 Using most recent test result: ${path.basename(sourceFile)}`);
} else {
  // Resolve relative path
  if (!path.isAbsolute(sourceFile)) {
    sourceFile = path.join(resultsDir, sourceFile);
  }
  
  if (!fs.existsSync(sourceFile)) {
    console.error(`❌ Error: Source file not found: ${sourceFile}`);
    process.exit(1);
  }
}

// Verify source file is valid
try {
  const testData = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  if (!testData.results || !Array.isArray(testData.results)) {
    console.error('❌ Error: Invalid test result file format');
    process.exit(1);
  }
  
  console.log(`\n📊 Test Result Summary:`);
  console.log(`   File: ${path.basename(sourceFile)}`);
  console.log(`   Questions: ${testData.results.length}`);
  console.log(`   Success Rate: ${testData.successfulTests || 'N/A'}/${testData.results.length}`);
  console.log(`   Avg Confidence: ${testData.avgConfidence || 'N/A'}`);
  
  if (testData.aggregateMetrics) {
    console.log(`   Articles: ${testData.aggregateMetrics.totalArticles || 0}`);
    console.log(`   Products: ${testData.aggregateMetrics.totalProducts || 0}`);
    console.log(`   Events: ${testData.aggregateMetrics.totalEvents || 0}`);
    console.log(`   Services: ${testData.aggregateMetrics.totalServices || 0}`);
    if (testData.aggregateMetrics.productsInArticlesIssues > 0) {
      console.log(`   ⚠️  WARNING: ${testData.aggregateMetrics.productsInArticlesIssues} queries have products in articles!`);
    }
  }
  
} catch (error) {
  console.error(`❌ Error reading source file: ${error.message}`);
  process.exit(1);
}

// Backup existing baseline if it exists
if (fs.existsSync(BASELINE_PATH)) {
  const backupPath = BASELINE_PATH.replace('.json', `-backup-${Date.now()}.json`);
  fs.copyFileSync(BASELINE_PATH, backupPath);
  console.log(`\n💾 Backed up existing baseline to: ${path.basename(backupPath)}`);
  
  // Show old baseline info
  try {
    const oldBaseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    console.log(`   Old baseline: ${oldBaseline.timestamp || 'unknown timestamp'}`);
  } catch {
    // Ignore errors reading old baseline
  }
}

// Copy source to baseline
fs.copyFileSync(sourceFile, BASELINE_PATH);

// Add baseline metadata
const baselineData = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
baselineData.baselineMetadata = {
  establishedAt: new Date().toISOString(),
  establishedBy: 'update-baseline-40q.cjs',
  sourceFile: path.basename(sourceFile),
  note: 'This is the fixed baseline for 40Q regression tests. Only update when system is in a verified good state.'
};
fs.writeFileSync(BASELINE_PATH, JSON.stringify(baselineData, null, 2));

console.log(`\n✅ Baseline updated successfully!`);
console.log(`   New baseline: ${BASELINE_PATH}`);
console.log(`   Established: ${baselineData.baselineMetadata.establishedAt}`);
console.log(`\n💡 This baseline will now be used for all future regression test comparisons.`);
console.log(`   To compare against this baseline, run:`);
console.log(`   node compare-40q-baseline-vs-current.cjs`);

