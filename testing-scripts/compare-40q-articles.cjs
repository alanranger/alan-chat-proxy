#!/usr/bin/env node
/**
 * Compare article IDs/titles between two 40Q test result files
 * This shows which queries return different articles after scoring changes
 */

const fs = require('fs');
const path = require('path');

const resultsDir = 'testing-scripts/test results';

// Find baseline (before scoring changes - Nov 10 or earlier)
const baselineFiles = fs.readdirSync(resultsDir)
  .filter(f => (f.startsWith('baseline-40-question-interactive-subset-') || f.startsWith('deployed-analytics-test-')) && f.endsWith('.json'))
  .filter(f => {
    // Prefer Nov 10 or earlier (before scoring changes)
    const match = f.match(/(\d{4}-\d{2}-\d{2})/);
    if (!match) return false;
    const date = match[1];
    return date <= '2025-11-10';
  })
  .sort()
  .reverse();

// Find current test (today's test)
const currentFiles = fs.readdirSync(resultsDir)
  .filter(f => f.startsWith('deployed-analytics-test-') && f.endsWith('.json'))
  .sort()
  .reverse();

if (baselineFiles.length === 0) {
  console.error('❌ No baseline file found (before Nov 10)');
  process.exit(1);
}

if (currentFiles.length === 0) {
  console.error('❌ No current test file found');
  process.exit(1);
}

const baselinePath = path.join(resultsDir, baselineFiles[0]);
const currentPath = path.join(resultsDir, currentFiles[0]);

console.log(`📋 Baseline: ${path.basename(baselinePath)}`);
console.log(`📋 Current: ${path.basename(currentPath)}\n`);

const baselineData = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf8'));

// Create lookup maps
const baselineMap = new Map();
baselineData.results.forEach(r => {
  const query = r.query.toLowerCase().trim();
  const articles = (r.response?.structured?.articles || []).map(a => ({
    id: a.id,
    title: a.title || a.page_url || 'NO_TITLE',
    url: a.page_url || a.url || ''
  }));
  baselineMap.set(query, articles);
});

const currentMap = new Map();
currentData.results.forEach(r => {
  const query = r.query.toLowerCase().trim();
  const articles = (r.response?.structured?.articles || []).map(a => ({
    id: a.id,
    title: a.title || a.page_url || 'NO_TITLE',
    url: a.page_url || a.url || ''
  }));
  currentMap.set(query, articles);
});

// Compare
const differences = [];
let totalCompared = 0;
let articlesChanged = 0;

baselineMap.forEach((baselineArticles, query) => {
  const currentArticles = currentMap.get(query);
  if (!currentArticles) {
    differences.push({
      query,
      issue: 'Query not found in current results',
      baselineCount: baselineArticles.length,
      currentCount: 0
    });
    return;
  }

  totalCompared++;

  const baselineIds = new Set(baselineArticles.map(a => a.id));
  const currentIds = new Set(currentArticles.map(a => a.id));

  const added = currentArticles.filter(a => !baselineIds.has(a.id));
  const removed = baselineArticles.filter(a => !currentIds.has(a.id));
  const same = baselineArticles.filter(a => currentIds.has(a.id));

  if (added.length > 0 || removed.length > 0) {
    articlesChanged++;
    differences.push({
      query,
      baselineCount: baselineArticles.length,
      currentCount: currentArticles.length,
      sameCount: same.length,
      added: added.map(a => ({ id: a.id, title: a.title })),
      removed: removed.map(a => ({ id: a.id, title: a.title }))
    });
  }
});

// Report
console.log('📊 ARTICLE COMPARISON RESULTS');
console.log('='.repeat(80));
console.log(`Total queries compared: ${totalCompared}`);
console.log(`Queries with article changes: ${articlesChanged}`);
console.log(`Queries unchanged: ${totalCompared - articlesChanged}\n`);

if (differences.length > 0) {
  console.log('🔍 QUERIES WITH ARTICLE CHANGES:');
  console.log('='.repeat(80));
  
  differences.forEach((diff, idx) => {
    console.log(`\n${idx + 1}. "${diff.query}"`);
    console.log(`   Baseline: ${diff.baselineCount} articles | Current: ${diff.currentCount} articles | Same: ${diff.sameCount}`);
    
    if (diff.removed && diff.removed.length > 0) {
      console.log(`   ❌ Removed (${diff.removed.length}):`);
      diff.removed.slice(0, 5).forEach(a => {
        console.log(`      - [${a.id}] ${a.title.substring(0, 60)}`);
      });
      if (diff.removed.length > 5) {
        console.log(`      ... and ${diff.removed.length - 5} more`);
      }
    }
    
    if (diff.added && diff.added.length > 0) {
      console.log(`   ✅ Added (${diff.added.length}):`);
      diff.added.slice(0, 5).forEach(a => {
        console.log(`      + [${a.id}] ${a.title.substring(0, 60)}`);
      });
      if (diff.added.length > 5) {
        console.log(`      ... and ${diff.added.length - 5} more`);
      }
    }
  });
  
  // Summary by query type
  console.log('\n📈 SUMMARY BY QUERY TYPE:');
  console.log('='.repeat(80));
  
  const tripodQueries = differences.filter(d => d.query.includes('tripod'));
  const equipmentQueries = differences.filter(d => 
    d.query.includes('tripod') || d.query.includes('camera') || d.query.includes('lens') || 
    d.query.includes('equipment') || d.query.includes('gear')
  );
  const otherQueries = differences.filter(d => !equipmentQueries.includes(d));
  
  console.log(`Equipment queries with changes: ${equipmentQueries.length}`);
  console.log(`Other queries with changes: ${otherQueries.length}`);
  
  if (tripodQueries.length > 0) {
    console.log(`\n🎯 Tripod queries affected: ${tripodQueries.length}`);
    tripodQueries.forEach(d => {
      console.log(`   - "${d.query}" (${d.baselineCount} → ${d.currentCount} articles)`);
    });
  }
} else {
  console.log('✅ No article changes detected - all queries return the same articles!');
}

// Save detailed comparison
const outputPath = path.join(resultsDir, `article-comparison-${Date.now()}.json`);
fs.writeFileSync(outputPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  baseline: path.basename(baselinePath),
  current: path.basename(currentPath),
  summary: {
    totalCompared,
    articlesChanged,
    unchanged: totalCompared - articlesChanged
  },
  differences
}, null, 2));

console.log(`\n💾 Detailed comparison saved to: ${outputPath}`);





