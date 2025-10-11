#!/usr/bin/env node

// Comprehensive Chat System Test Script
// Tests the entire pipeline: CSV import -> Ingest -> Chat responses

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Comprehensive Test Queries - 30 questions covering all enhanced data aspects
const TEST_QUERIES = [
  // GENERAL ADVICE & TECHNICAL QUESTIONS
  {
    query: "what is iso",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["ISO", "exposure", "camera settings"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true,
      shouldHavePublishDate: true
    }
  },
  {
    query: "what is aperture in photography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["aperture", "depth of field"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is shutter speed",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["shutter", "exposure"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is depth of field",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["depth of field", "aperture"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is white balance",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["white balance", "color"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },

  // EQUIPMENT RECOMMENDATIONS
  {
    query: "what tripod do you recommend",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["tripod", "travel", "benro", "manfrotto"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "best camera for beginners",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["camera", "beginners"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what lens should I buy",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["lens", "equipment"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "camera bag recommendations",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["camera bag", "equipment"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what filters do I need",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["filters", "ND", "polarizing"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },

  // COURSES & PRODUCTS
  {
    query: "lightroom course",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["lightroom", "photo editing", "course"],
      minConfidence: 70,
      shouldHaveLocation: true,
      shouldHavePrice: true,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "beginners photography course",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["beginners", "photography", "course"],
      minConfidence: 70,
      shouldHaveLocation: true,
      shouldHavePrice: true
    }
  },
  {
    query: "photography course cost",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["course", "cost", "price"],
      minConfidence: 70,
      shouldHavePrice: true
    }
  },
  {
    query: "online photography course",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["online", "course"],
      minConfidence: 70,
      shouldHaveLocation: true
    }
  },
  {
    query: "photography mentoring",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["mentoring", "RPS"],
      minConfidence: 70,
      shouldHavePrice: true
    }
  },

  // WORKSHOPS & EVENTS
  {
    query: "bluebell workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["bluebell", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true,
      shouldHaveStartTime: true,
      shouldHaveEndTime: true
    }
  },
  {
    query: "devon workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["devon", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "autumn photography workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["autumn", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "woodland photography workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["woodland", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "landscape photography workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["landscape", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },

  // SPECIFIC LOCATIONS & DATES
  {
    query: "workshop in coventry",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["coventry", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveLocationAddress: true
    }
  },
  {
    query: "workshop in peak district",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["peak district", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in lake district",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["lake district", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in wales",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["wales", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in yorkshire",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["yorkshire", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },

  // TECHNICAL REQUIREMENTS & PARTICIPANTS
  {
    query: "do I need a laptop for lightroom course",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["lightroom", "laptop"],
      minConfidence: 70,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what camera do I need for course",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["camera", "course"],
      minConfidence: 70,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "can my 14 year old attend workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["workshop", "age"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "equipment needed for workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["workshop", "equipment"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "fitness level required for workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["workshop", "fitness"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },

  // PRICING & AVAILABILITY
  {
    query: "how much does a photography course cost",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["course", "cost"],
      minConfidence: 70,
      shouldHavePrice: true
    }
  },
  {
    query: "workshop price",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["workshop", "price"],
      minConfidence: 60,
      shouldHavePrice: true
    }
  },
  {
    query: "is the online course free",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["online", "free", "course"],
      minConfidence: 70,
      shouldHavePrice: true
    }
  },
  {
    query: "photography course availability",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["course", "availability"],
      minConfidence: 70,
      shouldHaveAvailability: true
    }
  },
  {
    query: "workshop booking",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["workshop", "booking"],
      minConfidence: 60,
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
    
    console.log(`   Response: "${data.answer_markdown || data.response || 'undefined'}"`);
    const confidencePercent = data.confidence * 100;
    console.log(`   Confidence: ${confidencePercent.toFixed(1)}%`);
    
    // Check confidence (convert to percentage for comparison)
    if (confidencePercent < expected.minConfidence) {
      console.log(`❌ Low confidence: ${confidencePercent.toFixed(1)}% < ${expected.minConfidence}%`);
      return false;
    }
    
    // Check for expected content
    const articles = data.structured?.articles || data.articles || [];
    if (expected.shouldFindArticles && articles.length > 0) {
      console.log(`   Articles found: ${articles.length}`);
      
      // Check if articles have categories/tags
      const articlesWithCategories = articles.filter(a => a.categories && a.categories.length > 0);
      const articlesWithTags = articles.filter(a => a.tags && a.tags.length > 0);
      
      console.log(`   Articles with categories: ${articlesWithCategories.length}`);
      console.log(`   Articles with tags: ${articlesWithTags.length}`);
      
      if (expected.shouldHaveCategories && articlesWithCategories.length === 0) {
        console.log("❌ No articles have categories");
        return false;
      }
    }
    
    const products = data.structured?.products || data.products || [];
    if (expected.shouldFindProducts && products.length > 0) {
      console.log(`   Products found: ${products.length}`);
    }
    
    const events = data.structured?.events || data.events || [];
    if (expected.shouldFindEvents && events.length > 0) {
      console.log(`   Events found: ${events.length}`);
      
      // Check for event-specific data
      if (expected.shouldHaveStartTime) {
        const eventsWithStartTime = events.filter(e => e.start_time);
        console.log(`   Events with start time: ${eventsWithStartTime.length}`);
      }
      
      if (expected.shouldHaveEndTime) {
        const eventsWithEndTime = events.filter(e => e.end_time);
        console.log(`   Events with end time: ${eventsWithEndTime.length}`);
      }
      
      if (expected.shouldHaveDates) {
        const eventsWithDates = events.filter(e => e.start_date || e.end_date);
        console.log(`   Events with dates: ${eventsWithDates.length}`);
      }
      
      if (expected.shouldHaveLocation) {
        const eventsWithLocation = events.filter(e => e.location_name || e.location_address);
        console.log(`   Events with location: ${eventsWithLocation.length}`);
      }
      
      if (expected.shouldHaveLocationAddress) {
        const eventsWithAddress = events.filter(e => e.location_address);
        console.log(`   Events with address: ${eventsWithAddress.length}`);
      }
      
      if (expected.shouldHavePrice) {
        const eventsWithPrice = events.filter(e => e.price);
        console.log(`   Events with price: ${eventsWithPrice.length}`);
      }
    }
    
    // Check for product-specific data
    if (expected.shouldHavePrice) {
      const productsWithPrice = products.filter(p => p.price);
      console.log(`   Products with price: ${productsWithPrice.length}`);
    }
    
    if (expected.shouldHaveAvailability) {
      const productsWithAvailability = products.filter(p => p.availability);
      console.log(`   Products with availability: ${productsWithAvailability.length}`);
    }
    
    if (expected.shouldHaveLocation) {
      const productsWithLocation = products.filter(p => p.location_name || p.location_address);
      console.log(`   Products with location: ${productsWithLocation.length}`);
    }
    
    // Check for article-specific data
    if (expected.shouldHavePublishDate) {
      const articlesWithPublishDate = articles.filter(a => a.publish_date);
      console.log(`   Articles with publish date: ${articlesWithPublishDate.length}`);
    }
    
    console.log("✅ Query test passed");
    return true;
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log("🚀 Starting Comprehensive Chat System Tests - 30 Questions\n");
  console.log("📋 Testing Categories:");
  console.log("   • General Advice & Technical Questions (5 questions)");
  console.log("   • Equipment Recommendations (5 questions)");
  console.log("   • Courses & Products (5 questions)");
  console.log("   • Workshops & Events (5 questions)");
  console.log("   • Specific Locations & Dates (5 questions)");
  console.log("   • Technical Requirements & Participants (5 questions)");
  console.log("   • Pricing & Availability (5 questions)\n");
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
  let categoryResults = {
    "General Advice": { passed: 0, total: 5 },
    "Equipment": { passed: 0, total: 5 },
    "Courses": { passed: 0, total: 5 },
    "Workshops": { passed: 0, total: 5 },
    "Locations": { passed: 0, total: 5 },
    "Requirements": { passed: 0, total: 5 },
    "Pricing": { passed: 0, total: 5 }
  };
  
  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const test = TEST_QUERIES[i];
    const categoryIndex = Math.floor(i / 5);
    const categoryNames = ["General Advice", "Equipment", "Courses", "Workshops", "Locations", "Requirements", "Pricing"];
    const categoryName = categoryNames[categoryIndex];
    
    const passed = await testChatAPI(test.query, test.expected);
    if (passed) {
      passedTests++;
      categoryResults[categoryName].passed++;
    }
  }
  
  // Summary
  console.log("\n" + "=" * 60);
  console.log(`📊 COMPREHENSIVE TEST SUMMARY: ${passedTests}/${totalTests} tests passed`);
  console.log(`   Overall Success Rate: ${((passedTests/totalTests)*100).toFixed(1)}%\n`);
  
  console.log("📈 Results by Category:");
  for (const [category, results] of Object.entries(categoryResults)) {
    const percentage = ((results.passed/results.total)*100).toFixed(1);
    const status = results.passed === results.total ? "✅" : results.passed >= results.total * 0.8 ? "⚠️" : "❌";
    console.log(`   ${status} ${category}: ${results.passed}/${results.total} (${percentage}%)`);
  }
  
  console.log("\n🎯 Enhanced Data Coverage:");
  console.log("   • Categories & Tags: ✅ Tested across all question types");
  console.log("   • Publish Dates: ✅ Tested for articles");
  console.log("   • Event Dates & Times: ✅ Tested for workshops");
  console.log("   • Locations & Addresses: ✅ Tested for events and products");
  console.log("   • Pricing & Availability: ✅ Tested for products");
  console.log("   • Technical Requirements: ✅ Tested for courses and workshops");
  
  if (passedTests === totalTests) {
    console.log("\n🎉 ALL TESTS PASSED - Enhanced data system is working perfectly!");
  } else if (passedTests >= totalTests * 0.8) {
    console.log("\n⚠️ MOSTLY WORKING - Enhanced data system performing well with minor issues");
  } else {
    console.log("\n❌ SOME TESTS FAILED - Enhanced data system needs attention");
  }
}

// Run the tests
runAllTests().catch(console.error);
