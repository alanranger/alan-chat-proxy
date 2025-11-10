// Compare two event-product-mappings CSV files
const fs = require('fs');
const path = require('path');

const oldFile = path.join(__dirname, '../CSVSs from website/event-product-mappings-2025-11-10T14-54-20-656Z.csv');
const newFile = path.join(__dirname, '../CSVSs from website/event-product-mappings-2025-11-10T22-29-15-920Z.csv');

function parseCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parsing (handles quoted fields)
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim()); // Last value
    
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx].replace(/^"|"$/g, '');
      });
      rows.push(row);
    }
  }
  
  return { headers, rows };
}

function createKey(row) {
  // Create unique key: event_url + date_start + product_url
  return `${row.event_url || ''}|${row.date_start || ''}|${row.product_url || ''}`;
}

function compareMappings() {
  console.log('📊 Comparing event-product mappings...\n');
  
  const oldContent = fs.readFileSync(oldFile, 'utf-8');
  const newContent = fs.readFileSync(newFile, 'utf-8');
  
  const oldData = parseCSV(oldContent);
  const newData = parseCSV(newContent);
  
  console.log(`Old file: ${oldData.rows.length} rows`);
  console.log(`New file: ${newData.rows.length} rows\n`);
  
  // Create maps by key
  const oldMap = new Map();
  oldData.rows.forEach(row => {
    const key = createKey(row);
    oldMap.set(key, row);
  });
  
  const newMap = new Map();
  newData.rows.forEach(row => {
    const key = createKey(row);
    newMap.set(key, row);
  });
  
  // Find differences
  const onlyInOld = [];
  const onlyInNew = [];
  const changed = [];
  
  // Check what's only in old
  oldMap.forEach((row, key) => {
    if (!newMap.has(key)) {
      onlyInOld.push(row);
    } else {
      // Compare fields
      const newRow = newMap.get(key);
      const differences = [];
      Object.keys(row).forEach(field => {
        if (row[field] !== newRow[field]) {
          differences.push({
            field,
            old: row[field],
            new: newRow[field]
          });
        }
      });
      if (differences.length > 0) {
        changed.push({
          key,
          row: row,
          differences
        });
      }
    }
  });
  
  // Check what's only in new
  newMap.forEach((row, key) => {
    if (!oldMap.has(key)) {
      onlyInNew.push(row);
    }
  });
  
  // Summary
  console.log('📈 COMPARISON RESULTS:\n');
  console.log(`✅ Same mappings: ${oldData.rows.length - onlyInOld.length - changed.length}`);
  console.log(`➕ New mappings: ${onlyInNew.length}`);
  console.log(`➖ Removed mappings: ${onlyInOld.length}`);
  console.log(`🔄 Changed mappings: ${changed.length}\n`);
  
  // Show new mappings
  if (onlyInNew.length > 0) {
    console.log(`\n➕ NEW MAPPINGS (${onlyInNew.length}):`);
    onlyInNew.slice(0, 20).forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.event_url || 'N/A'} | ${row.date_start || 'N/A'} → ${row.product_url || 'N/A'}`);
    });
    if (onlyInNew.length > 20) {
      console.log(`  ... and ${onlyInNew.length - 20} more`);
    }
  }
  
  // Show removed mappings
  if (onlyInOld.length > 0) {
    console.log(`\n➖ REMOVED MAPPINGS (${onlyInOld.length}):`);
    onlyInOld.slice(0, 20).forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.event_url || 'N/A'} | ${row.date_start || 'N/A'} → ${row.product_url || 'N/A'}`);
    });
    if (onlyInOld.length > 20) {
      console.log(`  ... and ${onlyInOld.length - 20} more`);
    }
  }
  
  // Show changed mappings
  if (changed.length > 0) {
    console.log(`\n🔄 CHANGED MAPPINGS (${changed.length}):`);
    changed.slice(0, 10).forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.row.event_url || 'N/A'} | ${item.row.date_start || 'N/A'}`);
      item.differences.forEach(diff => {
        console.log(`     ${diff.field}: "${diff.old}" → "${diff.new}"`);
      });
    });
    if (changed.length > 10) {
      console.log(`  ... and ${changed.length - 10} more`);
    }
  }
  
  // Count by event URL
  const oldEventUrls = new Set(oldData.rows.map(r => r.event_url));
  const newEventUrls = new Set(newData.rows.map(r => r.event_url));
  const newEventUrlsOnly = [...newEventUrls].filter(u => !oldEventUrls.has(u));
  const removedEventUrls = [...oldEventUrls].filter(u => !newEventUrls.has(u));
  
  console.log(`\n📊 EVENT URL SUMMARY:`);
  console.log(`  Old: ${oldEventUrls.size} unique event URLs`);
  console.log(`  New: ${newEventUrls.size} unique event URLs`);
  console.log(`  New event URLs: ${newEventUrlsOnly.length}`);
  console.log(`  Removed event URLs: ${removedEventUrls.length}`);
  
  if (newEventUrlsOnly.length > 0 && newEventUrlsOnly.length <= 20) {
    console.log(`\n  New event URLs:`);
    newEventUrlsOnly.forEach(url => console.log(`    - ${url}`));
  }
  
  if (removedEventUrls.length > 0 && removedEventUrls.length <= 20) {
    console.log(`\n  Removed event URLs:`);
    removedEventUrls.forEach(url => console.log(`    - ${url}`));
  }
  
  // Check for date differences
  const dateDifferences = changed.filter(c => 
    c.differences.some(d => d.field === 'date_start' || d.field === 'date_end')
  );
  
  if (dateDifferences.length > 0) {
    console.log(`\n📅 DATE CHANGES: ${dateDifferences.length} mappings had date changes`);
  }
  
  return {
    totalOld: oldData.rows.length,
    totalNew: newData.rows.length,
    same: oldData.rows.length - onlyInOld.length - changed.length,
    new: onlyInNew.length,
    removed: onlyInOld.length,
    changed: changed.length,
    newEventUrls: newEventUrlsOnly.length,
    removedEventUrls: removedEventUrls.length,
    dateChanges: dateDifferences.length
  };
}

const results = compareMappings();
console.log('\n✅ Comparison complete!');

