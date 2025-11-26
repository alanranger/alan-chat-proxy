#!/usr/bin/env node
/**
 * DEFINITIVE TEST: Verify the exact behavior of extractKeywords and filterArticleKeywords
 * for "what is depth of field" query
 */

// Simulate the exact functions from chat.js

function normalizeQuery(q) {
  let lc = (q || "").toLowerCase();
  lc = lc.replace(/\bb\s*&\s*b\b/g, "bnb");
  lc = lc.replace(/\bbed\s*and\s*breakfast\b/g, "bnb");
  return lc;
}

const TOPIC_KEYWORDS = [
  "devon", "snowdonia", "wales", "yorkshire", "lake district", "warwickshire", "coventry", "dorset",
  "bluebell", "autumn", "astrophotography", "beginners", "lightroom", "long exposure", "landscape", "woodlands",
  "weekend", "group", "advanced", "residential", "multi day", "multi-day",
  "iso", "aperture", "shutter", "exposure", "metering", "manual", "depth of field", "focal length", "white balance",
  "tripod", "filters", "lens", "camera", "equipment",
  "bnb", "accommodation", "bed", "breakfast", "pricing", "price", "cost",
];

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
  const kws = new Set();
  addTopicKeywords(kws, lc);
  addTechnicalAndMeaningfulWords(kws, lc);
  return Array.from(kws);
}

function filterArticleKeywords(keywords){
  const allow = new Set([
    'sharp','sharpness','focus','focusing','blur','blurry','camera','camera shake','tripod','shutter','shutter speed','stabilization','ibis','vr',
    'aperture','iso','exposure','metering','composition','white balance','depth of field','focal length','long exposure','hdr','noise','handheld',
    'landscape','portrait','travel','studio','macro','wildlife','street'
  ]);
  const cleaned = Array.from(new Set((keywords||[]).map(k=>String(k).toLowerCase().trim())));
  return cleaned.filter(k=>k.length>=3 && (allow.has(k) || /^(?:iso|hdr|vr|ibis)$/i.test(k) || /\b(sharp|focus|blur|tripod|shutter|landscape|portrait|travel|studio|macro|wildlife|street)\b/.test(k)));
}

// Test the query
const query = "what is depth of field";
console.log(`\n🔍 Query: "${query}"\n`);

const extracted = extractKeywords(query);
console.log(`📝 After extractKeywords:`);
console.log(`   ${JSON.stringify(extracted, null, 2)}`);
console.log(`   Count: ${extracted.length}`);
console.log(`   Contains "depth of field": ${extracted.includes("depth of field")}`);

const filtered = filterArticleKeywords(extracted);
console.log(`\n📝 After filterArticleKeywords:`);
console.log(`   ${JSON.stringify(filtered, null, 2)}`);
console.log(`   Count: ${filtered.length}`);
console.log(`   Contains "depth of field": ${filtered.includes("depth of field")}`);

if (filtered.includes("depth of field")) {
  console.log(`\n✅ CORRECT: "depth of field" is preserved through filterArticleKeywords`);
} else {
  console.log(`\n❌ BUG CONFIRMED: "depth of field" is NOT preserved through filterArticleKeywords`);
  console.log(`\n🔍 Analysis:`);
  console.log(`   - "depth of field" is in the allow set: ${new Set(['depth of field']).has('depth of field')}`);
  console.log(`   - After cleaning, checking each keyword:`);
  extracted.forEach(k => {
    const cleaned = String(k).toLowerCase().trim();
    const inAllow = new Set(['sharp','sharpness','focus','focusing','blur','blurry','camera','camera shake','tripod','shutter','shutter speed','stabilization','ibis','vr',
      'aperture','iso','exposure','metering','composition','white balance','depth of field','focal length','long exposure','hdr','noise','handheld',
      'landscape','portrait','travel','studio','macro','wildlife','street']).has(cleaned);
    const matchesRegex = /^(?:iso|hdr|vr|ibis)$/i.test(cleaned) || /\b(sharp|focus|blur|tripod|shutter|landscape|portrait|travel|studio|macro|wildlife|street)\b/.test(cleaned);
    const passes = cleaned.length >= 3 && (inAllow || matchesRegex);
    console.log(`     "${k}" -> cleaned: "${cleaned}", length: ${cleaned.length}, inAllow: ${inAllow}, matchesRegex: ${matchesRegex}, PASSES: ${passes}`);
  });
}

