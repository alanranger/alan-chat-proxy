#!/usr/bin/env node
/**
 * Test to understand why equipment keyword filtering might be removing articles
 */

// Simulate the equipment keyword filtering logic
function testEquipmentFilter() {
  console.log('================================================================================');
  console.log('TESTING: Equipment Keyword Filtering Logic');
  console.log('================================================================================');

  // Simulate "what is depth of field" query
  const query = "what is depth of field";
  const kw = query.toLowerCase().split(/\s+/); // ["what", "is", "depth", "of", "field"]
  
  const equipmentKeywords = new Set([
    'tripod', 'camera', 'lens', 'filter', 'flash', 'monopod', 'head', 'ball head', 'geared head',
    'memory card', 'battery', 'sensor', 'shutter', 'aperture', 'iso', 'white balance',
    'depth of field', 'focal length', 'exposure', 'metering', 'composition', 'sharpness', 'focus',
    'sharp', 'sharpness', 'focusing', 'blur', 'blurry', 'camera shake', 'stabilization', 'ibis', 'vr',
    'hdr', 'noise', 'handheld'
  ]);

  // Simulate the equipment keyword detection (after our fix)
  const queryEquipmentKeywords = new Set();
  const normalizedKeywordString = kw.join(' ').replace(/\s+/g, ' ').trim(); // "what is depth of field"

  // Check individual words
  for (const token of kw) {
    if (equipmentKeywords.has(token)) {
      queryEquipmentKeywords.add(token);
    }
  }

  // Check multi-word phrases
  for (const term of equipmentKeywords) {
    if (term.includes(' ') && normalizedKeywordString.length > 0) {
      const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(normalizedKeywordString)) {
        queryEquipmentKeywords.add(term);
      }
    }
  }

  console.log(`\nQuery: "${query}"`);
  console.log(`Keywords: ${kw.join(', ')}`);
  console.log(`Normalized keyword string: "${normalizedKeywordString}"`);
  console.log(`\nDetected equipment keywords: ${Array.from(queryEquipmentKeywords).join(', ')}`);
  console.log(`hasEquipmentKeyword: ${queryEquipmentKeywords.size > 0}`);

  // Simulate articles
  const articles = [
    {
      id: 265306,
      title: "Aperture and Depth of Field Photography Assignment",
      page_url: "https://www.alanranger.com/blog-on-photography/aperture-and-depth-of-field-assignment"
    },
    {
      id: 256968,
      title: "09 What is DEPTH OF FIELD in Photography: A Beginners Guide",
      page_url: "https://www.alanranger.com/blog-on-photography/what-is-depth-of-field"
    }
  ];

  console.log(`\n================================================================================`);
  console.log('TESTING: Equipment Keyword Filter');
  console.log('================================================================================');

  // Simulate the filter logic
  const filtered = articles.filter((r) => {
    const t = (r.title || "").toLowerCase();
    const u = (r.page_url || "").toLowerCase();
    const matches = Array.from(queryEquipmentKeywords).some(eq => {
      const eqLower = eq.toLowerCase();
      const titleMatch = t.includes(eqLower);
      const urlMatch = u.includes(eqLower);
      console.log(`  Article ${r.id}: Checking "${eq}" -> title: ${titleMatch}, url: ${urlMatch}`);
      return titleMatch || urlMatch;
    });
    return matches;
  });

  console.log(`\nResults:`);
  console.log(`  Input articles: ${articles.length}`);
  console.log(`  Filtered articles: ${filtered.length}`);
  filtered.forEach((a, i) => {
    console.log(`    ${i + 1}. ${a.title} (ID: ${a.id})`);
  });

  if (filtered.length !== articles.length) {
    console.log(`\n❌ PROBLEM: Filter removed ${articles.length - filtered.length} article(s)`);
    const removed = articles.filter(a => !filtered.some(f => f.id === a.id));
    removed.forEach(a => {
      console.log(`    Removed: ${a.title} (ID: ${a.id})`);
    });
  } else {
    console.log(`\n✅ All articles passed the filter`);
  }
}

testEquipmentFilter();

