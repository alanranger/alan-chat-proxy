// Test script to debug keyword extraction
// This will help us understand why evidence extraction is failing

const TOPIC_KEYWORDS = [
  "photography", "photo", "workshop", "course", "training", "lesson", "tutorial", "guide",
  "tripod", "camera", "lens", "equipment", "gear", "settings", "exposure", "composition",
  "landscape", "portrait", "macro", "abstract", "coastal", "urban", "architecture",
  "beginner", "intermediate", "advanced", "professional", "amateur", "hobbyist",
  "online", "in-person", "virtual", "remote", "live", "recorded", "free", "paid",
  "wedding", "commercial", "event", "corporate", "family", "portrait", "headshot",
  "article", "blog", "post", "tip", "advice", "help", "support", "mentoring",
  "service", "services", "hire", "booking", "pricing", "cost", "rate", "fee",
  "location", "venue", "studio", "outdoor", "indoor", "travel", "destination",
  "date", "time", "schedule", "availability", "booking", "reservation",
  "group", "private", "one-to-one", "individual", "personal", "custom",
  "technique", "skill", "method", "approach", "style", "creative", "artistic",
  "digital", "analog", "film", "processing", "editing", "post-production",
  "lighting", "flash", "natural", "artificial", "studio", "outdoor",
  "weather", "season", "time", "golden hour", "blue hour", "night",
  "travel", "destination", "location", "venue", "studio", "outdoor",
  "equipment", "gear", "camera", "lens", "tripod", "filter", "accessory",
  "software", "app", "tool", "resource", "reference", "inspiration",
  "community", "forum", "group", "network", "social", "sharing",
  "exhibition", "gallery", "show", "display", "portfolio", "collection",
  "competition", "contest", "award", "recognition", "achievement",
  "business", "marketing", "branding", "website", "portfolio", "client",
  "pricing", "cost", "rate", "fee", "package", "deal", "offer", "discount",
  "booking", "reservation", "schedule", "availability", "calendar",
  "contact", "email", "phone", "message", "inquiry", "question",
  "about", "bio", "background", "experience", "qualification", "certification",
  "testimonial", "review", "feedback", "rating", "recommendation",
  "faq", "question", "answer", "help", "support", "assistance",
  "terms", "conditions", "policy", "privacy", "cancellation", "refund",
  "gift", "voucher", "certificate", "present", "special", "occasion",
  "seasonal", "holiday", "christmas", "valentine", "mother", "father",
  "birthday", "anniversary", "graduation", "wedding", "engagement",
  "corporate", "business", "team", "staff", "employee", "training",
  "event", "party", "celebration", "conference", "meeting", "seminar",
  "workshop", "masterclass", "intensive", "retreat", "residential",
  "travel", "destination", "location", "venue", "studio", "outdoor",
  "accommodation", "hotel", "bnb", "bed", "breakfast", "residential",
  "transport", "travel", "flight", "train", "car", "parking",
  "food", "meal", "catering", "refreshment", "break", "lunch",
  "insurance", "safety", "risk", "liability", "cover", "protection",
  "weather", "season", "time", "golden hour", "blue hour", "night",
  "equipment", "gear", "camera", "lens", "tripod", "filter", "accessory",
  "software", "app", "tool", "resource", "reference", "inspiration",
  "community", "forum", "group", "network", "social", "sharing",
  "exhibition", "gallery", "show", "display", "portfolio", "collection",
  "competition", "contest", "award", "recognition", "achievement",
  "business", "marketing", "branding", "website", "portfolio", "client",
  "pricing", "price", "cost"
];

function extractKeywords(q) {
  let lc = (q || "").toLowerCase();
  // Normalize common variants to improve matching
  lc = lc.replace(/\bb\s*&\s*b\b/g, "bnb"); // b&b -> bnb
  lc = lc.replace(/\bbed\s*and\s*breakfast\b/g, "bnb");
  const kws = new Set();
  for (const t of TOPIC_KEYWORDS) {
    if (lc.includes(t)) kws.add(t);
  }
  
  // Add technical terms (3+ chars) and general words (4+ chars)
  const words = lc.split(/\s+/).filter(w => w.length >= 3);
  for (const w of words) {
    if (w.length >= 4 || /^[a-z]{3}$/.test(w)) {
      kws.add(w);
    }
  }
  
  return Array.from(kws);
}

// Test keyword extraction for various queries
const testQueries = [
  "photography courses",
  "photography articles", 
  "photography services",
  "explain the exposure triangle",
  "what tripod do you recommend"
];

console.log('🔍 TESTING KEYWORD EXTRACTION');
console.log('=' .repeat(50));

testQueries.forEach(query => {
  const keywords = extractKeywords(query);
  console.log(`\nQuery: "${query}"`);
  console.log(`Keywords: [${keywords.join(', ')}]`);
  console.log(`Count: ${keywords.length}`);
});

console.log('\n' + '='.repeat(50));
console.log('🎯 KEYWORD EXTRACTION ANALYSIS');
console.log('='.repeat(50));

console.log('\nKey Findings:');
console.log('1. If keywords are empty or too few, search functions will fail');
console.log('2. If keywords are too generic, search will return too many results');
console.log('3. If keywords are too specific, search will return no results');

console.log('\nNext Steps:');
console.log('1. Check if extracted keywords are appropriate for search');
console.log('2. Verify search functions work with these keywords');
console.log('3. Test if database queries return results with these keywords');



