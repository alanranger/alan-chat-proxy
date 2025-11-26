#!/usr/bin/env node
/**
 * Test "what is shutter speed" query - investigate regression (3 -> 1 article)
 */

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

const query = "what is shutter speed";
console.log("=".repeat(80));
console.log("INVESTIGATION: 'what is shutter speed'");
console.log("=".repeat(80));
console.log(`\nQuery: "${query}"`);
console.log(`Regression: 3 articles (baseline) -> 1 article (current)\n`);

// Step 1
const allKeywords = extractKeywords(query);
console.log(`STEP 1: Extract keywords`);
console.log(`   Result: ${JSON.stringify(allKeywords)}\n`);

// Step 2
const filteredKeywords = filterArticleKeywords(allKeywords);
console.log(`STEP 2: Filter to allowed keywords`);
console.log(`   Result: ${JSON.stringify(filteredKeywords)}`);
if (filteredKeywords.length === 0) {
  console.log(`   ❌ BUG: filterArticleKeywords returns empty`);
} else {
  console.log(`   ✅ filterArticleKeywords returns keywords`);
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
  console.log(`   ✅ Equipment keyword detected (because "shutter" is in equipmentKeywords)`);
} else {
  console.log(`   ❌ Equipment keyword NOT detected`);
}
console.log();

// Analysis
console.log("=".repeat(80));
console.log("ANALYSIS");
console.log("=".repeat(80));
console.log(`\n✅ DIFFERENCES from "what is depth of field":`);
console.log(`   - "shutter speed" is a multi-word phrase`);
console.log(`   - "shutter" is in equipmentKeywords, "speed" is not`);
console.log(`   - filterArticleKeywords should return ["shutter", "speed"] (both >= 3 chars)`);
console.log(`   - Equipment keyword detection should detect "shutter"`);
console.log(`\n❓ QUESTIONS:`);
console.log(`   - Why only 1 article showing (same as depth of field and aperture)?`);
console.log(`   - Is this the same pattern?`);


