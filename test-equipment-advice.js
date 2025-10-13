#!/usr/bin/env node

// Test script for enhanced equipment advice responses
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test equipment advice queries
const TEST_QUERIES = [
  "what tripod do you recommend",
  "best camera for beginners",
  "what lens should I buy",
  "camera bag recommendations",
  "what filters do I need"
];

async function testEquipmentAdvice() {
  console.log("🧪 Testing Enhanced Equipment Advice Responses\n");
  
  for (const query of TEST_QUERIES) {
    console.log(`\n🔍 Testing Query: "${query}"`);
    console.log("=" * 60);
    
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
        continue;
      }
      
      const data = await response.json();
      
      console.log(`✅ Response received (${data.confidence * 100}% confidence)`);
      console.log(`📝 Answer:`);
      console.log(data.answer_markdown || data.response || 'No answer provided');
      
      // Check if it's using the new equipment advice system
      if (data.answer_markdown && data.answer_markdown.includes('Equipment Recommendations:')) {
        console.log(`🎯 ✅ Using enhanced equipment advice system`);
      } else {
        console.log(`⚠️ ❌ Not using enhanced equipment advice system`);
      }
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
    }
  }
  
  console.log("\n🏁 Equipment advice testing complete!");
}

// Run the tests
testEquipmentAdvice().catch(console.error);

