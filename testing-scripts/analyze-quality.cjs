#!/usr/bin/env node
/**
 * Quality-focused analysis of responses and related information
 * Measures QUALITY, not just quantity
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

console.log('\n📊 QUALITY ANALYSIS - Responses & Related Information');
console.log('='.repeat(80));

// Parse response data
const parsedResults = results.map(r => {
  const resp = r.response || {};
  const sources = resp.sources || {};
  const structured = resp.structured || {};
  
  // Extract related information from both sources and structured
  const articles = (structured.articles && Array.isArray(structured.articles) && structured.articles.length > 0)
    ? structured.articles
    : (sources.articles && Array.isArray(sources.articles) && sources.articles.length > 0)
      ? sources.articles
      : [];
      
  const services = (structured.services && Array.isArray(structured.services) && structured.services.length > 0)
    ? structured.services
    : (sources.services && Array.isArray(sources.services) && sources.services.length > 0)
      ? sources.services
      : [];
      
  const events = (structured.events && Array.isArray(structured.events) && structured.events.length > 0)
    ? structured.events
    : (sources.events && Array.isArray(sources.events) && sources.events.length > 0)
      ? sources.events
      : [];
      
  const products = (structured.products && Array.isArray(structured.products) && structured.products.length > 0)
    ? structured.products
    : (sources.products && Array.isArray(sources.products) && sources.products.length > 0)
      ? sources.products
      : [];
  
  return {
    query: r.query,
    answer: resp.answer || '',
    confidence: resp.confidence || 0,
    type: resp.type || 'unknown',
    articles,
    services,
    events,
    products,
    hasRelatedInfo: articles.length > 0 || services.length > 0 || events.length > 0 || products.length > 0,
    relatedInfoCount: articles.length + services.length + events.length + products.length,
    relatedInfoTypes: [
      articles.length > 0 ? 'articles' : null,
      services.length > 0 ? 'services' : null,
      events.length > 0 ? 'events' : null,
      products.length > 0 ? 'products' : null
    ].filter(Boolean)
  };
});

const total = parsedResults.length;

// ============================================================================
// QUALITY METRICS - Related Information Coverage
// ============================================================================

console.log('\n📈 RELATED INFORMATION COVERAGE (Quality Metrics):');
console.log('-'.repeat(80));

const withRelatedInfo = parsedResults.filter(r => r.hasRelatedInfo);
const withoutRelatedInfo = parsedResults.filter(r => !r.hasRelatedInfo);

console.log(`\n✅ Responses WITH related information: ${withRelatedInfo.length}/${total} (${(withRelatedInfo.length/total*100).toFixed(1)}%)`);
console.log(`❌ Responses WITHOUT related information: ${withoutRelatedInfo.length}/${total} (${(withoutRelatedInfo.length/total*100).toFixed(1)}%)`);

// Related info type distribution
const articlesCount = parsedResults.filter(r => r.articles.length > 0).length;
const servicesCount = parsedResults.filter(r => r.services.length > 0).length;
const eventsCount = parsedResults.filter(r => r.events.length > 0).length;
const productsCount = parsedResults.filter(r => r.products.length > 0).length;

console.log(`\n📊 Related Information Type Distribution:`);
console.log(`  Articles: ${articlesCount} responses (${(articlesCount/total*100).toFixed(1)}%)`);
console.log(`  Services: ${servicesCount} responses (${(servicesCount/total*100).toFixed(1)}%)`);
console.log(`  Events: ${eventsCount} responses (${(eventsCount/total*100).toFixed(1)}%)`);
console.log(`  Products: ${productsCount} responses (${(productsCount/total*100).toFixed(1)}%)`);

// Diversity: How many response types have multiple types of related info
const multiTypeRelated = parsedResults.filter(r => r.relatedInfoTypes.length > 1).length;
console.log(`\n🎯 Related Information Diversity:`);
console.log(`  Responses with MULTIPLE types of related info: ${multiTypeRelated} (${(multiTypeRelated/total*100).toFixed(1)}%)`);
console.log(`  Responses with SINGLE type of related info: ${withRelatedInfo.length - multiTypeRelated} (${((withRelatedInfo.length - multiTypeRelated)/total*100).toFixed(1)}%)`);

// Average related info items per response
const avgRelatedItems = withRelatedInfo.length > 0
  ? withRelatedInfo.reduce((sum, r) => sum + r.relatedInfoCount, 0) / withRelatedInfo.length
  : 0;
console.log(`\n📦 Related Information Quantity:`);
console.log(`  Average items per response (WITH related info): ${avgRelatedItems.toFixed(1)}`);
console.log(`  Total items across all responses: ${parsedResults.reduce((sum, r) => sum + r.relatedInfoCount, 0)}`);

// ============================================================================
// QUALITY METRICS - Answer Quality (not just length)
// ============================================================================

console.log('\n📝 ANSWER QUALITY METRICS:');
console.log('-'.repeat(80));

// Answer length distribution (for context, not primary metric)
const shortAnswers = parsedResults.filter(r => r.answer.length < 100).length;
const mediumAnswers = parsedResults.filter(r => r.answer.length >= 100 && r.answer.length < 300).length;
const longAnswers = parsedResults.filter(r => r.answer.length >= 300).length;
const avgAnswerLength = parsedResults.reduce((sum, r) => sum + r.answer.length, 0) / total;

console.log(`\n📏 Answer Length (Context Only):`);
console.log(`  Average: ${Math.round(avgAnswerLength)} chars`);
console.log(`  Short (<100): ${shortAnswers} (${(shortAnswers/total*100).toFixed(1)}%)`);
console.log(`  Medium (100-300): ${mediumAnswers} (${(mediumAnswers/total*100).toFixed(1)}%)`);
console.log(`  Long (≥300): ${longAnswers} (${(longAnswers/total*100).toFixed(1)}%)`);

// Answer quality indicators
const hasQuestionMark = parsedResults.filter(r => r.answer.includes('?')).length;
const hasLinks = parsedResults.filter(r => r.answer.includes('http') || r.answer.includes('www.')).length;
const hasDetails = parsedResults.filter(r => r.answer.includes(':') || r.answer.includes('-')).length;
const hasNumbers = parsedResults.filter(r => /\d/.test(r.answer)).length;

console.log(`\n✅ Answer Quality Indicators:`);
console.log(`  Contains questions/clarifications: ${hasQuestionMark} (${(hasQuestionMark/total*100).toFixed(1)}%)`);
console.log(`  Contains links: ${hasLinks} (${(hasLinks/total*100).toFixed(1)}%)`);
console.log(`  Contains structured details: ${hasDetails} (${(hasDetails/total*100).toFixed(1)}%)`);
console.log(`  Contains numbers/data: ${hasNumbers} (${(hasNumbers/total*100).toFixed(1)}%)`);

// Confidence distribution
const highConfidence = parsedResults.filter(r => r.confidence >= 0.8).length;
const mediumConfidence = parsedResults.filter(r => r.confidence >= 0.5 && r.confidence < 0.8).length;
const lowConfidence = parsedResults.filter(r => r.confidence < 0.5).length;
const avgConfidence = parsedResults.reduce((sum, r) => sum + r.confidence, 0) / total;

console.log(`\n🎯 Confidence Distribution:`);
console.log(`  Average: ${(avgConfidence * 100).toFixed(1)}%`);
console.log(`  High (≥80%): ${highConfidence} (${(highConfidence/total*100).toFixed(1)}%)`);
console.log(`  Medium (50-79%): ${mediumConfidence} (${(mediumConfidence/total*100).toFixed(1)}%)`);
console.log(`  Low (<50%): ${lowConfidence} (${(lowConfidence/total*100).toFixed(1)}%)`);

// ============================================================================
// QUALITY METRICS - Correlation Analysis
// ============================================================================

console.log('\n🔗 QUALITY CORRELATIONS:');
console.log('-'.repeat(80));

// Correlation: Related info vs Confidence
const avgConfidenceWithRelated = withRelatedInfo.length > 0
  ? withRelatedInfo.reduce((sum, r) => sum + r.confidence, 0) / withRelatedInfo.length
  : 0;
const avgConfidenceWithoutRelated = withoutRelatedInfo.length > 0
  ? withoutRelatedInfo.reduce((sum, r) => sum + r.confidence, 0) / withoutRelatedInfo.length
  : 0;

console.log(`\n📊 Related Info vs Confidence:`);
console.log(`  WITH related info: ${(avgConfidenceWithRelated * 100).toFixed(1)}% avg confidence`);
console.log(`  WITHOUT related info: ${(avgConfidenceWithoutRelated * 100).toFixed(1)}% avg confidence`);
console.log(`  Difference: ${((avgConfidenceWithRelated - avgConfidenceWithoutRelated) * 100).toFixed(1)} percentage points`);

// Correlation: Related info vs Response Type
console.log(`\n📊 Related Info Coverage by Response Type:`);
const typeGroups = {};
parsedResults.forEach(r => {
  if (!typeGroups[r.type]) {
    typeGroups[r.type] = { total: 0, withRelated: 0 };
  }
  typeGroups[r.type].total++;
  if (r.hasRelatedInfo) {
    typeGroups[r.type].withRelated++;
  }
});

Object.entries(typeGroups).sort((a, b) => b[1].total - a[1].total).forEach(([type, stats]) => {
  const coverage = (stats.withRelated / stats.total * 100).toFixed(1);
  console.log(`  ${type}: ${stats.withRelated}/${stats.total} (${coverage}%)`);
});

// ============================================================================
// QUALITY METRICS - Response Type Analysis
// ============================================================================

console.log('\n📋 RESPONSE TYPE ANALYSIS:');
console.log('-'.repeat(80));

const typeCounts = {};
parsedResults.forEach(r => {
  typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
});

Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
  const typeResponses = parsedResults.filter(r => r.type === type);
  const withRelated = typeResponses.filter(r => r.hasRelatedInfo).length;
  const avgConf = typeResponses.reduce((sum, r) => sum + r.confidence, 0) / typeResponses.length;
  
  console.log(`\n  ${type}:`);
  console.log(`    Count: ${count} (${(count/total*100).toFixed(1)}%)`);
  console.log(`    Related Info Coverage: ${withRelated}/${count} (${(withRelated/count*100).toFixed(1)}%)`);
  console.log(`    Avg Confidence: ${(avgConf * 100).toFixed(1)}%`);
  
  const relatedTypes = {};
  typeResponses.forEach(r => {
    r.relatedInfoTypes.forEach(t => {
      relatedTypes[t] = (relatedTypes[t] || 0) + 1;
    });
  });
  
  if (Object.keys(relatedTypes).length > 0) {
    console.log(`    Related Info Types: ${Object.entries(relatedTypes).map(([t, c]) => `${t}(${c})`).join(', ')}`);
  }
});

// ============================================================================
// QUALITY METRICS - Sample Responses
// ============================================================================

console.log('\n\n🌟 HIGH QUALITY RESPONSES (with related info):');
console.log('='.repeat(80));

const highQualityResponses = parsedResults
  .filter(r => r.hasRelatedInfo && r.confidence >= 0.7)
  .sort((a, b) => b.relatedInfoCount - a.relatedInfoCount)
  .slice(0, 10);

highQualityResponses.forEach((r, i) => {
  console.log(`\n${i+1}. "${r.query.substring(0, 60)}${r.query.length > 60 ? '...' : ''}"`);
  console.log(`   Type: ${r.type}, Confidence: ${(r.confidence * 100).toFixed(1)}%`);
  console.log(`   Related Info: ${r.relatedInfoCount} items (${r.relatedInfoTypes.join(', ')})`);
  console.log(`   Breakdown: Articles(${r.articles.length}), Services(${r.services.length}), Events(${r.events.length}), Products(${r.products.length})`);
});

console.log('\n\n⚠️  RESPONSES NEEDING IMPROVEMENT (no related info, high confidence):');
console.log('='.repeat(80));

const needsImprovement = parsedResults
  .filter(r => !r.hasRelatedInfo && r.confidence >= 0.7)
  .sort((a, b) => b.confidence - a.confidence)
  .slice(0, 10);

needsImprovement.forEach((r, i) => {
  console.log(`\n${i+1}. "${r.query.substring(0, 60)}${r.query.length > 60 ? '...' : ''}"`);
  console.log(`   Type: ${r.type}, Confidence: ${(r.confidence * 100).toFixed(1)}%`);
  console.log(`   Answer Length: ${r.answer.length} chars`);
});

// ============================================================================
// SUMMARY SCORES
// ============================================================================

console.log('\n\n📊 OVERALL QUALITY SCORES:');
console.log('='.repeat(80));

const coverageScore = (withRelatedInfo.length / total) * 100;
const diversityScore = (multiTypeRelated / total) * 100;
const confidenceScore = avgConfidence * 100;
const completenessScore = (articlesCount + servicesCount + eventsCount + productsCount) / (total * 4) * 100;

console.log(`\n✅ Related Information Coverage: ${coverageScore.toFixed(1)}%`);
console.log(`🎯 Related Information Diversity: ${diversityScore.toFixed(1)}%`);
console.log(`📈 Average Confidence: ${confidenceScore.toFixed(1)}%`);
console.log(`📦 Content Completeness: ${completenessScore.toFixed(1)}%`);

const overallQualityScore = (
  coverageScore * 0.4 +      // 40% weight on coverage
  diversityScore * 0.2 +      // 20% weight on diversity
  confidenceScore * 0.3 +     // 30% weight on confidence
  completenessScore * 0.1     // 10% weight on completeness
).toFixed(1);

console.log(`\n🏆 OVERALL QUALITY SCORE: ${overallQualityScore}%`);
console.log(`\n   (Weighted: Coverage 40%, Diversity 20%, Confidence 30%, Completeness 10%)`);

console.log('\n' + '='.repeat(80));
console.log('✅ Quality analysis complete!');

