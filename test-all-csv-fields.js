#!/usr/bin/env node

// Comprehensive CSV Field Testing Script
// Tests ALL fields from ALL CSV types to ensure complete data integrity

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Expected fields for each CSV type based on the actual CSV files
const EXPECTED_CSV_FIELDS = {
  blog: {
    required: ['url', 'title', 'categories', 'tags', 'publish_date', 'image_url'],
    optional: ['excerpt']
  },
  course_events: {
    required: ['url', 'title', 'start_date', 'end_date', 'start_time', 'end_time', 'location_name', 'location_address'],
    optional: ['categories', 'tags', 'participants', 'fitness_level', 'price']
  },
  workshop_events: {
    required: ['url', 'title', 'start_date', 'end_date', 'start_time', 'end_time', 'location_name', 'location_address'],
    optional: ['categories', 'tags', 'participants', 'fitness_level', 'price']
  },
  course_products: {
    required: ['url', 'title', 'price', 'availability'],
    optional: ['categories', 'tags', 'description', 'participants', 'fitness_level']
  },
  workshop_products: {
    required: ['url', 'title', 'price', 'availability'],
    optional: ['categories', 'tags', 'description', 'participants', 'fitness_level']
  },
  site_urls: {
    required: ['url', 'title'],
    optional: ['categories', 'tags', 'description']
  },
  product_schema: {
    required: ['url', 'title', 'price', 'availability'],
    optional: ['categories', 'tags', 'description', 'sku', 'provider']
  }
};

async function testAllCSVFields() {
  console.log("🔍 Testing ALL CSV Fields Across ALL CSV Types...\n");
  console.log("=" * 80);
  
  let totalTests = 0;
  let passedTests = 0;
  
  for (const [csvType, fieldSpec] of Object.entries(EXPECTED_CSV_FIELDS)) {
    console.log(`\n📊 Testing ${csvType.toUpperCase()} CSV Fields:`);
    console.log("-" * 50);
    
    // Get sample records for this CSV type
    const { data: records, error } = await supa
      .from('csv_metadata')
      .select('*')
      .eq('csv_type', csvType)
      .limit(5);
    
    if (error) {
      console.log(`❌ Error fetching ${csvType} records:`, error.message);
      continue;
    }
    
    if (!records || records.length === 0) {
      console.log(`❌ No ${csvType} records found`);
      continue;
    }
    
    console.log(`   Found ${records.length} ${csvType} records`);
    
    // Test required fields
    console.log(`\n   🔴 Required Fields:`);
    for (const field of fieldSpec.required) {
      totalTests++;
      const recordsWithField = records.filter(r => r[field] !== null && r[field] !== undefined && r[field] !== '');
      const percentage = (recordsWithField.length / records.length * 100).toFixed(1);
      
      if (recordsWithField.length === records.length) {
        console.log(`   ✅ ${field}: ${recordsWithField.length}/${records.length} (${percentage}%)`);
        passedTests++;
      } else if (recordsWithField.length > 0) {
        console.log(`   ⚠️  ${field}: ${recordsWithField.length}/${records.length} (${percentage}%) - PARTIAL`);
        passedTests += 0.5;
      } else {
        console.log(`   ❌ ${field}: ${recordsWithField.length}/${records.length} (${percentage}%) - MISSING`);
      }
      
      // Show sample values for debugging
      if (recordsWithField.length > 0) {
        const sampleValue = recordsWithField[0][field];
        if (Array.isArray(sampleValue)) {
          console.log(`      Sample: [${sampleValue.join(', ')}]`);
        } else {
          console.log(`      Sample: "${sampleValue}"`);
        }
      }
    }
    
    // Test optional fields
    console.log(`\n   🟡 Optional Fields:`);
    for (const field of fieldSpec.optional) {
      totalTests++;
      const recordsWithField = records.filter(r => r[field] !== null && r[field] !== undefined && r[field] !== '');
      const percentage = (recordsWithField.length / records.length * 100).toFixed(1);
      
      if (recordsWithField.length > 0) {
        console.log(`   ✅ ${field}: ${recordsWithField.length}/${records.length} (${percentage}%)`);
        passedTests++;
        
        // Show sample values for debugging
        const sampleValue = recordsWithField[0][field];
        if (Array.isArray(sampleValue)) {
          console.log(`      Sample: [${sampleValue.join(', ')}]`);
        } else {
          console.log(`      Sample: "${sampleValue}"`);
        }
      } else {
        console.log(`   ⚪ ${field}: ${recordsWithField.length}/${records.length} (${percentage}%) - Not present`);
        passedTests += 0.5; // Optional fields get partial credit
      }
    }
  }
  
  // Test page_entities integration
  console.log(`\n\n🔗 Testing Page Entities Integration:`);
  console.log("-" * 50);
  
  const { data: peRecords, error: peError } = await supa
    .from('page_entities')
    .select('kind, categories, tags, publish_date, start_date, end_date, start_time, end_time, location_name, location_address, location_city_state_zip, image_url, json_ld_data, workflow_state')
    .limit(20);
  
  if (peError) {
    console.log(`❌ Error fetching page_entities:`, peError.message);
  } else {
    console.log(`   Found ${peRecords.length} page_entities records`);
    
    // Test CSV field transfer to page_entities
    const csvFields = ['categories', 'tags', 'publish_date', 'start_date', 'end_date', 'start_time', 'end_time', 'location_name', 'location_address', 'location_city_state_zip', 'image_url', 'json_ld_data', 'workflow_state'];
    
    for (const field of csvFields) {
      totalTests++;
      const recordsWithField = peRecords.filter(r => r[field] !== null && r[field] !== undefined && r[field] !== '');
      const percentage = (recordsWithField.length / peRecords.length * 100).toFixed(1);
      
      if (recordsWithField.length > 0) {
        console.log(`   ✅ page_entities.${field}: ${recordsWithField.length}/${peRecords.length} (${percentage}%)`);
        passedTests++;
        
        // Show sample values
        const sampleValue = recordsWithField[0][field];
        if (Array.isArray(sampleValue)) {
          console.log(`      Sample: [${sampleValue.join(', ')}]`);
        } else {
          console.log(`      Sample: "${sampleValue}"`);
        }
      } else {
        console.log(`   ❌ page_entities.${field}: ${recordsWithField.length}/${peRecords.length} (${percentage}%) - MISSING`);
      }
    }
  }
  
  // Summary
  console.log("\n" + "=" * 80);
  console.log(`📊 COMPREHENSIVE TEST SUMMARY: ${passedTests}/${totalTests} tests passed`);
  console.log(`   Success Rate: ${(passedTests / totalTests * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log("🎉 ALL TESTS PASSED - Complete data integrity verified!");
  } else if (passedTests / totalTests >= 0.8) {
    console.log("⚠️  MOSTLY WORKING - Some fields need attention");
  } else {
    console.log("❌ MAJOR ISSUES - Significant data integrity problems");
  }
  
  return passedTests / totalTests;
}

// Run the comprehensive test
testAllCSVFields().catch(console.error);
