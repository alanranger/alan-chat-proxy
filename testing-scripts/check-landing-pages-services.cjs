const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkLandingPages() {
  console.log('\n=== Checking landing_service_pages ===\n');
  
  // Check page_entities with landing_service_pages
  const { data: landingPages, error } = await client
    .from('page_entities')
    .select('id, title, page_url, url, csv_type')
    .eq('csv_type', 'landing_service_pages')
    .limit(20);
  
  console.log('Landing service pages found:', landingPages?.length || 0);
  if (landingPages && landingPages.length > 0) {
    landingPages.forEach(p => {
      console.log(`  - ${p.title} | ${p.page_url || p.url}`);
    });
    
    // Check specifically for about/ethics/testimonials
    console.log('\n=== Filtering for About/Ethics/Testimonials ===\n');
    const relevant = landingPages.filter(p => {
      const t = (p.title || '').toLowerCase();
      const u = (p.page_url || p.url || '').toLowerCase();
      return t.includes('about') || t.includes('ethics') || t.includes('testimonial') ||
             u.includes('/about') || u.includes('/ethics') || u.includes('/testimonial');
    });
    
    console.log('Relevant pages:', relevant.length);
    relevant.forEach(p => {
      console.log(`  - ${p.title} | ${p.page_url || p.url}`);
    });
  } else {
    console.log('No landing service pages found or error:', error);
  }
  
  console.log('\n=== END CHECK ===\n');
}

checkLandingPages().catch(console.error);


