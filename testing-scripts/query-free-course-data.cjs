#!/usr/bin/env node
/**
 * Query database for free online photography course / photography academy data
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const FREE_COURSE_URL = 'https://www.alanranger.com/free-online-photography-course';

async function queryFreeCourseData() {
  console.log('🔍 Querying database for free online photography course data...\n');
  console.log('='.repeat(80));
  
  // 1. Query page_entities table
  console.log('\n📊 1. PAGE_ENTITIES TABLE:');
  console.log('-'.repeat(80));
  const { data: entities, error: entitiesError } = await supabase
    .from('page_entities')
    .select('*')
    .eq('page_url', FREE_COURSE_URL);
  
  if (entitiesError) {
    console.error('❌ Error:', entitiesError);
  } else {
    console.log(`✅ Found ${entities.length} entities:`);
    entities.forEach((entity, i) => {
      console.log(`\n  Entity ${i + 1}:`);
      console.log(`    - kind: ${entity.kind}`);
      console.log(`    - title: ${entity.title}`);
      console.log(`    - description: ${entity.description ? entity.description.substring(0, 150) + '...' : 'None'}`);
      if (entity.json_ld_data) {
        console.log(`    - has JSON-LD data: Yes`);
        if (entity.json_ld_data.mainEntity) {
          console.log(`    - has FAQ data: ${Array.isArray(entity.json_ld_data.mainEntity) ? 'Yes (' + entity.json_ld_data.mainEntity.length + ' FAQs)' : 'No'}`);
        }
      }
    });
  }
  
  // 2. Query page_chunks table
  console.log('\n\n📊 2. PAGE_CHUNKS TABLE:');
  console.log('-'.repeat(80));
  const { data: chunks, error: chunksError } = await supabase
    .from('page_chunks')
    .select('*')
    .eq('url', FREE_COURSE_URL)
    .limit(10);
  
  if (chunksError) {
    console.error('❌ Error:', chunksError);
  } else {
    console.log(`✅ Found ${chunks.length} chunks:`);
    chunks.forEach((chunk, i) => {
      console.log(`\n  Chunk ${i + 1}:`);
      console.log(`    - title: ${chunk.title || 'None'}`);
      console.log(`    - chunk_text: ${chunk.chunk_text ? chunk.chunk_text.substring(0, 200) + '...' : 'None'}`);
      console.log(`    - content: ${chunk.content ? chunk.content.substring(0, 200) + '...' : 'None'}`);
    });
  }
  
  // 3. Search for "photography academy" in entities
  console.log('\n\n📊 3. SEARCHING FOR "PHOTOGRAPHY ACADEMY" IN PAGE_ENTITIES:');
  console.log('-'.repeat(80));
  const { data: academyEntities, error: academyError } = await supabase
    .from('page_entities')
    .select('*')
    .ilike('title', '%photography academy%')
    .limit(5);
  
  if (academyError) {
    console.error('❌ Error:', academyError);
  } else {
    console.log(`✅ Found ${academyEntities.length} entities with "photography academy":`);
    academyEntities.forEach((entity, i) => {
      console.log(`\n  Entity ${i + 1}:`);
      console.log(`    - kind: ${entity.kind}`);
      console.log(`    - title: ${entity.title}`);
      console.log(`    - page_url: ${entity.page_url}`);
    });
  }
  
  // 4. Search for "free course" in chunks
  console.log('\n\n📊 4. SEARCHING FOR "FREE COURSE" IN PAGE_CHUNKS:');
  console.log('-'.repeat(80));
  const { data: freeCourseChunks, error: freeChunksError } = await supabase
    .from('page_chunks')
    .select('*')
    .or('chunk_text.ilike.%free course%,content.ilike.%free course%,chunk_text.ilike.%photography academy%,content.ilike.%photography academy%')
    .limit(5);
  
  if (freeChunksError) {
    console.error('❌ Error:', freeChunksError);
  } else {
    console.log(`✅ Found ${freeCourseChunks.length} chunks mentioning "free course" or "photography academy":`);
    freeCourseChunks.forEach((chunk, i) => {
      console.log(`\n  Chunk ${i + 1}:`);
      console.log(`    - url: ${chunk.url}`);
      console.log(`    - title: ${chunk.title || 'None'}`);
      console.log(`    - chunk_text: ${chunk.chunk_text ? chunk.chunk_text.substring(0, 150) + '...' : 'None'}`);
    });
  }
  
  // 5. Check services table
  console.log('\n\n📊 5. SEARCHING SERVICES TABLE:');
  console.log('-'.repeat(80));
  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('*')
    .or('title.ilike.%free course%,title.ilike.%photography academy%,url.ilike.%free-online-photography-course%')
    .limit(5);
  
  if (servicesError) {
    console.error('❌ Error:', servicesError);
  } else {
    console.log(`✅ Found ${services.length} services:`);
    services.forEach((service, i) => {
      console.log(`\n  Service ${i + 1}:`);
      console.log(`    - title: ${service.title}`);
      console.log(`    - url: ${service.url || service.page_url || 'None'}`);
      console.log(`    - description: ${service.description ? service.description.substring(0, 150) + '...' : 'None'}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Query complete!\n');
}

queryFreeCourseData().catch(console.error);

