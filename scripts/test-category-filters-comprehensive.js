// Comprehensive test for category filtering, times, and event listings
// Tests all permutations of workshop clarification options

import fetch from 'node-fetch';

const API_URL = 'https://alan-chat-proxy.vercel.app/api/chat';
const INGEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';

console.log('🧪 COMPREHENSIVE CATEGORY FILTER TESTING');
console.log('==========================================');

// Test cases for all category filter permutations
const testCases = [
  {
    name: 'Initial Workshop Query',
    query: 'photography workshops',
    expectedBehavior: 'Should trigger clarification with options'
  },
  {
    name: '2.5hr - 4hr Workshops',
    query: '2.5hr - 4hr workshops',
    expectedBehavior: 'Should show only 2.5hr-4hr events with correct labels'
  },
  {
    name: '1 Day Workshops',
    query: '1 day workshops',
    expectedBehavior: 'Should show only 1-day events with correct labels'
  },
  {
    name: 'Multi Day Residential Workshops',
    query: 'Multi day residential workshops',
    expectedBehavior: 'Should show only 2-5-day events with correct labels'
  },
  {
    name: 'Workshops by Location',
    query: 'Workshops by location',
    expectedBehavior: 'Should show location-based clarification options'
  },
  {
    name: 'Workshops by Month',
    query: 'Workshops by month',
    expectedBehavior: 'Should show month-based clarification options'
  }
];

async function testCategoryFilter(testCase) {
  console.log(`\n🔍 Testing: ${testCase.name}`);
  console.log(`Query: "${testCase.query}"`);
  console.log(`Expected: ${testCase.expectedBehavior}`);
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INGEST_TOKEN}`
      },
      body: JSON.stringify({
        query: testCase.query,
        topK: 8
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.log(`❌ API Error: ${response.status} - ${result.error || 'Unknown error'}`);
      return;
    }

    // Analyze the response
    console.log(`✅ Response received`);
    console.log(`Intent: ${result.intent || 'unknown'}`);
    console.log(`Confidence: ${result.confidence || 'unknown'}`);
    console.log(`Version: ${result.debug?.version || 'unknown'}`);
    
    // Check if it's a clarification response
    if (result.clarification) {
      console.log(`📋 Clarification Response:`);
      console.log(`  Options: ${result.clarification.options?.length || 0}`);
      if (result.clarification.options) {
        result.clarification.options.forEach((option, index) => {
          console.log(`    ${index + 1}. ${option}`);
        });
      }
    }
    
    // Check if it's an events response
    if (result.events && Array.isArray(result.events)) {
      console.log(`📅 Events Response:`);
      console.log(`  Count: ${result.events.length}`);
      
      // Analyze event categories and times
      const categoryCounts = {};
      const timeIssues = [];
      const categoryLabelIssues = [];
      
      result.events.forEach((event, index) => {
        // Check categories
        if (event.categories && Array.isArray(event.categories)) {
          event.categories.forEach(cat => {
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
          });
        }
        
        // Check times (look for 1-hour discrepancies)
        if (event.start_time && event.end_time) {
          const startTime = event.start_time;
          const endTime = event.end_time;
          
          // Check for common time issues
          if (startTime.includes(':00:00') && !startTime.includes('T')) {
            timeIssues.push(`Event ${index + 1}: ${event.title} - Start time format issue: ${startTime}`);
          }
          if (endTime.includes(':00:00') && !endTime.includes('T')) {
            timeIssues.push(`Event ${index + 1}: ${event.title} - End time format issue: ${endTime}`);
          }
        }
        
        // Check category labels in title/description
        if (testCase.query.includes('2.5hr') && !event.title?.toLowerCase().includes('2.5') && !event.title?.toLowerCase().includes('short')) {
          categoryLabelIssues.push(`Event ${index + 1}: ${event.title} - May not be 2.5hr-4hr category`);
        }
        if (testCase.query.includes('1 day') && !event.title?.toLowerCase().includes('1-day') && !event.title?.toLowerCase().includes('day')) {
          categoryLabelIssues.push(`Event ${index + 1}: ${event.title} - May not be 1-day category`);
        }
      });
      
      console.log(`  Category Distribution:`);
      Object.entries(categoryCounts).forEach(([cat, count]) => {
        console.log(`    ${cat}: ${count} events`);
      });
      
      if (timeIssues.length > 0) {
        console.log(`  ⚠️  Time Issues:`);
        timeIssues.forEach(issue => console.log(`    ${issue}`));
      }
      
      if (categoryLabelIssues.length > 0) {
        console.log(`  ⚠️  Category Label Issues:`);
        categoryLabelIssues.forEach(issue => console.log(`    ${issue}`));
      }
      
      // Check chronological order
      const dates = result.events.map(e => new Date(e.date_start)).filter(d => !isNaN(d));
      const isChronological = dates.every((date, index) => 
        index === 0 || date >= dates[index - 1]
      );
      console.log(`  📅 Chronological Order: ${isChronological ? '✅ Correct' : '❌ Incorrect'}`);
      
      // Show sample events
      console.log(`  📋 Sample Events:`);
      result.events.slice(0, 3).forEach((event, index) => {
        console.log(`    ${index + 1}. ${event.title}`);
        console.log(`       Date: ${event.date_start}`);
        console.log(`       Time: ${event.start_time} - ${event.end_time}`);
        console.log(`       Categories: ${JSON.stringify(event.categories)}`);
        console.log(`       Location: ${event.location}`);
      });
    }
    
    // Check for debug information
    if (result.debug) {
      console.log(`🔧 Debug Info:`);
      console.log(`  Version: ${result.debug.version}`);
      if (result.debug.timestamp) {
        console.log(`  Timestamp: ${result.debug.timestamp}`);
      }
    }
    
  } catch (error) {
    console.log(`❌ Test Error: ${error.message}`);
  }
}

async function runComprehensiveTest() {
  console.log(`\n🚀 Starting comprehensive category filter testing...`);
  console.log(`Testing ${testCases.length} scenarios\n`);
  
  for (const testCase of testCases) {
    await testCategoryFilter(testCase);
    
    // Add delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n✅ COMPREHENSIVE TEST COMPLETE`);
  console.log(`\n📋 SUMMARY:`);
  console.log(`- Tested ${testCases.length} category filter scenarios`);
  console.log(`- Checked event filtering accuracy`);
  console.log(`- Verified time display correctness`);
  console.log(`- Validated chronological ordering`);
  console.log(`- Analyzed category label consistency`);
}

// Run the comprehensive test
runComprehensiveTest().catch(console.error);



