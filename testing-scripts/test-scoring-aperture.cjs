#!/usr/bin/env node
/**
 * Test scoring for "what is aperture" query
 * Compare article 256372 vs assignment article 265306
 */

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

// Test articles
const testArticles = [
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
  }
];

const query = "what is aperture";
const keywords = ["aperture"]; // filterArticleKeywords would return this
const equipmentKeywords = new Set(["aperture"]); // Equipment keyword detected

console.log(`\n🔍 Testing query: "${query}"`);
console.log(`📝 Keywords: ${keywords.join(", ")}`);
console.log(`🔧 Equipment keywords: ${Array.from(equipmentKeywords).join(", ")}\n`);

const scored = testArticles.map(r => {
  const score = scoreArticleRow(r, keywords, equipmentKeywords);
  return { article: r, score };
}).sort((a, b) => b.score - a.score);

console.log("=".repeat(80));
console.log("SCORING RESULTS");
console.log("=".repeat(80));

scored.forEach((item, index) => {
  const { article, score } = item;
  const baseScore = Math.floor(score / 1000);
  const recencyBoost = score % 1000;
  
  console.log(`\n${index + 1}. ${article.title}`);
  console.log(`   ID: ${article.id}`);
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

if (scored[0].article.id === 256372) {
  console.log("✅ Correct article is ranking #1");
} else {
  console.log("❌ Problem: Article 256372 should be ranking #1 but isn't");
  const apertureArticle = scored.find(s => s.article.id === 256372);
  if (apertureArticle) {
    const rank = scored.indexOf(apertureArticle) + 1;
    console.log(`   Article 256372 is ranking at position #${rank}`);
    console.log(`   Score difference: ${winner.score - apertureArticle.score} points`);
    console.log(`   Reason: Assignment article's recency boost (+${winner.score % 1000}) overcomes proper article's advantages`);
  }
}


