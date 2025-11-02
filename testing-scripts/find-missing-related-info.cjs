const fs = require('fs');
const path = require('path');

// Find latest test results file
const testResultsDir = path.join(__dirname, 'test results');
const files = fs.readdirSync(testResultsDir)
  .filter(f => f.includes('deployed-430-analytics-test') && f.endsWith('.json'))
  .sort()
  .reverse();

if (files.length === 0) {
  console.log('No test results found');
  process.exit(1);
}

const latestFile = path.join(testResultsDir, files[0]);
console.log(`Analyzing: ${files[0]}\n`);

const data = JSON.parse(fs.readFileSync(latestFile, 'utf8'));

// Find responses missing related info
const missing = data.results.filter(r => {
  const s = r.response?.structured || {};
  const hasArticles = s.articles && Array.isArray(s.articles) && s.articles.length > 0;
  const hasServices = s.services && Array.isArray(s.services) && s.services.length > 0;
  const hasEvents = s.events && Array.isArray(s.events) && s.events.length > 0;
  const hasProducts = s.products && Array.isArray(s.products) && s.products.length > 0;
  return !hasArticles && !hasServices && !hasEvents && !hasProducts;
});

console.log(`Questions missing related info (${missing.length} out of ${data.results.length}):`);
console.log('='.repeat(80));

missing.forEach((r, i) => {
  const type = r.response?.type || 'unknown';
  const confidence = r.response?.confidence || 0;
  const answerLength = (r.response?.answer || '').length;
  console.log(`${i+1}. "${r.query}"`);
  console.log(`   Type: ${type}, Confidence: ${(confidence*100).toFixed(1)}%, Answer Length: ${answerLength} chars`);
  console.log('');
});

console.log(`\nTotal: ${missing.length} questions (${(missing.length/data.results.length*100).toFixed(1)}%)`);

