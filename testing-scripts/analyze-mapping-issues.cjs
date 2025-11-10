const fs = require('fs');
const path = require('path');

// Read the CSV files
const mappingsPath = path.join(__dirname, '../CSVSs from website/event-product-mappings-2025-11-10T10-32-29-696Z.csv');
const lessonsPath = path.join(__dirname, '../CSVSs from website/02 - www-alanranger-com__5013f4b2c4aaa4752ac69b17__beginners-photography-lessons.csv');
const workshopsPath = path.join(__dirname, '../CSVSs from website/03 - www-alanranger-com__5013f4b2c4aaa4752ac69b17__photographic-workshops-near-me.csv');

function parseCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
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
    
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || '';
    });
    return row;
  });
  
  return { headers, rows };
}

// Analyze mappings for duplicates
const mappingsContent = fs.readFileSync(mappingsPath, 'utf-8');
const mappings = parseCSV(mappingsContent);

console.log('=== DUPLICATE EVENT URLS IN MAPPINGS ===\n');
const eventUrlCounts = {};
mappings.rows.forEach(row => {
  const url = row.event_url;
  if (!eventUrlCounts[url]) {
    eventUrlCounts[url] = [];
  }
  eventUrlCounts[url].push(row);
});

const duplicates = Object.entries(eventUrlCounts).filter(([url, rows]) => rows.length > 1);
console.log(`Found ${duplicates.length} event URLs with duplicates:\n`);

duplicates.slice(0, 20).forEach(([url, rows]) => {
  console.log(`  ${url}: ${rows.length} duplicates`);
  rows.forEach((row, idx) => {
    console.log(`    ${idx + 1}. date_start: ${row.date_start || 'MISSING'}, product_url: ${row.product_url}`);
  });
});

// Analyze source CSVs for missing dates
console.log('\n\n=== MISSING EVENT DATES IN SOURCE CSVs ===\n');

const lessonsContent = fs.readFileSync(lessonsPath, 'utf-8');
const lessons = parseCSV(lessonsContent);

const workshopsContent = fs.readFileSync(workshopsPath, 'utf-8');
const workshops = parseCSV(workshopsContent);

// Check for missing dates in lessons
console.log('LESSON EVENTS (beginners-photography-lessons.csv):');
const lessonsWithoutDates = lessons.rows.filter(r => !r.Start_Date || r.Start_Date.trim() === '');
console.log(`  Total rows: ${lessons.rows.length}`);
console.log(`  Missing Start_Date: ${lessonsWithoutDates.length}`);
if (lessonsWithoutDates.length > 0) {
  lessonsWithoutDates.forEach(r => {
    console.log(`    - ${r.Event_Title || r.Event_URL || 'Unknown'}`);
  });
}

// Check for missing dates in workshops
console.log('\nWORKSHOP EVENTS (photographic-workshops-near-me.csv):');
const workshopsWithoutDates = workshops.rows.filter(r => !r.Start_Date || r.Start_Date.trim() === '');
console.log(`  Total rows: ${workshops.rows.length}`);
console.log(`  Missing Start_Date: ${workshopsWithoutDates.length}`);
if (workshopsWithoutDates.length > 0) {
  workshopsWithoutDates.forEach(r => {
    console.log(`    - ${r.Event_Title || r.Event_URL || 'Unknown'}`);
  });
}

// Check specific events mentioned by user
console.log('\n\n=== CHECKING SPECIFIC EVENTS MENTIONED ===\n');

const specificWorkshopEvents = [
  'Coventry Evening Urban Architecture Photography Workshop',
  'Long Exposure Photography Workshop - Sunset | Kenilworth',
  'Long Exposure Photography Workshop - Kenilworth 11-05',
  'Sunset Photographic Workshop - Chesterton Windmill 16-09',
  'Fairy Glen Betws-y-Coed Photography Workshop - Wales Autumn',
  'Batsford Arboretum Autumn Photography Workshop - 24/10',
  'Batsford Arboretum Autumn Photography Workshop - 25/10',
  'Batsford Arboretum Autumn Photography Workshop -29/10'
];

console.log('WORKSHOP EVENTS:');
specificWorkshopEvents.forEach(eventTitle => {
  const found = workshops.rows.find(r => 
    r.Event_Title && r.Event_Title.includes(eventTitle.split(' - ')[0])
  );
  if (found) {
    console.log(`  ✓ Found: "${found.Event_Title}"`);
    console.log(`    Start_Date: ${found.Start_Date || 'MISSING'}`);
    console.log(`    Event_URL: ${found.Event_URL || 'MISSING'}`);
  } else {
    console.log(`  ✗ NOT FOUND: "${eventTitle}"`);
  }
});

// Check for RPS, Camera Courses, and Lightroom events
console.log('\nLESSON EVENTS:');
const rpsEvents = lessons.rows.filter(r => r.Event_Title && r.Event_Title.includes('RPS'));
const cameraEvents = lessons.rows.filter(r => r.Event_Title && r.Event_Title.includes('Camera Courses'));
const lightroomEvents = lessons.rows.filter(r => r.Event_Title && r.Event_Title.includes('Lightroom'));

console.log(`  RPS Courses events: ${rpsEvents.length} total`);
rpsEvents.forEach(r => {
  console.log(`    - ${r.Event_Title}: Start_Date = ${r.Start_Date || 'MISSING'}`);
});

console.log(`\n  Camera Courses events: ${cameraEvents.length} total`);
const cameraWithoutDates = cameraEvents.filter(r => !r.Start_Date || r.Start_Date.trim() === '');
console.log(`    Missing dates: ${cameraWithoutDates.length}`);
cameraWithoutDates.forEach(r => {
  console.log(`    - ${r.Event_Title}: Event_URL = ${r.Event_URL || 'MISSING'}`);
});

console.log(`\n  Lightroom events: ${lightroomEvents.length} total`);
const lightroomWithoutDates = lightroomEvents.filter(r => !r.Start_Date || r.Start_Date.trim() === '');
console.log(`    Missing dates: ${lightroomWithoutDates.length}`);
lightroomWithoutDates.forEach(r => {
  console.log(`    - ${r.Event_Title}: Event_URL = ${r.Event_URL || 'MISSING'}`);
});

// Summary
console.log('\n\n=== SUMMARY ===');
console.log(`Mappings CSV: ${mappings.rows.length} total rows, ${duplicates.length} duplicate event URLs`);
console.log(`Lessons CSV: ${lessons.rows.length} total, ${lessonsWithoutDates.length} missing dates`);
console.log(`Workshops CSV: ${workshops.rows.length} total, ${workshopsWithoutDates.length} missing dates`);

