// Script to populate the interactive testing dashboard with Alan's baseline scores
import fs from 'fs';

// Read the CSV file
const csvContent = fs.readFileSync('results/alan manual test of questions - 23 10 2025.csv', 'utf8');
const lines = csvContent.split('\n');

// Parse the CSV data
const baselineScores = {};

lines.forEach((line, index) => {
  if (index < 2) return; // Skip header lines
  
  const parts = line.split(',');
  if (parts.length >= 4) {
    let question = parts[0].trim();
    // Clean up the question text - extract just the question part
    question = question.replace(/^"1\. ""/, '').replace(/""- Should.*$/, '').replace(/^"/, '').replace(/"$/, '').trim();
    
    // Further cleanup to get just the question
    if (question.includes('""')) {
      question = question.split('""')[0];
    }
    if (question.includes('')) {
      question = question.split('')[0];
    }
    
    const verdict = parts[1]?.trim();
    const qualityScore = parseInt(parts[2]?.trim());
    const notes = parts[3]?.trim();
    
    if (question && verdict && !isNaN(qualityScore)) {
      // Extract confidence score from notes if mentioned
      let confidenceScore = 70; // Default
      if (notes.includes('0.2%')) {
        confidenceScore = 0.2;
      } else if (notes.includes('should have higher confidence')) {
        confidenceScore = 85;
      } else if (notes.includes('confidence')) {
        // Try to extract confidence from notes
        const confidenceMatch = notes.match(/(\d+)%/);
        if (confidenceMatch) {
          confidenceScore = parseInt(confidenceMatch[1]);
        }
      }
      
      baselineScores[question] = {
        confidenceScore: confidenceScore,
        qualityScore: qualityScore,
        verdict: verdict,
        notes: notes,
        timestamp: '2025-10-23T00:00:00.000Z' // Baseline date
      };
    }
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
