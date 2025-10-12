// Debug script to analyze actual HTML content from ISO article
import { createClient } from '@supabase/supabase-js';

// Use the hardcoded Supabase URL from admin.js
const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  console.log('Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Copy the exact extractJSONLD function from ingest.js
function extractJSONLD(html) {
  console.log('🔍 extractJSONLD called with HTML length:', html.length);
  
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
  console.log('🔍 Regex matches found:', jsonLdMatches ? jsonLdMatches.length : 0);
  
  if (!jsonLdMatches) {
    console.log('❌ No JSON-LD script tags found');
    return null;
  }
  
  const jsonLdObjects = [];
  for (const match of jsonLdMatches) {
    console.log('🔍 Processing match, length:', match.length);
    let jsonContent = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    console.log('🔍 Extracted JSON content length:', jsonContent.length);
    console.log('🔍 JSON content preview:', jsonContent.substring(0, 200) + '...');
    
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
        console.log('🔍 Created sliced attempt, length:', sliced.length);
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
        console.log('✅ JSON parsing successful! Type:', parsed['@type']);
        parsedOk = true;
        break;
      } catch (e) {
        console.log('❌ JSON parsing failed:', e.message);
        // keep trying next strategy
      }
    }
    if (!parsedOk) {
      console.warn('Failed to parse JSON-LD block after repairs. First 80 chars:', jsonContent.slice(0, 80));
    }
  }
  
  console.log('🔍 Final result: extracted', jsonLdObjects.length, 'JSON-LD objects');
  return jsonLdObjects.length > 0 ? jsonLdObjects : null;
}

async function debugActualHtml() {
  console.log('=== ACTUAL HTML CONTENT DEBUG ===\n');
  
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
    
    const html = htmlData.html_content;
    
    // Basic HTML analysis
    console.log('\n=== HTML ANALYSIS ===');
    const hasJsonLd = html.includes('application/ld+json');
    const hasFaqPage = html.includes('FAQPage');
    const hasSchemaType = html.includes('@type');
    const hasScriptTags = html.includes('<script');
    
    console.log('Has <script tags:', hasScriptTags ? '✅' : '❌');
    console.log('Has application/ld+json:', hasJsonLd ? '✅' : '❌');
    console.log('Has FAQPage:', hasFaqPage ? '✅' : '❌');
    console.log('Has @type:', hasSchemaType ? '✅' : '❌');
    
    // Find all script tags
    const allScriptTags = html.match(/<script[^>]*>.*?<\/script>/gis);
    console.log('\nTotal script tags found:', allScriptTags ? allScriptTags.length : 0);
    
    if (allScriptTags) {
      console.log('\n=== SCRIPT TAG ANALYSIS ===');
      allScriptTags.forEach((script, i) => {
        const hasType = script.includes('type=');
        const hasJsonLd = script.includes('application/ld+json');
        const hasJsonLdEncoded = script.includes('application/ld%2Bjson');
        const length = script.length;
        
        console.log(`Script ${i + 1}:`);
        console.log(`  Length: ${length} characters`);
        console.log(`  Has type attribute: ${hasType ? '✅' : '❌'}`);
        console.log(`  Has application/ld+json: ${hasJsonLd ? '✅' : '❌'}`);
        console.log(`  Has application/ld%2Bjson: ${hasJsonLdEncoded ? '✅' : '❌'}`);
        
        if (hasJsonLd || hasJsonLdEncoded) {
          console.log(`  🎯 JSON-LD script found!`);
          console.log(`  Preview: ${script.substring(0, 300)}...`);
          
          // Extract the type attribute
          const typeMatch = script.match(/type=["']([^"']+)["']/i);
          if (typeMatch) {
            console.log(`  Type attribute: "${typeMatch[1]}"`);
          }
        }
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
            obj.mainEntity.forEach((faq, j) => {
              console.log(`    FAQ ${j + 1}: ${faq.name || 'Unknown question'}`);
            });
          }
        }
      });
    } else {
      console.log('❌ JSON-LD extraction failed');
      console.log('This explains why the data is not being stored!');
      
      // Try to find why it failed
      console.log('\n=== DEBUGGING EXTRACTION FAILURE ===');
      
      // Check for different script tag patterns
      const patterns = [
        /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis,
        /<script[^>]*type=["']application\/ld%2Bjson["'][^>]*>(.*?)<\/script>/gis,
        /<script[^>]*application\/ld\+json[^>]*>(.*?)<\/script>/gis,
        /<script[^>]*application\/ld%2Bjson[^>]*>(.*?)<\/script>/gis
      ];
      
      patterns.forEach((pattern, i) => {
        const matches = html.match(pattern);
        console.log(`Pattern ${i + 1} matches:`, matches ? matches.length : 0);
        if (matches) {
          matches.forEach((match, j) => {
            console.log(`  Match ${j + 1} preview: ${match.substring(0, 200)}...`);
          });
        }
      });
    }
    
  } catch (error) {
    console.error('Error during debug:', error.message);
  }
}

// Run the debug
debugActualHtml().catch(console.error);

