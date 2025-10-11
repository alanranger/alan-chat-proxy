#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testSingleQuery() {
  console.log("🔍 Testing Single Query Response...\n");
  
  try {
    const response = await fetch('https://alan-ranger-chat-bot.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: "bluebell workshop",
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
    
    console.log("\n📅 Events Data:");
    if (data.structured?.events && data.structured.events.length > 0) {
      console.log(`   Found ${data.structured.events.length} events`);
      const event = data.structured.events[0];
      console.log("   First event fields:");
      console.log(`     title: ${event.title}`);
      console.log(`     start_date: ${event.start_date}`);
      console.log(`     end_date: ${event.end_date}`);
      console.log(`     start_time: ${event.start_time}`);
      console.log(`     end_time: ${event.end_time}`);
      console.log(`     location_name: ${event.location_name}`);
      console.log(`     location_address: ${event.location_address}`);
      console.log(`     price: ${event.price}`);
      console.log(`     categories: ${JSON.stringify(event.categories)}`);
      console.log(`     tags: ${JSON.stringify(event.tags)}`);
    } else {
      console.log("   No events found");
    }
    
    console.log("\n📦 Products Data:");
    if (data.structured?.products && data.structured.products.length > 0) {
      console.log(`   Found ${data.structured.products.length} products`);
      const product = data.structured.products[0];
      console.log("   First product fields:");
      console.log(`     title: ${product.title}`);
      console.log(`     price: ${product.price}`);
      console.log(`     availability: ${product.availability}`);
      console.log(`     location_name: ${product.location_name}`);
      console.log(`     categories: ${JSON.stringify(product.categories)}`);
      console.log(`     tags: ${JSON.stringify(product.tags)}`);
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

testSingleQuery();
