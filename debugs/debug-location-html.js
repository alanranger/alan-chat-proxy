#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debugLocationHTML() {
  console.log("🔍 Debugging Location HTML Content...\n");
  
  try {
    // Get the course product from database
    const { data: products, error } = await supa
      .from('page_entities')
      .select('*')
      .eq('kind', 'product')
      .ilike('title', '%beginners photography course%')
      .limit(1);
    
    if (error) {
      console.error("❌ Database error:", error);
      return;
    }
    
    if (!products || products.length === 0) {
      console.log("❌ No products found");
      return;
    }
    
    const product = products[0];
    console.log("📦 Product found:");
    console.log(`   Title: ${product.title}`);
    console.log(`   URL: ${product.url}`);
    console.log(`   Location Address: ${product.location_address}`);
    console.log(`   Time Schedule: ${product.time_schedule}`);
    console.log(`   Course Duration: ${product.course_duration}`);
    
    // Get the raw HTML content
    const { data: chunks, error: chunkError } = await supa
      .from('page_chunks')
      .select('content')
      .eq('url', product.url);
    
    if (chunkError) {
      console.error("❌ Chunk error:", chunkError);
      return;
    }
    
    if (!chunks || chunks.length === 0) {
      console.log("❌ No chunks found");
      return;
    }
    
    // Combine all chunks to get the full content
    const fullContent = chunks.map(chunk => chunk.content).join('\n');
    
    console.log("\n📄 Full HTML Content (first 2000 chars):");
    console.log("=" * 50);
    console.log(fullContent.substring(0, 2000));
    console.log("=" * 50);
    
    // Look for location patterns
    console.log("\n🔍 Looking for location patterns:");
    const locationMatches = fullContent.match(/location[^a-zA-Z]*:?[^a-zA-Z]*([^\n\r]+)/gi);
    if (locationMatches) {
      locationMatches.forEach((match, i) => {
        console.log(`   Match ${i + 1}: ${match}`);
      });
    } else {
      console.log("   No location patterns found");
    }
    
    // Look for time patterns
    console.log("\n🔍 Looking for time patterns:");
    const timeMatches = fullContent.match(/time[^a-zA-Z]*:?[^a-zA-Z]*([^\n\r]+)/gi);
    if (timeMatches) {
      timeMatches.forEach((match, i) => {
        console.log(`   Match ${i + 1}: ${match}`);
      });
    } else {
      console.log("   No time patterns found");
    }
    
    // Look for duration patterns
    console.log("\n🔍 Looking for duration patterns:");
    const durationMatches = fullContent.match(/duration[^a-zA-Z]*:?[^a-zA-Z]*([^\n\r]+)/gi);
    if (durationMatches) {
      durationMatches.forEach((match, i) => {
        console.log(`   Match ${i + 1}: ${match}`);
      });
    } else {
      console.log("   No duration patterns found");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

debugLocationHTML();
