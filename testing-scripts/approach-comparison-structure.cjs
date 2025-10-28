// This shows the structure of the comparison test
// Run this to see what we'll be testing

const testQueries = [
  "what is exposure",
  "what is exposure triangle", 
  "do you have photography courses",
  "what camera do i need for your courses",
  "do you do commercial photography"
];

console.log('🔍 APPROACH COMPARISON TEST STRUCTURE');
console.log('='.repeat(60));
console.log('This test will compare two approaches for each question:\n');

console.log('APPROACH 1: Simple Parameters (New Logic)');
console.log('Parameters: { query, sessionId }');
console.log('Expected: Direct technical explanations, high confidence');
console.log('Use case: Technical queries that need direct answers\n');

console.log('APPROACH 2: Live Chat Parameters (Original Logic)');
console.log('Parameters: { query, topK: 8, previousQuery, sessionId, pageContext }');
console.log('Expected: Article links, enhanced search, different confidence');
console.log('Use case: Business queries that need contextual information\n');

console.log('FOR EACH QUESTION WE WILL TEST:');
console.log('1. Confidence score (which is closer to Alan\'s manual score)');
console.log('2. Response type (direct answer vs article links vs hybrid)');
console.log('3. Content quality (does it answer the question directly)');
console.log('4. Supporting content (events, articles, etc.)');
console.log('5. Overall effectiveness\n');

console.log('TEST QUESTIONS:');
testQueries.forEach((query, i) => {
  console.log(`${i + 1}. "${query}"`);
});

console.log('\nEXPECTED OUTCOMES:');
console.log('- Technical queries (exposure, exposure triangle) should work better with simple parameters');
console.log('- Business queries (courses, commercial photography) should work better with live chat parameters');
console.log('- Equipment queries might work better with one or the other depending on context');

console.log('\nTO RUN THE ACTUAL TEST:');
console.log('1. Start the server on port 3000');
console.log('2. Run: node quick-approach-test.cjs');
console.log('3. Analyze results to determine which approach works better for each query type');
