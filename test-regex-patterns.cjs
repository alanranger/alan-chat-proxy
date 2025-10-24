const testQuery = "what camera do i need for your courses and workshops";

console.log(`🔍 Testing regex patterns for: "${testQuery}"`);

// Test the workshop patterns that should be excluded
const workshopPatterns = [
  /^(?!.*what.*camera.*need).*camera course/i,
  /^(?!.*what.*camera.*need).*camera courses/i
];

console.log('\n📊 Workshop patterns (should NOT match):');
for (let i = 0; i < workshopPatterns.length; i++) {
  const pattern = workshopPatterns[i];
  const matches = pattern.test(testQuery);
  console.log(`  Pattern ${i + 1}: ${pattern} → ${matches ? 'MATCHES' : 'NO MATCH'}`);
}

// Test the equipment patterns that should match
const equipmentPatterns = [
  /what camera do i need/i,
  /camera requirements/i,
  /equipment requirements/i,
  /what camera.*need.*course/i,
  /what camera.*need.*workshop/i
];

console.log('\n📊 Equipment patterns (should match):');
for (let i = 0; i < equipmentPatterns.length; i++) {
  const pattern = equipmentPatterns[i];
  const matches = pattern.test(testQuery);
  console.log(`  Pattern ${i + 1}: ${pattern} → ${matches ? 'MATCHES' : 'NO MATCH'}`);
}

// Test the original workshop patterns that were causing the issue
const originalWorkshopPatterns = [
  /camera course/i,
  /camera courses/i
];

console.log('\n📊 Original workshop patterns (should NOT match after fix):');
for (let i = 0; i < originalWorkshopPatterns.length; i++) {
  const pattern = originalWorkshopPatterns[i];
  const matches = pattern.test(testQuery);
  console.log(`  Pattern ${i + 1}: ${pattern} → ${matches ? 'MATCHES' : 'NO MATCH'}`);
}


