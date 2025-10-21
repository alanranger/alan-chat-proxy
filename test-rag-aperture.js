import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';

const client = createClient(supabaseUrl, supabaseKey);

async function testRagAperture() {
  console.log('🔍 Testing RAG system for "how to use aperture"');
  
  const query = 'how to use aperture';
  const keywords = ['how', 'use', 'aperture'];
  
  console.log('🔑 Keywords:', keywords);
  
  // Test entity search
  let entities = [];
  for (const keyword of keywords) {
    console.log(`🔍 Searching for keyword: "${keyword}"`);
    const { data: keywordEntities, error: entitiesError } = await client
      .from('page_entities')
      .select('url, title, description, location, date_start, kind')
      .or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%,location.ilike.%${keyword}%`)
      .limit(5);
    
    if (!entitiesError && keywordEntities) {
      console.log(`📄 Found ${keywordEntities.length} entities for "${keyword}"`);
      keywordEntities.forEach(e => console.log(`  - "${e.title}" (${e.kind})`));
      entities = [...entities, ...keywordEntities];
    }
  }
  
  // Remove duplicates
  entities = entities.filter((entity, index, self) => 
    index === self.findIndex(e => e.url === entity.url)
  );
  
  console.log(`\n🏷️ Total unique entities found: ${entities.length}`);
  entities.forEach(e => console.log(`  - "${e.title}" (${e.kind}) - ${e.url}`));
  
  // Filter for advice entities (non-event)
  const adviceEntities = entities.filter(e => e.kind !== 'event');
  console.log(`\n📝 Advice entities (non-event): ${adviceEntities.length}`);
  adviceEntities.forEach(e => console.log(`  - "${e.title}" (${e.kind})`));
  
  // Test entity filtering logic
  const lcQuery = query.toLowerCase();
  console.log(`\n🔍 Testing entity filtering for query: "${query}"`);
  
  const relevantEntities = adviceEntities.filter(entity => {
    const title = (entity.title || '').toLowerCase();
    const description = (entity.description || '').toLowerCase();
    
    // For technical queries, look for relevant technical content
    if (/how.*use|what.*is|explain|guide|tips|technique/i.test(lcQuery)) {
      console.log(`🔍 Checking entity: "${entity.title}"`);
      const isRelevant = title.includes('aperture') || title.includes('iso') || title.includes('shutter') || 
                        title.includes('camera') || title.includes('photography') ||
                        (description && (description.includes('aperture') || description.includes('iso') || description.includes('shutter')));
      console.log(`🔍 Entity "${entity.title}" relevant: ${isRelevant}`);
      return isRelevant;
    }
    
    return true;
  });
  
  console.log(`\n✅ Final relevant entities: ${relevantEntities.length}`);
  relevantEntities.forEach(e => console.log(`  - "${e.title}" (${e.kind})`));
  
  // Calculate confidence
  let confidence = 0;
  if (relevantEntities.length > 0) {
    confidence = Math.max(confidence, 0.7);
  }
  
  console.log(`\n📊 Confidence: ${confidence}`);
  console.log(`📊 Would succeed: ${confidence >= 0.6}`);
}

testRagAperture().catch(console.error);
