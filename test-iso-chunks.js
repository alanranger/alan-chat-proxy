#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testISOChunks() {
  console.log("🔍 Checking ISO content chunks...\n");
  
  try {
    // Check for chunks containing ISO content
    const { data: chunks, error } = await supa
      .from('page_chunks')
      .select('chunk_text, url, title')
      .ilike('chunk_text', '%iso%')
      .limit(5);
    
    if (error) {
      console.error("❌ Database error:", error);
      return;
    }
    
    console.log(`📚 Found ${chunks?.length || 0} chunks containing 'iso':`);
    chunks?.forEach((chunk, index) => {
      console.log(`\nChunk ${index + 1}:`);
      console.log(`   URL: ${chunk.url}`);
      console.log(`   Title: ${chunk.title}`);
      console.log(`   Text preview: ${chunk.chunk_text?.substring(0, 300)}...`);
    });
    
    // Also check for chunks from the ISO article specifically
    console.log("\n🔍 Checking chunks from ISO article specifically...");
    const { data: isoChunks, error: isoError } = await supa
      .from('page_chunks')
      .select('chunk_text, url, title')
      .eq('url', 'https://www.alanranger.com/blog-on-photography/what-is-iso-in-photography')
      .limit(3);
    
    if (isoError) {
      console.error("❌ ISO chunks error:", isoError);
      return;
    }
    
    console.log(`📚 Found ${isoChunks?.length || 0} chunks from ISO article:`);
    isoChunks?.forEach((chunk, index) => {
      console.log(`\nISO Chunk ${index + 1}:`);
      console.log(`   Text preview: ${chunk.chunk_text?.substring(0, 400)}...`);
    });
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testISOChunks();
