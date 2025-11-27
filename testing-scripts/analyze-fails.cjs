const fs = require('fs');

const csv = fs.readFileSync('results/interactive-test-results-2025-11-27.csv', 'utf8');
const lines = csv.split('\n').slice(1, 42); // First 40 questions (rows 2-41)

const questions = lines.map((line, idx) => {
  // Parse CSV line - handle quoted fields
  const cols = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cols.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cols.push(current.trim());
  
  return {
    q: idx + 1,
    question: cols[0] || '',
    status: cols[1] || '',
    botScore: parseInt(cols[2]) || 0,
    relatedScore: parseInt(cols[4]) || 0
  };
});

// Find questions that fail on BOTH scores (both < 70)
const failsBoth = questions.filter(r => 
  r.status === 'Fail' && r.botScore < 70 && r.relatedScore < 70
);

console.log('Questions failing on BOTH scores (both < 70):\n');
failsBoth.forEach(f => {
  console.log(`Q${f.q}: "${f.question}"`);
  console.log(`   Bot Response: ${f.botScore}, Related: ${f.relatedScore}`);
  console.log('');
});

console.log(`\nTotal: ${failsBoth.length} questions`);

// Also show all fails for context
const allFails = questions.filter(r => r.status === 'Fail');
console.log(`\nTotal Fail questions: ${allFails.length}`);
console.log(`\nBreakdown:`);
console.log(`- Both scores < 70: ${failsBoth.length}`);
console.log(`- Only Bot Response < 70: ${allFails.filter(f => f.botScore < 70 && f.relatedScore >= 70).length}`);
console.log(`- Only Related < 70: ${allFails.filter(f => f.botScore >= 70 && f.relatedScore < 70).length}`);

