#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testContentChunks() {
  console.log("🔍 Testing Content Chunks for ISO Query...\n");
  
  try {
    // First, let's check what content chunks are being returned
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
      return;
    }
    
    const data = await response.json();
    
    console.log("📊 Debug Counts:");
    console.log(`   Content Chunks: ${data.debug?.counts?.contentChunks || 0}`);
    console.log(`   Articles: ${data.debug?.counts?.articles || 0}`);
    
    // Let's also check the database directly for content chunks
    console.log("\n🔍 Checking database for ISO content chunks...");
    
    const { data: chunks, error } = await supa
      .from('page_chunks')
      .select('chunk_text, source_url, title')
      .ilike('chunk_text', '%iso%')
      .limit(5);
    
    if (error) {
      console.error("❌ Database error:", error);
      return;
    }
    
    console.log(`📚 Found ${chunks?.length || 0} chunks containing 'iso':`);
    chunks?.forEach((chunk, index) => {
      console.log(`\nChunk ${index + 1}:`);
      console.log(`   URL: ${chunk.source_url}`);
      console.log(`   Title: ${chunk.title}`);
      console.log(`   Text preview: ${chunk.chunk_text?.substring(0, 200)}...`);
    });
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testContentChunks();
