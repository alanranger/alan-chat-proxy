#!/usr/bin/env node
/**
 * Comprehensive 40Q Regression Test Comparison
 * Validates response types, entity counts, and quality metrics
 * 
 * Usage: node compare-40q-baseline-vs-current.cjs [baseline-file] [current-file]
 */

const fs = require('fs');
const path = require('path');

// Get file paths from command line or use defaults
const baselinePath = process.argv[2] || path.join(__dirname, '..', 'test results', 'deployed-analytics-test-2025-11-15T16-17-22-761Z.json');
const currentPath = process.argv[3] || path.join(__dirname, '..', 'test results', 'deployed-analytics-test-2025-11-20T17-50-03-253Z.json');

if (!fs.existsSync(baselinePath) || !fs.existsSync(currentPath)) {
  console.error('❌ Error: One or both test result files not found');
  console.error(`   Baseline: ${baselinePath}`);
  console.error(`   Current:  ${currentPath}`);
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));

console.log('📊 COMPREHENSIVE 40Q REGRESSION TEST COMPARISON');
console.log('='.repeat(80));
console.log(`Baseline: ${path.basename(baselinePath)}`);
console.log(`Current:  ${path.basename(currentPath)}`);
console.log('='.repeat(80));

// Helper: Extract metrics from result (handles both old and new format)
function extractMetrics(result) {
  if (result.metrics) {
    // New format with explicit metrics
    return result.metrics;
  }
  
  // Old format - calculate from response
  const structured = result.response?.structured || {};
  const sources = result.response?.sources || {};
  
  return {
    responseType: result.response?.type || 'unknown',
    articlesCount: Array.isArray(structured.articles) ? structured.articles.length : 0,
    productsCount: Array.isArray(structured.products) ? structured.products.length : 0,
    eventsCount: Array.isArray(structured.events) ? structured.events.length : 0,
    servicesCount: Array.isArray(structured.services) ? structured.services.length : 0,
    landingCount: Array.isArray(structured.landing) ? structured.landing.length : 0,
    productsInArticles: Array.isArray(structured.articles) 
      ? structured.articles.filter(a => a.kind === 'product' || a.source_type === 'workshop_product').length 
      : 0,
    sourcesEventsCount: Array.isArray(sources.events) ? sources.events.length : 0,
    sourcesArticlesCount: Array.isArray(sources.articles) ? sources.articles.length : 0
  };
}

// Overall stats
console.log('\n📈 OVERALL STATS:');
console.log(`Success Rate: ${baseline.successfulTests}/${baseline.successfulTests} → ${current.successfulTests}/${current.successfulTests} ${baseline.successfulTests === current.successfulTests ? '✅' : '⚠️'}`);
console.log(`Avg Confidence: ${baseline.avgConfidence} → ${current.avgConfidence}`);

// Aggregate metrics comparison
const baselineMetrics = baseline.aggregateMetrics || {};
const currentMetrics = current.aggregateMetrics || {};

console.log('\n📦 AGGREGATE ENTITY COUNTS:');
console.log('='.repeat(80));
console.log(`Articles:  ${baselineMetrics.totalArticles || 'N/A'} → ${currentMetrics.totalArticles || 'N/A'}`);
console.log(`Products:  ${baselineMetrics.totalProducts || 'N/A'} → ${currentMetrics.totalProducts || 'N/A'}`);
console.log(`Events:    ${baselineMetrics.totalEvents || 'N/A'} → ${currentMetrics.totalEvents || 'N/A'}`);
console.log(`Services:  ${baselineMetrics.totalServices || 'N/A'} → ${currentMetrics.totalServices || 'N/A'}`);

if (currentMetrics.productsInArticlesIssues > 0) {
  console.log(`\n⚠️  REGRESSION DETECTED: ${currentMetrics.productsInArticlesIssues} queries have products incorrectly in articles array!`);
}

// Response type distribution
console.log('\n📊 RESPONSE TYPE DISTRIBUTION:');
console.log('='.repeat(80));
const baselineTypes = baselineMetrics.responseTypes || {};
const currentTypes = currentMetrics.responseTypes || {};
const allTypes = new Set([...Object.keys(baselineTypes), ...Object.keys(currentTypes)]);

allTypes.forEach(type => {
  const b = baselineTypes[type] || 0;
  const c = currentTypes[type] || 0;
  const change = c - b;
  const icon = change === 0 ? '➡️' : change > 0 ? '📈' : '📉';
  console.log(`  ${type}: ${b} → ${c} ${icon} (${change > 0 ? '+' : ''}${change})`);
});

// Per-query detailed comparison with regression detection
console.log('\n🔍 PER-QUERY DETAILED COMPARISON:');
console.log('='.repeat(80));

const regressions = [];
const improvements = [];

console.log('Processing', baseline.results.length, 'queries for detailed comparison...');

baseline.results.forEach((bResult) => {
  const cResult = current.results.find(r => r.query === bResult.query);
  if (!cResult) {
    console.warn(`Warning: Query "${bResult.query}" not found in current results`);
    return;
  }
  
  const bMetrics = extractMetrics(bResult);
  const cMetrics = extractMetrics(cResult);
  
  const issues = [];
  const improvements_found = [];
  
  // Check response type changed
  if (bMetrics.responseType !== cMetrics.responseType) {
    issues.push(`Response type changed: ${bMetrics.responseType} → ${cMetrics.responseType}`);
  }
  
  // Check for product categorization regression
  if (cMetrics.productsInArticles > 0 && bMetrics.productsInArticles === 0) {
    issues.push(`⚠️ REGRESSION: Products incorrectly in articles array (${cMetrics.productsInArticles} products)`);
  }
  
  // Check entity count changes (flag significant drops)
  const entityChecks = [
    { name: 'Articles', baseline: bMetrics.articlesCount, current: cMetrics.articlesCount, threshold: 0.5 },
    { name: 'Products', baseline: bMetrics.productsCount, current: cMetrics.productsCount, threshold: 0.5 },
    { name: 'Events', baseline: bMetrics.eventsCount, current: cMetrics.eventsCount, threshold: 0.5 },
    { name: 'Services', baseline: bMetrics.servicesCount, current: cMetrics.servicesCount, threshold: 0.5 }
  ];
  
  entityChecks.forEach(check => {
    if (check.baseline > 0 && check.current === 0) {
      issues.push(`⚠️ REGRESSION: ${check.name} count dropped to 0 (was ${check.baseline})`);
    } else if (check.baseline > 0 && check.current < check.baseline * check.threshold) {
      issues.push(`⚠️ REGRESSION: ${check.name} count dropped significantly (${check.baseline} → ${check.current})`);
    } else if (check.baseline === 0 && check.current > 0) {
      improvements_found.push(`✅ IMPROVEMENT: ${check.name} count increased (0 → ${check.current})`);
    } else if (check.current > check.baseline * 1.5) {
      improvements_found.push(`✅ IMPROVEMENT: ${check.name} count increased (${check.baseline} → ${check.current})`);
    }
  });
  
  if (issues.length > 0) {
    regressions.push({
      query: bResult.query,
      category: bResult.category,
      issues: issues,
      baseline: bMetrics,
      current: cMetrics
    });
  }
  
  if (improvements_found.length > 0) {
    improvements.push({
      query: bResult.query,
      improvements: improvements_found,
      baseline: bMetrics,
      current: cMetrics
    });
  }
});

// Equipment-related queries (legacy section for backward compatibility)
const equipmentQueries = [
  'tripod',
  'camera',
  'memory card',
  'prime and zoom'
];

console.log('\n🔧 EQUIPMENT QUERIES COMPARISON:');
console.log('='.repeat(80));

equipmentQueries.forEach(q => {
  const b = baseline.results.find(r => r.query.toLowerCase().includes(q));
  const c = current.results.find(r => r.query.toLowerCase().includes(q));
  
  if (b && c) {
    const bMetrics = extractMetrics(b);
    const cMetrics = extractMetrics(c);
    
    const bTitles = (b.response?.structured?.articles || b.response?.sources?.articles || []).slice(0, 3).map(a => (a.title || a.name || '').substring(0, 60));
    const cTitles = (c.response?.structured?.articles || c.response?.sources?.articles || []).slice(0, 3).map(a => (a.title || a.name || '').substring(0, 60));
    
    // Check for landscape articles in results
    const bHasLandscape = bTitles.some(t => t.toLowerCase().includes('landscape') && !t.toLowerCase().includes('tripod'));
    const cHasLandscape = cTitles.some(t => t.toLowerCase().includes('landscape') && !t.toLowerCase().includes('tripod'));
    
    console.log(`\n${q.toUpperCase()}:`);
    console.log(`  Query: "${b.query}"`);
    console.log(`  Articles: ${bMetrics.articlesCount} → ${cMetrics.articlesCount} ${cMetrics.articlesCount < bMetrics.articlesCount ? '📉' : cMetrics.articlesCount > bMetrics.articlesCount ? '📈' : '➡️'}`);
    console.log(`  Products: ${bMetrics.productsCount} → ${cMetrics.productsCount} ${cMetrics.productsCount < bMetrics.productsCount ? '📉' : cMetrics.productsCount > bMetrics.productsCount ? '📈' : '➡️'}`);
    console.log(`  Baseline top 3: ${bTitles.join('; ')}`);
    console.log(`  Current top 3:  ${cTitles.join('; ')}`);
    console.log(`  Landscape articles removed: ${bHasLandscape && !cHasLandscape ? '✅ YES' : bHasLandscape && cHasLandscape ? '❌ Still present' : 'N/A'}`);
    if (cMetrics.productsInArticles > 0) {
      console.log(`  ⚠️  WARNING: ${cMetrics.productsInArticles} products incorrectly in articles array!`);
    }
  }
});

// Check for landscape queries to ensure they still work
console.log('\n\n🌄 LANDSCAPE QUERIES (should still work):');
console.log('='.repeat(80));

const landscapeQueries = ['autumn', 'landscape'];
landscapeQueries.forEach(q => {
  const b = baseline.results.find(r => r.query.toLowerCase().includes(q));
  const c = current.results.find(r => r.query.toLowerCase().includes(q));
  
  if (b && c) {
    const bMetrics = extractMetrics(b);
    const cMetrics = extractMetrics(c);
    
    console.log(`\n${q.toUpperCase()}:`);
    console.log(`  Query: "${b.query}"`);
    console.log(`  Articles: ${bMetrics.articlesCount} → ${cMetrics.articlesCount} ${cMetrics.articlesCount < bMetrics.articlesCount ? '📉' : cMetrics.articlesCount > bMetrics.articlesCount ? '📈' : '➡️'}`);
    console.log(`  Products: ${bMetrics.productsCount} → ${cMetrics.productsCount} ${cMetrics.productsCount < bMetrics.productsCount ? '📉' : cMetrics.productsCount > bMetrics.productsCount ? '📈' : '➡️'}`);
  }
});

// Report regressions
if (regressions.length > 0) {
  console.log(`\n❌ REGRESSIONS DETECTED (${regressions.length} queries):`);
  console.log('='.repeat(80));
  regressions.forEach((r, idx) => {
    console.log(`\n${idx + 1}. "${r.query}" (${r.category})`);
    r.issues.forEach(issue => console.log(`   ${issue}`));
    console.log(`   Baseline: Type=${r.baseline.responseType}, Articles=${r.baseline.articlesCount}, Products=${r.baseline.productsCount}, Events=${r.baseline.eventsCount}`);
    console.log(`   Current:  Type=${r.current.responseType}, Articles=${r.current.articlesCount}, Products=${r.current.productsCount}, Events=${r.current.eventsCount}`);
  });
} else {
  console.log(`\n✅ NO REGRESSIONS DETECTED`);
}

// Report improvements
if (improvements.length > 0) {
  console.log(`\n✅ IMPROVEMENTS DETECTED (${improvements.length} queries):`);
  console.log('='.repeat(80));
  improvements.slice(0, 10).forEach((i, idx) => {
    console.log(`\n${idx + 1}. "${i.query}"`);
    i.improvements.forEach(imp => console.log(`   ${imp}`));
  });
  if (improvements.length > 10) {
    console.log(`\n   ... and ${improvements.length - 10} more improvements`);
  }
}

// Category-specific analysis
console.log('\n📋 CATEGORY-SPECIFIC ANALYSIS:');
console.log('='.repeat(80));

const categories = ['Event Queries', 'Equipment Recommendations', 'General Queries'];
categories.forEach(category => {
  const bCategory = baseline.results.filter(r => r.category === category);
  const cCategory = current.results.filter(r => r.category === category);
  
  if (bCategory.length === 0) return;
  
  const bTotalArticles = bCategory.reduce((sum, r) => sum + extractMetrics(r).articlesCount, 0);
  const cTotalArticles = cCategory.reduce((sum, r) => sum + extractMetrics(r).articlesCount, 0);
  const bTotalProducts = bCategory.reduce((sum, r) => sum + extractMetrics(r).productsCount, 0);
  const cTotalProducts = cCategory.reduce((sum, r) => sum + extractMetrics(r).productsCount, 0);
  const bTotalEvents = bCategory.reduce((sum, r) => sum + extractMetrics(r).eventsCount, 0);
  const cTotalEvents = cCategory.reduce((sum, r) => sum + extractMetrics(r).eventsCount, 0);
  
  console.log(`\n${category}:`);
  console.log(`  Articles: ${bTotalArticles} → ${cTotalArticles} ${cTotalArticles < bTotalArticles ? '📉' : cTotalArticles > bTotalArticles ? '📈' : '➡️'}`);
  console.log(`  Products: ${bTotalProducts} → ${cTotalProducts} ${cTotalProducts < bTotalProducts ? '📉' : cTotalProducts > bTotalProducts ? '📈' : '➡️'}`);
  console.log(`  Events:   ${bTotalEvents} → ${cTotalEvents} ${cTotalEvents < bTotalEvents ? '📉' : cTotalEvents > bTotalEvents ? '📈' : '➡️'}`);
});

console.log('\n' + '='.repeat(80));
console.log(`✅ Comprehensive comparison complete!`);
console.log(`   Regressions: ${regressions.length}, Improvements: ${improvements.length}`);
if (regressions.length > 0) {
  console.log(`\n⚠️  ACTION REQUIRED: Review ${regressions.length} regression(s) above`);
  process.exit(1);
} else {
  console.log(`\n✅ All checks passed - no regressions detected!`);
  process.exit(0);
}





