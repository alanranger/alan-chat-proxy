#!/usr/bin/env node
/**
 * Test what RAG system returns for free course queries
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const client = createClient(url, key, { auth: { persistSession: false } });

const testQueries = [
  "Is the online photography course really free",
  "How do I subscribe to the free online photography course",
  "Do you I get a certificate with the photography course",
  "free online photography course",
  "photography academy",
  "free academy",
  "online photography course",
  "free photography course"
];

async function testRagRetrieval(query) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`QUERY: "${query}"`);
  console.log('='.repeat(80));
  
  // Extract keywords
  const keywords = extractKeywords(query);
  console.log(`Keywords: ${keywords.join(', ')}`);
  
  // Test services
  console.log(`\n--- SERVICES ---`);
  const { data: services, error: servicesError } = await client
    .from('v_services_unified')
    .select('id, title, page_url, description')
    .or(keywords.map(k => `title.ilike.%${k}%,description.ilike.%${k}%`).join(','))
    .limit(5);
  
  if (servicesError) {
    console.error('Services error:', servicesError);
  } else {
    console.log(`Found ${services?.length || 0} services:`);
    services?.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.title}`);
      console.log(`     URL: ${s.page_url}`);
      console.log(`     Description: ${(s.description || '').substring(0, 150)}...`);
    });
  }
  
  // Test articles
  console.log(`\n--- ARTICLES ---`);
  const { data: articles, error: articlesError } = await client
    .from('v_articles_unified')
    .select('id, title, page_url, description, meta_description, json_ld_data')
    .or(keywords.map(k => `title.ilike.%${k}%,description.ilike.%${k}%,meta_description.ilike.%${k}%`).join(','))
    .limit(5);
  
  if (articlesError) {
    console.error('Articles error:', articlesError);
  } else {
    console.log(`Found ${articles?.length || 0} articles:`);
    articles?.forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.title}`);
      console.log(`     URL: ${a.page_url}`);
      console.log(`     Description: ${(a.description || a.meta_description || '').substring(0, 150)}...`);
      if (a.json_ld_data?.mainEntity) {
        console.log(`     Has FAQ data: YES`);
      }
    });
  }
  
  // Test chunks
  console.log(`\n--- CONTENT CHUNKS ---`);
  const { data: chunks, error: chunksError } = await client
    .from('page_chunks')
    .select('title, chunk_text, url, content')
    .or(keywords.map(k => `chunk_text.ilike.%${k}%,content.ilike.%${k}%,title.ilike.%${k}%`).join(','))
    .limit(5);
  
  if (chunksError) {
    console.error('Chunks error:', chunksError);
  } else {
    console.log(`Found ${chunks?.length || 0} chunks:`);
    chunks?.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.title || 'NO TITLE'}`);
      console.log(`     URL: ${c.url}`);
      console.log(`     Text preview: ${(c.chunk_text || c.content || '').substring(0, 200)}...`);
    });
  }
}

function extractKeywords(query) {
  const lc = query.toLowerCase();
  const words = lc.split(/\s+/).filter(w => w.length > 2);
  // Add multi-word phrases
  const phrases = [];
  if (lc.includes('free online photography course')) phrases.push('free online photography course');
  if (lc.includes('photography academy')) phrases.push('photography academy');
  if (lc.includes('free photography course')) phrases.push('free photography course');
  if (lc.includes('online photography course')) phrases.push('online photography course');
  if (lc.includes('free academy')) phrases.push('free academy');
  if (lc.includes('free course')) phrases.push('free course');
  return [...phrases, ...words.filter(w => !phrases.some(p => p.includes(w)))].slice(0, 10);
}

async function runTests() {
  for (const query of testQueries) {
    await testRagRetrieval(query);
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
  }
  process.exit(0);
}

runTests().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

