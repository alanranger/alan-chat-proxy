// Comprehensive test of the JSON-LD regex fix across multiple blog articles
import { createClient } from '@supabase/supabase-js';

// Use the hardcoded Supabase URL from admin.js
const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Current regex pattern (the broken one)
function extractJSONLDCurrent(html) {
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
  if (!jsonLdMatches) return null;
  
  const jsonLdObjects = [];
  for (const match of jsonLdMatches) {
    let jsonContent = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    jsonContent = jsonContent
      .replace(/<!--([\s\S]*?)-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '')
      .trim();

    const attempts = [];
    attempts.push(jsonContent);
    const firstBrace = jsonContent.indexOf('{');
    const firstBracket = jsonContent.indexOf('[');
    const start = (firstBracket !== -1 && (firstBracket < firstBrace || firstBrace === -1)) ? firstBracket : firstBrace;
    if (start !== -1) {
      const lastBrace = jsonContent.lastIndexOf('}');
      const lastBracket = jsonContent.lastIndexOf(']');
      const end = Math.max(lastBrace, lastBracket);
      if (end > start) {
        let sliced = jsonContent.slice(start, end + 1);
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
  }
  
  return jsonLdObjects.length > 0 ? jsonLdObjects : null;
}

// Fixed regex pattern (the improved one)
function extractJSONLDFixed(html) {
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gis);
  if (!jsonLdMatches) return null;
  
  const jsonLdObjects = [];
  for (const match of jsonLdMatches) {
    let jsonContent = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    jsonContent = jsonContent
      .replace(/<!--([\s\S]*?)-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '')
      .trim();

    const attempts = [];
    attempts.push(jsonContent);
    const firstBrace = jsonContent.indexOf('{');
    const firstBracket = jsonContent.indexOf('[');
    const start = (firstBracket !== -1 && (firstBracket < firstBrace || firstBrace === -1)) ? firstBracket : firstBrace;
    if (start !== -1) {
      const lastBrace = jsonContent.lastIndexOf('}');
      const lastBracket = jsonContent.lastIndexOf(']');
      const end = Math.max(lastBrace, lastBracket);
      if (end > start) {
        let sliced = jsonContent.slice(start, end + 1);
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
  }
  
  return jsonLdObjects.length > 0 ? jsonLdObjects : null;
}

async function testRegexFixComprehensive() {
  console.log('=== COMPREHENSIVE REGEX FIX TEST ===\n');
  
  try {
    // Get multiple blog articles with FAQPage content
    const { data: articles, error } = await supabase
      .from('page_html')
      .select('url, html_content')
      .like('url', '%blog-on-photography%')
      .like('html_content', '%FAQPage%')
      .limit(5);
    
    if (error) {
      console.error('Error fetching articles:', error.message);
      return;
    }
    
    console.log(`Testing ${articles.length} blog articles with FAQPage content...\n`);
    
    const results = [];
    
    for (const article of articles) {
      const url = article.url;
      const html = article.html_content;
      
      console.log(`Testing: ${url}`);
      console.log(`HTML Length: ${html.length} characters`);
      
      // Test current regex
      const currentResult = extractJSONLDCurrent(html);
      const currentCount = currentResult ? currentResult.length : 0;
      const currentFaqPages = currentResult ? currentResult.filter(obj => obj['@type'] === 'FAQPage').length : 0;
      
      // Test fixed regex
      const fixedResult = extractJSONLDFixed(html);
      const fixedCount = fixedResult ? fixedResult.length : 0;
      const fixedFaqPages = fixedResult ? fixedResult.filter(obj => obj['@type'] === 'FAQPage').length : 0;
      
      console.log(`  Current regex: ${currentCount} objects, ${currentFaqPages} FAQPages`);
      console.log(`  Fixed regex:   ${fixedCount} objects, ${fixedFaqPages} FAQPages`);
      
      if (fixedFaqPages > currentFaqPages) {
        console.log(`  🎯 IMPROVEMENT: Fixed regex found ${fixedFaqPages - currentFaqPages} more FAQPages!`);
        
        // Show details of the FAQPage found
        const faqPage = fixedResult.find(obj => obj['@type'] === 'FAQPage');
        if (faqPage && faqPage.mainEntity) {
          console.log(`  FAQ Questions: ${Array.isArray(faqPage.mainEntity) ? faqPage.mainEntity.length : 1}`);
        }
      } else if (currentFaqPages === 0 && fixedFaqPages === 0) {
        console.log(`  ❌ No FAQPages found with either regex`);
      } else {
        console.log(`  ✅ Both regexes found the same number of FAQPages`);
      }
      
      results.push({
        url,
        currentCount,
        currentFaqPages,
        fixedCount,
        fixedFaqPages,
        improvement: fixedFaqPages > currentFaqPages
      });
      
      console.log('');
    }
    
    // Summary
    console.log('=== SUMMARY ===');
    const totalCurrentFaqPages = results.reduce((sum, r) => sum + r.currentFaqPages, 0);
    const totalFixedFaqPages = results.reduce((sum, r) => sum + r.fixedFaqPages, 0);
    const improvements = results.filter(r => r.improvement).length;
    
    console.log(`Total FAQPages found with current regex: ${totalCurrentFaqPages}`);
    console.log(`Total FAQPages found with fixed regex: ${totalFixedFaqPages}`);
    console.log(`Articles with improvement: ${improvements}/${results.length}`);
    
    if (totalFixedFaqPages > totalCurrentFaqPages) {
      console.log(`\n🎯 REGEX FIX IS EFFECTIVE!`);
      console.log(`Found ${totalFixedFaqPages - totalCurrentFaqPages} additional FAQPages across ${improvements} articles`);
      console.log(`This will significantly improve chat bot responses for technical questions!`);
    } else if (totalCurrentFaqPages === 0 && totalFixedFaqPages === 0) {
      console.log(`\n❌ No FAQPages found in any articles - there may be a deeper issue`);
    } else {
      console.log(`\n✅ Both regex patterns work equally well`);
    }
    
  } catch (error) {
    console.error('Error during comprehensive test:', error.message);
  }
}

// Run the test
testRegexFixComprehensive().catch(console.error);

