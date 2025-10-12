// Test script to verify the regex fix works
import { createClient } from '@supabase/supabase-js';

// Use the hardcoded Supabase URL from admin.js
const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Fixed extractJSONLD function (copy from ingest.js)
function extractJSONLD(html) {
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gis);
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

async function testRegexFix() {
  console.log('=== TESTING REGEX FIX ===\n');
  
  try {
    // Test on the ISO article
    const { data: htmlData, error: htmlError } = await supabase
      .from('page_html')
      .select('url, html_content')
      .ilike('url', '%what-is-iso%')
      .single();
    
    if (htmlError) {
      console.error('Error fetching HTML:', htmlError.message);
      return;
    }
    
    console.log('✅ Testing on:', htmlData.url);
    console.log('HTML Length:', htmlData.html_content.length, 'characters');
    
    // Test the fixed extractJSONLD function
    const extractedJsonLd = extractJSONLD(htmlData.html_content);
    
    if (extractedJsonLd) {
      console.log('\n🎯 SUCCESS! JSON-LD extraction working!');
      console.log('Number of objects extracted:', extractedJsonLd.length);
      
      // Find FAQPage objects
      const faqPages = extractedJsonLd.filter(obj => obj['@type'] === 'FAQPage');
      console.log('FAQPage objects found:', faqPages.length);
      
      if (faqPages.length > 0) {
        console.log('\n📚 FAQPage Details:');
        faqPages.forEach((faqPage, i) => {
          console.log(`  FAQPage ${i + 1}:`);
          if (faqPage.mainEntity && Array.isArray(faqPage.mainEntity)) {
            console.log(`    Questions: ${faqPage.mainEntity.length}`);
            faqPage.mainEntity.forEach((faq, j) => {
              console.log(`      ${j + 1}. ${faq.name || 'Unknown question'}`);
            });
          }
        });
        
        console.log('\n✅ REGEX FIX IS WORKING!');
        console.log('This will dramatically improve chat bot responses for technical questions.');
      } else {
        console.log('\n⚠️  No FAQPage objects found - may need further investigation');
      }
      
      // Show all object types found
      const objectTypes = extractedJsonLd.map(obj => obj['@type']).filter(Boolean);
      const uniqueTypes = [...new Set(objectTypes)];
      console.log('\nAll JSON-LD object types found:', uniqueTypes.join(', '));
      
    } else {
      console.log('\n❌ JSON-LD extraction still failing');
      console.log('The regex fix may not be sufficient - need further investigation');
    }
    
  } catch (error) {
    console.error('Error during test:', error.message);
  }
}

// Run the test
testRegexFix().catch(console.error);

