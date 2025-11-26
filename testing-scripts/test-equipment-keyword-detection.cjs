#!/usr/bin/env node
/**
 * Test equipment keyword detection for "what is depth of field"
 * This will show us exactly what's happening with the keyword detection
 */

// Simulate extractKeywords (simplified)
function extractKeywords(query) {
  return query.toLowerCase().split(/\s+/).filter(k => k.length > 0);
}

// Simulate filterArticleKeywords
function filterArticleKeywords(keywords) {
  const allow = new Set([
    'sharp','sharpness','focus','focusing','blur','blurry','camera','camera shake','tripod','shutter','shutter speed','stabilization','ibis','vr',
    'aperture','iso','exposure','metering','composition','white balance','depth of field','focal length','long exposure','hdr','noise','handheld',
    'landscape','portrait','travel','studio','macro','wildlife','street'
  ]);
  const cleaned = Array.from(new Set((keywords||[]).map(k=>String(k).toLowerCase().trim())));
  return cleaned.filter(k=>k.length>=3 && (allow.has(k) || /^(?:iso|hdr|vr|ibis)$/i.test(k) || /\b(sharp|focus|blur|tripod|shutter|landscape|portrait|travel|studio|macro|wildlife|street)\b/.test(k)));
}

// Simulate processAndSortResults equipment keyword detection
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
  
  // Check for multi-word phrases in the original query
  const originalQuery = keywords.join(' ');
  equipmentKeywords.forEach(eq => {
    if (eq.includes(' ') && originalQuery.includes(eq)) {
      queryEquipmentKeywords.add(eq);
    }
  });
  
  return {
    hasEquipmentKeyword: hasEquipmentKeyword || queryEquipmentKeywords.size > 0,
    queryEquipmentKeywords
  };
}

// Test
const query = "what is depth of field";
console.log(`\n🔍 Testing query: "${query}"\n`);

// Step 1: Extract keywords
const allKeywords = extractKeywords(query);
console.log(`1. Extracted keywords: ${JSON.stringify(allKeywords)}`);

// Step 2: Filter to allowed keywords
const filteredKeywords = filterArticleKeywords(allKeywords);
console.log(`2. Filtered keywords (allowed): ${JSON.stringify(filteredKeywords)}`);

// Step 3: Check equipment keyword detection
const detection = detectEquipmentKeywords(filteredKeywords);
console.log(`3. Equipment keyword detection:`);
console.log(`   - hasEquipmentKeyword: ${detection.hasEquipmentKeyword}`);
console.log(`   - queryEquipmentKeywords: ${JSON.stringify(Array.from(detection.queryEquipmentKeywords))}`);

// Step 4: Check if "depth of field" phrase would be detected
const fullQuery = query.toLowerCase();
const equipmentKeywords = new Set([
  'tripod', 'camera', 'lens', 'filter', 'flash', 'monopod', 'head', 'ball head', 'geared head',
  'memory card', 'battery', 'sensor', 'shutter', 'aperture', 'iso', 'white balance',
  'depth of field', 'focal length', 'exposure', 'metering', 'composition', 'sharpness', 'focus',
  'sharp', 'sharpness', 'focusing', 'blur', 'blurry', 'camera shake', 'stabilization', 'ibis', 'vr',
  'hdr', 'noise', 'handheld'
]);

console.log(`\n4. Checking if "depth of field" phrase is in equipmentKeywords: ${equipmentKeywords.has('depth of field')}`);
console.log(`5. Checking if full query contains "depth of field": ${fullQuery.includes('depth of field')}`);

// Step 5: Simulate what the ACTUAL code does (checking individual words only)
const actualCodeDetection = filteredKeywords.some(k => equipmentKeywords.has(k));
console.log(`\n6. ACTUAL CODE behavior (checking individual words only):`);
console.log(`   - Individual words in equipmentKeywords: ${filteredKeywords.filter(k => equipmentKeywords.has(k)).join(', ') || 'NONE'}`);
console.log(`   - hasEquipmentKeyword (actual code): ${actualCodeDetection}`);

// Step 7: Show the problem
console.log(`\n❌ PROBLEM IDENTIFIED:`);
if (!actualCodeDetection && fullQuery.includes('depth of field')) {
  console.log(`   The code checks individual keywords ("depth", "field") but NOT the phrase "depth of field"`);
  console.log(`   So "depth of field" is NOT detected as an equipment keyword!`);
  console.log(`   This means equipment keyword filtering won't work correctly.`);
}


