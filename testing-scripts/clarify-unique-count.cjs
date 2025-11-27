console.log('='.repeat(80));
console.log('CLARIFYING UNIQUE QUESTION COUNT');
console.log('='.repeat(80));
console.log('\n');

// Breakdown:
const exactMatches = 6; // Same text in both sets
const sameQuestionDifferentWording = 10; // Same question, different wording (10 pairs = 20 questions total, but 10 unique questions)
const trulyUniqueInInteractive = 24; // Only in interactive, no match in regression
const trulyUniqueInRegression = 24; // Only in regression, no match in interactive

console.log('BREAKDOWN:');
console.log(`  1. Exact matches (same text): ${exactMatches} questions`);
console.log(`  2. Same question, different wording: ${sameQuestionDifferentWording} questions (appears as ${sameQuestionDifferentWording * 2} questions total - one in each set)`);
console.log(`  3. Truly unique in Interactive: ${trulyUniqueInInteractive} questions`);
console.log(`  4. Truly unique in Regression: ${trulyUniqueInRegression} questions`);
console.log('\n');

const totalQuestionsInBothSets = 40 + 40; // 80 questions total
const duplicateQuestions = exactMatches + (sameQuestionDifferentWording * 2); // 6 + 20 = 26 questions that are duplicates
const uniqueQuestions = totalQuestionsInBothSets - duplicateQuestions; // 80 - 26 = 54

console.log('CALCULATION:');
console.log(`  Total questions across both sets: ${totalQuestionsInBothSets}`);
console.log(`  Duplicate questions (exact + same/different wording): ${duplicateQuestions}`);
console.log(`  Unique questions if we count each wording separately: ${uniqueQuestions}`);
console.log('\n');

// But if we're asking "how many unique testable questions" (meaning we'd pick one version):
const uniqueTestableQuestions = exactMatches + sameQuestionDifferentWording + trulyUniqueInInteractive + trulyUniqueInRegression;
console.log('UNIQUE TESTABLE QUESTIONS (if we pick one version of each):');
console.log(`  Exact matches: ${exactMatches} (keep as-is)`);
console.log(`  Same question, different wording: ${sameQuestionDifferentWording} (pick one version)`);
console.log(`  Unique in Interactive: ${trulyUniqueInInteractive}`);
console.log(`  Unique in Regression: ${trulyUniqueInRegression}`);
console.log(`  TOTAL UNIQUE TESTABLE QUESTIONS: ${uniqueTestableQuestions}`);
console.log('\n');

console.log('='.repeat(80));
console.log('\nANSWER:');
console.log(`  If you want to test ALL unique questions from BOTH sets:`);
console.log(`  You have ${uniqueTestableQuestions} unique testable questions`);
console.log(`  (This counts the ${sameQuestionDifferentWording} same questions with different wording as ${sameQuestionDifferentWording} questions, not ${sameQuestionDifferentWording * 2})`);
console.log('\n');
console.log(`  If you count each wording separately: ${uniqueQuestions} unique questions`);
console.log(`  (This counts "tripod recommend" and "tripod should buy" as 2 separate questions)`);

