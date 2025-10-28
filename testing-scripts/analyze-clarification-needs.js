import fs from 'fs';
import csv from 'csv-parser';

const questions = [];
const clarificationNeeded = [];
const directAnswer = [];

console.log('🔍 ANALYZING CLARIFICATION NEEDS vs DIRECT ANSWERS');
console.log('==================================================');

// Read the 171 questions
fs.createReadStream('CSVSs from website/new test question batch.csv')
  .pipe(csv())
  .on('data', (row) => {
    const question = Object.values(row)[0];
    if (question && typeof question === 'string') {
      questions.push(question);
    }
  })
  .on('end', () => {
    console.log(`Total questions analyzed: ${questions.length}`);
    console.log('');
    
    // Analyze each question for clarification needs
    questions.forEach(q => {
      const lc = q.toLowerCase();
      
      // BROAD QUERIES - Need clarification
      if (
        // Very broad/generic queries
        lc.includes('photography help') ||
        lc.includes('photography advice') ||
        lc.includes('photography tips') ||
        lc.includes('photography services') ||
        lc.includes('photography courses') ||
        lc.includes('photography workshops') ||
        lc.includes('photography equipment') ||
        lc.includes('photography gear') ||
        lc.includes('photography techniques') ||
        lc.includes('photography tutorials') ||
        
        // Ambiguous queries
        lc.includes('what do you offer') ||
        lc.includes('what can you help') ||
        lc.includes('what services') ||
        lc.includes('what courses') ||
        lc.includes('what workshops') ||
        
        // Multiple choice scenarios
        lc.includes('which course') ||
        lc.includes('which workshop') ||
        lc.includes('which service') ||
        lc.includes('best for me') ||
        lc.includes('suitable for')
      ) {
        clarificationNeeded.push(q);
      } else {
        // SPECIFIC QUERIES - Direct answers
        directAnswer.push(q);
      }
    });
    
    console.log('📊 CLARIFICATION ANALYSIS RESULTS:');
    console.log('==================================');
    console.log(`Direct Answer Queries: ${directAnswer.length} (${Math.round(directAnswer.length/questions.length*100)}%)`);
    console.log(`Clarification Needed: ${clarificationNeeded.length} (${Math.round(clarificationNeeded.length/questions.length*100)}%)`);
    console.log('');
    
    console.log('🎯 QUERIES NEEDING CLARIFICATION:');
    console.log('=================================');
    clarificationNeeded.forEach((q, i) => {
      console.log(`${i+1}. ${q}`);
    });
    console.log('');
    
    console.log('✅ QUERIES FOR DIRECT ANSWERS:');
    console.log('==============================');
    console.log('Sample direct answer queries:');
    directAnswer.slice(0, 10).forEach((q, i) => {
      console.log(`${i+1}. ${q}`);
    });
    console.log(`... and ${directAnswer.length - 10} more`);
    console.log('');
    
    // Analyze question specificity
    const specificity = {
      'Very Specific (Direct Answer)': directAnswer.length,
      'Broad (Clarification)': clarificationNeeded.length
    };
    
    console.log('📈 CLARIFICATION SYSTEM IMPACT:');
    console.log('===============================');
    console.log('Current system assumes: Most queries need clarification');
    console.log('Reality: Most queries are specific and expect direct answers');
    console.log('');
    console.log('RECOMMENDATION:');
    console.log('- Default to DIRECT ANSWERS for specific queries');
    console.log('- Use CLARIFICATION only for genuinely broad queries');
    console.log('- Implement evidence-based responses with relevant pills');
    console.log('- Preserve workshop clarification (it works well)');
  });



