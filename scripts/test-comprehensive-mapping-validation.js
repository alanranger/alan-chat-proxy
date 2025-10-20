// scripts/test-comprehensive-mapping-validation.js
// Comprehensive before/after validation of ALL 129 mappings

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

console.log('🧪 COMPREHENSIVE MAPPING VALIDATION TEST');
console.log('========================================');

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

// Load baseline mappings from CSV
function loadBaselineMappings() {
  console.log('\n📁 Loading baseline mappings from CSV...');
  
  try {
    const content = fs.readFileSync('Working Files Downloaded/event-product-mappings-2025-10-19T12-39-30-604Z.csv', 'utf8');
    const mappings = parseCSV(content);
    
    console.log(`✅ Loaded ${mappings.length} baseline mappings from CSV`);
    
    // Create lookup map
    const baselineMap = new Map();
    mappings.forEach(mapping => {
      baselineMap.set(mapping.event_url, {
        product_url: mapping.product_url,
        product_title: mapping.product_title,
        price_gbp: mapping.price_gbp,
        event_title: mapping.event_title
      });
    });
    
    return baselineMap;
    
  } catch (error) {
    console.error('❌ Error loading baseline mappings:', error.message);
    return null;
  }
}

// Get current database mappings
async function getCurrentMappings() {
  console.log('\n🗄️ Loading current mappings from database...');
  
  try {
    const { data, error } = await supabase
      .from('v_event_product_mappings')
      .select('event_url, event_title, product_url, product_title, price_gbp');
    
    if (error) {
      console.error('❌ Database query error:', error);
      return null;
    }
    
    console.log(`✅ Loaded ${data.length} current mappings from database`);
    
    // Create lookup map
    const currentMap = new Map();
    data.forEach(mapping => {
      currentMap.set(mapping.event_url, {
        product_url: mapping.product_url,
        product_title: mapping.product_title,
        price_gbp: mapping.price_gbp,
        event_title: mapping.event_title
      });
    });
    
    return currentMap;
    
  } catch (error) {
    console.error('❌ Error loading current mappings:', error);
    return null;
  }
}

// Compare mappings
function compareMappings(baselineMap, currentMap) {
  console.log('\n🔍 Comparing baseline vs current mappings...');
  
  const changes = [];
  const unchanged = [];
  const missing = [];
  const added = [];
  
  // Check all baseline mappings
  for (const [eventUrl, baselineMapping] of baselineMap) {
    const currentMapping = currentMap.get(eventUrl);
    
    if (!currentMapping) {
      missing.push({
        event_url: eventUrl,
        event_title: baselineMapping.event_title,
        baseline: baselineMapping,
        current: null
      });
    } else {
      // Compare the mappings
      const isChanged = (
        baselineMapping.product_url !== currentMapping.product_url ||
        baselineMapping.price_gbp !== currentMapping.price_gbp.toString()
      );
      
      if (isChanged) {
        changes.push({
          event_url: eventUrl,
          event_title: baselineMapping.event_title,
          baseline: baselineMapping,
          current: currentMapping
        });
      } else {
        unchanged.push({
          event_url: eventUrl,
          event_title: baselineMapping.event_title,
          mapping: baselineMapping
        });
      }
    }
  }
  
  // Check for new mappings not in baseline
  for (const [eventUrl, currentMapping] of currentMap) {
    if (!baselineMap.has(eventUrl)) {
      added.push({
        event_url: eventUrl,
        event_title: currentMapping.event_title,
        mapping: currentMapping
      });
    }
  }
  
  return { changes, unchanged, missing, added };
}

// Generate comprehensive report
function generateComprehensiveReport(comparison) {
  console.log('\n📋 COMPREHENSIVE VALIDATION REPORT');
  console.log('==================================');
  
  const { changes, unchanged, missing, added } = comparison;
  
  console.log(`📊 SUMMARY:`);
  console.log(`   Total baseline mappings: ${unchanged.length + changes.length + missing.length}`);
  console.log(`   Unchanged mappings: ${unchanged.length}`);
  console.log(`   Changed mappings: ${changes.length}`);
  console.log(`   Missing mappings: ${missing.length}`);
  console.log(`   New mappings: ${added.length}`);
  
  if (changes.length > 0) {
    console.log(`\n🔄 CHANGED MAPPINGS (${changes.length}):`);
    changes.forEach((change, index) => {
      console.log(`\n${index + 1}. ${change.event_title}`);
      console.log(`   Event URL: ${change.event_url}`);
      console.log(`   Baseline: ${change.baseline.product_title} - £${change.baseline.price_gbp}`);
      console.log(`   Current:  ${change.current.product_title} - £${change.current.price_gbp}`);
      
      // Check if this is one of the expected fixes
      const isExpectedFix = (
        (change.event_url.includes('fairy-glen') && change.current.product_title.includes('FAIRY GLEN')) ||
        (change.event_url.includes('snowdonia') && change.current.product_title.includes('SNOWDONIA'))
      );
      
      if (isExpectedFix) {
        console.log(`   ✅ EXPECTED FIX: This change was intentional`);
      } else {
        console.log(`   ⚠️  UNEXPECTED CHANGE: This may be a regression`);
      }
    });
  }
  
  if (missing.length > 0) {
    console.log(`\n❌ MISSING MAPPINGS (${missing.length}):`);
    missing.forEach((missing, index) => {
      console.log(`${index + 1}. ${missing.event_title} - ${missing.event_url}`);
    });
  }
  
  if (added.length > 0) {
    console.log(`\n➕ NEW MAPPINGS (${added.length}):`);
    added.forEach((added, index) => {
      console.log(`${index + 1}. ${added.event_title} - ${added.event_url}`);
    });
  }
  
  // Validation summary
  console.log(`\n✅ VALIDATION SUMMARY:`);
  const expectedChanges = changes.filter(change => 
    (change.event_url.includes('fairy-glen') && change.current.product_title.includes('FAIRY GLEN')) ||
    (change.event_url.includes('snowdonia') && change.current.product_title.includes('SNOWDONIA'))
  ).length;
  
  const unexpectedChanges = changes.length - expectedChanges;
  
  console.log(`   Expected changes: ${expectedChanges} (Fairy Glen + Snowdonia fixes)`);
  console.log(`   Unexpected changes: ${unexpectedChanges}`);
  console.log(`   Unchanged mappings: ${unchanged.length}`);
  
  if (unexpectedChanges === 0 && missing.length === 0) {
    console.log(`\n🎉 VALIDATION PASSED: Only expected changes detected!`);
  } else {
    console.log(`\n⚠️  VALIDATION ISSUES: Unexpected changes or missing mappings detected!`);
  }
  
  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalBaseline: unchanged.length + changes.length + missing.length,
      unchanged: unchanged.length,
      changed: changes.length,
      missing: missing.length,
      added: added.length,
      expectedChanges: expectedChanges,
      unexpectedChanges: unexpectedChanges
    },
    changes: changes,
    unchanged: unchanged,
    missing: missing,
    added: added
  };
  
  const reportFile = `results/comprehensive-mapping-validation-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n💾 Detailed report saved to: ${reportFile}`);
  
  return report;
}

// Main validation function
async function runComprehensiveValidation() {
  console.log('🚀 Starting comprehensive mapping validation...');
  
  // Step 1: Load baseline mappings
  const baselineMap = loadBaselineMappings();
  if (!baselineMap) {
    console.log('❌ Failed to load baseline mappings');
    return;
  }
  
  // Step 2: Get current database mappings
  const currentMap = await getCurrentMappings();
  if (!currentMap) {
    console.log('❌ Failed to load current mappings');
    return;
  }
  
  // Step 3: Compare mappings
  const comparison = compareMappings(baselineMap, currentMap);
  
  // Step 4: Generate comprehensive report
  const report = generateComprehensiveReport(comparison);
  
  console.log('\n✅ COMPREHENSIVE VALIDATION COMPLETE');
  console.log('====================================');
  
  return report;
}

// Run the validation
runComprehensiveValidation().catch(console.error);




