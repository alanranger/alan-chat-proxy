#!/usr/bin/env node
/**
 * Analyze related information enrichment issues
 */

const fs = require('fs');
const path = require('path');

// Find the latest test results file
const testResultsDir = path.join(__dirname, 'test results');
const files = fs.readdirSync(testResultsDir)
  .filter(f => f.startsWith('deployed-430-analytics-test-') && f.endsWith('.json'))
  .sort()
  .reverse();
const testResultsFile = path.join(testResultsDir, files[0]);
console.log(`📄 Using test results file: ${files[0]}`);

const data = JSON.parse(fs.readFileSync(testResultsFile, 'utf8'));
const results = data.results || [];

console.log('\n🔍 ANALYZING RELATED INFORMATION ENRICHMENT ISSUES');
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
    structured: resp.structured || {},
    success: resp.success !== false
  };
});

// Analyze responses without related information
const noRelatedInfo = parsedResults.filter(r => {
  const sources = r.sources || {};
  const structured = r.structured || {};
  
  const hasArticles = (sources.articles && Array.isArray(sources.articles) && sources.articles.length > 0) ||
                      (structured.articles && Array.isArray(structured.articles) && structured.articles.length > 0);
  const hasServices = (sources.services && Array.isArray(sources.services) && sources.services.length > 0) ||
                      (structured.services && Array.isArray(structured.services) && structured.services.length > 0);
  const hasEvents = (sources.events && Array.isArray(sources.events) && sources.events.length > 0) ||
                    (structured.events && Array.isArray(structured.events) && structured.events.length > 0);
  const hasProducts = (sources.products && Array.isArray(sources.products) && sources.products.length > 0) ||
                      (structured.products && Array.isArray(structured.products) && structured.products.length > 0);
  return !hasArticles && !hasServices && !hasEvents && !hasProducts;
});

console.log(`\n📊 Total Responses: ${parsedResults.length}`);
console.log(`❌ Responses WITHOUT related information: ${noRelatedInfo.length} (${(noRelatedInfo.length/parsedResults.length*100).toFixed(1)}%)`);

// Analyze what's missing
console.log('\n📋 ANALYSIS OF MISSING RELATED INFO:');
noRelatedInfo.forEach((r, i) => {
  if (i >= 20) return; // Limit to first 20
  
  const sources = r.sources || {};
  const structured = r.structured || {};
  
  const hasSourcesObj = Object.keys(sources).length > 0;
  const hasStructuredObj = Object.keys(structured).length > 0;
  
  console.log(`\n${i+1}. "${r.query.substring(0, 70)}${r.query.length > 70 ? '...' : ''}"`);
  console.log(`   Type: ${r.type}, Confidence: ${(r.confidence * 100).toFixed(1)}%`);
  
  if (hasSourcesObj) {
    console.log(`   ⚠️  sources object exists:`, Object.keys(sources).join(', '));
    Object.keys(sources).forEach(key => {
      const arr = sources[key];
      if (Array.isArray(arr)) {
        console.log(`      - ${key}: ${arr.length} items`);
      } else {
        console.log(`      - ${key}: ${typeof arr}`);
      }
    });
  } else {
    console.log(`   ⚠️  No sources object`);
  }
  
  if (hasStructuredObj) {
    console.log(`   ⚠️  structured object exists:`, Object.keys(structured).join(', '));
    Object.keys(structured).forEach(key => {
      const arr = structured[key];
      if (Array.isArray(arr)) {
        console.log(`      - ${key}: ${arr.length} items`);
      } else {
        console.log(`      - ${key}: ${typeof arr}`);
      }
    });
  } else {
    console.log(`   ⚠️  No structured object`);
  }
});

// Check structure of responses WITH related info for comparison
const withRelatedInfo = parsedResults.filter(r => {
  const sources = r.sources || {};
  const structured = r.structured || {};
  
  const hasArticles = (sources.articles && Array.isArray(sources.articles) && sources.articles.length > 0) ||
                      (structured.articles && Array.isArray(structured.articles) && structured.articles.length > 0);
  const hasServices = (sources.services && Array.isArray(sources.services) && sources.services.length > 0) ||
                      (structured.services && Array.isArray(structured.services) && structured.services.length > 0);
  const hasEvents = (sources.events && Array.isArray(sources.events) && sources.events.length > 0) ||
                    (structured.events && Array.isArray(structured.events) && structured.events.length > 0);
  const hasProducts = (sources.products && Array.isArray(sources.products) && sources.products.length > 0) ||
                      (structured.products && Array.isArray(structured.products) && structured.products.length > 0);
  return hasArticles || hasServices || hasEvents || hasProducts;
}).slice(0, 5);

console.log('\n\n✅ SAMPLE RESPONSES WITH RELATED INFO (for comparison):');
withRelatedInfo.forEach((r, i) => {
  console.log(`\n${i+1}. "${r.query.substring(0, 70)}${r.query.length > 70 ? '...' : ''}"`);
  const sources = r.sources || {};
  const structured = r.structured || {};
  
  console.log(`   sources:`, Object.keys(sources).join(', '));
  console.log(`   structured:`, Object.keys(structured).join(', '));
  
  if (sources.articles && Array.isArray(sources.articles)) console.log(`   - sources.articles: ${sources.articles.length}`);
  if (structured.articles && Array.isArray(structured.articles)) console.log(`   - structured.articles: ${structured.articles.length}`);
  if (sources.services && Array.isArray(sources.services)) console.log(`   - sources.services: ${sources.services.length}`);
  if (structured.services && Array.isArray(structured.services)) console.log(`   - structured.services: ${structured.services.length}`);
  if (sources.events && Array.isArray(sources.events)) console.log(`   - sources.events: ${sources.events.length}`);
  if (structured.events && Array.isArray(structured.events)) console.log(`   - structured.events: ${structured.events.length}`);
});

console.log('\n' + '='.repeat(80));
console.log('✅ Analysis complete!');

