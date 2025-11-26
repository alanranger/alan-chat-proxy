#!/usr/bin/env node
/**
 * Test "what is aperture" query - similar investigation to "what is depth of field"
 */

// Simulate the same functions as before
function extractKeywords(query) {
  return query.toLowerCase().split(/\s+/).filter(k => k.length > 0);
}

function filterArticleKeywords(keywords) {
  const allow = new Set([
    'sharp','sharpness','focus','focusing','blur','blurry','camera','camera shake','tripod','shutter','shutter speed','stabilization','ibis','vr',
    'aperture','iso','exposure','metering','composition','white balance','depth of field','focal length','long exposure','hdr','noise','handheld',
    'landscape','portrait','travel','studio','macro','wildlife','street'
  ]);
  const cleaned = Array.from(new Set((keywords||[]).map(k=>String(k).toLowerCase().trim())));
  return cleaned.filter(k=>k.length>=3 && (allow.has(k) || /^(?:iso|hdr|vr|ibis)$/i.test(k) || /\b(sharp|focus|blur|tripod|shutter|landscape|portrait|travel|studio|macro|wildlife|street)\b/.test(k)));
}

function detectEquipmentKeywords(keywords) {
  const equipmentKeywords = new Set([
    'tripod', 'camera', 'lens', 'filter', 'flash', 'monopod', 'head', 'ball head', 'geared head',
    'memory card', 'battery', 'sensor', 'shutter', 'aperture', 'iso', 'white balance',
    'depth of field', 'focal length', 'exposure', 'metering', 'composition', 'sharpness', 'focus',
    'sharp', 'sharpness', 'focusing', 'blur', 'blurry', 'camera shake', 'stabilization', 'ibis', 'vr',
    'hdr', 'noise', 'handheld'
  ]);
  
  const queryEquipmentKeywords = new Set();
  const hasEquipmentKeyword = keywords.some(k => {
    if (equipmentKeywords.has(k)) {
      queryEquipmentKeywords.add(k);
      return true;
    }
    return false;
  });
  
  return { hasEquipmentKeyword, queryEquipmentKeywords };
}

const query = "what is aperture";
console.log("=".repeat(80));
console.log("INVESTIGATION: 'what is aperture'");
console.log("=".repeat(80));
console.log(`\nQuery: "${query}"\n`);

// Step 1
const allKeywords = extractKeywords(query);
console.log(`STEP 1: Extract keywords`);
console.log(`   Result: ${JSON.stringify(allKeywords)}\n`);

// Step 2
const filteredKeywords = filterArticleKeywords(allKeywords);
console.log(`STEP 2: Filter to allowed keywords`);
console.log(`   Result: ${JSON.stringify(filteredKeywords)}`);
if (filteredKeywords.length === 0) {
  console.log(`   ❌ SAME BUG: filterArticleKeywords returns empty (but "aperture" IS in allow set!)`);
} else {
  console.log(`   ✅ DIFFERENT: filterArticleKeywords returns keywords (because "aperture" is in allow set)`);
}
console.log();

// Step 3
const enhancedKeywords = filteredKeywords.length > 0 ? filteredKeywords : allKeywords;
console.log(`STEP 3: Enhanced keywords`);
console.log(`   Result: ${JSON.stringify(enhancedKeywords)}\n`);

// Step 4
const detection = detectEquipmentKeywords(enhancedKeywords);
console.log(`STEP 4: Equipment keyword detection`);
console.log(`   hasEquipmentKeyword: ${detection.hasEquipmentKeyword}`);
console.log(`   queryEquipmentKeywords: ${JSON.stringify(Array.from(detection.queryEquipmentKeywords))}`);
if (detection.hasEquipmentKeyword) {
  console.log(`   ✅ DIFFERENT: Equipment keyword detected (because "aperture" is single word)`);
} else {
  console.log(`   ❌ SAME BUG: Equipment keyword NOT detected`);
}
console.log();

// Conclusion
console.log("=".repeat(80));
console.log("COMPARISON WITH 'what is depth of field'");
console.log("=".repeat(80));
console.log(`\n✅ DIFFERENCES:`);
console.log(`   - "aperture" is a single word, so filterArticleKeywords should work`);
console.log(`   - "aperture" is in equipmentKeywords set, so detection should work`);
console.log(`\n❓ QUESTIONS:`);
console.log(`   - Why does baseline show a PRODUCT instead of article 256372?`);
console.log(`   - Why does current show assignment article instead of article 256372?`);
console.log(`   - Is this the same recency boost issue?`);


