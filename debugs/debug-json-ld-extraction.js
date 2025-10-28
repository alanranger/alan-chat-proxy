// Debug script to test JSON-LD extraction from ISO article HTML
import { createClient } from '@supabase/supabase-js';

// Use the hardcoded Supabase URL from admin.js
const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Copy the extractJSONLD function from ingest.js
function extractJSONLD(html) {
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
  if (!jsonLdMatches) return null;
  
  const jsonLdObjects = [];
  for (const match of jsonLdMatches) {
    let jsonContent = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    // Harden: strip HTML comments, CDATA, and try to repair common issues
    jsonContent = jsonContent
      .replace(/<!--([\s\S]*?)-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '')
      .trim();

    const attempts = [];
    attempts.push(jsonContent);
    // If raw content isn't valid JSON, try to isolate the main object/array
    const firstBrace = jsonContent.indexOf('{');
    const firstBracket = jsonContent.indexOf('[');
    const start = (firstBracket !== -1 && (firstBracket < firstBrace || firstBrace === -1)) ? firstBracket : firstBrace;
    if (start !== -1) {
      const lastBrace = jsonContent.lastIndexOf('}');
      const lastBracket = jsonContent.lastIndexOf(']');
      const end = Math.max(lastBrace, lastBracket);
      if (end > start) {
        let sliced = jsonContent.slice(start, end + 1);
        // Remove trailing commas before } or ]
        sliced = sliced.replace(/,\s*([}\]])/g, '$1');
        attempts.push(sliced);
      }
    }

    let parsedOk = false;
    for (const candidate of attempts) {
      try {
        const parsed = JSON.parse(candidate);
        if (Array.isArray(parsed)) {
          jsonLdObjects.push(...parsed);
        } else {
          jsonLdObjects.push(parsed);
        }
        parsedOk = true;
        break;
      } catch (e) {
        // keep trying next strategy
      }
    }
    if (!parsedOk) {
      console.warn('Failed to parse JSON-LD block after repairs. First 80 chars:', jsonContent.slice(0, 80));
    }
  }
  
  return jsonLdObjects.length > 0 ? jsonLdObjects : null;
}

async function debugJsonLdExtraction() {
  console.log('=== JSON-LD EXTRACTION DEBUG ===\n');
  
  try {
    // Get the ISO article HTML
    const { data: htmlData, error: htmlError } = await supabase
      .from('page_html')
      .select('url, html_content')
      .ilike('url', '%what-is-iso%')
      .single();
    
    if (htmlError) {
      console.error('Error fetching HTML:', htmlError.message);
      return;
    }
    
    console.log('✅ Retrieved HTML for:', htmlData.url);
    console.log('HTML Length:', htmlData.html_content.length, 'characters');
    
    // Check for JSON-LD script tags
    const html = htmlData.html_content;
    const hasJsonLd = html.includes('application/ld+json');
    const hasFaqPage = html.includes('FAQPage');
    const hasSchemaType = html.includes('@type');
    
    console.log('\nHTML Analysis:');
    console.log('  Has JSON-LD script:', hasJsonLd ? '✅' : '❌');
    console.log('  Has FAQPage:', hasFaqPage ? '✅' : '❌');
    console.log('  Has @type:', hasSchemaType ? '✅' : '❌');
    
    if (hasJsonLd) {
      // Find JSON-LD script tags
      const scriptMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>.*?<\/script>/gis);
      console.log('\nJSON-LD Script Tags Found:', scriptMatches ? scriptMatches.length : 0);
      
      if (scriptMatches) {
        scriptMatches.forEach((script, i) => {
          console.log(`\nScript ${i + 1}:`);
          console.log('  Length:', script.length, 'characters');
          console.log('  Preview:', script.substring(0, 200) + '...');
        });
      }
      
      // Test the extractJSONLD function
      console.log('\n=== TESTING EXTRACTJSONLD FUNCTION ===');
      const extractedJsonLd = extractJSONLD(html);
      
      if (extractedJsonLd) {
        console.log('✅ JSON-LD extraction successful!');
        console.log('Number of objects extracted:', extractedJsonLd.length);
        
        extractedJsonLd.forEach((obj, i) => {
          console.log(`\nObject ${i + 1}:`);
          console.log('  @type:', obj['@type'] || 'Unknown');
          console.log('  Keys:', Object.keys(obj).slice(0, 10).join(', '));
          if (obj['@type'] === 'FAQPage') {
            console.log('  🎯 FAQPage found!');
            if (obj.mainEntity && Array.isArray(obj.mainEntity)) {
              console.log('  FAQ Count:', obj.mainEntity.length);
            }
          }
        });
      } else {
        console.log('❌ JSON-LD extraction failed');
        console.log('This explains why the data is not being stored!');
      }
    } else {
      console.log('❌ No JSON-LD script tags found in HTML');
    }
    
  } catch (error) {
    console.error('Error during debug:', error.message);
  }
}

// Run the debug
debugJsonLdExtraction().catch(console.error);

