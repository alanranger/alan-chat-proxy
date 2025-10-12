#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testDetailedResponse() {
  console.log("🔍 Testing Detailed Response for 'what is iso'...\n");
  
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
    
    console.log("📊 Full Response Structure:");
    console.log(JSON.stringify(data, null, 2));
    
    console.log("\n📝 Answer Content:");
    console.log(data.answer_markdown || data.response || 'No answer content');
    
    console.log("\n📚 Articles Found:");
    if (data.structured?.articles && data.structured.articles.length > 0) {
      data.structured.articles.forEach((article, index) => {
        console.log(`\nArticle ${index + 1}:`);
        console.log(`  Title: ${article.title}`);
        console.log(`  URL: ${article.page_url || article.url}`);
        console.log(`  Publish Date: ${article.publish_date || article.display_date}`);
        console.log(`  Categories: ${JSON.stringify(article.categories)}`);
        console.log(`  Description: ${article.description?.substring(0, 100)}...`);
      });
    } else {
      console.log("No articles found in structured response");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testDetailedResponse();
