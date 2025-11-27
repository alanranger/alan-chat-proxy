const fs = require('fs');

// Load canonical 68Q list
const canonicalData = JSON.parse(fs.readFileSync('testing-scripts/canonical-64q-questions.json', 'utf8'));
const canonicalQuestions = canonicalData.questions.map(q => ({
  question: q.question,
  category: q.category,
  id: q.id
}));

// Load question mapping
const mapping = JSON.parse(fs.readFileSync('testing-scripts/question-mapping.json', 'utf8'));

// Parse CSV from interactive testing
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

// Read interactive testing CSV
const csvPath = 'results/interactive-test-results-2025-11-27.csv';
const csvContent = fs.readFileSync(csvPath, 'utf8');
const lines = csvContent.split('\n').filter(l => l.trim());
const dataLines = lines.slice(1);

// Build map of interactive testing results
const interactiveResults = new Map();
dataLines.slice(0, 40).forEach((line, idx) => {
  if (!line.trim()) return;
  const cols = parseCSVLine(line);
  if (cols.length < 5) return;
  
  const question = cols[0].replace(/^"|"$/g, '');
  const botScore = parseInt(cols[2]) || 0;
  const relatedScore = parseInt(cols[4]) || 0;
  const botNotes = cols[3] || '';
  const relatedNotes = cols[5] || '';
  const category = cols[7] || '';
  
  // Map to canonical
  const canonicalQ = mapping.interactive_to_canonical[question] || question;
  interactiveResults.set(canonicalQ.toLowerCase().trim(), {
    question: canonicalQ,
    botScore,
    relatedScore,
    botNotes,
    relatedNotes,
    category,
    source: 'interactive',
    index: idx + 1
  });
});

// Create master list
const masterList = [];

canonicalQuestions.forEach((canonicalQ, idx) => {
  const key = canonicalQ.question.toLowerCase().trim();
  const interactive = interactiveResults.get(key);
  
  if (interactive) {
    // Has interactive testing data
    if (interactive.botScore < 100 || interactive.relatedScore < 100) {
      masterList.push({
        canonicalId: canonicalQ.id,
        question: canonicalQ.question,
        category: canonicalQ.category,
        source: 'interactive',
        botScore: interactive.botScore,
        relatedScore: interactive.relatedScore,
        botNotes: interactive.botNotes,
        relatedNotes: interactive.relatedNotes,
        priority: interactive.botScore < 50 || interactive.relatedScore < 50 ? 'HIGH' : 
                 interactive.botScore < 70 || interactive.relatedScore < 70 ? 'MEDIUM' : 'LOW',
        needsFix: true
      });
    } else {
      // Perfect score, no fix needed
      masterList.push({
        canonicalId: canonicalQ.id,
        question: canonicalQ.question,
        category: canonicalQ.category,
        source: 'interactive',
        botScore: interactive.botScore,
        relatedScore: interactive.relatedScore,
        needsFix: false,
        status: 'OK'
      });
    }
  } else {
    // No interactive testing data - needs regression test analysis
    masterList.push({
      canonicalId: canonicalQ.id,
      question: canonicalQ.question,
      category: canonicalQ.category,
      source: 'regression-only',
      needsFix: 'unknown',
      status: 'Needs regression test analysis'
    });
  }
});

// Separate into categories
const needsFix = masterList.filter(i => i.needsFix === true);
const needsAnalysis = masterList.filter(i => i.needsFix === 'unknown');
const ok = masterList.filter(i => i.needsFix === false);

// Sort by priority
needsFix.sort((a, b) => {
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  }
  const aMin = Math.min(a.botScore, a.relatedScore);
  const bMin = Math.min(b.botScore, b.relatedScore);
  return aMin - bMin;
});

console.log('='.repeat(80));
console.log('MASTER FIX LIST - All Issues with Testing Data');
console.log('='.repeat(80));

console.log(`\n📊 Summary:`);
console.log(`   Total questions in 68Q: ${masterList.length}`);
console.log(`   ✅ OK (no fixes needed): ${ok.length}`);
console.log(`   ⚠️  Needs Fix (has testing data): ${needsFix.length}`);
console.log(`   ❓ Needs Analysis (regression test only): ${needsAnalysis.length}`);

console.log(`\n📋 ISSUES TO FIX (${needsFix.length} total):\n`);

needsFix.forEach((issue, idx) => {
  console.log(`${idx + 1}. [${issue.priority}] Q${issue.canonicalId}: "${issue.question}"`);
  console.log(`   Category: ${issue.category}`);
  console.log(`   Bot Score: ${issue.botScore}, Related Score: ${issue.relatedScore}`);
  if (issue.botNotes) {
    console.log(`   Bot Issue: ${issue.botNotes}`);
  }
  if (issue.relatedNotes) {
    console.log(`   Related Issue: ${issue.relatedNotes}`);
  }
  console.log('');
});

// Group by priority
const highPriority = needsFix.filter(i => i.priority === 'HIGH');
const mediumPriority = needsFix.filter(i => i.priority === 'MEDIUM');
const lowPriority = needsFix.filter(i => i.priority === 'LOW');

console.log(`\n📊 By Priority:`);
console.log(`   HIGH: ${highPriority.length} issues`);
console.log(`   MEDIUM: ${mediumPriority.length} issues`);
console.log(`   LOW: ${lowPriority.length} issues`);

// Export JSON
const exportData = {
  summary: {
    total: masterList.length,
    ok: ok.length,
    needsFix: needsFix.length,
    needsAnalysis: needsAnalysis.length
  },
  issuesToFix: needsFix,
  needsAnalysis: needsAnalysis,
  ok: ok
};

fs.writeFileSync(
  'testing-scripts/master-fix-list.json',
  JSON.stringify(exportData, null, 2)
);

console.log(`\n✅ Master fix list exported to: testing-scripts/master-fix-list.json`);

