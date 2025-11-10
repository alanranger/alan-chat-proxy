#!/usr/bin/env node
/**
 * Compare structured data (events, products, services, articles) between baseline and current test
 */

const fs = require('fs');
const path = require('path');

const resultsDir = 'testing-scripts/test results';

// Baseline from Nov 1 (official baseline)
const baselinePath = path.join(resultsDir, 'baseline-40-question-interactive-subset-2025-11-01T13-32-45-780Z.json');
// Latest test results
const currentPath = path.join(resultsDir, 'deployed-analytics-test-2025-11-10T22-57-04-965Z.json');

console.log('📊 COMPARING STRUCTURED DATA (Events, Products, Services, Articles)\n');
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
    totalQuestions: baseline.totalQuestions || 40
  },
  improvements: [],
  regressions: [],
  unchanged: [],
  changes: [],
  missing: []
};

function countStructuredData(result) {
  const structured = result.response?.structured || {};
  return {
    events: Array.isArray(structured.events) ? structured.events.length : 0,
    products: Array.isArray(structured.products) ? structured.products.length : 0,
    services: Array.isArray(structured.services) ? structured.services.length : 0,
    articles: Array.isArray(structured.articles) ? structured.articles.length : 0,
    total: (Array.isArray(structured.events) ? structured.events.length : 0) +
           (Array.isArray(structured.products) ? structured.products.length : 0) +
           (Array.isArray(structured.services) ? structured.services.length : 0) +
           (Array.isArray(structured.articles) ? structured.articles.length : 0)
  };
}

current.results.forEach((currentResult) => {
  const query = currentResult.query.trim();
  const lcQuery = query.toLowerCase();
  const baselineResult = baselineMap.get(lcQuery);
  
  if (!baselineResult) {
    console.warn(`⚠️  No baseline found for: "${query}"`);
    return;
  }

  const baselineCounts = countStructuredData(baselineResult);
  const currentCounts = countStructuredData(currentResult);
  
  const change = {
    query,
    category: currentResult.category,
    baseline: baselineCounts,
    current: currentCounts,
    eventsDiff: currentCounts.events - baselineCounts.events,
    productsDiff: currentCounts.products - baselineCounts.products,
    servicesDiff: currentCounts.services - baselineCounts.services,
    articlesDiff: currentCounts.articles - baselineCounts.articles,
    totalDiff: currentCounts.total - baselineCounts.total
  };

  // Categorize changes
  if (change.totalDiff === 0 && 
      change.eventsDiff === 0 && 
      change.productsDiff === 0 && 
      change.servicesDiff === 0 && 
      change.articlesDiff === 0) {
    comparison.unchanged.push(change);
  } else if (change.totalDiff > 0 || 
             (change.eventsDiff > 0 && baselineCounts.events === 0) ||
             (change.productsDiff > 0 && baselineCounts.products === 0) ||
             (change.servicesDiff > 0 && baselineCounts.services === 0) ||
             (change.articlesDiff > 0 && baselineCounts.articles === 0)) {
    comparison.improvements.push(change);
  } else if (change.totalDiff < 0 || 
             (change.eventsDiff < 0 && currentCounts.events === 0 && baselineCounts.events > 0) ||
             (change.productsDiff < 0 && currentCounts.products === 0 && baselineCounts.products > 0) ||
             (change.servicesDiff < 0 && currentCounts.services === 0 && baselineCounts.services > 0) ||
             (change.articlesDiff < 0 && currentCounts.articles === 0 && baselineCounts.articles > 0)) {
    comparison.regressions.push(change);
  } else {
    comparison.changes.push(change);
  }
});

// Print summary
console.log('='.repeat(80));
console.log('📊 STRUCTURED DATA SUMMARY');
console.log('='.repeat(80));

const baselineTotal = baseline.results.reduce((sum, r) => {
  const counts = countStructuredData(r);
  return sum + counts.total;
}, 0);

const currentTotal = current.results.reduce((sum, r) => {
  const counts = countStructuredData(r);
  return sum + counts.total;
}, 0);

console.log(`Total Structured Items: ${baselineTotal} → ${currentTotal} (${currentTotal > baselineTotal ? '+' : ''}${currentTotal - baselineTotal})`);
console.log(`\n📈 Improvements: ${comparison.improvements.length}`);
console.log(`📉 Regressions: ${comparison.regressions.length}`);
console.log(`🔄 Changes: ${comparison.changes.length}`);
console.log(`✅ Unchanged: ${comparison.unchanged.length}`);

if (comparison.improvements.length > 0) {
  console.log('\n' + '='.repeat(80));
  console.log('📈 IMPROVEMENTS (More structured data)');
  console.log('='.repeat(80));
  comparison.improvements.slice(0, 10).forEach(imp => {
    console.log(`\n✅ "${imp.query}"`);
    console.log(`   Events: ${imp.baseline.events} → ${imp.current.events} (${imp.eventsDiff > 0 ? '+' : ''}${imp.eventsDiff})`);
    console.log(`   Products: ${imp.baseline.products} → ${imp.current.products} (${imp.productsDiff > 0 ? '+' : ''}${imp.productsDiff})`);
    console.log(`   Services: ${imp.baseline.services} → ${imp.current.services} (${imp.servicesDiff > 0 ? '+' : ''}${imp.servicesDiff})`);
    console.log(`   Articles: ${imp.baseline.articles} → ${imp.current.articles} (${imp.articlesDiff > 0 ? '+' : ''}${imp.articlesDiff})`);
    console.log(`   Total: ${imp.baseline.total} → ${imp.current.total} (${imp.totalDiff > 0 ? '+' : ''}${imp.totalDiff})`);
  });
  if (comparison.improvements.length > 10) {
    console.log(`\n... and ${comparison.improvements.length - 10} more improvements`);
  }
}

if (comparison.regressions.length > 0) {
  console.log('\n' + '='.repeat(80));
  console.log('📉 REGRESSIONS (Less structured data)');
  console.log('='.repeat(80));
  comparison.regressions.forEach(reg => {
    console.log(`\n❌ "${reg.query}"`);
    console.log(`   Events: ${reg.baseline.events} → ${reg.current.events} (${reg.eventsDiff})`);
    console.log(`   Products: ${reg.baseline.products} → ${reg.current.products} (${reg.productsDiff})`);
    console.log(`   Services: ${reg.baseline.services} → ${reg.current.services} (${reg.servicesDiff})`);
    console.log(`   Articles: ${reg.baseline.articles} → ${reg.current.articles} (${reg.articlesDiff})`);
    console.log(`   Total: ${reg.baseline.total} → ${reg.current.total} (${reg.totalDiff})`);
  });
}

if (comparison.changes.length > 0 && comparison.changes.length <= 10) {
  console.log('\n' + '='.repeat(80));
  console.log('🔄 CHANGES (Different distribution)');
  console.log('='.repeat(80));
  comparison.changes.forEach(chg => {
    console.log(`\n🔄 "${chg.query}"`);
    console.log(`   Events: ${chg.baseline.events} → ${chg.current.events} (${chg.eventsDiff > 0 ? '+' : ''}${chg.eventsDiff})`);
    console.log(`   Products: ${chg.baseline.products} → ${chg.current.products} (${chg.productsDiff > 0 ? '+' : ''}${chg.productsDiff})`);
    console.log(`   Services: ${chg.baseline.services} → ${chg.current.services} (${chg.servicesDiff > 0 ? '+' : ''}${chg.servicesDiff})`);
    console.log(`   Articles: ${chg.baseline.articles} → ${chg.current.articles} (${chg.articlesDiff > 0 ? '+' : ''}${chg.articlesDiff})`);
    console.log(`   Total: ${chg.baseline.total} → ${chg.current.total} (${chg.totalDiff > 0 ? '+' : ''}${chg.totalDiff})`);
  });
}

// Save comparison to file
const outputPath = path.join(resultsDir, `structured-data-comparison-${Date.now()}.json`);
fs.writeFileSync(outputPath, JSON.stringify(comparison, null, 2));
console.log(`\n💾 Comparison saved to: ${path.basename(outputPath)}`);

// Overall assessment
console.log('\n' + '='.repeat(80));
console.log('🎯 OVERALL ASSESSMENT');
console.log('='.repeat(80));
if (comparison.regressions.length === 0 && comparison.improvements.length >= 0) {
  console.log('✅ NO REGRESSIONS IN STRUCTURED DATA - All improvements are positive or neutral');
} else if (comparison.regressions.length > 0) {
  console.log(`⚠️  ${comparison.regressions.length} REGRESSION(S) IN STRUCTURED DATA - Review required`);
} else {
  console.log('✅ Structured data is stable with improvements');
}

