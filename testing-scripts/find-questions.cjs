const fs = require('fs');
const path = require('path');

const baselinePath = path.join(__dirname, 'test results', 'baseline-40-question-interactive-subset-2025-11-02T09-16-08.122Z.json');
const data = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

console.log('All questions:');
data.results.forEach((r, i) => {
  console.log(`Q${i+1}: ${r.query}`);
});

