// Test cleanHTMLText function with category values
import { cleanHTMLText } from '../lib/htmlExtractor.js';

const testCategories = [
  '1-day',
  '2.5hrs-4hrs', 
  '2-5-days',
  '1-day,2.5hrs-4hrs'
];

console.log('🧪 Testing cleanHTMLText with category values');
console.log('==============================================');

testCategories.forEach(category => {
  const cleaned = cleanHTMLText(category);
  console.log(`Input: "${category}"`);
  console.log(`Output: "${cleaned}"`);
  console.log(`Length: ${cleaned.length}`);
  console.log(`Boolean: ${Boolean(cleaned)}`);
  console.log('---');
});




