const fs = require('fs');

// Load canonical list
const canonicalData = JSON.parse(fs.readFileSync('testing-scripts/canonical-64q-questions.json', 'utf8'));

// Extract just the question strings
const questions = canonicalData.questions.map(q => q.question);

console.log('// Canonical 64Q questions (extracted from canonical-64q-questions.json)');
console.log('const QUERIES = [');
questions.forEach((q, i) => {
  const comma = i < questions.length - 1 ? ',' : '';
  // Escape quotes in the question
  const escaped = q.replace(/"/g, '\\"');
  console.log(`  "${escaped}"${comma}`);
});
console.log('];');
console.log('');
console.log(`// Total: ${questions.length} questions`);

