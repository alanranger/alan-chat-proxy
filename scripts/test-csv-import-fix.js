// Test the CSV import fix locally
import fs from 'fs';

// Copy the fixed CSV parsing logic
function parseCSVLine(line, startIndex = 0) {
  const result = [];
  let current = '';
  let inQuotes = false;
  let i = startIndex;
  
  while (i < line.length) {
    const ch = line[i];
    if (ch === '"') {
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

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.toLowerCase());
  
  const rows = [];
  let i = 1;
  
  while (i < lines.length) {
    let line = lines[i];
    
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

console.log('🧪 Testing CSV import fix locally');
console.log('==================================');

try {
  const csvContent = fs.readFileSync('CSVSs from website/03 - www-alanranger-com__5013f4b2c4aaa4752ac69b17__photographic-workshops-near-me.csv', 'utf8');
  const { headers, rows } = parseCSV(csvContent);
  
  console.log(`Total rows: ${rows.length}`);
  
  // Test the fixed category processing
  const testEvents = [
    'secrets-of-woodland-photography-masterclass-autumn',
    'batsford-arboretum-autumn-photography-29oct',
    'peak-district-photography-workshops-autumn'
  ];
  
  testEvents.forEach(eventName => {
    const matchingRows = rows.filter(row => 
      row.event_url && row.event_url.includes(eventName)
    );
    
    if (matchingRows.length > 0) {
      const row = matchingRows[0];
      console.log(`\n✅ ${eventName}:`);
      console.log(`  Category (raw): "${row.category}"`);
      
      // Apply the FIXED processing logic
      const categories = row.category ? row.category.split(',').map(c => c.trim()).filter(Boolean) : [];
      console.log(`  Categories (FIXED): [${categories.map(c => `"${c}"`).join(', ')}]`);
    } else {
      console.log(`\n❌ ${eventName}: Not found`);
    }
  });
  
  // Count categories
  const categoryCounts = {};
  rows.forEach(row => {
    if (row.category) {
      const categories = row.category.split(',').map(c => c.trim()).filter(Boolean);
      categories.forEach(cat => {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
    }
  });
  
  console.log('\n📊 Category counts (FIXED):');
  Object.entries(categoryCounts).forEach(([cat, count]) => {
    console.log(`  "${cat}": ${count} events`);
  });
  
} catch (error) {
  console.error('Error:', error.message);
}




