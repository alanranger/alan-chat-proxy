// Test the CSV import fix for categories
const testCategories = [
  '1-day',
  '2.5hrs-4hrs', 
  '2-5-days',
  '1-day,2.5hrs-4hrs'
];

console.log('🧪 Testing CSV import fix for categories');
console.log('========================================');

testCategories.forEach(category => {
  // Simulate the fixed CSV import logic
  const processed = category ? category.split(',').map(c => c.trim()).filter(Boolean) : [];
  console.log(`Input: "${category}"`);
  console.log(`Output: [${processed.map(c => `"${c}"`).join(', ')}]`);
  console.log(`Length: ${processed.length}`);
  console.log('---');
});




