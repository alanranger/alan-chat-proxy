#!/usr/bin/env node

// TEST RESTORE POINT - December 2025
// Verifies that courses and workshops are working perfectly

async function testRestorePoint() {
  console.log("🧪 TESTING RESTORE POINT - December 2025");
  console.log("=" * 50);
  
  const tests = [
    {
      name: "Beginners Photography Course",
      query: "beginners photography course",
      expectedFields: {
        title: "Beginners Photography Course",
        participants: "4",
        time_schedule: "19:00 - 21:00",
        course_duration: "3 weeks",
        location_address: "45 Hathaway Road, Tile Hill Village, Coventry, CV4 9HW"
      }
    },
    {
      name: "Lightroom Course",
      query: "when is the next lightroom course",
      expectedFields: {
        title: "Lightroom Courses for Beginners",
        participants: "3",
        time_schedule: "19:00 - 21:00",
        course_duration: "3 weeks",
        location_address: "45 Hathaway Road, Tile Hill Village, Coventry, CV4 9HW"
      }
    }
  ];
  
  let allTestsPassed = true;
  
  for (const test of tests) {
    console.log(`\n🔍 Testing: ${test.name}`);
    console.log(`Query: "${test.query}"`);
    
    try {
      const response = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: test.query,
          sessionId: "restore-point-test"
        })
      });
      
      if (!response.ok) {
        console.error(`❌ HTTP Error: ${response.status}`);
        allTestsPassed = false;
        continue;
      }
      
      const data = await response.json();
      
      if (!data.structured?.products || data.structured.products.length === 0) {
        console.error("❌ No products found");
        allTestsPassed = false;
        continue;
      }
      
      const product = data.structured.products[0];
      console.log("📦 Product found:");
      
      // Test each expected field
      for (const [field, expectedValue] of Object.entries(test.expectedFields)) {
        const actualValue = product[field];
        const isMatch = actualValue && actualValue.includes(expectedValue);
        
        if (isMatch) {
          console.log(`   ✅ ${field}: "${actualValue}"`);
        } else {
          console.log(`   ❌ ${field}: Expected "${expectedValue}", got "${actualValue}"`);
          allTestsPassed = false;
        }
      }
      
      // Check for problematic values
      const problematicFields = ['time_schedule', 'course_duration', 'location_address'];
      for (const field of problematicFields) {
        const value = product[field];
        if (value && (value.includes('milliseconds') || value.includes('Participants:'))) {
          console.log(`   ❌ ${field}: Contains problematic text: "${value}"`);
          allTestsPassed = false;
        }
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${test.name}:`, error.message);
      allTestsPassed = false;
    }
  }
  
  console.log("\n" + "=" * 50);
  if (allTestsPassed) {
    console.log("🎉 ALL TESTS PASSED - Restore Point is Working Perfectly!");
    console.log("✅ Courses and workshops are ready for production");
    console.log("✅ Ready to proceed with articles and general questions");
  } else {
    console.log("❌ SOME TESTS FAILED - Restore Point needs attention");
    console.log("⚠️ Do not proceed with articles until these issues are fixed");
  }
  console.log("=" * 50);
}

testRestorePoint();

