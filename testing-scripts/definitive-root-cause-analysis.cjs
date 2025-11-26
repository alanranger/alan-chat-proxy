#!/usr/bin/env node
/**
 * DEFINITIVE ROOT CAUSE ANALYSIS for "what is depth of field"
 * This will show us exactly what's happening step by step
 */

// Step 1: Keyword extraction and filtering
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

// Step 2: Equipment keyword detection
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

// Test
const query = "what is depth of field";
console.log("=".repeat(80));
console.log("DEFINITIVE ROOT CAUSE ANALYSIS");
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
console.log(`   ❌ BUG: "depth" and "field" are filtered out because they're not in allow set individually`);
console.log(`   ❌ BUG: "depth of field" is in allow set as a phrase, but filterArticleKeywords checks individual words\n`);

// Step 3
const enhancedKeywords = allKeywords; // When filterArticleKeywords returns empty, use all keywords
console.log(`STEP 3: Enhanced keywords (fallback when filtered is empty)`);
console.log(`   Result: ${JSON.stringify(enhancedKeywords)}\n`);

// Step 4
const detection = detectEquipmentKeywords(enhancedKeywords);
console.log(`STEP 4: Equipment keyword detection`);
console.log(`   hasEquipmentKeyword: ${detection.hasEquipmentKeyword}`);
console.log(`   queryEquipmentKeywords: ${JSON.stringify(Array.from(detection.queryEquipmentKeywords))}`);
console.log(`   ❌ BUG: "depth" and "field" individually don't match "depth of field" in equipmentKeywords set`);
console.log(`   ❌ BUG: Code doesn't check for multi-word phrases in the full query\n`);

// Step 5: Database query simulation
console.log(`STEP 5: Database query (what would actually be executed)`);
if (filteredKeywords.length === 0) {
  console.log(`   Since filterArticleKeywords returned empty, use enhancedKeywords`);
  console.log(`   Query: title.ilike('%what%') OR title.ilike('%is%') OR title.ilike('%depth%') OR title.ilike('%of%') OR title.ilike('%field%') OR ...`);
  console.log(`   ❌ PROBLEM: This is VERY broad and matches many irrelevant articles`);
  console.log(`   ✅ GOOD: Article 256968 WOULD be returned (it matches "depth" and "field")`);
  console.log(`   ✅ GOOD: Article 265306 WOULD be returned (it matches "depth" and "field")\n`);
}

// Step 6: Equipment keyword filtering
console.log(`STEP 6: Equipment keyword filtering (after scoring)`);
if (!detection.hasEquipmentKeyword) {
  console.log(`   Since hasEquipmentKeyword is FALSE, NO filtering happens`);
  console.log(`   ✅ All articles from database query pass through\n`);
} else {
  console.log(`   Since hasEquipmentKeyword is TRUE, filter articles`);
  console.log(`   Articles must match: ${JSON.stringify(Array.from(detection.queryEquipmentKeywords))}`);
  console.log(`   ❌ PROBLEM: If wrong keywords detected, wrong articles might be filtered\n`);
}

// Step 7: Final result
console.log(`STEP 7: Final result`);
console.log(`   Database returns: ~75 articles (limit * 5 = 15 * 5)`);
console.log(`   Articles are scored and sorted`);
console.log(`   Top articles are returned (limit = 15)`);
console.log(`   ❓ QUESTION: Why is only 1 article showing in test results?`);
console.log(`   ❓ POSSIBLE CAUSES:`);
console.log(`      1. Scoring is wrong - article 256968 scores lower than expected`);
console.log(`      2. Limit is being applied somewhere else`);
console.log(`      3. Articles are being filtered out after scoring`);
console.log(`      4. Database query is not returning article 256968 (unlikely - we verified it does)\n`);

// Conclusion
console.log("=".repeat(80));
console.log("CONCLUSION");
console.log("=".repeat(80));
console.log(`\n✅ CONFIRMED BUGS:`);
console.log(`   1. filterArticleKeywords filters out "depth" and "field" because they're not in allow set individually`);
console.log(`   2. Equipment keyword detection doesn't check for multi-word phrases like "depth of field"`);
console.log(`   3. This causes the database query to be too broad (matches "what", "is", "of")`);
console.log(`\n❓ UNKNOWN:`);
console.log(`   Why is only 1 article (assignment article) showing in results when article 256968 should score higher?`);
console.log(`   Need to check: scoring logic, limit application, or additional filtering\n`);


