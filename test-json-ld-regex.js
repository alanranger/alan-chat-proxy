// Test script to debug the JSON-LD regex pattern
const testHtml = `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is ISO in photography?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "ISO in photography refers to the sensitivity of the camera's image sensor to light."
      }
    }
  ]
}
</script>
`;

// Test the current regex pattern from ingest.js
function testCurrentRegex(html) {
  console.log('=== TESTING CURRENT REGEX PATTERN ===');
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
  console.log('Matches found:', jsonLdMatches ? jsonLdMatches.length : 0);
  if (jsonLdMatches) {
    jsonLdMatches.forEach((match, i) => {
      console.log(`Match ${i + 1}:`, match.substring(0, 100) + '...');
    });
  }
  return jsonLdMatches;
}

// Test alternative regex patterns
function testAlternativeRegex(html) {
  console.log('\n=== TESTING ALTERNATIVE REGEX PATTERNS ===');
  
  // Pattern 1: Case insensitive
  const pattern1 = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
  const matches1 = html.match(pattern1);
  console.log('Pattern 1 (case insensitive):', matches1 ? matches1.length : 0);
  
  // Pattern 2: More flexible type matching
  const pattern2 = /<script[^>]*type=["']application\/ld[^"']*json["'][^>]*>(.*?)<\/script>/gis;
  const matches2 = html.match(pattern2);
  console.log('Pattern 2 (flexible):', matches2 ? matches2.length : 0);
  
  // Pattern 3: Simple script tag with JSON-LD
  const pattern3 = /<script[^>]*application\/ld\+json[^>]*>(.*?)<\/script>/gis;
  const matches3 = html.match(pattern3);
  console.log('Pattern 3 (simple):', matches3 ? matches3.length : 0);
  
  return { matches1, matches2, matches3 };
}

// Test JSON parsing
function testJsonParsing(matches) {
  if (!matches || matches.length === 0) {
    console.log('\n❌ No matches to test JSON parsing');
    return;
  }
  
  console.log('\n=== TESTING JSON PARSING ===');
  
  matches.forEach((match, i) => {
    console.log(`\nTesting match ${i + 1}:`);
    let jsonContent = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    console.log('Raw content length:', jsonContent.length);
    console.log('Raw content preview:', jsonContent.substring(0, 100) + '...');
    
    try {
      const parsed = JSON.parse(jsonContent);
      console.log('✅ JSON parsing successful!');
      console.log('Parsed type:', parsed['@type']);
      if (parsed['@type'] === 'FAQPage') {
        console.log('🎯 FAQPage detected!');
        if (parsed.mainEntity) {
          console.log('FAQ count:', Array.isArray(parsed.mainEntity) ? parsed.mainEntity.length : 1);
        }
      }
    } catch (e) {
      console.log('❌ JSON parsing failed:', e.message);
      
      // Try to fix common issues
      const fixed = jsonContent
        .replace(/<!--([\s\S]*?)-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '')
        .trim();
      
      try {
        const parsedFixed = JSON.parse(fixed);
        console.log('✅ Fixed JSON parsing successful!');
        console.log('Fixed type:', parsedFixed['@type']);
      } catch (e2) {
        console.log('❌ Fixed JSON parsing also failed:', e2.message);
      }
    }
  });
}

// Run the tests
console.log('=== JSON-LD REGEX DEBUGGING ===\n');

const currentMatches = testCurrentRegex(testHtml);
const alternativeResults = testAlternativeRegex(testHtml);

if (currentMatches) {
  testJsonParsing(currentMatches);
} else {
  console.log('\n❌ Current regex pattern failed - trying alternatives...');
  if (alternativeResults.matches1) {
    testJsonParsing(alternativeResults.matches1);
  } else if (alternativeResults.matches2) {
    testJsonParsing(alternativeResults.matches2);
  } else if (alternativeResults.matches3) {
    testJsonParsing(alternativeResults.matches3);
  }
}

console.log('\n=== CONCLUSION ===');
if (currentMatches && currentMatches.length > 0) {
  console.log('✅ Current regex pattern works with test HTML');
  console.log('🔍 Issue might be with the actual HTML content or regex flags');
} else {
  console.log('❌ Current regex pattern failed with test HTML');
  console.log('🔧 Need to fix the regex pattern in extractJSONLD function');
}

