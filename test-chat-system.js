#!/usr/bin/env node

// Comprehensive Chat System Test Script
// Tests the entire pipeline: CSV import -> Ingest -> Chat responses

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test queries with expected results
const TEST_QUERIES = [
  {
    query: "what is iso",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["ISO", "exposure", "camera settings"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "tripod recommendation",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["tripod", "travel", "benro", "manfrotto"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "lightroom course",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["lightroom", "photo editing", "course"],
      minConfidence: 70,
      shouldHaveLocation: true,
      shouldHavePrice: true
    }
  },
  {
    query: "workshop near me",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["workshop", "photography"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  }
];

async function testDatabaseData() {
  console.log("🔍 Testing Database Data Quality...\n");
  
  // Test 1: CSV Metadata
  console.log("1. CSV Metadata Test:");
  const { data: csvData, error: csvError } = await supa
    .from('csv_metadata')
    .select('csv_type, categories, tags, title')
    .limit(10);
  
  if (csvError) {
    console.log("❌ CSV Metadata Error:", csvError.message);
    return false;
  }
  
  const csvWithCategories = csvData.filter(row => row.categories && row.categories.length > 0);
  const csvWithTags = csvData.filter(row => row.tags && row.tags.length > 0);
  
  console.log(`   Total CSV records: ${csvData.length}`);
  console.log(`   Records with categories: ${csvWithCategories.length}`);
  console.log(`   Records with tags: ${csvWithTags.length}`);
  
  if (csvWithCategories.length === 0) {
    console.log("❌ NO CATEGORIES FOUND IN CSV_METADATA!");
    return false;
  }
  
  // Test 2: Page Entities
  console.log("\n2. Page Entities Test:");
  const { data: peData, error: peError } = await supa
    .from('page_entities')
    .select('kind, categories, tags, title')
    .limit(10);
  
  if (peError) {
    console.log("❌ Page Entities Error:", peError.message);
    return false;
  }
  
  const peWithCategories = peData.filter(row => row.categories && row.categories.length > 0);
  const peWithTags = peData.filter(row => row.tags && row.tags.length > 0);
  
  console.log(`   Total page_entities records: ${peData.length}`);
  console.log(`   Records with categories: ${peWithCategories.length}`);
  console.log(`   Records with tags: ${peWithTags.length}`);
  
  // Test 3: Articles View
  console.log("\n3. Articles View Test:");
  const { data: articlesData, error: articlesError } = await supa
    .from('v_articles_unified')
    .select('title, categories, tags, publish_date')
    .limit(5);
  
  if (articlesError) {
    console.log("❌ Articles View Error:", articlesError.message);
    return false;
  }
  
  console.log(`   Articles found: ${articlesData.length}`);
  if (articlesData.length > 0) {
    console.log(`   Sample article: "${articlesData[0].title}"`);
    console.log(`   Categories: ${JSON.stringify(articlesData[0].categories)}`);
    console.log(`   Tags: ${JSON.stringify(articlesData[0].tags)}`);
  }
  
  return csvWithCategories.length > 0 && peWithCategories.length > 0;
}

async function testChatAPI(query, expected) {
  console.log(`\n🧪 Testing Query: "${query}"`);
  
  try {
    const response = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        pageContext: null
      })
    });
    
    if (!response.ok) {
      console.log(`❌ API Error: ${response.status} ${response.statusText}`);
      return false;
    }
    
    const data = await response.json();
    
    console.log(`   Response: "${data.response}"`);
    console.log(`   Confidence: ${data.confidence}%`);
    
    // Check confidence
    if (data.confidence < expected.minConfidence) {
      console.log(`❌ Low confidence: ${data.confidence}% < ${expected.minConfidence}%`);
      return false;
    }
    
    // Check for expected content
    if (expected.shouldFindArticles && data.articles) {
      console.log(`   Articles found: ${data.articles.length}`);
      if (data.articles.length === 0) {
        console.log("❌ No articles found when expected");
        return false;
      }
      
      // Check if articles have categories/tags
      const articlesWithCategories = data.articles.filter(a => a.categories && a.categories.length > 0);
      const articlesWithTags = data.articles.filter(a => a.tags && a.tags.length > 0);
      
      console.log(`   Articles with categories: ${articlesWithCategories.length}`);
      console.log(`   Articles with tags: ${articlesWithTags.length}`);
      
      if (expected.shouldHaveCategories && articlesWithCategories.length === 0) {
        console.log("❌ No articles have categories");
        return false;
      }
    }
    
    if (expected.shouldFindProducts && data.products) {
      console.log(`   Products found: ${data.products.length}`);
      if (data.products.length === 0) {
        console.log("❌ No products found when expected");
        return false;
      }
    }
    
    if (expected.shouldFindEvents && data.events) {
      console.log(`   Events found: ${data.events.length}`);
      if (data.events.length === 0) {
        console.log("❌ No events found when expected");
        return false;
      }
    }
    
    console.log("✅ Query test passed");
    return true;
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log("🚀 Starting Comprehensive Chat System Tests\n");
  console.log("=" * 60);
  
  // Test 1: Database Data Quality
  const dbTestPassed = await testDatabaseData();
  
  if (!dbTestPassed) {
    console.log("\n❌ DATABASE TESTS FAILED - Cannot proceed with API tests");
    console.log("🔧 Fix CSV import and ingest process first");
    return;
  }
  
  console.log("\n✅ Database tests passed - proceeding with API tests");
  
  // Test 2: Chat API Tests
  let passedTests = 0;
  let totalTests = TEST_QUERIES.length;
  
  for (const test of TEST_QUERIES) {
    const passed = await testChatAPI(test.query, test.expected);
    if (passed) passedTests++;
  }
  
  // Summary
  console.log("\n" + "=" * 60);
  console.log(`📊 TEST SUMMARY: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log("🎉 ALL TESTS PASSED - System is working correctly!");
  } else {
    console.log("❌ SOME TESTS FAILED - System needs fixes");
  }
}

// Run the tests
runAllTests().catch(console.error);
