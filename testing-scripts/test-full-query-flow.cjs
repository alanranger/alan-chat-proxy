#!/usr/bin/env node
/**
 * Test the FULL query flow for "what is depth of field"
 * Simulates: database query -> filtering -> scoring -> final results
 */

// Simulate articles that would be returned from database query
// (ordered by publish_date DESC, limited to ~60 results)
const dbResults = [
  {
    id: 265306,
    title: "Aperture and Depth of Field Photography Assignment",
    page_url: "https://www.alanranger.com/blog-on-photography/aperture-and-depth-of-field-assignment",
    categories: [],
    tags: ["Technical Foundations"],
    publish_date: "2025-11-23",
    last_seen: "2025-11-24T16:39:15.352+00:00",
    kind: "article",
    source_type: "blog"
  },
  {
    id: 256968,
    title: "09 What is DEPTH OF FIELD in Photography: A Beginners Guide",
    page_url: "https://www.alanranger.com/blog-on-photography/what-is-depth-of-field",
    categories: ["photography-tips", "online photography course"],
    tags: ["camera settings for photography"],
    publish_date: "2025-02-20",
    last_seen: "2025-11-24T16:45:37.421+00:00",
    kind: "article",
    source_type: "blog"
  },
  {
    id: 256403,
    title: "Mastering the Art of Winter Photography: An In-depth Guide",
    page_url: "https://www.alanranger.com/blog-on-photography/mastering-the-art-of-winter-photography",
    categories: ["photography-tips", "photography-workshops", "tip-of-the-day"],
    tags: ["winter photography"],
    publish_date: "2025-01-02",
    last_seen: "2025-11-24T16:53:16.207+00:00",
    kind: "article",
    source_type: "blog"
  }
];

// Scoring functions (same as before)
function addBaseKeywordScore(context) {
  for (const k of context.kw) {
    if (!k) continue;
    if (context.has(context.t, k)) context.add(3);
    if (context.has(context.u, k)) context.add(1);
  }
}

function addOnlineCourseBoost(context) {
  const isOnlineCourse = context.categories.includes("online photography course");
  const coreConcepts = [
    "iso", "aperture", "shutter speed", "white balance", "depth of field", "metering",
    "exposure", "composition", "macro", "landscape", "portrait", "street", "wildlife",
    "raw", "jpeg", "hdr", "focal length", "long exposure"
  ];
  const hasCore = coreConcepts.some(c => context.kw.includes(c));
  
  if (context.preventBoost) {
    return { hasCore, coreConcepts };
  }
  
  if (hasCore && isOnlineCourse) {
    context.add(25);
    for (const c of coreConcepts) {
      if (context.has(context.t, `what is ${c}`) || context.has(context.t, `${c} in photography`)) {
        context.add(15);
      }
    }
    if (context.has(context.t, "pdf") || context.has(context.t, "checklist") || context.has(context.t, "guide")) {
      context.add(10);
    }
  }
  
  return { hasCore, coreConcepts };
}

function applyConceptBoosts(context) {
  if (context.t.startsWith(`what is ${context.concept}`)) context.add(20);
  if (context.has(context.t, `what is ${context.concept}`)) context.add(10);
  if (context.has(context.u, `/what-is-${context.slug}`)) context.add(12);
  if (context.has(context.u, `${context.slug}`)) context.add(3);
}

function addCoreConceptScore(context) {
  if (!context.hasCore) return;
  
  for (const c of context.coreConcepts) {
    const slug = c.replace(/\s+/g, "-");
    applyConceptBoosts({
      concept: c,
      slug: slug,
      t: context.t,
      u: context.u,
      add: context.add,
      has: context.has
    });
  }
  
  if (/(lightroom|what's new|whats new)/i.test(context.t) || /(lightroom|whats-new)/.test(context.u)) {
    context.add(-12);
  }
}

function addCategoryBoost(categories, hasCore, add) {
  if (categories.includes("photography-tips") && hasCore) {
    add(5);
  }
}

function addRecencyTieBreaker(s, r) {
  const publishDate = r.publish_date ? new Date(r.publish_date).getTime() || 0 : 0;
  const seen = r.last_seen ? new Date(r.last_seen).getTime() || 0 : 0;
  const recencyDate = publishDate > 0 ? publishDate : seen;
  
  const now = Date.now();
  const daysSincePublication = recencyDate > 0 ? (now - recencyDate) / (1000 * 60 * 60 * 24) : Infinity;
  
  let recencyBoost = 0;
  if (daysSincePublication <= 7) {
    recencyBoost = 20;
  } else if (daysSincePublication <= 30) {
    recencyBoost = 10;
  } else if (daysSincePublication <= 90) {
    recencyBoost = 5;
  }
  
  return s * 1000 + recencyBoost;
}

function scoreArticleRow(r, kw, equipmentKeywords = null) {
  const t = (r.title || r.raw?.name || "").toLowerCase();
  const u = (r.page_url || r.source_url || "").toLowerCase();
  const categories = r.categories || [];
  let s = 0;
  
  const add = (n) => { s += n; };
  const has = (str, needle) => str.includes(needle);
  
  let matchesEquipment = false;
  if (equipmentKeywords && equipmentKeywords.size > 0) {
    matchesEquipment = Array.from(equipmentKeywords).some(eq => has(t, eq) || has(u, eq));
    if (!matchesEquipment) {
      add(-50);
    }
  }
  
  addBaseKeywordScore({ kw, t, u, add, has });
  
  const shouldPreventOnlineCourseBoost = equipmentKeywords && equipmentKeywords.size > 0 && !matchesEquipment;
  const { hasCore, coreConcepts } = addOnlineCourseBoost({ categories, kw, t, add, has, preventBoost: shouldPreventOnlineCourseBoost });
  addCoreConceptScore({ hasCore, coreConcepts, t, u, add, has });
  addCategoryBoost(categories, hasCore, add);
  
  return addRecencyTieBreaker(s, r);
}

// Simulate processAndSortResults
function processAndSortResults(rows, keywords, limit) {
  let kw = (keywords || []).map(k => String(k || "").toLowerCase());
  
  const equipmentKeywords = new Set([
    'tripod', 'camera', 'lens', 'filter', 'flash', 'monopod', 'head', 'ball head', 'geared head',
    'memory card', 'battery', 'sensor', 'shutter', 'aperture', 'iso', 'white balance',
    'depth of field', 'focal length', 'exposure', 'metering', 'composition', 'sharpness', 'focus',
    'sharp', 'sharpness', 'focusing', 'blur', 'blurry', 'camera shake', 'stabilization', 'ibis', 'vr',
    'hdr', 'noise', 'handheld'
  ]);
  
  const genreKeywords = new Set([
    'landscape', 'portrait', 'travel', 'studio', 'macro', 'wildlife', 'street'
  ]);
  
  const queryEquipmentKeywords = new Set();
  const hasEquipmentKeyword = kw.some(k => {
    if (equipmentKeywords.has(k)) {
      queryEquipmentKeywords.add(k);
      return true;
    }
    return false;
  });
  
  // Check for multi-word equipment keywords in the full query
  const fullQuery = kw.join(' ');
  equipmentKeywords.forEach(eq => {
    if (eq.includes(' ') && fullQuery.includes(eq)) {
      queryEquipmentKeywords.add(eq);
      if (!hasEquipmentKeyword) {
        // This will be set to true below
      }
    }
  });
  
  const finalHasEquipmentKeyword = hasEquipmentKeyword || queryEquipmentKeywords.size > 0;
  
  if (finalHasEquipmentKeyword) {
    kw = kw.filter(k => !genreKeywords.has(k));
  }
  
  // Deduplicate
  const seen = new Set();
  const unique = [];
  for (const row of rows) {
    const key = (row.page_url || row.url || row.id || '').toString().replace(/\/+$/, '').trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      unique.push(row);
    }
  }
  
  const scored = unique
    .map(r => ({ r, s: scoreArticleRow(r, kw, finalHasEquipmentKeyword ? queryEquipmentKeywords : null) }))
    .sort((a,b) => b.s - a.s);
  
  // Equipment keyword filtering
  let filtered = scored;
  if (finalHasEquipmentKeyword && queryEquipmentKeywords.size > 0) {
    filtered = scored.filter(({ r }) => {
      const t = (r.title || r.raw?.name || "").toLowerCase();
      const u = (r.page_url || r.source_url || "").toLowerCase();
      return Array.from(queryEquipmentKeywords).some(eq => t.includes(eq) || u.includes(eq));
    });
    
    if (filtered.length === 0) {
      filtered = scored;
    }
  }
  
  return filtered.slice(0, limit).map(x => x.r);
}

// Test
const query = "what is depth of field";
const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length >= 3);

console.log(`\n🔍 Testing FULL query flow: "${query}"`);
console.log(`📝 Keywords: ${keywords.join(", ")}\n`);
console.log(`📊 Database returns ${dbResults.length} articles (ordered by publish_date DESC)\n`);

const final = processAndSortResults(dbResults, keywords, 12);

console.log("=".repeat(80));
console.log("FINAL RESULTS (after scoring and filtering)");
console.log("=".repeat(80));

final.forEach((article, index) => {
  console.log(`\n${index + 1}. ${article.title}`);
  console.log(`   ID: ${article.id}`);
  console.log(`   Publish Date: ${article.publish_date}`);
});

if (final[0]?.id === 256968) {
  console.log("\n✅ SUCCESS: Article 256968 is ranking #1");
} else {
  console.log("\n❌ PROBLEM: Article 256968 is NOT ranking #1");
  const dofIndex = final.findIndex(a => a.id === 256968);
  if (dofIndex >= 0) {
    console.log(`   Article 256968 is at position #${dofIndex + 1}`);
  } else {
    console.log("   Article 256968 was FILTERED OUT!");
  }
}


