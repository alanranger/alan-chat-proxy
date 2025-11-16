#!/usr/bin/env node
/**
 * Compare Nov 10 baseline vs Nov 15 current (after equipment filtering fix)
 */

const fs = require('fs');
const path = require('path');

const baselinePath = path.join(__dirname, 'test results', 'deployed-analytics-test-2025-11-10T22-57-04-965Z.json');
const currentPath = path.join(__dirname, 'test results', 'deployed-analytics-test-2025-11-15T16-17-22-761Z.json');

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));

console.log('📊 40Q REGRESSION TEST COMPARISON');
console.log('='.repeat(80));
console.log(`Baseline: ${path.basename(baselinePath)} (Nov 10)`);
console.log(`Current:  ${path.basename(currentPath)} (Nov 15 - After Equipment Filtering Fix)`);
console.log('='.repeat(80));

// Overall stats
console.log('\n📈 OVERALL STATS:');
console.log(`Success Rate: ${baseline.successfulTests}/${baseline.successfulTests} → ${current.successfulTests}/${current.successfulTests} ${baseline.successfulTests === current.successfulTests ? '✅' : '⚠️'}`);
console.log(`Avg Confidence: ${baseline.avgConfidence} → ${current.avgConfidence}`);

// Equipment-related queries
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
    const bArts = b.response?.structured?.articles?.length || b.response?.sources?.articles?.length || 0;
    const cArts = c.response?.structured?.articles?.length || c.response?.sources?.articles?.length || 0;
    
    const bTitles = (b.response?.structured?.articles || b.response?.sources?.articles || []).slice(0, 3).map(a => (a.title || a.name || '').substring(0, 60));
    const cTitles = (c.response?.structured?.articles || c.response?.sources?.articles || []).slice(0, 3).map(a => (a.title || a.name || '').substring(0, 60));
    
    // Check for landscape articles in results
    const bHasLandscape = bTitles.some(t => t.toLowerCase().includes('landscape') && !t.toLowerCase().includes('tripod'));
    const cHasLandscape = cTitles.some(t => t.toLowerCase().includes('landscape') && !t.toLowerCase().includes('tripod'));
    
    console.log(`\n${q.toUpperCase()}:`);
    console.log(`  Query: "${b.query}"`);
    console.log(`  Articles: ${bArts} → ${cArts} ${cArts < bArts ? '📉' : cArts > bArts ? '📈' : '➡️'}`);
    console.log(`  Baseline top 3: ${bTitles.join('; ')}`);
    console.log(`  Current top 3:  ${cTitles.join('; ')}`);
    console.log(`  Landscape articles removed: ${bHasLandscape && !cHasLandscape ? '✅ YES' : bHasLandscape && cHasLandscape ? '❌ Still present' : 'N/A'}`);
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
    const bArts = b.response?.structured?.articles?.length || b.response?.sources?.articles?.length || 0;
    const cArts = c.response?.structured?.articles?.length || c.response?.sources?.articles?.length || 0;
    
    console.log(`\n${q.toUpperCase()}:`);
    console.log(`  Query: "${b.query}"`);
    console.log(`  Articles: ${bArts} → ${cArts} ${cArts < bArts ? '📉' : cArts > bArts ? '📈' : '➡️'}`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('✅ Comparison complete!');





