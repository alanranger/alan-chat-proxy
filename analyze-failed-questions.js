const fs = require('fs');

// Read the benchmark results
const results = JSON.parse(fs.readFileSync('results/quality-benchmark-before-2025-10-21T22-51-18-701Z.json', 'utf8'));

console.log('🔍 ANALYZING 9 FAILED QUESTIONS (Score < 70/100)');
console.log('='.repeat(60));

const failedQuestions = results.results.filter(r => r.quality.overall < 70);

failedQuestions.forEach((result, index) => {
  console.log(`\n${index + 1}. "${result.query}"`);
  console.log(`   Score: ${result.quality.overall}/100`);
  console.log(`   Issues: ${result.quality.issues.join(', ')}`);
  console.log(`   `);
  console.log(`   📝 INITIAL RESPONSE:`);
  const answer = result.response.answer || result.response.answer_markdown || 'No answer provided';
  console.log(`   "${answer}"`);
  console.log(`   `);
  console.log(`   📊 RESPONSE STRUCTURE:`);
  console.log(`   - Answer Length: ${answer.length} chars`);
  console.log(`   - Articles Found: ${result.response.structured?.articles?.length || 0}`);
  console.log(`   - Events Found: ${result.response.structured?.events?.length || 0}`);
  console.log(`   - Response Type: ${result.response.type || 'unknown'}`);
  console.log(`   - Has Clarification: ${result.response.clarification ? 'Yes' : 'No'}`);
  if (result.response.clarification) {
    console.log(`   - Clarification: "${result.response.clarification}"`);
  }
  if (result.response.options && result.response.options.length > 0) {
    console.log(`   - Options: ${result.response.options.join(', ')}`);
  }
  console.log(`   `);
});
