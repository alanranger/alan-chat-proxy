#!/usr/bin/env node
/**
 * Test keyword filtering bug - why "depth" and "field" are being filtered out
 */

function filterArticleKeywords(keywords) {
  const allow = new Set([
    'sharp','sharpness','focus','focusing','blur','blurry','camera','camera shake','tripod','shutter','shutter speed','stabilization','ibis','vr',
    'aperture','iso','exposure','metering','composition','white balance','depth of field','focal length','long exposure','hdr','noise','handheld',
    'landscape','portrait','travel','studio','macro','wildlife','street'
  ]);
  const cleaned = Array.from(new Set((keywords||[]).map(k=>String(k).toLowerCase().trim())));
  return cleaned.filter(k=>k.length>=3 && (allow.has(k) || /^(?:iso|hdr|vr|ibis)$/i.test(k) || /\b(sharp|focus|blur|tripod|shutter|landscape|portrait|travel|studio|macro|wildlife|street)\b/.test(k)));
}

const query = "what is depth of field";
const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 0);

console.log(`\n🔍 Testing keyword filtering for: "${query}"`);
console.log(`📝 All keywords: ${JSON.stringify(keywords)}`);

const filtered = filterArticleKeywords(keywords);
console.log(`✅ Filtered keywords: ${JSON.stringify(filtered)}`);

console.log(`\n❌ PROBLEM:`);
console.log(`   - "depth" (length ${'depth'.length}) is NOT in allow set: ${new Set(['depth of field']).has('depth')}`);
console.log(`   - "field" (length ${'field'.length}) is NOT in allow set: ${new Set(['depth of field']).has('field')}`);
console.log(`   - "depth of field" is in allow set, but filterArticleKeywords checks individual words, not phrases`);
console.log(`   - So "depth" and "field" get filtered out!`);

console.log(`\n📊 What happens next:`);
if (filtered.length === 0) {
  console.log(`   - filterArticleKeywords returns EMPTY array`);
  console.log(`   - executePrimarySearch uses enhancedKeywords instead (line 4624)`);
  console.log(`   - enhancedKeywords = ["what", "is", "depth", "of", "field"]`);
  console.log(`   - So the database query searches for: title.ilike('%what%') OR title.ilike('%is%') OR ...`);
  console.log(`   - This is VERY broad and will match many irrelevant articles!`);
}


