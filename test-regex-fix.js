#!/usr/bin/env node

// Test the regex fix
const testHtml = `Location: 45 Hathaway Road, Tile Hill Village, Coventry, CV4 9HW * Participants: Max 4 * Time: 19:00 - 21:00 * Multi Course Start Dates:`;

console.log("🔍 Testing Regex Fix...\n");
console.log("Test HTML:", testHtml);
console.log("");

// Test location regex
const locationMatch = testHtml.match(/location\s*:\s*([^*]+?)(?=\s*\*)/i);
if (locationMatch) {
  console.log("✅ Location regex works:");
  console.log(`   Extracted: "${locationMatch[1].trim()}"`);
} else {
  console.log("❌ Location regex failed");
}

// Test time regex
const timeMatch = testHtml.match(/time\s*:\s*([^*]+?)(?=\s*\*)/i);
if (timeMatch) {
  console.log("✅ Time regex works:");
  console.log(`   Extracted: "${timeMatch[1].trim()}"`);
} else {
  console.log("❌ Time regex failed");
}