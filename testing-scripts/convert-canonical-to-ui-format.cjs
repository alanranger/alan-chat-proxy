const fs = require('fs');

// Load canonical list
const canonicalData = JSON.parse(fs.readFileSync('testing-scripts/canonical-64q-questions.json', 'utf8'));

// Convert to interactive-testing.html format
const interactiveFormat = canonicalData.questions.map(q => ({
  category: q.category,
  question: q.question,
  focus: q.focus,
  expectedType: "advice"
}));

console.log('// Canonical 64Q questions for interactive-testing.html');
console.log('const testQuestions = [');
interactiveFormat.forEach((q, i) => {
  const comma = i < interactiveFormat.length - 1 ? ',' : '';
  console.log(`    {`);
  console.log(`        category: "${q.category}",`);
  console.log(`        question: ${JSON.stringify(q.question)},`);
  console.log(`        focus: "${q.focus}",`);
  console.log(`        expectedType: "${q.expectedType}"`);
  console.log(`    }${comma}`);
});
console.log('];');

// Also generate for regression-comparison.html
const regressionQueries = canonicalData.questions.map(q => q.question);
const regressionCategories = canonicalData.questions.map(q => q.category);

console.log('\n\n// For regression-comparison.html:');
console.log('const QUERIES = [');
regressionQueries.forEach((q, i) => {
  const comma = i < regressionQueries.length - 1 ? ',' : '';
  console.log(`  ${JSON.stringify(q)}${comma}`);
});
console.log('];');

console.log('\nconst QUERY_CATEGORIES = [');
regressionCategories.forEach((cat, i) => {
  const comma = i < regressionCategories.length - 1 ? ',' : '';
  console.log(`  ${JSON.stringify(cat)}${comma}`);
});
console.log('];');

