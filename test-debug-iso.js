#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testDebugISO() {
  console.log("🔍 Testing ISO Query with Debug Logs...\n");
  
  try {
    const response = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: "what is iso",
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
    
    console.log("📊 Debug Info:");
    if (data.debug?.debugInfo) {
      data.debug.debugInfo.forEach(info => {
        console.log(`   ${info}`);
      });
    }
    
    console.log("\n📝 Answer Content:");
    console.log(data.answer_markdown || data.response || 'No answer content');
    
    console.log("\n🔧 Pills:");
    if (data.structured?.pills) {
      data.structured.pills.forEach((pill, index) => {
        console.log(`   ${index + 1}. ${pill.label} -> ${pill.url}`);
      });
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testDebugISO();
