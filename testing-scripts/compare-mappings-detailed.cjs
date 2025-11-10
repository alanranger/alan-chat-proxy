// Detailed comparison of two event-product-mappings CSV files
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

function normalizeDate(dateStr) {
  if (!dateStr) return '';
  // Normalize dates to YYYY-MM-DD format for comparison
  try {
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
  } catch {
    return String(dateStr).split('T')[0];
  }
}

function compareMappings() {
  console.log('📊 Detailed Comparison of Event-Product Mappings\n');
  console.log('=' .repeat(80));
  
  const oldContent = fs.readFileSync(oldFile, 'utf-8');
  const newContent = fs.readFileSync(newFile, 'utf-8');
  
  const oldData = parseCSV(oldContent);
  const newData = parseCSV(newContent);
  
  console.log(`\n📁 FILE INFO:`);
  console.log(`  Old: ${oldData.rows.length} rows, ${oldData.headers.length} columns`);
  console.log(`  New: ${newData.rows.length} rows, ${newData.headers.length} columns`);
  
  // Check headers
  const headerDiff = oldData.headers.filter(h => !newData.headers.includes(h));
  const headerNew = newData.headers.filter(h => !oldData.headers.includes(h));
  if (headerDiff.length > 0 || headerNew.length > 0) {
    console.log(`\n⚠️  HEADER DIFFERENCES:`);
    if (headerDiff.length > 0) console.log(`  Removed: ${headerDiff.join(', ')}`);
    if (headerNew.length > 0) console.log(`  Added: ${headerNew.join(', ')}`);
  } else {
    console.log(`\n✅ Headers match`);
  }
  
  // Create maps by event_url + date_start + product_url
  const createKey = (row) => {
    const url = (row.event_url || '').replace(/\/+$/, '');
    const date = normalizeDate(row.date_start || '');
    const product = (row.product_url || '').replace(/\/+$/, '');
    return `${url}|${date}|${product}`;
  };
  
  const oldMap = new Map();
  oldData.rows.forEach(row => {
    const key = createKey(row);
    if (!oldMap.has(key)) {
      oldMap.set(key, []);
    }
    oldMap.get(key).push(row);
  });
  
  const newMap = new Map();
  newData.rows.forEach(row => {
    const key = createKey(row);
    if (!newMap.has(key)) {
      newMap.set(key, []);
    }
    newMap.get(key).push(row);
  });
  
  // Compare
  const onlyInOld = [];
  const onlyInNew = [];
  const changed = [];
  const same = [];
  
  // Check old mappings
  oldMap.forEach((oldRows, key) => {
    if (!newMap.has(key)) {
      onlyInOld.push(...oldRows);
    } else {
      const newRows = newMap.get(key);
      // Compare each old row with new rows
      oldRows.forEach(oldRow => {
        const match = newRows.find(newRow => {
          // Compare all fields
          return oldData.headers.every(header => {
            const oldVal = String(oldRow[header] || '').trim();
            const newVal = String(newRow[header] || '').trim();
            return oldVal === newVal;
          });
        });
        
        if (match) {
          same.push({ old: oldRow, new: match });
        } else {
          // Find closest match for reporting
          const closest = newRows[0];
          const differences = [];
          oldData.headers.forEach(header => {
            const oldVal = String(oldRow[header] || '').trim();
            const newVal = String(closest[header] || '').trim();
            if (oldVal !== newVal) {
              differences.push({ field: header, old: oldVal, new: newVal });
            }
          });
          changed.push({ key, old: oldRow, new: closest, differences });
        }
      });
    }
  });
  
  // Check new mappings
  newMap.forEach((newRows, key) => {
    if (!oldMap.has(key)) {
      onlyInNew.push(...newRows);
    }
  });
  
  // Summary
  console.log(`\n📈 COMPARISON RESULTS:`);
  console.log(`  ✅ Identical mappings: ${same.length}`);
  console.log(`  ➕ New mappings: ${onlyInNew.length}`);
  console.log(`  ➖ Removed mappings: ${onlyInOld.length}`);
  console.log(`  🔄 Changed mappings: ${changed.length}`);
  
  // Detailed analysis
  if (onlyInNew.length > 0) {
    console.log(`\n➕ NEW MAPPINGS (${onlyInNew.length}):`);
    onlyInNew.slice(0, 10).forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.event_url || 'N/A'}`);
      console.log(`     Date: ${row.date_start || 'N/A'}`);
      console.log(`     Product: ${row.product_url || 'N/A'}`);
      console.log(`     Price: ${row.price_gbp || 'N/A'}`);
    });
    if (onlyInNew.length > 10) {
      console.log(`  ... and ${onlyInNew.length - 10} more`);
    }
  }
  
  if (onlyInOld.length > 0) {
    console.log(`\n➖ REMOVED MAPPINGS (${onlyInOld.length}):`);
    onlyInOld.slice(0, 10).forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.event_url || 'N/A'}`);
      console.log(`     Date: ${row.date_start || 'N/A'}`);
      console.log(`     Product: ${row.product_url || 'N/A'}`);
    });
    if (onlyInOld.length > 10) {
      console.log(`  ... and ${onlyInOld.length - 10} more`);
    }
  }
  
  if (changed.length > 0) {
    console.log(`\n🔄 CHANGED MAPPINGS (${changed.length}):`);
    changed.slice(0, 10).forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.old.event_url || 'N/A'} | ${item.old.date_start || 'N/A'}`);
      item.differences.forEach(diff => {
        console.log(`     ${diff.field}: "${diff.old}" → "${diff.new}"`);
      });
    });
    if (changed.length > 10) {
      console.log(`  ... and ${changed.length - 10} more`);
    }
  }
  
  // Field-by-field analysis
  const fieldChanges = {};
  changed.forEach(item => {
    item.differences.forEach(diff => {
      if (!fieldChanges[diff.field]) {
        fieldChanges[diff.field] = 0;
      }
      fieldChanges[diff.field]++;
    });
  });
  
  if (Object.keys(fieldChanges).length > 0) {
    console.log(`\n📊 FIELD CHANGES:`);
    Object.entries(fieldChanges).sort((a, b) => b[1] - a[1]).forEach(([field, count]) => {
      console.log(`  ${field}: ${count} changes`);
    });
  }
  
  // Event URL analysis
  const oldEventUrls = new Set(oldData.rows.map(r => (r.event_url || '').replace(/\/+$/, '')));
  const newEventUrls = new Set(newData.rows.map(r => (r.event_url || '').replace(/\/+$/, '')));
  const newEventUrlsOnly = [...newEventUrls].filter(u => u && !oldEventUrls.has(u));
  const removedEventUrls = [...oldEventUrls].filter(u => u && !newEventUrls.has(u));
  
  console.log(`\n📊 EVENT URL ANALYSIS:`);
  console.log(`  Old: ${oldEventUrls.size} unique event URLs`);
  console.log(`  New: ${newEventUrls.size} unique event URLs`);
  if (newEventUrlsOnly.length > 0) {
    console.log(`  ➕ New event URLs: ${newEventUrlsOnly.length}`);
    newEventUrlsOnly.slice(0, 10).forEach(url => console.log(`     - ${url}`));
  }
  if (removedEventUrls.length > 0) {
    console.log(`  ➖ Removed event URLs: ${removedEventUrls.length}`);
    removedEventUrls.slice(0, 10).forEach(url => console.log(`     - ${url}`));
  }
  
  // Date analysis
  const oldDates = new Set(oldData.rows.map(r => normalizeDate(r.date_start || '')));
  const newDates = new Set(newData.rows.map(r => normalizeDate(r.date_start || '')));
  const newDatesOnly = [...newDates].filter(d => d && !oldDates.has(d));
  const removedDates = [...oldDates].filter(d => d && !newDates.has(d));
  
  if (newDatesOnly.length > 0 || removedDates.length > 0) {
    console.log(`\n📅 DATE ANALYSIS:`);
    if (newDatesOnly.length > 0) {
      console.log(`  ➕ New dates: ${newDatesOnly.length}`);
      newDatesOnly.slice(0, 10).forEach(date => console.log(`     - ${date}`));
    }
    if (removedDates.length > 0) {
      console.log(`  ➖ Removed dates: ${removedDates.length}`);
      removedDates.slice(0, 10).forEach(date => console.log(`     - ${date}`));
    }
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ Detailed comparison complete!`);
  
  return {
    same: same.length,
    new: onlyInNew.length,
    removed: onlyInOld.length,
    changed: changed.length,
    fieldChanges
  };
}

compareMappings();

