// scripts/analyze-13-mapping-changes.js
// Detailed analysis of the 13 unexpected mapping changes

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

console.log('🔍 DETAILED ANALYSIS OF 13 MAPPING CHANGES');
console.log('==========================================');

const supabaseUrl = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse CSV function
function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

// Calculate duration in hours
function calculateDuration(dateStart, dateEnd) {
  const start = new Date(dateStart);
  const end = new Date(dateEnd);
  return (end - start) / (1000 * 60 * 60);
}

// Load baseline and current mappings
async function loadMappings() {
  console.log('📁 Loading mappings...');
  
  // Load baseline from CSV
  const baselineContent = fs.readFileSync('Working Files Downloaded/event-product-mappings-2025-10-19T12-39-30-604Z.csv', 'utf8');
  const baselineMappings = parseCSV(baselineContent);
  
  // Load current from database
  const { data: currentMappings } = await supabase
    .from('v_event_product_mappings')
    .select('event_url, event_title, product_url, product_title, price_gbp, date_start, date_end');
  
  // Create lookup maps
  const baselineMap = new Map();
  baselineMappings.forEach(mapping => {
    baselineMap.set(mapping.event_url, {
      product_url: mapping.product_url,
      product_title: mapping.product_title,
      price_gbp: mapping.price_gbp,
      event_title: mapping.event_title
    });
  });
  
  const currentMap = new Map();
  currentMappings.forEach(mapping => {
    currentMap.set(mapping.event_url, {
      product_url: mapping.product_url,
      product_title: mapping.product_title,
      price_gbp: mapping.price_gbp,
      event_title: mapping.event_title,
      date_start: mapping.date_start,
      date_end: mapping.date_end
    });
  });
  
  return { baselineMap, currentMap };
}

// Analyze each change
function analyzeChange(eventUrl, baseline, current) {
  const duration = current.date_start && current.date_end ? 
    calculateDuration(current.date_start, current.date_end) : null;
  
  const analysis = {
    event_url: eventUrl,
    event_title: current.event_title,
    duration_hours: duration,
    baseline: {
      product_title: baseline.product_title,
      price_gbp: baseline.price_gbp,
      product_url: baseline.product_url
    },
    current: {
      product_title: current.product_title,
      price_gbp: current.price_gbp,
      product_url: current.product_url
    },
    analysis: {
      price_change: baseline.price_gbp !== current.price_gbp.toString(),
      product_change: baseline.product_url !== current.product_url,
      title_change: baseline.product_title !== current.product_title
    }
  };
  
  // Add specific analysis based on event type
  if (eventUrl.includes('exmoor')) {
    analysis.analysis.notes = 'Exmoor workshop - price changed from £750 to £575';
    analysis.analysis.likely_cause = 'Algorithm now prefers more specific location matching';
  } else if (eventUrl.includes('peak-district')) {
    analysis.analysis.notes = 'Peak District workshop - product title formatting improved';
    analysis.analysis.likely_cause = 'Algorithm now prefers cleaner product titles';
  } else if (eventUrl.includes('secrets-of-woodland')) {
    analysis.analysis.notes = 'Woodland Photography workshop - product title formatting improved';
    analysis.analysis.likely_cause = 'Algorithm now prefers cleaner product titles';
  } else if (eventUrl.includes('woodland-photography-walk')) {
    analysis.analysis.notes = 'Woodland walk - changed from Garden Photography (£35) to Woodland Walks (£15)';
    analysis.analysis.likely_cause = 'Algorithm now prefers more specific activity matching';
  }
  
  return analysis;
}

// Main analysis function
async function analyzeChanges() {
  console.log('🚀 Starting detailed analysis...');
  
  const { baselineMap, currentMap } = await loadMappings();
  
  // Find all changes
  const changes = [];
  for (const [eventUrl, baseline] of baselineMap) {
    const current = currentMap.get(eventUrl);
    if (current && (
      baseline.product_url !== current.product_url ||
      baseline.price_gbp !== current.price_gbp.toString()
    )) {
      changes.push(analyzeChange(eventUrl, baseline, current));
    }
  }
  
  // Filter out the expected changes (Fairy Glen and Snowdonia)
  const unexpectedChanges = changes.filter(change => 
    !change.event_url.includes('fairy-glen') && 
    !change.event_url.includes('landscape-photography-snowdonia')
  );
  
  console.log(`\n📊 Found ${unexpectedChanges.length} unexpected changes to analyze:`);
  
  unexpectedChanges.forEach((change, index) => {
    console.log(`\n${index + 1}. ${change.event_title}`);
    console.log(`   Event URL: ${change.event_url}`);
    if (change.duration_hours) {
      console.log(`   Duration: ${change.duration_hours} hours`);
    }
    console.log(`   \n   📋 BASELINE MAPPING:`);
    console.log(`      Product: ${change.baseline.product_title}`);
    console.log(`      Price: £${change.baseline.price_gbp}`);
    console.log(`      URL: ${change.baseline.product_url}`);
    console.log(`   \n   🔄 CURRENT MAPPING:`);
    console.log(`      Product: ${change.current.product_title}`);
    console.log(`      Price: £${change.current.price_gbp}`);
    console.log(`      URL: ${change.current.product_url}`);
    console.log(`   \n   📝 ANALYSIS:`);
    console.log(`      Price changed: ${change.analysis.price_change ? 'YES' : 'NO'}`);
    console.log(`      Product changed: ${change.analysis.product_change ? 'YES' : 'NO'}`);
    console.log(`      Title changed: ${change.analysis.title_change ? 'YES' : 'NO'}`);
    if (change.analysis.notes) {
      console.log(`      Notes: ${change.analysis.notes}`);
    }
    if (change.analysis.likely_cause) {
      console.log(`      Likely cause: ${change.analysis.likely_cause}`);
    }
    console.log(`   \n   ❓ FOR YOUR REVIEW:`);
    console.log(`      Is this change CORRECT (improvement) or INCORRECT (regression)?`);
    console.log(`      Should we KEEP this change or REVERT it?`);
  });
  
  // Save detailed analysis
  const report = {
    timestamp: new Date().toISOString(),
    totalChanges: changes.length,
    unexpectedChanges: unexpectedChanges.length,
    changes: unexpectedChanges
  };
  
  const reportFile = `results/detailed-13-changes-analysis-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n💾 Detailed analysis saved to: ${reportFile}`);
  
  return unexpectedChanges;
}

// Run the analysis
analyzeChanges().catch(console.error);



