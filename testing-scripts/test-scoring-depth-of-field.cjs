#!/usr/bin/env node
/**
 * Test scoring logic for "what is depth of field" query
 * Simulates the scoring functions from chat.js to see why article 256968 isn't ranking
 */

// Simulate the scoring functions from chat.js
function addBaseKeywordScore(context) {
  for (const k of context.kw) {
    if (!k) continue;
    if (context.has(context.t, k)) context.add(3); // strong match in title
    if (context.has(context.u, k)) context.add(1); // weak match in URL
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
    context.add(25); // Major boost for online course content on technical topics
    
    // Extra boost for "What is..." format articles in online course
    for (const c of coreConcepts) {
      if (context.has(context.t, `what is ${c}`) || context.has(context.t, `${c} in photography`)) {
        context.add(15); // Additional boost for structured learning content
      }
    }
    
    // Boost for PDF checklists and guides
    if (context.has(context.t, "pdf") || context.has(context.t, "checklist") || context.has(context.t, "guide")) {
      context.add(10);
    }
  }
  
  return { hasCore, coreConcepts };
}

function applyConceptBoosts(context) {
  if (context.t.startsWith(`what is ${context.concept}`)) context.add(20); // ideal explainer
  if (context.has(context.t, `what is ${context.concept}`)) context.add(10);
  if (context.has(context.u, `/what-is-${context.slug}`)) context.add(12);
  if (context.has(context.u, `${context.slug}`)) context.add(3);
}

function addCoreConceptScore(context) {
  if (!context.hasCore) return;
  
  // Process core concept scoring
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
  
  // Apply penalties for generic content
  if (/(lightroom|what's new|whats new)/i.test(context.t) || /(lightroom|whats-new)/.test(context.u)) {
    context.add(-12);
  }
}

function addCategoryBoost(categories, hasCore, add) {
  if (categories.includes("photography-tips") && hasCore) {
    add(5); // Boost for photography tips on technical topics
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
    recencyBoost = 20; // Very new articles (within 7 days)
  } else if (daysSincePublication <= 30) {
    recencyBoost = 10; // Recent articles (within 30 days)
  } else if (daysSincePublication <= 90) {
    recencyBoost = 5; // Moderately recent (within 90 days)
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
  
  // If equipment keywords are present, check if article matches any of them
  let matchesEquipment = false;
  if (equipmentKeywords && equipmentKeywords.size > 0) {
    matchesEquipment = Array.from(equipmentKeywords).some(eq => has(t, eq) || has(u, eq));
    if (!matchesEquipment) {
      add(-50); // Significant penalty for articles that don't match equipment keywords
    }
  }
  
  addBaseKeywordScore({ kw, t, u, add, has });
  
  const shouldPreventOnlineCourseBoost = equipmentKeywords && equipmentKeywords.size > 0 && !matchesEquipment;
  const { hasCore, coreConcepts } = addOnlineCourseBoost({ categories, kw, t, add, has, preventBoost: shouldPreventOnlineCourseBoost });
  addCoreConceptScore({ hasCore, coreConcepts, t, u, add, has });
  addCategoryBoost(categories, hasCore, add);
  
  return addRecencyTieBreaker(s, r);
}

// Test articles
const testArticles = [
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
    id: 256372,
    title: "02 What is APERTURE in photography: A Guide for Beginners",
    page_url: "https://www.alanranger.com/blog-on-photography/what-is-aperture-in-photography",
    categories: ["photography-tips", "online photography course"],
    tags: ["camera settings for photography"],
    publish_date: "2025-05-05",
    last_seen: "2025-11-24T16:45:31.774+00:00",
    kind: "article",
    source_type: "blog"
  }
];

// Simulate the query processing
// First, keywords are filtered by filterArticleKeywords
// Then they're checked against equipment keywords
const query = "what is depth of field";
const allKeywords = query.toLowerCase().split(/\s+/).filter(k => k.length >= 3);
console.log(`\n🔍 Testing query: "${query}"`);
console.log(`📝 All keywords extracted: ${allKeywords.join(", ")}`);

// filterArticleKeywords filters to only allowed keywords
const allowedKeywords = new Set([
  'sharp','sharpness','focus','focusing','blur','blurry','camera','camera shake','tripod','shutter','shutter speed','stabilization','ibis','vr',
  'aperture','iso','exposure','metering','composition','white balance','depth of field','focal length','long exposure','hdr','noise','handheld',
  'landscape','portrait','travel','studio','macro','wildlife','street'
]);

// The filterArticleKeywords function would filter these
// But it also checks for multi-word phrases - let's simulate that
// "depth of field" is in the allow list, but when split it becomes ["depth", "field"]
// The actual code checks individual words against equipmentKeywords
const keywords = allKeywords.filter(k => allowedKeywords.has(k) || k.length >= 3);
console.log(`📝 Filtered keywords: ${keywords.join(", ")}\n`);

// Equipment keywords check - this is the ACTUAL logic from chat.js
const equipmentKeywords = new Set([
  'tripod', 'camera', 'lens', 'filter', 'flash', 'monopod', 'head', 'ball head', 'geared head',
  'memory card', 'battery', 'sensor', 'shutter', 'aperture', 'iso', 'white balance',
  'depth of field', 'focal length', 'exposure', 'metering', 'composition', 'sharpness', 'focus',
  'sharp', 'sharpness', 'focusing', 'blur', 'blurry', 'camera shake', 'stabilization', 'ibis', 'vr',
  'hdr', 'noise', 'handheld'
]);

// The code checks if ANY keyword matches equipmentKeywords
// But "depth of field" is a multi-word phrase, so individual words won't match
// However, the code also checks the full query string for phrases
const queryEquipmentKeywords = new Set();
let hasEquipmentKeyword = false;

// Check individual keywords
keywords.forEach(k => {
  if (equipmentKeywords.has(k)) {
    queryEquipmentKeywords.add(k);
    hasEquipmentKeyword = true;
  }
});

// Also check if the full query contains multi-word equipment keywords
const queryLower = query.toLowerCase();
equipmentKeywords.forEach(eq => {
  if (eq.includes(' ') && queryLower.includes(eq)) {
    queryEquipmentKeywords.add(eq);
    hasEquipmentKeyword = true;
  }
});

console.log(`🔧 Equipment keyword detected: ${hasEquipmentKeyword}`);
if (hasEquipmentKeyword) {
  console.log(`   Equipment keywords in query: ${Array.from(queryEquipmentKeywords).join(", ")}`);
}

// Score each article
console.log("\n" + "=".repeat(80));
console.log("SCORING RESULTS");
console.log("=".repeat(80));

const scored = testArticles.map(r => {
  const score = scoreArticleRow(r, keywords, hasEquipmentKeyword ? queryEquipmentKeywords : null);
  return { article: r, score };
}).sort((a, b) => b.score - a.score);

scored.forEach((item, index) => {
  const { article, score } = item;
  const baseScore = Math.floor(score / 1000);
  const recencyBoost = score % 1000;
  
  console.log(`\n${index + 1}. ${article.title}`);
  console.log(`   ID: ${article.id}`);
  console.log(`   URL: ${article.page_url}`);
  console.log(`   Publish Date: ${article.publish_date}`);
  console.log(`   Categories: ${article.categories.join(", ") || "none"}`);
  console.log(`   📊 Base Score: ${baseScore}`);
  console.log(`   ⏰ Recency Boost: +${recencyBoost}`);
  console.log(`   🎯 FINAL SCORE: ${score}`);
});

console.log("\n" + "=".repeat(80));
console.log("ANALYSIS");
console.log("=".repeat(80));

const winner = scored[0];
console.log(`\n🏆 Winner: ${winner.article.title} (Score: ${winner.score})`);

if (scored[0].article.id === 256968) {
  console.log("✅ Correct article is ranking #1");
} else {
  console.log("❌ Problem: Article 256968 should be ranking #1 but isn't");
  const dofArticle = scored.find(s => s.article.id === 256968);
  if (dofArticle) {
    const rank = scored.indexOf(dofArticle) + 1;
    console.log(`   Article 256968 is ranking at position #${rank}`);
    console.log(`   Score difference: ${winner.score - dofArticle.score} points`);
  } else {
    console.log("   Article 256968 not found in results!");
  }
}

