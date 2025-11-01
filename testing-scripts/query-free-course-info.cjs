#!/usr/bin/env node
/**
 * Query database for information about free online photography course
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

async function queryDatabase() {
  console.log('🔍 Querying database for Free Online Photography Course information...\n');
  
  // Query articles
  console.log('=== ARTICLES (v_articles_unified) ===');
  const { data: articles, error: articlesError } = await client
    .from('v_articles_unified')
    .select('id, title, page_url, description, json_ld_data')
    .or('title.ilike.%free online photography course%,title.ilike.%photography academy%,page_url.ilike.%free-online-photography-course%,page_url.ilike.%account/digital-products%')
    .limit(10);
  
  if (articlesError) {
    console.error('Articles error:', articlesError);
  } else {
    console.log(`Found ${articles?.length || 0} articles:`);
    articles?.forEach((a, i) => {
      console.log(`\n${i + 1}. ${a.title}`);
      console.log(`   URL: ${a.page_url}`);
      console.log(`   Description: ${(a.description || '').substring(0, 150)}...`);
      if (a.json_ld_data?.mainEntity) {
        console.log(`   Has FAQ data: YES`);
      }
    });
  }
  
  // Query chunks
  console.log('\n\n=== CONTENT CHUNKS (page_chunks) ===');
  const { data: chunks, error: chunksError } = await client
    .from('page_chunks')
    .select('title, chunk_text, url, content')
    .or('url.ilike.%free-online-photography-course%,url.ilike.%account/digital-products%,chunk_text.ilike.%free online photography course%,chunk_text.ilike.%photography academy%')
    .limit(20);
  
  if (chunksError) {
    console.error('Chunks error:', chunksError);
  } else {
    console.log(`Found ${chunks?.length || 0} chunks:`);
    chunks?.forEach((c, i) => {
      console.log(`\n${i + 1}. ${c.title || 'NO TITLE'}`);
      console.log(`   URL: ${c.url}`);
      console.log(`   Text preview: ${(c.chunk_text || c.content || '').substring(0, 200)}...`);
    });
  }
  
  // Check for FAQ data
  console.log('\n\n=== CHECKING FAQ DATA ===');
  const freeCourseUrl = 'https://www.alanranger.com/free-online-photography-course';
  const { data: faqArticles, error: faqError } = await client
    .from('v_articles_unified')
    .select('id, title, page_url, json_ld_data')
    .eq('page_url', freeCourseUrl)
    .limit(1);
  
  if (faqError) {
    console.error('FAQ query error:', faqError);
  } else if (faqArticles && faqArticles.length > 0) {
    const article = faqArticles[0];
    console.log(`Found article: ${article.title}`);
    if (article.json_ld_data?.mainEntity) {
      const faqs = Array.isArray(article.json_ld_data.mainEntity) 
        ? article.json_ld_data.mainEntity 
        : [article.json_ld_data.mainEntity];
      console.log(`\nFound ${faqs.length} FAQs:`);
      faqs.slice(0, 10).forEach((faq, i) => {
        if (faq.name) {
          console.log(`\n${i + 1}. Q: ${faq.name}`);
          if (faq.acceptedAnswer?.text) {
            console.log(`   A: ${faq.acceptedAnswer.text.substring(0, 150)}...`);
          }
        }
      });
    } else {
      console.log('No FAQ data found in json_ld_data');
    }
  } else {
    console.log('Article not found with that exact URL');
  }
  
  process.exit(0);
}

queryDatabase().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

