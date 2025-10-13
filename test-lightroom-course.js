#!/usr/bin/env node

async function testLightroomCourse() {
  console.log("🔍 Testing Lightroom Course Query...\n");
  
  try {
    const response = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: "when is the next lightroom course",
        sessionId: "test-session"
      })
    });
    
    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error("Response body:", text);
      return;
    }
    
    const data = await response.json();
    
    console.log("📊 Response Summary:");
    console.log(`   Success: ${data.ok}`);
    console.log(`   Confidence: ${data.confidence}`);
    console.log(`   Intent: ${data.structured?.intent}`);
    
    console.log("\n📦 Products Data:");
    if (data.structured?.products && data.structured.products.length > 0) {
      console.log(`   Found ${data.structured.products.length} products`);
      const product = data.structured.products[0];
      console.log("   First product fields:");
      console.log(`     title: ${product.title}`);
      console.log(`     time_schedule: ${product.time_schedule}`);
      console.log(`     course_duration: ${product.course_duration}`);
      console.log(`     location_address: ${product.location_address}`);
      console.log(`     participants: ${product.participants}`);
      console.log(`     equipment_needed: ${product.equipment_needed}`);
      console.log(`     experience_level: ${product.experience_level}`);
    } else {
      console.log("   No products found");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testLightroomCourse();

