// Script to populate the interactive testing dashboard with Alan's baseline scores
import fs from 'fs';

// Read the CSV file
const csvContent = fs.readFileSync('results/alan manual test of questions - 23 10 2025.csv', 'utf8');
const lines = csvContent.split('\n');

// Parse the CSV data
const baselineScores = {};

// Helper function to clean question text
function cleanQuestionText(question) {
  question = question.replace(/^"1\. ""/, '').replace(/""- Should.*$/, '').replace(/^"/, '').replace(/"$/, '').trim();
  
  if (question.includes('""')) {
    question = question.split('""')[0];
  }
  if (question.includes('')) {
    question = question.split('')[0];
  }
  
  return question;
}

// Helper function to extract confidence score from notes
function extractConfidenceScore(notes) {
  if (notes.includes('0.2%')) {
    return 0.2;
  } else if (notes.includes('should have higher confidence')) {
    return 85;
  } else if (notes.includes('confidence')) {
    const confidenceMatch = notes.match(/(\d+)%/);
    if (confidenceMatch) {
      return parseInt(confidenceMatch[1]);
    }
  }
  return 70; // Default
}

// Helper function to process a single line
function processLine(line, index) {
  if (index < 2) return null; // Skip header lines
  
  const parts = line.split(',');
  if (parts.length < 4) return null;
  
  const question = cleanQuestionText(parts[0].trim());
  const verdict = parts[1]?.trim();
  const qualityScore = parseInt(parts[2]?.trim());
  const notes = parts[3]?.trim();
  
  if (!question || !verdict || isNaN(qualityScore)) return null;
  
  return {
    question,
    confidenceScore: extractConfidenceScore(notes),
    qualityScore,
    verdict,
    notes,
    timestamp: '2025-10-23T00:00:00.000Z'
  };
}

lines.forEach((line, index) => {
  const result = processLine(line, index);
  if (result) {
    baselineScores[result.question] = {
      confidenceScore: result.confidenceScore,
      qualityScore: result.qualityScore,
      verdict: result.verdict,
      notes: result.notes,
      timestamp: result.timestamp
    };
  }
});

// Generate JavaScript code to populate localStorage
const jsCode = `
// Auto-populate baseline scores from Alan's manual testing
const baselineScores = ${JSON.stringify(baselineScores, null, 2)};

// Load existing scores
let savedScores = {};
const saved = localStorage.getItem('interactiveTestScores');
if (saved) {
  savedScores = JSON.parse(saved);
}

// Merge baseline scores (baseline takes precedence for questions that exist)
Object.keys(baselineScores).forEach(question => {
  savedScores[question] = baselineScores[question];
});

// Save back to localStorage
localStorage.setItem('interactiveTestScores', JSON.stringify(savedScores));

console.log('Baseline scores loaded:', Object.keys(baselineScores).length, 'questions');
`;

// Write the script to a file
fs.writeFileSync('populate-baseline.js', jsCode);

console.log('Generated populate-baseline.js with', Object.keys(baselineScores).length, 'baseline scores');
console.log('Sample scores:');
Object.keys(baselineScores).slice(0, 3).forEach(question => {
  console.log(`- ${question}: ${baselineScores[question].qualityScore}/100 (${baselineScores[question].verdict})`);
});
