#!/usr/bin/env node
/**
 * Test the actual database query for RAG search to see what's happening
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supa = createClient(supabaseUrl, supabaseKey);

async function testRagQuery() {
  const keyword = 'tripod';
  const query = 'what tripod do you recommend for landscape photography';
  
  console.log(`\n🔍 Testing RAG Database Queries`);
  console.log('='.repeat(80));
  
  // Test 1: Search with keyword using OR condition
  console.log(`\n📝 Test 1: Search for keyword "${keyword}" with OR condition`);
  const orCondition1 = `chunk_text.ilike.%${keyword}%,title.ilike.%${keyword}%,url.ilike.%${keyword}%`;
  console.log(`   OR Condition: ${orCondition1}`);
  
  const { data: keywordChunks, error: keywordError } = await supa
    .from('page_chunks')
    .select('url, title, chunk_text')
    .or(orCondition1)
    .limit(5);
  
  if (keywordError) {
    console.log(`   ❌ Error: ${JSON.stringify(keywordError, null, 2)}`);
  } else {
    console.log(`   ✅ Found ${keywordChunks?.length || 0} chunks`);
    if (keywordChunks && keywordChunks.length > 0) {
      keywordChunks.forEach((chunk, i) => {
        console.log(`      ${i + 1}. ${chunk.title || chunk.url}`);
      });
    }
  }
  
  // Test 2: Search with full query
  console.log(`\n📝 Test 2: Search with full query "${query}"`);
  const orCondition2 = `chunk_text.ilike.%${query}%,title.ilike.%${query}%,url.ilike.%${query}%`;
  console.log(`   OR Condition: ${orCondition2}`);
  
  const { data: fullQueryChunks, error: fullQueryError } = await supa
    .from('page_chunks')
    .select('url, title, chunk_text')
    .or(orCondition2)
    .limit(5);
  
  if (fullQueryError) {
    console.log(`   ❌ Error: ${JSON.stringify(fullQueryError, null, 2)}`);
  } else {
    console.log(`   ✅ Found ${fullQueryChunks?.length || 0} chunks`);
  }
  
  // Test 3: Simple ilike search (without OR)
  console.log(`\n📝 Test 3: Simple ilike search for "${keyword}" in chunk_text`);
  const { data: simpleChunks, error: simpleError } = await supa
    .from('page_chunks')
    .select('url, title, chunk_text')
    .ilike('chunk_text', `%${keyword}%`)
    .limit(5);
  
  if (simpleError) {
    console.log(`   ❌ Error: ${JSON.stringify(simpleError, null, 2)}`);
  } else {
    console.log(`   ✅ Found ${simpleChunks?.length || 0} chunks`);
    if (simpleChunks && simpleChunks.length > 0) {
      simpleChunks.forEach((chunk, i) => {
        console.log(`      ${i + 1}. ${chunk.title || chunk.url}`);
        if (chunk.chunk_text) {
          const preview = chunk.chunk_text.substring(0, 100).replace(/\n/g, ' ');
          console.log(`         Preview: ${preview}...`);
        }
      });
    }
  }
  
  // Test 4: Check if tripod article exists in page_chunks
  console.log(`\n📝 Test 4: Check for tripod article URL in page_chunks`);
  const tripodUrl = 'https://www.alanranger.com/blog-on-photography/tripods-a-photographers-best-friend';
  const { data: urlChunks, error: urlError } = await supa
    .from('page_chunks')
    .select('url, title, chunk_text')
    .eq('url', tripodUrl)
    .limit(5);
  
  if (urlError) {
    console.log(`   ❌ Error: ${JSON.stringify(urlError, null, 2)}`);
  } else {
    console.log(`   ✅ Found ${urlChunks?.length || 0} chunks for tripod article URL`);
    if (urlChunks && urlChunks.length > 0) {
      console.log(`      First chunk preview: ${urlChunks[0].chunk_text?.substring(0, 150)}...`);
    } else {
      console.log(`   ⚠️  No chunks found for tripod article - this might be the issue!`);
    }
  }
  
  // Test 5: Count total chunks in database
  console.log(`\n📝 Test 5: Count total chunks in page_chunks table`);
  const { count, error: countError } = await supa
    .from('page_chunks')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.log(`   ❌ Error: ${JSON.stringify(countError, null, 2)}`);
  } else {
    console.log(`   ✅ Total chunks in database: ${count}`);
  }
}

testRagQuery().catch(console.error);

