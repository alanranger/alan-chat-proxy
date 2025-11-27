const fs = require('fs');
const path = require('path');

// Load canonical 68Q list
const canonicalData = JSON.parse(fs.readFileSync('testing-scripts/canonical-64q-questions.json', 'utf8'));
const canonicalQuestions = canonicalData.questions.map(q => q.question.toLowerCase().trim());

// Load question mapping
const mapping = JSON.parse(fs.readFileSync('testing-scripts/question-mapping.json', 'utf8'));

// Parse CSV
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Read CSV
const csvPath = 'results/interactive-test-results-2025-11-27.csv';
const csvContent = fs.readFileSync(csvPath, 'utf8');
const lines = csvContent.split('\n').filter(l => l.trim());

// Skip header
const dataLines = lines.slice(1);

// Parse questions with Related Score < 100
const issues = [];
dataLines.forEach((line, idx) => {
  if (!line.trim()) return;
  
  const cols = parseCSVLine(line);
  if (cols.length < 5) return;
  
  const question = cols[0].replace(/^"|"$/g, ''); // Remove quotes
  const relatedScore = parseInt(cols[4]) || 0;
  const relatedNotes = cols[5] || '';
  const botScore = parseInt(cols[2]) || 0;
  const botNotes = cols[3] || '';
  const category = cols[7] || '';
  
  // Only include main 40 questions (rows 2-41, indices 0-39)
  if (idx >= 40) return;
  
  if (relatedScore < 100) {
    // Map to canonical question
    const canonicalQ = mapping.interactive_to_canonical[question] || question;
    const isInCanonical = canonicalQuestions.includes(canonicalQ.toLowerCase().trim());
    
    issues.push({
      originalQuestion: question,
      canonicalQuestion: canonicalQ,
      isInCanonical68Q: isInCanonical,
      relatedScore,
      relatedNotes,
      botScore,
      botNotes,
      category,
      index: idx + 1
    });
  }
});

// Separate into batch 2 (in 68Q) and others
const batch2 = issues.filter(i => i.isInCanonical68Q);
const notIn68Q = issues.filter(i => !i.isInCanonical68Q);

console.log('='.repeat(80));
console.log('BATCH 2 ISSUES: Questions with Related Score < 100 in Canonical 68Q List');
console.log('='.repeat(80));
console.log(`\nTotal issues found: ${issues.length}`);
console.log(`In 68Q list (Batch 2): ${batch2.length}`);
console.log(`Not in 68Q list: ${notIn68Q.length}\n`);

if (batch2.length > 0) {
  console.log('\n📋 BATCH 2 - Issues to Fix (in 68Q canonical list):\n');
  batch2.forEach((issue, idx) => {
    console.log(`${idx + 1}. Q${issue.index}: "${issue.originalQuestion}"`);
    console.log(`   Related Score: ${issue.relatedScore}`);
    console.log(`   Bot Score: ${issue.botScore}`);
    console.log(`   Category: ${issue.category}`);
    console.log(`   Related Notes: ${issue.relatedNotes || '(none)'}`);
    if (issue.botNotes) {
      console.log(`   Bot Notes: ${issue.botNotes}`);
    }
    console.log(`   Canonical: "${issue.canonicalQuestion}"`);
    console.log('');
  });
}

if (notIn68Q.length > 0) {
  console.log('\n⚠️  Not in 68Q list (from old interactive test, not in canonical):\n');
  notIn68Q.forEach((issue, idx) => {
    console.log(`${idx + 1}. Q${issue.index}: "${issue.originalQuestion}"`);
    console.log(`   Related Score: ${issue.relatedScore}`);
    console.log('');
  });
}

// Summary by score range
console.log('\n📊 BATCH 2 Summary by Related Score:\n');
const byScore = {};
batch2.forEach(i => {
  const range = i.relatedScore < 50 ? '<50' : i.relatedScore < 70 ? '50-69' : '70-99';
  byScore[range] = (byScore[range] || 0) + 1;
});

Object.entries(byScore).sort().forEach(([range, count]) => {
  console.log(`   ${range}: ${count} questions`);
});

// Export for todo list
const batch2Summary = batch2.map(i => ({
  question: i.canonicalQuestion,
  relatedScore: i.relatedScore,
  botScore: i.botScore,
  relatedNotes: i.relatedNotes,
  botNotes: i.botNotes,
  category: i.category
}));

fs.writeFileSync(
  'testing-scripts/batch2-issues.json',
  JSON.stringify(batch2Summary, null, 2)
);

console.log('\n✅ Batch 2 issues exported to: testing-scripts/batch2-issues.json');

