// Test the irrelevant response detection logic directly
function checkIrrelevantResponse(responseLower, queryLower) {
  if (responseLower.includes('based on alan ranger\'s expertise') && 
      responseLower.includes('autumn photography') && 
      !queryLower.includes('autumn')) {
    return 0.0; // Completely irrelevant
  }
  return null;
}

function checkGenericResponse(responseLower, queryWords) {
  if (responseLower.startsWith('based on alan ranger\'s expertise') &&
      responseLower.includes('here\'s what you need to know') &&
      !queryWords.some(word => responseLower.includes(word))) {
    return 0.1; // Generic response that doesn't answer the question
  }
  return null;
}

function calculateAccuracy(responseText, queryLower) {
  const responseLower = responseText.toLowerCase();
  const queryWords = (queryLower || '').split(/\s+/).filter(word => word.length > 2);
  
  console.log(`🔍 Testing accuracy calculation:`);
  console.log(`   Response: "${responseText.substring(0, 100)}..."`);
  console.log(`   Query: "${queryLower}"`);
  console.log(`   Query words: ${queryWords.join(', ')}`);
  
  // Check for completely irrelevant responses
  const irrelevantScore = checkIrrelevantResponse(responseLower, queryLower);
  console.log(`   Irrelevant score: ${irrelevantScore}`);
  if (irrelevantScore !== null) return irrelevantScore;
  
  // Check for generic responses
  const genericScore = checkGenericResponse(responseLower, queryWords);
  console.log(`   Generic score: ${genericScore}`);
  if (genericScore !== null) return genericScore;
  
  console.log(`   Final accuracy: 0.5 (neutral)`);
  return 0.5;
}

// Test the problematic response
const testResponse = "Based on Alan Ranger's expertise, here's what you need to know about your question.\n\nFIVE CREATIVE AUTUMN PHOTOGRAPHY PROJECTS: TO INSPIRE YOU\n\n*For detailed information, read the full guide: https://www.alanranger.com/blog-on-photography/five-creative-autumn-photography-projects*";

const testQuery = "do you do commercial photography";

console.log('🧪 TESTING IRRELEVANT RESPONSE DETECTION');
console.log('=======================================\n');

const accuracy = calculateAccuracy(testResponse, testQuery);
console.log(`\n🎯 Final Accuracy Score: ${accuracy}`);

if (accuracy === 0.0) {
  console.log('✅ CORRECTLY DETECTED AS IRRELEVANT');
} else if (accuracy === 0.1) {
  console.log('✅ CORRECTLY DETECTED AS GENERIC');
} else {
  console.log('❌ NOT DETECTED AS PROBLEMATIC');
}


