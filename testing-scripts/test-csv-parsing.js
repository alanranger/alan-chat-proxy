// Test CSV parsing for category import bug
import fs from 'fs';

// Copy the CSV parsing logic from csv-import.js
function parseCSVLine(line, startIndex = 0) {
  const result = [];
  let current = '';
  let inQuotes = false;
  let i = startIndex;
  
  while (i < line.length) {
    const ch = line[i];
    if (ch === '"') {
      // Handle escaped quotes
      if (inQuotes && line[i + 1] === '"') { 
        current += '"'; 
        i += 2; 
        continue; 
      }
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
      i++;
      continue;
    } else {
      current += ch;
    }
    i++;
  }
  result.push(current);
  return result.map(s => s.replace(/^\s+|\s+$/g, '').replace(/^"|"$/g, ''));
}

// Test with problematic lines
const testLines = [
  'Batsford Arboretum Autumn Photography Workshop - 24/10,24/10/2025,08:00:00,24/10/2025,15:30:00,"1-day,2.5hrs-4hrs",,24/10/2025Gloucestershire',
  'The Secrets of Woodland Photography - 1-Day Masterclass Oct,19/10/2025,10:00:00,19/10/2025,16:00:00,1-day,,"19/10/2025Coventry'
];

console.log('🧪 Testing CSV parsing for category import bug');
console.log('==============================================');

testLines.forEach((line, index) => {
  console.log(`\nTest ${index + 1}:`);
  console.log(`Input: ${line}`);
  
  const parsed = parseCSVLine(line);
  console.log(`Parsed: [${parsed.map(f => `"${f}"`).join(', ')}]`);
  
  // Find category field (should be index 5)
  if (parsed.length > 5) {
    const category = parsed[5];
    console.log(`Category field: "${category}"`);
    
    if (category) {
      const categories = category.split(',').map(c => c.trim()).filter(Boolean);
      console.log(`Split categories: [${categories.map(c => `"${c}"`).join(', ')}]`);
    }
  }
});




