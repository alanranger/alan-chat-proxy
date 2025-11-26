#!/usr/bin/env node
/**
 * Test how PostgREST encodes "depth of field" in the query
 */

function testEncoding() {
  console.log('================================================================================');
  console.log('TESTING: PostgREST Query Encoding');
  console.log('================================================================================');

  const keywords = ["depth of field"];
  
  console.log(`\nKeywords: ${JSON.stringify(keywords)}`);
  
  // Simulate what anyIlike does
  const parts = keywords
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => {
      const encoded = encodeURIComponent(w);
      console.log(`\nKeyword: "${w}"`);
      console.log(`  Encoded: "${encoded}"`);
      console.log(`  PostgREST pattern: title.ilike.%${encoded}%`);
      return `title.ilike.%${encoded}%`;
    });
  
  console.log(`\nPostgREST OR expression: ${parts.join(',')}`);
  
  // Test if this would match
  const testTitles = [
    "Aperture and Depth of Field Photography Assignment",
    "09 What is DEPTH OF FIELD in Photography: A Beginners Guide"
  ];
  
  console.log(`\n================================================================================`);
  console.log('TESTING: Pattern Matching');
  console.log('================================================================================');
  
  const pattern = keywords[0].toLowerCase();
  testTitles.forEach(title => {
    const titleLower = title.toLowerCase();
    const matches = titleLower.includes(pattern);
    console.log(`\nTitle: "${title}"`);
    console.log(`  Pattern: "${pattern}"`);
    console.log(`  Matches: ${matches}`);
  });
}

testEncoding();

