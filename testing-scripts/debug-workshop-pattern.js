// Debug the workshop pattern matching
function checkCourseWorkshopPatterns(lc) {
  if (lc.includes("do you do") && lc.includes("courses")) {
    return { type: "course_clarification", question: "What type of course?", options: [] };
  }
  
  // Enhanced workshop pattern matching to catch more variations
  // Match any query that contains "workshop" and doesn't contain specific duration indicators
  if (lc.includes("workshop") && 
      !lc.includes("2.5hr") && 
      !lc.includes("4hr") && 
      !lc.includes("1 day") && 
      !lc.includes("multi day") && 
      !lc.includes("residential") &&
      !lc.includes("short") &&
      !lc.includes("long")) {
    return { type: "workshop_clarification", question: "What type of workshop?", options: [] };
  }
  
  return null;
}

// Test the pattern matching
const testQueries = [
  'photography workshops',
  'workshops near me',
  'do you run workshops',
  'what workshops do you have',
  'short photography workshops',
  '2.5hr workshops'
];

console.log('🔍 Testing workshop pattern matching:');
console.log('=====================================');

testQueries.forEach(query => {
  const lc = query.toLowerCase();
  const result = checkCourseWorkshopPatterns(lc);
  console.log(`"${query}" -> ${result ? 'MATCH' : 'NO MATCH'}`);
  if (result) {
    console.log(`  Type: ${result.type}`);
  }
});



