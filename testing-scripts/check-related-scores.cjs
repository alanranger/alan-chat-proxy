const fs = require('fs');

const csv = fs.readFileSync('results/interactive-test-results-2025-11-27.csv', 'utf8');
const allLines = csv.split('\n');
const lines = allLines.slice(1, 41); // First 40 questions (rows 2-41)

const questions = lines.map((line, idx) => {
  // Parse CSV line - handle quoted fields
  const cols = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    // Handle escaped quotes ("" inside quoted field)
    if (char === '"' && line[i + 1] === '"' && inQuotes) {
      current += '"';
      i++; // Skip next quote
    } else if (char === '"') {
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
    botNotes: cols[3] || '',
    relatedScore: parseInt(cols[4]) || 0,
    relatedNotes: cols[5] || '',
    otherNotes: cols[6] || ''
  };
});

// Find questions with Related Score < 100
const below100 = questions.filter(r => r.relatedScore < 100);

console.log('Questions with Related Score < 100:\n');
below100.forEach(f => {
  console.log(`Q${f.q}: "${f.question}"`);
  console.log(`   Related Score: ${f.relatedScore}`);
  if (f.relatedNotes) console.log(`   Notes: ${f.relatedNotes}`);
  console.log('');
});

console.log(`\nTotal: ${below100.length} questions scored below 100 on related information`);
console.log(`\nBreakdown by score:`);
const byScore = {};
below100.forEach(q => {
  byScore[q.relatedScore] = (byScore[q.relatedScore] || 0) + 1;
});
Object.keys(byScore).sort((a, b) => b - a).forEach(score => {
  console.log(`  ${score}: ${byScore[score]} question(s)`);
});

