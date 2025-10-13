#!/usr/bin/env node

async function testCourseProduct() {
  console.log("🔍 Testing Course Product Query...\n");
  
  try {
    const response = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: "beginners photography course",
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
      console.log(`     description: ${product.description}`);
      console.log(`     price: ${product.price}`);
      console.log(`     participants: ${product.participants}`);
      console.log(`     fitness_level: ${product.fitness_level}`);
      console.log(`     location_address: ${product.location_address}`);
      console.log(`     equipment_needed: ${product.equipment_needed}`);
      console.log(`     experience_level: ${product.experience_level}`);
      console.log(`     time_schedule: ${product.time_schedule}`);
      console.log(`     what_to_bring: ${product.what_to_bring}`);
      console.log(`     course_duration: ${product.course_duration}`);
      console.log(`     instructor_info: ${product.instructor_info}`);
      console.log(`     availability_status: ${product.availability_status}`);
    } else {
      console.log("   No products found");
    }
    
    console.log("\n🔧 Debug Counts:");
    if (data.debug?.counts) {
      console.log(`   Events: ${data.debug.counts.events}`);
      console.log(`   Products: ${data.debug.counts.products}`);
      console.log(`   Articles: ${data.debug.counts.articles}`);
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testCourseProduct();

