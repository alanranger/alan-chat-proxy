// Debug CSV import process for category import bug
import fs from 'fs';
import { cleanHTMLText } from '../lib/htmlExtractor.js';

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

function parseCSV(csvText) {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];

  // Find the header line
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.toLowerCase());
  
  const rows = [];
  let i = 1;
  
  while (i < lines.length) {
    let line = lines[i];
    
    // If line is empty, skip
    if (!line.trim()) {
      i++;
      continue;
    }
    
    const parsed = parseCSVLine(line);
    if (parsed.length > 0) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = parsed[index] || '';
      });
      rows.push(row);
    }
    i++;
  }
  
  return { headers, rows };
}

// Test with the actual CSV file
console.log('🔍 Debugging CSV import for category bug');
console.log('========================================');

try {
  const csvContent = fs.readFileSync('CSVSs from website/03 - www-alanranger-com__5013f4b2c4aaa4752ac69b17__photographic-workshops-near-me.csv', 'utf8');
  const { headers, rows } = parseCSV(csvContent);
  
  console.log(`\nHeaders: [${headers.join(', ')}]`);
  console.log(`Total rows: ${rows.length}`);
  
  // Find the problematic events
  const problemEvents = [
    'secrets-of-woodland-photography-masterclass-autumn',
    'batsford-arboretum-autumn-photography-29oct'
  ];
  
  problemEvents.forEach(eventName => {
    console.log(`\n🔍 Checking event: ${eventName}`);
    
    const matchingRows = rows.filter(row => 
      row.event_url && row.event_url.includes(eventName)
    );
    
    console.log(`Found ${matchingRows.length} matching rows`);
    
    matchingRows.forEach((row, index) => {
      console.log(`\nRow ${index + 1}:`);
      console.log(`  URL: ${row.event_url}`);
      console.log(`  Category (raw): "${row.category}"`);
      
      if (row.category) {
        const categories = row.category.split(',').map(c => cleanHTMLText(c.trim())).filter(Boolean);
        console.log(`  Categories (processed): [${categories.map(c => `"${c}"`).join(', ')}]`);
      } else {
        console.log(`  Categories (processed): []`);
      }
    });
  });
  
  // Check for any rows with empty categories
  const emptyCategoryRows = rows.filter(row => !row.category || row.category.trim() === '');
  console.log(`\n📊 Summary:`);
  console.log(`  Total rows: ${rows.length}`);
  console.log(`  Rows with empty categories: ${emptyCategoryRows.length}`);
  
  if (emptyCategoryRows.length > 0) {
    console.log(`\n⚠️  Rows with empty categories:`);
    emptyCategoryRows.slice(0, 5).forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.event_title || 'No title'} - ${row.event_url || 'No URL'}`);
    });
  }
  
} catch (error) {
  console.error('Error:', error.message);
}




