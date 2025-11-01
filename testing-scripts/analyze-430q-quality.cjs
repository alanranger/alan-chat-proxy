#!/usr/bin/env node
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

console.log('\n📊 RESPONSE QUALITY ANALYSIS - 430 Question Test');
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

const total = parsedResults.length;
const withAnswers = parsedResults.filter(r => r.answer && r.answer.length > 0).length;
const avgAnswerLength = parsedResults.reduce((sum, r) => sum + (r.answer?.length || 0), 0) / total;
const avgConfidence = parsedResults.reduce((sum, r) => sum + (r.confidence || 0), 0) / total;

console.log('\n📈 OVERALL METRICS:');
console.log(`  Total Questions: ${total}`);
console.log(`  Questions with Answers: ${withAnswers} (${(withAnswers/total*100).toFixed(1)}%)`);
console.log(`  Average Answer Length: ${Math.round(avgAnswerLength)} chars`);
console.log(`  Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);

// Response type distribution
const typeCounts = {};
parsedResults.forEach(r => {
  typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
});

console.log('\n📊 RESPONSE TYPE DISTRIBUTION:');
Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
  console.log(`  ${type}: ${count} (${(count/total*100).toFixed(1)}%)`);
});

// Answer length distribution
const shortAnswers = parsedResults.filter(r => r.answer && r.answer.length < 100).length;
const mediumAnswers = parsedResults.filter(r => r.answer && r.answer.length >= 100 && r.answer.length < 300).length;
const longAnswers = parsedResults.filter(r => r.answer && r.answer.length >= 300).length;

console.log('\n📝 ANSWER LENGTH DISTRIBUTION:');
console.log(`  Short (< 100 chars): ${shortAnswers} (${(shortAnswers/total*100).toFixed(1)}%)`);
console.log(`  Medium (100-300 chars): ${mediumAnswers} (${(mediumAnswers/total*100).toFixed(1)}%)`);
console.log(`  Long (≥ 300 chars): ${longAnswers} (${(longAnswers/total*100).toFixed(1)}%)`);

// Confidence distribution
const highConfidence = parsedResults.filter(r => r.confidence >= 0.8).length;
const mediumConfidence = parsedResults.filter(r => r.confidence >= 0.5 && r.confidence < 0.8).length;
const lowConfidence = parsedResults.filter(r => r.confidence < 0.5).length;

console.log('\n🎯 CONFIDENCE DISTRIBUTION:');
console.log(`  High (≥ 80%): ${highConfidence} (${(highConfidence/total*100).toFixed(1)}%)`);
console.log(`  Medium (50-79%): ${mediumConfidence} (${(mediumConfidence/total*100).toFixed(1)}%)`);
console.log(`  Low (< 50%): ${lowConfidence} (${(lowConfidence/total*100).toFixed(1)}%)`);

// Related information analysis from sources
let withArticles = 0;
let withServices = 0;
let withEvents = 0;
let withProducts = 0;
let totalArticles = 0;
let totalServices = 0;
let totalEvents = 0;
let totalProducts = 0;

parsedResults.forEach(r => {
  const sources = r.sources || {};
  
  if (sources.articles && Array.isArray(sources.articles) && sources.articles.length > 0) {
    withArticles++;
    totalArticles += sources.articles.length;
  }
  if (sources.services && Array.isArray(sources.services) && sources.services.length > 0) {
    withServices++;
    totalServices += sources.services.length;
  }
  if (sources.events && Array.isArray(sources.events) && sources.events.length > 0) {
    withEvents++;
    totalEvents += sources.events.length;
  }
  if (sources.products && Array.isArray(sources.products) && sources.products.length > 0) {
    withProducts++;
    totalProducts += sources.products.length;
  }
});

console.log('\n🔗 RELATED INFORMATION ANALYSIS (from sources):');
console.log(`  Responses with Articles: ${withArticles} (${(withArticles/total*100).toFixed(1)}%)`);
console.log(`    Total Articles: ${totalArticles} (avg: ${withArticles > 0 ? (totalArticles/withArticles).toFixed(1) : 0} per response)`);
console.log(`  Responses with Services: ${withServices} (${(withServices/total*100).toFixed(1)}%)`);
console.log(`    Total Services: ${totalServices} (avg: ${withServices > 0 ? (totalServices/withServices).toFixed(1) : 0} per response)`);
console.log(`  Responses with Events: ${withEvents} (${(withEvents/total*100).toFixed(1)}%)`);
console.log(`    Total Events: ${totalEvents} (avg: ${withEvents > 0 ? (totalEvents/withEvents).toFixed(1) : 0} per response)`);
console.log(`  Responses with Products: ${withProducts} (${(withProducts/total*100).toFixed(1)}%)`);
console.log(`    Total Products: ${totalProducts} (avg: ${withProducts > 0 ? (totalProducts/withProducts).toFixed(1) : 0} per response)`);

// Responses without related information
const noRelatedInfo = parsedResults.filter(r => {
  const sources = r.sources || {};
  const hasArticles = sources.articles && Array.isArray(sources.articles) && sources.articles.length > 0;
  const hasServices = sources.services && Array.isArray(sources.services) && sources.services.length > 0;
  const hasEvents = sources.events && Array.isArray(sources.events) && sources.events.length > 0;
  const hasProducts = sources.products && Array.isArray(sources.products) && sources.products.length > 0;
  return !hasArticles && !hasServices && !hasEvents && !hasProducts;
}).length;

console.log('\n📊 RELATED INFORMATION COVERAGE:');
console.log(`  Responses WITHOUT related information: ${noRelatedInfo} (${(noRelatedInfo/total*100).toFixed(1)}%)`);
console.log(`  Responses WITH related information: ${total - noRelatedInfo} (${((total - noRelatedInfo)/total*100).toFixed(1)}%)`);

// Low confidence questions
const lowConfQuestions = parsedResults
  .filter(r => r.confidence < 0.5)
  .map(r => ({ question: r.query, confidence: (r.confidence * 100).toFixed(1) + '%', answerLength: r.answer?.length || 0, type: r.type }))
  .slice(0, 20);

if (lowConfQuestions.length > 0) {
  console.log('\n⚠️ LOW CONFIDENCE QUESTIONS (Top 20):');
  lowConfQuestions.forEach((q, i) => {
    console.log(`  ${i+1}. "${q.question.substring(0, 60)}${q.question.length > 60 ? '...' : ''}"`);
    console.log(`     Confidence: ${q.confidence}, Type: ${q.type}, Answer Length: ${q.answerLength} chars`);
  });
}

// Short answer questions
const shortAnswerQuestions = parsedResults
  .filter(r => r.answer && r.answer.length < 100)
  .map(r => ({ question: r.query, answerLength: r.answer.length, confidence: (r.confidence * 100).toFixed(1) + '%', type: r.type }))
  .slice(0, 20);

if (shortAnswerQuestions.length > 0) {
  console.log('\n📋 SHORT ANSWER QUESTIONS (< 100 chars, Top 20):');
  shortAnswerQuestions.forEach((q, i) => {
    console.log(`  ${i+1}. "${q.question.substring(0, 60)}${q.question.length > 60 ? '...' : ''}"`);
    console.log(`     Answer: ${q.answerLength} chars, Confidence: ${q.confidence}, Type: ${q.type}`);
  });
}

// Sample responses with rich related information
const richResponses = parsedResults
  .filter(r => {
    const sources = r.sources || {};
    const articleCount = sources.articles?.length || 0;
    const serviceCount = sources.services?.length || 0;
    const eventCount = sources.events?.length || 0;
    const productCount = sources.products?.length || 0;
    return (articleCount + serviceCount + eventCount + productCount) >= 3;
  })
  .slice(0, 10);

if (richResponses.length > 0) {
  console.log('\n🌟 SAMPLE RESPONSES WITH RICH RELATED INFORMATION (Top 10):');
  richResponses.forEach((r, i) => {
    const sources = r.sources || {};
    const articleCount = sources.articles?.length || 0;
    const serviceCount = sources.services?.length || 0;
    const eventCount = sources.events?.length || 0;
    const productCount = sources.products?.length || 0;
    console.log(`  ${i+1}. "${r.query.substring(0, 60)}${r.query.length > 60 ? '...' : ''}"`);
    console.log(`     Articles: ${articleCount}, Services: ${serviceCount}, Events: ${eventCount}, Products: ${productCount}`);
    console.log(`     Confidence: ${(r.confidence * 100).toFixed(1)}%, Answer: ${r.answer.length} chars`);
  });
}

console.log('\n' + '='.repeat(80));
console.log('✅ Analysis complete!');
console.log('\n💡 Note: This analysis is based on the test results file.');
console.log('   Check analytics.html to see if structured_response is stored in the database.');

