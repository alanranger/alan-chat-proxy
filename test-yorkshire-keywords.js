// Test keyword extraction for Yorkshire workshop query
const query = "when is your next yorkshire workshop";
console.log(`Testing keyword extraction for: "${query}"`);

// Simulate the extractKeywords function
const TOPIC_KEYWORDS = [
  // locations
  "devon",
  "snowdonia", 
  "wales",
  "lake district",
  "warwickshire",
  "coventry",
  "dorset",
  // seasons / themes / topics
  "bluebell",
  "autumn",
  "astrophotography",
  "beginners",
  "lightroom",
  "long exposure",
  "landscape",
  "woodlands",
  // technical photography terms
  "iso",
  "aperture",
  "shutter",
  "exposure",
  "metering",
  "manual",
  "depth of field",
  "focal length",
  "white balance",
  "tripod",
  "filters",
  "lens",
  "camera",
  "equipment",
  // accommodation/pricing
  "bnb",
  "accommodation",
  "bed",
  "breakfast",
  "pricing",
  "price",
  "cost",
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
  const technicalTerms = ["iso", "raw", "jpg", "png", "dpi", "ppi", "rgb", "cmyk"];
  lc
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && (technicalTerms.includes(w) || w.length >= 4))
    .forEach((w) => kws.add(w));
    
  return Array.from(kws);
}

const keywords = extractKeywords(query);
console.log(`Extracted keywords: [${keywords.join(', ')}]`);

// Check if "yorkshire" is in the keywords
console.log(`Contains "yorkshire": ${keywords.includes('yorkshire')}`);
console.log(`Contains "workshop": ${keywords.includes('workshop')}`);


