#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const testResultsFile = path.join(__dirname, 'test results', 'deployed-analytics-test-2025-11-01T18-52-02-403Z.json');

try {
  const data = JSON.parse(fs.readFileSync(testResultsFile, 'utf8'));
  const failed = data.results.filter(r => r.status === 500 || r.error);
  
  console.log('\n❌ FAILED QUESTIONS ANALYSIS');
  console.log('='.repeat(80));
  console.log(`Total Failed: ${failed.length}/40\n`);
  
  failed.forEach((f, i) => {
    console.log(`${i+1}. "${f.query}"`);
    console.log(`   Status: ${f.status || 'N/A'}`);
    console.log(`   Category: ${f.category || 'N/A'}`);
    console.log(`   Focus: ${f.focus || 'N/A'}`);
    if (f.error) {
      console.log(`   Error: ${f.error}`);
    }
    if (f.response && f.response.error) {
      console.log(`   Response Error: ${f.response.error}`);
    }
    console.log('');
  });
  
  console.log('\n💡 Common patterns in failed questions:');
  const patterns = {
    'services': failed.filter(f => f.query.toLowerCase().includes('service')).length,
    'free/course': failed.filter(f => f.query.toLowerCase().includes('free') || f.query.toLowerCase().includes('course')).length,
    'gallery/feedback': failed.filter(f => f.query.toLowerCase().includes('gallery') || f.query.toLowerCase().includes('feedback')).length,
    'location-based': failed.filter(f => f.query.toLowerCase().includes('coven') || f.query.toLowerCase().includes('devon')).length,
    'name search': failed.filter(f => f.query.toLowerCase().includes('peter') || f.query.toLowerCase().includes('orton')).length
  };
  
  Object.entries(patterns).forEach(([pattern, count]) => {
    if (count > 0) {
      console.log(`   - ${pattern}: ${count} failed`);
    }
  });
  
} catch (error) {
  console.error('Error reading test results:', error.message);
}

