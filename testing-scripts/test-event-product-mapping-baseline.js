// scripts/test-event-product-mapping-baseline.js
// Comprehensive baseline test for event-product mapping fixes

import fs from 'fs';
import path from 'path';

console.log('🧪 EVENT-PRODUCT MAPPING BASELINE TEST');
console.log('=====================================');

// File paths
const CORRECT_MAPPINGS_FILE = 'Working Files Downloaded/event-product-mappings-2025-10-19T12-39-30-604Z.csv';
const INCORRECT_MAPPINGS_FILE = 'Working Files Downloaded/event-product-mappings-2025-10-19T12-12-47-043Z.csv';

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

// Load and compare mappings
function loadAndCompareMappings() {
  console.log('\n📁 Loading mapping files...');
  
  try {
    const correctContent = fs.readFileSync(CORRECT_MAPPINGS_FILE, 'utf8');
    const incorrectContent = fs.readFileSync(INCORRECT_MAPPINGS_FILE, 'utf8');
    
    const correctMappings = parseCSV(correctContent);
    const incorrectMappings = parseCSV(incorrectContent);
    
    console.log(`✅ Loaded ${correctMappings.length} correct mappings (full set)`);
    console.log(`✅ Loaded ${incorrectMappings.length} incorrect mappings (problematic subset)`);
    
    // Create lookup maps
    const correctMap = new Map();
    correctMappings.forEach(mapping => {
      correctMap.set(mapping.event_url, {
        product_url: mapping.product_url,
        product_title: mapping.product_title,
        price_gbp: mapping.price_gbp,
        event_title: mapping.event_title
      });
    });
    
    const incorrectMap = new Map();
    incorrectMappings.forEach(mapping => {
      incorrectMap.set(mapping.event_url, {
        product_url: mapping.product_url,
        product_title: mapping.product_title,
        price_gbp: mapping.price_gbp,
        event_title: mapping.event_title
      });
    });
    
    // Find differences - check each incorrect mapping against correct mapping
    console.log('\n🔍 Analyzing differences...');
    const differences = [];
    
    // Check each incorrect mapping to see what it should be
    for (const [eventUrl, incorrectMapping] of incorrectMap) {
      const correctMapping = correctMap.get(eventUrl);
      
      if (correctMapping) {
        if (correctMapping.product_url !== incorrectMapping.product_url) {
          differences.push({
            event_url: eventUrl,
            event_title: incorrectMapping.event_title,
            correct: {
              product_url: correctMapping.product_url,
              product_title: correctMapping.product_title,
              price_gbp: correctMapping.price_gbp
            },
            incorrect: {
              product_url: incorrectMapping.product_url,
              product_title: incorrectMapping.product_title,
              price_gbp: incorrectMapping.price_gbp
            }
          });
        } else {
          console.log(`✅ ${eventUrl} - mapping is correct`);
        }
      } else {
        console.log(`⚠️ ${eventUrl} - not found in correct mappings`);
      }
    }
    
    console.log(`\n❌ Found ${differences.length} incorrect mappings:`);
    differences.forEach((diff, index) => {
      console.log(`\n${index + 1}. ${diff.event_title}`);
      console.log(`   Event URL: ${diff.event_url}`);
      console.log(`   ❌ Current (WRONG): ${diff.incorrect.product_title} - £${diff.incorrect.price_gbp}`);
      console.log(`   ✅ Should be: ${diff.correct.product_title} - £${diff.correct.price_gbp}`);
    });
    
    return {
      correctMappings,
      incorrectMappings,
      differences,
      correctMap,
      incorrectMap
    };
    
  } catch (error) {
    console.error('❌ Error loading mapping files:', error.message);
    return null;
  }
}

// Test current database state
async function testCurrentDatabaseState() {
  console.log('\n🗄️ Testing current database state...');
  
  // This would need to be implemented with actual database queries
  // For now, we'll create a placeholder structure
  console.log('📊 Database state test would go here...');
  console.log('   - Query current event_product_links_auto table');
  console.log('   - Compare with expected correct mappings');
  console.log('   - Identify which mappings need fixing');
  
  return {
    currentMappings: [],
    needsFixing: []
  };
}

// Generate test report
function generateTestReport(analysis) {
  if (!analysis) return;
  
  console.log('\n📋 BASELINE TEST REPORT');
  console.log('======================');
  console.log(`Total mappings analyzed: ${analysis.correctMappings.length}`);
  console.log(`Incorrect mappings found: ${analysis.differences.length}`);
  console.log(`Correct mappings: ${analysis.correctMappings.length - analysis.differences.length}`);
  
  console.log('\n🎯 INCORRECT MAPPINGS TO FIX:');
  analysis.differences.forEach((diff, index) => {
    console.log(`${index + 1}. ${diff.event_title}`);
    console.log(`   Current: £${diff.incorrect.price_gbp} → Should be: £${diff.correct.price_gbp}`);
  });
  
  console.log('\n✅ NEXT STEPS:');
  console.log('1. Fix the refresh_event_product_autolinks function');
  console.log('2. Run this test again to verify fixes');
  console.log('3. Ensure no correct mappings are broken');
  
  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    totalMappings: analysis.correctMappings.length,
    incorrectMappings: analysis.differences.length,
    differences: analysis.differences,
    summary: {
      correctMappings: analysis.correctMappings.length - analysis.differences.length,
      incorrectMappings: analysis.differences.length,
      needsFixing: analysis.differences.map(d => d.event_url)
    }
  };
  
  const reportFile = `results/event-mapping-baseline-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n💾 Detailed report saved to: ${reportFile}`);
  
  return report;
}

// Main test function
async function runBaselineTest() {
  console.log('🚀 Starting baseline test...');
  
  // Step 1: Load and compare mappings
  const analysis = loadAndCompareMappings();
  if (!analysis) {
    console.log('❌ Failed to load mapping files');
    return;
  }
  
  // Step 2: Test current database state
  const dbState = await testCurrentDatabaseState();
  
  // Step 3: Generate comprehensive report
  const report = generateTestReport(analysis);
  
  console.log('\n✅ BASELINE TEST COMPLETE');
  console.log('========================');
  console.log('Ready to fix the mapping algorithm and re-test!');
  
  return report;
}

// Run the test
runBaselineTest().catch(console.error);
