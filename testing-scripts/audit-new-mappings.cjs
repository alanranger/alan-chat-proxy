const fs = require('fs');
const path = require('path');

// Read source CSV files
const courseEventsPath = path.join(__dirname, '../CSVSs from website/02 - www-alanranger-com__5013f4b2c4aaa4752ac69b17__beginners-photography-lessons.csv');
const workshopEventsPath = path.join(__dirname, '../CSVSs from website/03 - www-alanranger-com__5013f4b2c4aaa4752ac69b17__photographic-workshops-near-me.csv');
// Find the latest mappings file
const mappingsDir = path.join(__dirname, '../CSVSs from website');
const mappingsFiles = fs.readdirSync(mappingsDir)
  .filter(f => f.startsWith('event-product-mappings-') && f.endsWith('.csv'))
  .sort()
  .reverse();
const mappingsPath = mappingsFiles.length > 0 
  ? path.join(mappingsDir, mappingsFiles[0])
  : path.join(__dirname, '../CSVSs from website/event-product-mappings-2025-11-10T14-54-20-656Z.csv');
console.log(`Using mappings file: ${path.basename(mappingsPath)}`);

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
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
const courseEvents = parseCSV(courseEventsPath);
const workshopEvents = parseCSV(workshopEventsPath);
const mappings = parseCSV(mappingsPath);

console.log('📊 FILE STATISTICS');
console.log('='.repeat(100));
console.log(`Source Course Events: ${courseEvents.length}`);
console.log(`Source Workshop Events: ${workshopEvents.length}`);
console.log(`Mappings File: ${mappings.length} rows`);
console.log('');

// Create lookup maps
const sourceEvents = new Map();
const mappingsMap = new Map();

// Index source events
courseEvents.forEach(row => {
  const url = row.Event_URL?.trim();
  const startDate = row.Start_Date?.trim();
  if (url && startDate) {
    const dateOnly = startDate.split(' ')[0];
    const key = `${url}|${dateOnly}`;
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
    const dateOnly = startDate.split(' ')[0];
    const key = `${url}|${dateOnly}`;
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
    const dateOnly = dateStart.split('T')[0];
    const key = `${url}|${dateOnly}`;
    if (!mappingsMap.has(key)) {
      mappingsMap.set(key, []);
    }
    mappingsMap.get(key).push({
      url,
      dateStart: dateOnly,
      productUrl: row.product_url?.trim(),
      productTitle: row.product_title?.trim()
    });
  }
});

// Find missing events
const missingEvents = [];
const today = new Date();
today.setHours(0, 0, 0, 0);

sourceEvents.forEach((event, key) => {
  const [url, startDate] = key.split('|');
  const lookupKey = `${url}|${startDate}`;
  
  if (!mappingsMap.has(lookupKey)) {
    const eventDate = new Date(startDate);
    eventDate.setHours(0, 0, 0, 0);
    const isPast = eventDate < today;
    
    missingEvents.push({
      ...event,
      isPast,
      daysFromToday: Math.floor((eventDate - today) / (1000 * 60 * 60 * 24))
    });
  }
});

// Sort by date
missingEvents.sort((a, b) => {
  const dateA = new Date(a.startDate.split(' ')[0]);
  const dateB = new Date(b.startDate.split(' ')[0]);
  return dateA - dateB;
});

// Group by past/future
const pastEvents = missingEvents.filter(e => e.isPast);
const futureEvents = missingEvents.filter(e => !e.isPast);

console.log('='.repeat(100));
console.log('📋 MISSING EVENTS FROM NEW MAPPINGS FILE');
console.log('='.repeat(100));
console.log(`\nTotal Missing: ${missingEvents.length} events\n`);

if (pastEvents.length > 0) {
  console.log(`❌ PAST EVENTS (${pastEvents.length}):`);
  console.log('-'.repeat(100));
  pastEvents.forEach((event, idx) => {
    const dateStr = event.startDate.split(' ')[0];
    console.log(`\n${idx + 1}. [${event.type.toUpperCase()}] ${event.title}`);
    console.log(`   📅 Date: ${dateStr} ${event.startTime || ''} (${Math.abs(event.daysFromToday)} days ago)`);
    console.log(`   🔗 URL: ${event.url}`);
  });
}

if (futureEvents.length > 0) {
  console.log(`\n\n✅ FUTURE EVENTS (${futureEvents.length}):`);
  console.log('-'.repeat(100));
  futureEvents.forEach((event, idx) => {
    const dateStr = event.startDate.split(' ')[0];
    console.log(`\n${idx + 1}. [${event.type.toUpperCase()}] ${event.title}`);
    console.log(`   📅 Date: ${dateStr} ${event.startTime || ''} (in ${event.daysFromToday} days)`);
    console.log(`   🔗 URL: ${event.url}`);
  });
}

console.log('\n' + '='.repeat(100));
console.log('📊 SUMMARY');
console.log('='.repeat(100));
console.log(`Total Source Events: ${sourceEvents.size}`);
console.log(`Total in Mappings: ${mappingsMap.size}`);
console.log(`Missing: ${missingEvents.length}`);
console.log(`  - Past Events: ${pastEvents.length} (${((pastEvents.length / missingEvents.length) * 100).toFixed(1)}%)`);
console.log(`  - Future Events: ${futureEvents.length} (${((futureEvents.length / missingEvents.length) * 100).toFixed(1)}%)`);
console.log(`  - Course Events: ${missingEvents.filter(e => e.type === 'course').length}`);
console.log(`  - Workshop Events: ${missingEvents.filter(e => e.type === 'workshop').length}`);

// Check for duplicates in mappings
const duplicateCheck = new Map();
mappings.forEach(row => {
  const url = row.event_url?.trim();
  const dateStart = row.date_start?.trim();
  if (url && dateStart) {
    const dateOnly = dateStart.split('T')[0];
    const key = `${url}|${dateOnly}`;
    duplicateCheck.set(key, (duplicateCheck.get(key) || 0) + 1);
  }
});

const duplicates = Array.from(duplicateCheck.entries()).filter(([_, count]) => count > 1);
if (duplicates.length > 0) {
  console.log(`\n⚠️  DUPLICATES IN MAPPINGS: ${duplicates.length} URL+date combinations appear multiple times`);
  duplicates.slice(0, 5).forEach(([key, count]) => {
    console.log(`   - ${key} (${count} times)`);
  });
} else {
  console.log(`\n✅ NO DUPLICATES: All URL+date combinations are unique`);
}

