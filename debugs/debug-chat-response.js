#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debugChatResponse() {
  console.log("🔍 Debugging Chat API Response Structure...\n");
  
  try {
    const response = await fetch('https://alan-ranger-chat-bot.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: "bluebell workshop",
        sessionId: "debug-session"
      })
    });
    
    const data = await response.json();
    
    console.log("📊 Response Structure:");
    console.log(`   Success: ${data.ok}`);
    console.log(`   Confidence: ${data.confidence}`);
    console.log(`   Intent: ${data.structured?.intent}`);
    
    console.log("\n📋 Events Data:");
    if (data.structured?.events && data.structured.events.length > 0) {
      const event = data.structured.events[0];
      console.log(`   Found ${data.structured.events.length} events`);
      console.log("   Sample event fields:");
      Object.keys(event).forEach(key => {
        const value = event[key];
        const displayValue = typeof value === 'string' && value.length > 100 ? 
          value.substring(0, 100) + '...' : value;
        console.log(`     ${key}: ${displayValue}`);
      });
    } else {
      console.log("   No events found");
    }
    
    console.log("\n📦 Products Data:");
    if (data.structured?.products && data.structured.products.length > 0) {
      const product = data.structured.products[0];
      console.log(`   Found ${data.structured.products.length} products`);
      console.log("   Sample product fields:");
      Object.keys(product).forEach(key => {
        const value = product[key];
        const displayValue = typeof value === 'string' && value.length > 100 ? 
          value.substring(0, 100) + '...' : value;
        console.log(`     ${key}: ${displayValue}`);
      });
    } else {
      console.log("   No products found");
    }
    
    console.log("\n📰 Articles Data:");
    if (data.structured?.articles && data.structured.articles.length > 0) {
      const article = data.structured.articles[0];
      console.log(`   Found ${data.structured.articles.length} articles`);
      console.log("   Sample article fields:");
      Object.keys(article).forEach(key => {
        const value = article[key];
        const displayValue = typeof value === 'string' && value.length > 100 ? 
          value.substring(0, 100) + '...' : value;
        console.log(`     ${key}: ${displayValue}`);
      });
    } else {
      console.log("   No articles found");
    }
    
    console.log("\n🔧 Debug Info:");
    if (data.debug?.debugInfo) {
      data.debug.debugInfo.forEach(info => {
        console.log(`   ${info}`);
      });
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

debugChatResponse();
