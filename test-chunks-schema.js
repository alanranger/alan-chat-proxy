#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testChunksSchema() {
  console.log("🔍 Checking chunks table schema...\n");
  
  try {
    // Let's check what columns exist in the chunks table
    const { data: chunks, error } = await supa
      .from('page_chunks')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error("❌ Database error:", error);
      return;
    }
    
    if (chunks && chunks.length > 0) {
      console.log("📊 Available columns in page_chunks:");
      Object.keys(chunks[0]).forEach(col => {
        console.log(`   - ${col}`);
      });
      
      console.log("\n🔍 Sample chunk data:");
      const sample = chunks[0];
      console.log(`   URL field: ${sample.page_url || sample.url || sample.source_url || 'not found'}`);
      console.log(`   Text preview: ${sample.chunk_text?.substring(0, 200)}...`);
    } else {
      console.log("❌ No chunks found");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testChunksSchema();
