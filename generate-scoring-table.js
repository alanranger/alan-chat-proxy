const fs = require('fs');
const path = require('path');

// Find the latest results file
const files = fs.readdirSync('./results')
  .filter(f => f.startsWith('quality-benchmark-before-') && f.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b))
  .reverse();

const latestFile = files[0];
console.log(`Reading results from: ${latestFile}`);

const results = JSON.parse(fs.readFileSync(path.join('./results', latestFile), 'utf8'));

console.log('\n=== COMPREHENSIVE SCORING TABLE ===');
console.log('Question | API Conf | Quality | Band | Length | Articles | Events | Issues');
console.log('---------|----------|---------|------|--------|----------|--------|-------');

results.results.forEach(r => {
  const issues = r.quality.issues ? r.quality.issues.join(', ') : '';
  const question = r.query.length > 40 ? r.query.substring(0, 37) + '...' : r.query;
  console.log(`${question} | ${(r.quality.apiConfidence * 100).toFixed(1)}% | ${r.quality.overall}/100 | ${r.quality.band} | ${r.response.answer.length} | ${r.response.sources?.articles?.length || 0} | ${r.response.sources?.events?.length || 0} | ${issues}`);
});

console.log('\n=== SUMMARY STATISTICS ===');
const totalQuestions = results.results.length;
const avgConfidence = results.results.reduce((sum, r) => sum + (r.quality.apiConfidence * 100), 0) / totalQuestions;
const avgQuality = results.results.reduce((sum, r) => sum + r.quality.overall, 0) / totalQuestions;

console.log(`Total Questions: ${totalQuestions}`);
console.log(`Average API Confidence: ${avgConfidence.toFixed(1)}%`);
console.log(`Average Quality Score: ${avgQuality.toFixed(1)}/100`);

// Quality distribution
const bands = results.results.reduce((acc, r) => {
  acc[r.quality.band] = (acc[r.quality.band] || 0) + 1;
  return acc;
}, {});

console.log('\n=== QUALITY DISTRIBUTION ===');
Object.entries(bands).forEach(([band, count]) => {
  console.log(`${band}: ${count}/${totalQuestions} (${((count/totalQuestions)*100).toFixed(1)}%)`);
});


