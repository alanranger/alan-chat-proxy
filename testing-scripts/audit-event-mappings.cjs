const fs = require('fs');
const path = require('path');

// Read source CSV files
const courseEventsPath = path.join(__dirname, '../CSVSs from website/02 - www-alanranger-com__5013f4b2c4aaa4752ac69b17__beginners-photography-lessons.csv');
const workshopEventsPath = path.join(__dirname, '../CSVSs from website/03 - www-alanranger-com__5013f4b2c4aaa4752ac69b17__photographic-workshops-near-me.csv');
const mappingsPath = path.join(__dirname, '../CSVSs from website/event-product-mappings-2025-11-10T11-44-25-698Z.csv');

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
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
    values.push(current.trim());
    
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx]?.replace(/^"|"$/g, '') || '';
      });
      rows.push(row);
    }
  }
  
  return rows;
}

// Parse all files
console.log('📊 Parsing CSV files...\n');
const courseEvents = parseCSV(courseEventsPath);
const workshopEvents = parseCSV(workshopEventsPath);
const mappings = parseCSV(mappingsPath);

console.log(`✅ Course Events: ${courseEvents.length} rows`);
console.log(`✅ Workshop Events: ${workshopEvents.length} rows`);
console.log(`✅ Mappings: ${mappings.length} rows\n`);

// Create lookup maps
const sourceEvents = new Map(); // key: url + start_date
const mappingsMap = new Map(); // key: event_url + date_start

// Index source events
courseEvents.forEach(row => {
  const url = row.Event_URL?.trim();
  const startDate = row.Start_Date?.trim();
  if (url && startDate) {
    const key = `${url}|${startDate}`;
    sourceEvents.set(key, {
      type: 'course',
      title: row.Event_Title?.trim(),
      url,
      startDate,
      startTime: row.Start_Time?.trim(),
      endDate: row.End_Date?.trim(),
      endTime: row.End_Time?.trim()
    });
  }
});

workshopEvents.forEach(row => {
  const url = row.Event_URL?.trim();
  const startDate = row.Start_Date?.trim();
  if (url && startDate) {
    const key = `${url}|${startDate}`;
    sourceEvents.set(key, {
      type: 'workshop',
      title: row.Event_Title?.trim(),
      url,
      startDate,
      startTime: row.Start_Time?.trim(),
      endDate: row.End_Date?.trim(),
      endTime: row.End_Time?.trim()
    });
  }
});

// Index mappings
mappings.forEach(row => {
  const url = row.event_url?.trim();
  const dateStart = row.date_start?.trim();
  if (url && dateStart) {
    // Extract just the date part (YYYY-MM-DD) for comparison
    const dateOnly = dateStart.split('T')[0];
    const key = `${url}|${dateOnly}`;
    if (!mappingsMap.has(key)) {
      mappingsMap.set(key, []);
    }
    mappingsMap.get(key).push({
      url,
      dateStart: dateOnly,
      productUrl: row.product_url?.trim(),
      productTitle: row.product_title?.trim(),
      eventTitle: row.event_title?.trim(),
      mapMethod: row.map_method?.trim(),
      confidence: row.confidence?.trim()
    });
  }
});

// Audit: Find missing events
console.log('🔍 AUDIT RESULTS\n');
console.log('='.repeat(80));

const missingEvents = [];
const foundEvents = [];

sourceEvents.forEach((event, key) => {
  const [url, startDate] = key.split('|');
  const dateOnly = startDate.split(' ')[0]; // Handle time if present
  const lookupKey = `${url}|${dateOnly}`;
  
  if (mappingsMap.has(lookupKey)) {
    foundEvents.push({
      ...event,
      mappings: mappingsMap.get(lookupKey)
    });
  } else {
    missingEvents.push(event);
  }
});

console.log(`\n✅ FOUND IN MAPPINGS: ${foundEvents.length}/${sourceEvents.size} events`);
console.log(`❌ MISSING FROM MAPPINGS: ${missingEvents.length} events\n`);

if (missingEvents.length > 0) {
  console.log('❌ MISSING EVENTS:');
  console.log('-'.repeat(80));
  missingEvents.forEach((event, idx) => {
    console.log(`${idx + 1}. [${event.type.toUpperCase()}] ${event.title}`);
    console.log(`   URL: ${event.url}`);
    console.log(`   Date: ${event.startDate} ${event.startTime || ''}`);
    console.log('');
  });
}

// Check for unmapped events (events in mappings but not in source)
const unmappedEvents = [];
mappingsMap.forEach((mappingList, key) => {
  const [url, dateStart] = key.split('|');
  if (!sourceEvents.has(key)) {
    // Try to find by URL only (might be date format difference)
    let found = false;
    for (const [sourceKey, sourceEvent] of sourceEvents.entries()) {
      const [sourceUrl] = sourceKey.split('|');
      if (sourceUrl === url) {
        found = true;
        break;
      }
    }
    if (!found) {
      unmappedEvents.push({ url, dateStart, mappings: mappingList });
    }
  }
});

if (unmappedEvents.length > 0) {
  console.log(`\n⚠️  UNMAPPED EVENTS (in mappings but not in source): ${unmappedEvents.length}`);
  console.log('-'.repeat(80));
  unmappedEvents.slice(0, 10).forEach((event, idx) => {
    console.log(`${idx + 1}. URL: ${event.url}`);
    console.log(`   Date: ${event.dateStart}`);
    console.log('');
  });
  if (unmappedEvents.length > 10) {
    console.log(`   ... and ${unmappedEvents.length - 10} more\n`);
  }
}

// Check mapping quality
console.log('\n📊 MAPPING QUALITY:');
console.log('-'.repeat(80));

let mappedCount = 0;
let unmappedCount = 0;
let autoMappedCount = 0;
let manualMappedCount = 0;

foundEvents.forEach(event => {
  const [url, startDate] = `${event.url}|${event.startDate}`.split('|');
  const dateOnly = startDate.split(' ')[0];
  const lookupKey = `${url}|${dateOnly}`;
  const mappings = mappingsMap.get(lookupKey);
  
  if (mappings && mappings.length > 0) {
    mappedCount++;
    mappings.forEach(m => {
      if (m.mapMethod === 'auto') autoMappedCount++;
      if (m.mapMethod === 'manual') manualMappedCount++;
    });
  } else {
    unmappedCount++;
  }
});

console.log(`✅ Mapped: ${mappedCount}`);
console.log(`❌ Unmapped: ${unmappedCount}`);
console.log(`🤖 Auto-mapped: ${autoMappedCount}`);
console.log(`✋ Manual-mapped: ${manualMappedCount}`);

// Check for duplicate mappings
console.log('\n🔍 DUPLICATE CHECK:');
console.log('-'.repeat(80));

const duplicateKeys = [];
mappingsMap.forEach((mappingList, key) => {
  if (mappingList.length > 1) {
    duplicateKeys.push({ key, count: mappingList.length, mappings: mappingList });
  }
});

if (duplicateKeys.length > 0) {
  console.log(`⚠️  Found ${duplicateKeys.length} events with multiple mappings:`);
  duplicateKeys.slice(0, 5).forEach((dup, idx) => {
    const [url, date] = dup.key.split('|');
    console.log(`\n${idx + 1}. ${url} (${date}) - ${dup.count} mappings:`);
    dup.mappings.forEach((m, mIdx) => {
      console.log(`   ${mIdx + 1}. Product: ${m.productTitle || m.productUrl}`);
      console.log(`      Method: ${m.mapMethod}, Confidence: ${m.confidence}`);
    });
  });
  if (duplicateKeys.length > 5) {
    console.log(`\n   ... and ${duplicateKeys.length - 5} more duplicates\n`);
  }
} else {
  console.log('✅ No duplicate mappings found');
}

// Summary
console.log('\n' + '='.repeat(80));
console.log('📋 SUMMARY');
console.log('='.repeat(80));
console.log(`Total Source Events: ${sourceEvents.size}`);
console.log(`  - Course Events: ${courseEvents.length}`);
console.log(`  - Workshop Events: ${workshopEvents.length}`);
console.log(`Total Mappings: ${mappings.length}`);
console.log(`Events Found in Mappings: ${foundEvents.length} (${((foundEvents.length / sourceEvents.size) * 100).toFixed(1)}%)`);
console.log(`Events Missing from Mappings: ${missingEvents.length} (${((missingEvents.length / sourceEvents.size) * 100).toFixed(1)}%)`);
console.log(`Mapped Events: ${mappedCount} (${((mappedCount / foundEvents.length) * 100).toFixed(1)}% of found events)`);
console.log(`Duplicate Mappings: ${duplicateKeys.length}`);


