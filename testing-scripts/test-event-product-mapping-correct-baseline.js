// scripts/test-event-product-mapping-correct-baseline.js
// Baseline test that identifies what the correct mappings SHOULD be

import fs from 'fs';

console.log('🧪 EVENT-PRODUCT MAPPING CORRECT BASELINE TEST');
console.log('==============================================');

// File paths
const CURRENT_MAPPINGS_FILE = 'Working Files Downloaded/event-product-mappings-2025-10-19T12-39-30-604Z.csv';

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
  return (end - start) / (1000 * 60 * 60); // Convert to hours
}

// Analyze current mappings and identify issues
function analyzeCurrentMappings() {
  console.log('\n📁 Loading current mappings...');
  
  try {
    const content = fs.readFileSync(CURRENT_MAPPINGS_FILE, 'utf8');
    const mappings = parseCSV(content);
    
    console.log(`✅ Loaded ${mappings.length} current mappings`);
    
    console.log('\n🔍 Analyzing ALL mappings for duration/price correlation issues...');
    
    const issues = [];
    
    mappings.forEach(mapping => {
      // Skip courses, focus on workshops
      if (mapping.subtype === 'workshop') {
        const duration = calculateDuration(mapping.date_start, mapping.date_end);
        const currentPrice = parseInt(mapping.price_gbp);
        
        // Determine expected price based on duration
        let expectedPrice, expectedProduct, issue;
        
        if (duration <= 4) {
          // Short workshops (≤4 hours) should be £35-125
          expectedPrice = duration <= 2 ? 35 : 125;
          if (currentPrice > 200) {
            issue = `Short workshop (${duration}h) mapped to £${currentPrice} but should be ≤£${expectedPrice}`;
          }
        } else if (duration <= 8) {
          // Half-day workshops (4-8 hours) should be £125-200
          expectedPrice = 125;
          if (currentPrice < 100 || currentPrice > 300) {
            issue = `Half-day workshop (${duration}h) mapped to £${currentPrice} but should be ~£${expectedPrice}`;
          }
        } else if (duration <= 24) {
          // Full-day workshops (8-24 hours) should be £200-400
          expectedPrice = 200;
          if (currentPrice < 150 || currentPrice > 500) {
            issue = `Full-day workshop (${duration}h) mapped to £${currentPrice} but should be ~£${expectedPrice}`;
          }
        } else {
          // Multi-day workshops (>24 hours) should be £400+
          expectedPrice = 400;
          if (currentPrice < 300) {
            issue = `Multi-day workshop (${duration}h) mapped to £${currentPrice} but should be ≥£${expectedPrice}`;
          }
        }
        
        // Special cases we know about
        if (mapping.event_url.includes('fairy-glen')) {
          expectedPrice = 125;
          if (currentPrice !== expectedPrice) {
            issue = `Fairy Glen (${duration}h) mapped to £${currentPrice} but should be £${expectedPrice}`;
          }
        } else if (mapping.event_url.includes('landscape-photography-snowdonia')) {
          expectedPrice = 595;
          if (currentPrice !== expectedPrice) {
            issue = `Snowdonia (${duration}h) mapped to £${currentPrice} but should be £${expectedPrice}`;
          }
        }
        
        if (issue) {
          issues.push({
            event_url: mapping.event_url,
            event_title: mapping.event_title,
            duration_hours: duration,
            current_price: currentPrice,
            current_product: mapping.product_title,
            expected_price: expectedPrice,
            issue: issue
          });
        }
      }
    });
    
    return { mappings, issues };
    
  } catch (error) {
    console.error('❌ Error loading mappings:', error.message);
    return null;
  }
}

// Generate baseline report
function generateBaselineReport(analysis) {
  if (!analysis) return;
  
  console.log('\n📋 CORRECT BASELINE REPORT');
  console.log('=========================');
  console.log(`Total mappings analyzed: ${analysis.mappings.length}`);
  console.log(`Issues identified: ${analysis.issues.length}`);
  
  if (analysis.issues.length > 0) {
    console.log('\n❌ INCORRECT MAPPINGS IDENTIFIED:');
    analysis.issues.forEach((issue, index) => {
      console.log(`\n${index + 1}. ${issue.event_title}`);
      console.log(`   Duration: ${issue.duration_hours} hours`);
      console.log(`   Current: £${issue.current_price} - ${issue.current_product}`);
      console.log(`   Should be: £${issue.expected_price} - ${issue.expected_product}`);
      console.log(`   Issue: ${issue.issue}`);
    });
  } else {
    console.log('\n✅ All mappings appear correct!');
  }
  
  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    totalMappings: analysis.mappings.length,
    issuesFound: analysis.issues.length,
    issues: analysis.issues,
    summary: {
      correctMappings: analysis.mappings.length - analysis.issues.length,
      incorrectMappings: analysis.issues.length,
      needsFixing: analysis.issues.map(i => i.event_url)
    }
  };
  
  const reportFile = `results/event-mapping-correct-baseline-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n💾 Detailed report saved to: ${reportFile}`);
  
  return report;
}

// Main test function
async function runCorrectBaselineTest() {
  console.log('🚀 Starting correct baseline test...');
  
  // Step 1: Analyze current mappings
  const analysis = analyzeCurrentMappings();
  if (!analysis) {
    console.log('❌ Failed to analyze mappings');
    return;
  }
  
  // Step 2: Generate comprehensive report
  const report = generateBaselineReport(analysis);
  
  console.log('\n✅ CORRECT BASELINE TEST COMPLETE');
  console.log('=================================');
  console.log('This establishes what the mappings SHOULD be.');
  console.log('Next: Fix the mapping algorithm and re-test!');
  
  return report;
}

// Run the test
runCorrectBaselineTest().catch(console.error);
