#!/usr/bin/env node
/**
 * Test keyword extraction and filtering for "what is depth of field"
 * This simulates the exact flow in chat.js
 */

// Simulate extractKeywords from chat.js
const TOPIC_KEYWORDS = [
  "devon", "snowdonia", "wales", "yorkshire", "lake district", "warwickshire", "coventry", "dorset",
  "bluebell", "autumn", "astrophotography", "beginners", "lightroom", "long exposure", "landscape", "woodlands",
  "weekend", "group", "advanced", "residential", "multi day", "multi-day",
  "iso", "aperture", "shutter", "exposure", "metering", "manual", "depth of field", "focal length",
  "white balance", "tripod", "filters", "lens", "camera", "equipment",
  "bnb", "accommodation", "bed", "breakfast", "pricing", "price", "cost",
];

function normalizeQuery(q) {
  let lc = (q || "").toLowerCase();
  lc = lc.replace(/\bb\s*&\s*b\b/g, "bnb");
  lc = lc.replace(/\bbed\s*and\s*breakfast\b/g, "bnb");
  return lc;
}

function applySynonymExpansion(lc) {
  const synonyms = {
    "weekend": ["fri", "sat", "sun", "friday", "saturday", "sunday", "multi day", "multi-day", "residential"],
    "group": ["participants", "people", "attendees", "max 4", "max 3", "max 2"],
    "advanced": ["hard", "difficult", "experienced", "expert", "experience level", "intermediate", "professional"],
    "equipment": ["gear", "camera", "lens", "tripod", "filters", "equipment needed", "what to bring", "required"]
  };
  
  for (const [key, values] of Object.entries(synonyms)) {
    if (lc.includes(key)) {
      values.forEach(synonym => lc += " " + synonym);
    }
  }
  return lc;
}

function applySpecialCases(lc) {
  if (lc.includes("group") && lc.includes("workshop")) {
    lc += " photography workshop residential multi day";
  }
  return lc;
}

function addTopicKeywords(kws, lc) {
  for (const t of TOPIC_KEYWORDS) {
    if (lc.includes(t)) kws.add(t);
  }
}

function addTechnicalAndMeaningfulWords(kws, lc) {
  const technicalTerms = ["iso", "raw", "jpg", "png", "dpi", "ppi", "rgb", "cmyk"];
  const stopWords = ["what", "when", "where", "which", "how", "why", "who", "can", "will", "should", "could", "would", "do", "does", "did", "are", "is", "was", "were", "have", "has", "had", "you", "your", "yours", "me", "my", "mine", "we", "our", "ours", "they", "their", "theirs", "them", "us", "him", "her", "his", "hers", "it", "its"];
  
  lc
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && (technicalTerms.includes(w) || w.length >= 4) && !stopWords.includes(w))
    .forEach((w) => kws.add(w));
}

function extractKeywords(q) {
  let lc = normalizeQuery(q);
  lc = applySynonymExpansion(lc);
  lc = applySpecialCases(lc);
  
  const kws = new Set();
  addTopicKeywords(kws, lc);
  addTechnicalAndMeaningfulWords(kws, lc);
  
  return Array.from(kws);
}

// Simulate filterArticleKeywords from chat.js line 4583
function filterArticleKeywords(keywords){
  const allow = new Set([
    'sharp','sharpness','focus','focusing','blur','blurry','camera','camera shake','tripod','shutter','shutter speed','stabilization','ibis','vr',
    'aperture','iso','exposure','metering','composition','white balance','depth of field','focal length','long exposure','hdr','noise','handheld',
    'landscape','portrait','travel','studio','macro','wildlife','street'
  ]);
  const cleaned = Array.from(new Set((keywords||[]).map(k=>String(k).toLowerCase().trim())));
  return cleaned.filter(k=>k.length>=3 && (allow.has(k) || /^(?:iso|hdr|vr|ibis)$/i.test(k) || /\b(sharp|focus|blur|tripod|shutter|landscape|portrait|travel|studio|macro|wildlife|street)\b/.test(k)));
}

// Test the flow
const query = "what is depth of field";
console.log(`\n🔍 Query: "${query}"\n`);

const extracted = extractKeywords(query);
console.log(`📝 After extractKeywords: ${JSON.stringify(extracted, null, 2)}`);

const filtered = filterArticleKeywords(extracted);
console.log(`\n📝 After filterArticleKeywords: ${JSON.stringify(filtered, null, 2)}`);

if (filtered.length === 0) {
  console.log("\n❌ PROBLEM: All keywords were filtered out!");
  console.log("   This means the database search will have no keywords to search for.");
  console.log("   Articles will get a base score of 0, making recency the sole ranking factor.");
} else if (filtered.includes("depth of field")) {
  console.log("\n✅ GOOD: 'depth of field' keyword is preserved");
} else {
  console.log("\n⚠️  WARNING: 'depth of field' keyword was filtered out");
  console.log(`   Only these keywords remain: ${filtered.join(", ")}`);
}
