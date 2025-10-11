#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debugDatabaseFields() {
  console.log("🔍 Debugging Database Fields...\n");
  
  try {
    // Check events in page_entities
    console.log("📅 Events in page_entities:");
    const { data: events, error: eventsError } = await supa
      .from('page_entities')
      .select('id, title, url, kind, start_date, end_date, start_time, end_time, location_name, location_address, price, categories, tags')
      .eq('kind', 'event')
      .limit(3);
    
    if (eventsError) {
      console.error("❌ Events error:", eventsError.message);
    } else {
      console.log(`   Found ${events?.length || 0} events`);
      if (events && events.length > 0) {
        const event = events[0];
        console.log("   Sample event fields:");
        Object.keys(event).forEach(key => {
          console.log(`     ${key}: ${event[key]}`);
        });
      }
    }
    
    console.log("\n📦 Products in page_entities:");
    const { data: products, error: productsError } = await supa
      .from('page_entities')
      .select('id, title, url, kind, price, availability, location_name, categories, tags')
      .eq('kind', 'product')
      .limit(3);
    
    if (productsError) {
      console.error("❌ Products error:", productsError.message);
    } else {
      console.log(`   Found ${products?.length || 0} products`);
      if (products && products.length > 0) {
        const product = products[0];
        console.log("   Sample product fields:");
        Object.keys(product).forEach(key => {
          console.log(`     ${key}: ${product[key]}`);
        });
      }
    }
    
    console.log("\n📰 Articles in page_entities:");
    const { data: articles, error: articlesError } = await supa
      .from('page_entities')
      .select('id, title, url, kind, publish_date, categories, tags')
      .eq('kind', 'article')
      .limit(3);
    
    if (articlesError) {
      console.error("❌ Articles error:", articlesError.message);
    } else {
      console.log(`   Found ${articles?.length || 0} articles`);
      if (articles && articles.length > 0) {
        const article = articles[0];
        console.log("   Sample article fields:");
        Object.keys(article).forEach(key => {
          console.log(`     ${key}: ${article[key]}`);
        });
      }
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

debugDatabaseFields();
