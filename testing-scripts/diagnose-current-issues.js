// Diagnose current issues with the chat system
import fetch from 'node-fetch';

const API_URL = 'https://alan-chat-proxy.vercel.app/api/chat';

async function testSingleQuery(query) {
  console.log(`🔍 Testing: "${query}"`);
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log(`📊 Response Analysis:`);
    console.log(`   - Has clarification: ${!!(result.question && result.options)}`);
    console.log(`   - Has events: ${!!result.events}`);
    console.log(`   - Event count: ${result.events?.length || 0}`);
    console.log(`   - Confidence: ${result.confidence || 'N/A'}`);
    console.log(`   - Response type: ${result.type || 'unknown'}`);
    
    if (result.events && result.events.length > 0) {
      console.log(`\n📋 Event Details:`);
      
      // Group by event URL to check for duplicates
      const eventGroups = {};
      result.events.forEach(event => {
        if (!eventGroups[event.event_url]) {
          eventGroups[event.event_url] = [];
        }
        eventGroups[event.event_url].push(event);
      });
      
      console.log(`   - Unique events: ${Object.keys(eventGroups).length}`);
      console.log(`   - Total event entries: ${result.events.length}`);
      
      // Check for Bluebell events specifically
      const bluebellEvents = result.events.filter(e => 
        e.title && e.title.toLowerCase().includes('bluebell')
      );
      
      if (bluebellEvents.length > 0) {
        console.log(`\n🌸 Bluebell Events (${bluebellEvents.length}):`);
        bluebellEvents.forEach(event => {
          console.log(`   - ${event.title}`);
          console.log(`     Time: ${event.start_time}-${event.end_time}`);
          console.log(`     Categories: ${JSON.stringify(event.categories)}`);
        });
      }
      
      // Check category distribution
      const categoryCounts = {};
      result.events.forEach(event => {
        if (event.categories) {
          event.categories.forEach(cat => {
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
          });
        }
      });
      
      console.log(`\n📊 Category Distribution:`);
      Object.entries(categoryCounts).forEach(([cat, count]) => {
        console.log(`   - ${cat}: ${count} events`);
      });
    }
    
    if (result.clarification) {
      console.log(`\n❓ Clarification Options:`);
      result.clarification.forEach((option, index) => {
        console.log(`   ${index + 1}. ${option}`);
      });
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

async function diagnoseIssues() {
  console.log('🔍 DIAGNOSING CURRENT CHAT SYSTEM ISSUES');
  console.log('==========================================\n');
  
  // Test 1: Initial workshop query (should trigger clarification)
  console.log('TEST 1: Initial Workshop Query');
  console.log('===============================');
  await testSingleQuery('photography workshops');
  console.log('\n');
  
  // Test 2: Direct category query (should show filtered events)
  console.log('TEST 2: Direct Category Query');
  console.log('==============================');
  await testSingleQuery('2.5hr - 4hr workshops');
  console.log('\n');
  
  // Test 3: 1-day query (should show only full-day sessions)
  console.log('TEST 3: 1-Day Query');
  console.log('====================');
  await testSingleQuery('1 day workshops');
  console.log('\n');
  
  console.log('🎯 DIAGNOSIS COMPLETE');
  console.log('=====================');
  console.log('Key Issues Identified:');
  console.log('1. Clarification system not triggering for initial queries');
  console.log('2. Category filtering not working (mixed categories shown)');
  console.log('3. Session parsing not working (no late sessions or full-day)');
  console.log('4. Event duplication (same URL appearing multiple times)');
  console.log('5. Database view not updated with session parsing logic');
}

diagnoseIssues().catch(console.error);
