// Test script to debug evidence-based clarification system
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Test the evidence-based clarification system
async function testEvidenceClarification() {
  console.log('🔍 Testing Evidence-Based Clarification System\n');
  
  const testQuery = "What photography workshops do you have?";
  console.log(`📝 Test Query: "${testQuery}"`);
  
  // Test 1: Check if events are found
  console.log('\n1️⃣ Testing Event Retrieval...');
  const { data: events, error: eventsError } = await supabase
    .from('v_events_for_chat')
    .select('event_title, date_start, date_end, event_location')
    .gte('date_start', new Date().toISOString())
    .limit(10);
  
  if (eventsError) {
    console.error('❌ Error fetching events:', eventsError);
    return;
  }
  
  console.log(`✅ Found ${events.length} events`);
  if (events.length > 0) {
    console.log('📋 Sample events:');
    events.slice(0, 3).forEach((event, i) => {
      console.log(`   ${i + 1}. ${event.event_title} (${event.event_location})`);
    });
  }
  
  // Test 2: Test the extractEventTypesAndCategories function
  console.log('\n2️⃣ Testing Event Type Extraction...');
  
  // Simulate the extractEventTypesAndCategories function
  function calculateEventDuration(event) {
    if (!event.date_start || !event.date_end) return null;
    
    const start = new Date(event.date_start);
    const end = new Date(event.date_end);
    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    
    return Math.round(diffHours * 10) / 10;
  }
  
  function getWorkshopTypeFromDuration(duration) {
    if (!duration) return null;
    
    if (duration <= 4) return '2.5hr - 4hr workshops';
    if (duration <= 8) return '1 day workshops';
    return 'Multi day residential workshops';
  }
  
  function extractEventTypesAndCategories(events) {
    const eventTypes = new Set();
    const eventCategories = new Set();
    
    // Extract duration-based workshop types
    for (const event of events) {
      const duration = calculateEventDuration(event);
      if (duration) {
        const type = getWorkshopTypeFromDuration(duration);
        if (type) eventTypes.add(type);
      }
    }
    
    // Add location-based types
    const hasLocations = events.some(event => event.event_location && event.event_location.trim());
    if (hasLocations) eventTypes.add('Workshops by location');
    
    // Add month-based types
    const hasDates = events.some(event => event.date_start);
    if (hasDates) eventTypes.add('Workshops by month');
    
    // Extract categories from event titles
    const categoryMappings = {
      'bluebell': 'Bluebell workshops',
      'woodland': 'Woodland workshops', 
      'autumn': 'Autumn workshops',
      'macro': 'Macro workshops',
      'abstract': 'Abstract workshops'
    };
    
    for (const event of events) {
      if (!event.event_title) continue;
      
      const title = event.event_title.toLowerCase();
      for (const [keyword, category] of Object.entries(categoryMappings)) {
        if (title.includes(keyword)) {
          eventCategories.add(category);
        }
      }
    }
        
    return { eventTypes, eventCategories };
  }
  
  const { eventTypes, eventCategories } = extractEventTypesAndCategories(events);
  
  console.log('📊 Extracted Event Types:');
  for (const type of eventTypes) {
    console.log(`   • ${type}`);
  }
  
  console.log('📊 Extracted Event Categories:');
  for (const category of eventCategories) {
    console.log(`   • ${category}`);
  }
  
  // Test 3: Test the full evidence snapshot
  console.log('\n3️⃣ Testing Full Evidence Snapshot...');
  
  // Simulate getEvidenceSnapshot
  async function getEvidenceSnapshot(client, query, pageContext) {
    const keywords = query.toLowerCase().split(' ').filter(word => word.length > 2);
    
    // Get events
    const { data: events } = await client
      .from('v_events_for_chat')
      .select('event_title, date_start, date_end, event_location')
      .gte('date_start', new Date().toISOString())
      .limit(50);
    
    // Get articles
    const { data: articles } = await client
      .from('page_entities')
      .select('title, description, categories, tags')
      .eq('kind', 'article')
      .limit(20);
    
    // Get services
    const { data: services } = await client
      .from('page_entities')
      .select('title, description, categories, tags')
      .eq('kind', 'service')
      .limit(20);
    
    return { events: events || [], articles: articles || [], services: services || [] };
  }
  
  const evidence = await getEvidenceSnapshot(supabase, testQuery, null);
  console.log(`📊 Evidence Summary:`);
  console.log(`   • Events: ${evidence.events.length}`);
  console.log(`   • Articles: ${evidence.articles.length}`);
  console.log(`   • Services: ${evidence.services.length}`);
  
  // Test 4: Test the full clarification options generation
  console.log('\n4️⃣ Testing Full Clarification Options Generation...');
  
  function addEventOptions(options, eventTypes, eventCategories) {
    // Add event-based options
    for (const type of eventTypes) {
      const displayType = type.charAt(0).toUpperCase() + type.slice(1);
      options.push({
        text: `${displayType} events`,
        query: `${type} events`
      });
    }
    
    // Add category-based options
    for (const category of eventCategories) {
      if (category && category.length > 3) {
        options.push({
          text: `${category} events`,
          query: `${category} events`
        });
      }
    }
  }
  
  function addServiceOptions(options, services) {
    const serviceTypes = new Set();
    for (const service of services) {
      if (service.title) {
        const title = service.title.toLowerCase();
        if (title.includes('course')) serviceTypes.add('photography-courses services');
        if (title.includes('class')) serviceTypes.add('photography-classes services');
        if (title.includes('workshop')) serviceTypes.add('All Photography Workshops services');
        if (title.includes('one day')) serviceTypes.add('- one day photo workshops services');
        if (title.includes('macro') || title.includes('abstract')) serviceTypes.add('Macro & Abstract services');
      }
    }
    
    for (const type of serviceTypes) {
      options.push({
        text: type,
        query: type
      });
    }
  }
  
  const options = [];
  
  // Generate options from events evidence
  if (evidence.events && evidence.events.length > 0) {
    const { eventTypes, eventCategories } = extractEventTypesAndCategories(evidence.events);
    addEventOptions(options, eventTypes, eventCategories);
  }
  
  // Generate options from services evidence (this is what's currently being used)
  if (evidence.services && evidence.services.length > 0) {
    addServiceOptions(options, evidence.services);
  }
  
  console.log('📋 Generated Clarification Options:');
  options.forEach((option, i) => {
    console.log(`   ${i + 1}. ${option.text}`);
  });
  
  // Test 5: Check which path is being taken
  console.log('\n5️⃣ Analysis:');
  const hasEventOptions = options.some(opt => opt.text.includes('workshops') && !opt.text.includes('services'));
  const hasServiceOptions = options.some(opt => opt.text.includes('services'));
  
  console.log(`   • Event-based options generated: ${hasEventOptions ? '✅' : '❌'}`);
  console.log(`   • Service-based options generated: ${hasServiceOptions ? '✅' : '❌'}`);
  
  if (hasServiceOptions && !hasEventOptions) {
    console.log('   🚨 ISSUE: Service options are overriding event options!');
    console.log('   🔧 This explains why we see generic "services" instead of meaningful workshop types');
  }
  
  console.log('\n✅ Test Complete');
}

// Run the test
testEvidenceClarification().catch(console.error);
