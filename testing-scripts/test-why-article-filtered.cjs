#!/usr/bin/env node
/**
 * Test why article 256968 might be filtered out
 * Simulate the equipment keyword filtering logic
 */

// Simulate the articles that would be returned from database
const articles = [
  {
    id: 265306,
    title: "Aperture and Depth of Field Photography Assignment",
    page_url: "https://www.alanranger.com/blog-on-photography/aperture-and-depth-of-field-assignment",
    publish_date: "2025-11-23"
  },
  {
    id: 256968,
    title: "09 What is DEPTH OF FIELD in Photography: A Beginners Guide",
    page_url: "https://www.alanranger.com/blog-on-photography/what-is-depth-of-field",
    publish_date: "2025-02-20"
  }
];

// Simulate equipment keyword filtering (lines 4567-4572)
function testEquipmentFiltering(articles, queryEquipmentKeywords) {
  console.log(`\n🔍 Testing equipment keyword filtering`);
  console.log(`   Query equipment keywords: ${JSON.stringify(Array.from(queryEquipmentKeywords))}\n`);
  
  const filtered = articles.filter((r) => {
    const t = (r.title || "").toLowerCase();
    const u = (r.page_url || "").toLowerCase();
    const matches = Array.from(queryEquipmentKeywords).some(eq => t.includes(eq) || u.includes(eq));
    console.log(`   Article ${r.id}: "${r.title}"`);
    console.log(`     - Title: ${t}`);
    console.log(`     - URL: ${u}`);
    console.log(`     - Matches equipment keyword: ${matches}`);
    if (matches) {
      const matchingKeywords = Array.from(queryEquipmentKeywords).filter(eq => t.includes(eq) || u.includes(eq));
      console.log(`     - Matching keywords: ${JSON.stringify(matchingKeywords)}`);
    }
    console.log();
    return matches;
  });
  
  return filtered;
}

// Test scenario 1: No equipment keywords detected (current bug)
console.log("=".repeat(80));
console.log("SCENARIO 1: No equipment keywords detected (current bug)");
console.log("=".repeat(80));
const emptySet = new Set();
const result1 = testEquipmentFiltering(articles, emptySet);
console.log(`Result: ${result1.length} articles pass filter (should be ${articles.length} - no filtering when no equipment keywords)`);

// Test scenario 2: Equipment keywords detected but wrong (individual words)
console.log("\n" + "=".repeat(80));
console.log("SCENARIO 2: Equipment keywords detected but wrong (individual words only)");
console.log("=".repeat(80));
const wrongSet = new Set(['depth', 'field']); // Individual words, not phrase
const result2 = testEquipmentFiltering(articles, wrongSet);
console.log(`Result: ${result2.length} articles pass filter`);

// Test scenario 3: Equipment keywords detected correctly (phrase)
console.log("\n" + "=".repeat(80));
console.log("SCENARIO 3: Equipment keywords detected correctly (phrase)");
console.log("=".repeat(80));
const correctSet = new Set(['depth of field']); // Phrase
const result3 = testEquipmentFiltering(articles, correctSet);
console.log(`Result: ${result3.length} articles pass filter`);

// Summary
console.log("\n" + "=".repeat(80));
console.log("SUMMARY");
console.log("=".repeat(80));
console.log(`Scenario 1 (no detection): ${result1.length} articles`);
console.log(`Scenario 2 (wrong detection): ${result2.length} articles`);
console.log(`Scenario 3 (correct detection): ${result3.length} articles`);

if (result1.length === articles.length && result2.length < articles.length && result3.length === articles.length) {
  console.log(`\n✅ When equipment keywords are NOT detected, NO filtering happens (all articles pass)`);
  console.log(`❌ When equipment keywords ARE detected but wrong, filtering removes articles`);
  console.log(`✅ When equipment keywords ARE detected correctly, filtering works correctly`);
}


