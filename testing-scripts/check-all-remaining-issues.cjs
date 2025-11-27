const fs = require('fs');

// Load canonical 68Q list
const canonicalData = JSON.parse(fs.readFileSync('testing-scripts/canonical-64q-questions.json', 'utf8'));
const canonicalQuestions = canonicalData.questions.map(q => q.question.toLowerCase().trim());

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
        i++;
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

// Load question mapping
const mapping = JSON.parse(fs.readFileSync('testing-scripts/question-mapping.json', 'utf8'));

// Parse all questions (main 40 only)
const allIssues = [];
dataLines.slice(0, 40).forEach((line, idx) => {
  if (!line.trim()) return;
  
  const cols = parseCSVLine(line);
  if (cols.length < 5) return;
  
  const question = cols[0].replace(/^"|"$/g, '');
  const relatedScore = parseInt(cols[4]) || 0;
  const botScore = parseInt(cols[2]) || 0;
  const relatedNotes = cols[5] || '';
  const botNotes = cols[3] || '';
  const category = cols[7] || '';
  
  // Map to canonical
  const canonicalQ = mapping.interactive_to_canonical[question] || question;
  const isInCanonical = canonicalQuestions.includes(canonicalQ.toLowerCase().trim());
  
  if (botScore < 100 || relatedScore < 100) {
    allIssues.push({
      originalQuestion: question,
      canonicalQuestion: canonicalQ,
      isInCanonical68Q: isInCanonical,
      botScore,
      relatedScore,
      botNotes,
      relatedNotes,
      category,
      index: idx + 1
    });
  }
});

// Categorize issues
const batch2Related = allIssues.filter(i => i.isInCanonical68Q && i.relatedScore < 100);
const batch2Bot = allIssues.filter(i => i.isInCanonical68Q && i.botScore < 100 && i.relatedScore >= 100);
const batch2Both = allIssues.filter(i => i.isInCanonical68Q && i.botScore < 100 && i.relatedScore < 100);
const notIn68Q = allIssues.filter(i => !i.isInCanonical68Q);

// Check which canonical questions weren't tested in interactive testing
const testedCanonical = new Set();
allIssues.forEach(i => {
  if (i.isInCanonical68Q) {
    testedCanonical.add(i.canonicalQuestion.toLowerCase().trim());
  }
});

const untestedIn68Q = canonicalData.questions.filter(q => 
  !testedCanonical.has(q.question.toLowerCase().trim())
);

console.log('='.repeat(80));
console.log('COMPREHENSIVE ISSUE ANALYSIS');
console.log('='.repeat(80));

console.log(`\n📊 Total issues found: ${allIssues.length}`);
console.log(`   In 68Q canonical list: ${allIssues.filter(i => i.isInCanonical68Q).length}`);
console.log(`   Not in 68Q list: ${notIn68Q.length}`);

console.log(`\n📋 BATCH 2 Breakdown:`);
console.log(`   Related Score < 100: ${batch2Related.length}`);
console.log(`   Bot Score < 100 (Related OK): ${batch2Bot.length}`);
console.log(`   Both Bot & Related < 100: ${batch2Both.length}`);

if (batch2Bot.length > 0) {
  console.log(`\n⚠️  BATCH 2 - Bot Response Issues (Related OK):`);
  batch2Bot.forEach((issue, idx) => {
    console.log(`   ${idx + 1}. Q${issue.index}: "${issue.originalQuestion}"`);
    console.log(`      Bot Score: ${issue.botScore}, Related: ${issue.relatedScore}`);
    console.log(`      Bot Notes: ${issue.botNotes || '(none)'}`);
    console.log('');
  });
}

if (batch2Both.length > 0) {
  console.log(`\n⚠️  BATCH 2 - Both Bot & Related Issues:`);
  batch2Both.forEach((issue, idx) => {
    console.log(`   ${idx + 1}. Q${issue.index}: "${issue.originalQuestion}"`);
    console.log(`      Bot Score: ${issue.botScore}, Related: ${issue.relatedScore}`);
    console.log(`      Bot Notes: ${issue.botNotes || '(none)'}`);
    console.log(`      Related Notes: ${issue.relatedNotes || '(none)'}`);
    console.log('');
  });
}

if (untestedIn68Q.length > 0) {
  console.log(`\n📝 Questions in 68Q canonical list NOT tested in interactive testing (${untestedIn68Q.length}):`);
  console.log(`   These are the 24 unique questions from the regression test that weren't in interactive testing.`);
  console.log(`   They should be tested separately or may need fixes based on regression test results.\n`);
  untestedIn68Q.slice(0, 10).forEach((q, idx) => {
    console.log(`   ${idx + 1}. "${q.question}" (${q.category})`);
  });
  if (untestedIn68Q.length > 10) {
    console.log(`   ... and ${untestedIn68Q.length - 10} more`);
  }
}

console.log(`\n✅ SUMMARY:`);
console.log(`   Batch 2 Related Issues: ${batch2Related.length}`);
console.log(`   Batch 2 Bot Issues: ${batch2Bot.length}`);
console.log(`   Batch 2 Both Issues: ${batch2Both.length}`);
console.log(`   Total Batch 2 Issues: ${batch2Related.length + batch2Bot.length + batch2Both.length}`);
console.log(`   Untested in 68Q: ${untestedIn68Q.length} (from regression test)`);

if (untestedIn68Q.length > 0) {
  console.log(`\n⚠️  NOTE: ${untestedIn68Q.length} questions in 68Q list were NOT in interactive testing.`);
  console.log(`   These need to be checked via regression test results or tested separately.`);
}

