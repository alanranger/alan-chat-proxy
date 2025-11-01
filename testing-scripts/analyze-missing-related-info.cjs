#!/usr/bin/env node
/**
 * Analyze why responses lack related information
 */

const fs = require('fs');
const path = require('path');

const testResultsFile = path.join(__dirname, 'test results', 'deployed-430-analytics-test-2025-11-01T20-06-42-591Z.json');

const data = JSON.parse(fs.readFileSync(testResultsFile, 'utf8'));
const results = data.results || [];

console.log('\n🔍 ANALYZING WHY RESPONSES LACK RELATED INFORMATION');
console.log('='.repeat(80));

// Parse response data
const parsedResults = results.map(r => {
  const resp = r.response || {};
  return {
    query: r.query,
    answer: resp.answer || '',
    confidence: resp.confidence || 0,
    type: resp.type || 'unknown',
    sources: resp.sources || {},
    success: resp.success !== false
  };
});

// Analyze responses without related information
const noRelatedInfo = parsedResults.filter(r => {
  const sources = r.sources || {};
  const hasArticles = sources.articles && Array.isArray(sources.articles) && sources.articles.length > 0;
  const hasServices = sources.services && Array.isArray(sources.services) && sources.services.length > 0;
  const hasEvents = sources.events && Array.isArray(sources.events) && sources.events.length > 0;
  const hasProducts = sources.products && Array.isArray(sources.products) && sources.products.length > 0;
  return !hasArticles && !hasServices && !hasEvents && !hasProducts;
});

console.log(`\n📊 Total Responses: ${parsedResults.length}`);
console.log(`❌ Responses WITHOUT related information: ${noRelatedInfo.length} (${(noRelatedInfo.length/parsedResults.length*100).toFixed(1)}%)`);

// Group by response type
const byType = {};
noRelatedInfo.forEach(r => {
  byType[r.type] = (byType[r.type] || 0) + 1;
});

console.log('\n📊 RESPONSES WITHOUT RELATED INFO BY TYPE:');
Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
  console.log(`  ${type}: ${count} (${(count/noRelatedInfo.length*100).toFixed(1)}%)`);
});

// Group by confidence level
const byConfidence = {
  high: noRelatedInfo.filter(r => r.confidence >= 0.8).length,
  medium: noRelatedInfo.filter(r => r.confidence >= 0.5 && r.confidence < 0.8).length,
  low: noRelatedInfo.filter(r => r.confidence < 0.5).length
};

console.log('\n📊 RESPONSES WITHOUT RELATED INFO BY CONFIDENCE:');
console.log(`  High (≥80%): ${byConfidence.high} (${(byConfidence.high/noRelatedInfo.length*100).toFixed(1)}%)`);
console.log(`  Medium (50-79%): ${byConfidence.medium} (${(byConfidence.medium/noRelatedInfo.length*100).toFixed(1)}%)`);
console.log(`  Low (<50%): ${byConfidence.low} (${(byConfidence.low/noRelatedInfo.length*100).toFixed(1)}%)`);

// Sample questions without related info
console.log('\n📋 SAMPLE QUESTIONS WITHOUT RELATED INFORMATION:');
noRelatedInfo.slice(0, 15).forEach((r, i) => {
  console.log(`  ${i+1}. "${r.query.substring(0, 60)}${r.query.length > 60 ? '...' : ''}"`);
  console.log(`     Type: ${r.type}, Confidence: ${(r.confidence * 100).toFixed(1)}%, Answer: ${r.answer.length} chars`);
  
  // Check if sources object exists but is empty
  const sources = r.sources || {};
  const hasEmptySources = Object.keys(sources).length > 0 && 
    (!sources.articles || sources.articles.length === 0) &&
    (!sources.services || sources.services.length === 0) &&
    (!sources.events || sources.events.length === 0) &&
    (!sources.products || sources.products.length === 0);
  
  if (hasEmptySources) {
    console.log(`     ⚠️  Sources object exists but all arrays are empty`);
  } else if (Object.keys(sources).length === 0) {
    console.log(`     ⚠️  No sources object at all`);
  }
});

// Compare with responses that DO have related info
const withRelatedInfo = parsedResults.filter(r => {
  const sources = r.sources || {};
  const hasArticles = sources.articles && Array.isArray(sources.articles) && sources.articles.length > 0;
  const hasServices = sources.services && Array.isArray(sources.services) && sources.services.length > 0;
  const hasEvents = sources.events && Array.isArray(sources.events) && sources.events.length > 0;
  const hasProducts = sources.products && Array.isArray(sources.products) && sources.products.length > 0;
  return hasArticles || hasServices || hasEvents || hasProducts;
});

console.log('\n📊 COMPARISON:');
console.log(`  WITH related info: ${withRelatedInfo.length} (${(withRelatedInfo.length/parsedResults.length*100).toFixed(1)}%)`);
console.log(`  WITHOUT related info: ${noRelatedInfo.length} (${(noRelatedInfo.length/parsedResults.length*100).toFixed(1)}%)`);

const avgConfidenceWith = withRelatedInfo.reduce((sum, r) => sum + r.confidence, 0) / withRelatedInfo.length;
const avgConfidenceWithout = noRelatedInfo.reduce((sum, r) => sum + r.confidence, 0) / noRelatedInfo.length;

console.log(`\n📈 Average Confidence:`);
console.log(`  WITH related info: ${(avgConfidenceWith * 100).toFixed(1)}%`);
console.log(`  WITHOUT related info: ${(avgConfidenceWithout * 100).toFixed(1)}%`);

// Check answer length
const avgAnswerLengthWith = withRelatedInfo.reduce((sum, r) => sum + r.answer.length, 0) / withRelatedInfo.length;
const avgAnswerLengthWithout = noRelatedInfo.reduce((sum, r) => sum + r.answer.length, 0) / noRelatedInfo.length;

console.log(`\n📝 Average Answer Length:`);
console.log(`  WITH related info: ${Math.round(avgAnswerLengthWith)} chars`);
console.log(`  WITHOUT related info: ${Math.round(avgAnswerLengthWithout)} chars`);

console.log('\n' + '='.repeat(80));
console.log('✅ Analysis complete!');

