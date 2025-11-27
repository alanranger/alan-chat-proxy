const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findLandingPages() {
  console.log('\n=== Searching for About/Ethics/Testimonials landing pages ===\n');
  
  // Search for "about" pages
  const { data: aboutPages, error: aboutError } = await client
    .from('articles')
    .select('id, title, page_url, url')
    .or('page_url.ilike.%about%,url.ilike.%about%,title.ilike.%about%')
    .limit(10);
  
  console.log('About pages found:', aboutPages?.length || 0);
  if (aboutPages && aboutPages.length > 0) {
    aboutPages.forEach(p => {
      console.log(`  - ${p.title} | ${p.page_url || p.url}`);
    });
  }
  
  // Search for "ethics" pages
  const { data: ethicsPages, error: ethicsError } = await client
    .from('articles')
    .select('id, title, page_url, url')
    .or('page_url.ilike.%ethics%,url.ilike.%ethics%,title.ilike.%ethics%')
    .limit(10);
  
  console.log('\nEthics pages found:', ethicsPages?.length || 0);
  if (ethicsPages && ethicsPages.length > 0) {
    ethicsPages.forEach(p => {
      console.log(`  - ${p.title} | ${p.page_url || p.url}`);
    });
  }
  
  // Search for "testimonial" pages
  const { data: testimonialPages, error: testimonialError } = await client
    .from('articles')
    .select('id, title, page_url, url')
    .or('page_url.ilike.%testimonial%,url.ilike.%testimonial%,title.ilike.%testimonial%')
    .limit(10);
  
  console.log('\nTestimonial pages found:', testimonialPages?.length || 0);
  if (testimonialPages && testimonialPages.length > 0) {
    testimonialPages.forEach(p => {
      console.log(`  - ${p.title} | ${p.page_url || p.url}`);
    });
  }
  
  console.log('\n=== END SEARCH ===\n');
}

findLandingPages().catch(console.error);


