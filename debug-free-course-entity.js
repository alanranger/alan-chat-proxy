// Debug script to check what entity type the free course URL was classified as
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0NzQ4NzQsImV4cCI6MjA0OTA1MDg3NH0.8Q5qJ8Q5qJ8Q5qJ8Q5qJ8Q5qJ8Q5qJ8Q5qJ8Q5qJ8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugFreeCourseEntity() {
  console.log('🔍 Debugging free course URL entity type...');
  
  const freeCourseUrl = 'https://www.alanranger.com/free-online-photography-course';
  
  try {
    // Check page_entities table
    console.log('\n📊 Checking page_entities table...');
    const { data: entities, error: entitiesError } = await supabase
      .from('page_entities')
      .select('*')
      .eq('page_url', freeCourseUrl);
    
    if (entitiesError) {
      console.error('❌ Error querying page_entities:', entitiesError);
    } else {
      console.log(`✅ Found ${entities.length} entities for free course URL`);
      entities.forEach((entity, index) => {
        console.log(`\nEntity ${index + 1}:`);
        console.log(`  - Kind: ${entity.kind}`);
        console.log(`  - Title: ${entity.title}`);
        console.log(`  - URL: ${entity.page_url}`);
        console.log(`  - Description: ${entity.description ? entity.description.substring(0, 100) + '...' : 'None'}`);
        console.log(`  - Raw data keys: ${entity.raw ? Object.keys(entity.raw) : 'None'}`);
      });
    }
    
    // Check page_chunks table
    console.log('\n📊 Checking page_chunks table...');
    const { data: chunks, error: chunksError } = await supabase
      .from('page_chunks')
      .select('*')
      .eq('page_url', freeCourseUrl);
    
    if (chunksError) {
      console.error('❌ Error querying page_chunks:', chunksError);
    } else {
      console.log(`✅ Found ${chunks.length} chunks for free course URL`);
      if (chunks.length > 0) {
        console.log(`  - First chunk content: ${chunks[0].content ? chunks[0].content.substring(0, 200) + '...' : 'None'}`);
      }
    }
    
    // Check csv_metadata table
    console.log('\n📊 Checking csv_metadata table...');
    const { data: metadata, error: metadataError } = await supabase
      .from('csv_metadata')
      .select('*')
      .eq('page_url', freeCourseUrl);
    
    if (metadataError) {
      console.error('❌ Error querying csv_metadata:', metadataError);
    } else {
      console.log(`✅ Found ${metadata.length} metadata records for free course URL`);
      metadata.forEach((meta, index) => {
        console.log(`\nMetadata ${index + 1}:`);
        console.log(`  - CSV Type: ${meta.csv_type}`);
        console.log(`  - Title: ${meta.title}`);
        console.log(`  - URL: ${meta.page_url}`);
      });
    }
    
    // Check if URL exists in any table with partial match
    console.log('\n📊 Checking for partial URL matches...');
    const { data: partialMatches, error: partialError } = await supabase
      .from('page_entities')
      .select('*')
      .ilike('page_url', '%free-online-photography-course%');
    
    if (partialError) {
      console.error('❌ Error querying partial matches:', partialError);
    } else {
      console.log(`✅ Found ${partialMatches.length} partial matches for free course URL`);
      partialMatches.forEach((match, index) => {
        console.log(`\nPartial Match ${index + 1}:`);
        console.log(`  - Kind: ${match.kind}`);
        console.log(`  - Title: ${match.title}`);
        console.log(`  - URL: ${match.page_url}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

debugFreeCourseEntity();

