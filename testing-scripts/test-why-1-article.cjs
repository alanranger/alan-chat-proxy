#!/usr/bin/env node
/**
 * Test why only 1 article shows - simulate the full flow
 */

// Simulate what findArticles would return (multiple articles)
const articlesFromFindArticles = [
  {
    id: 265306,
    title: "Aperture and Depth of Field Photography Assignment",
    page_url: "https://www.alanranger.com/blog-on-photography/aperture-and-depth-of-field-assignment",
    publish_date: "2025-11-23",
    categories: []
  },
  {
    id: 256372,
    title: "02 What is APERTURE in photography: A Guide for Beginners",
    page_url: "https://www.alanranger.com/blog-on-photography/what-is-aperture-in-photography",
    publish_date: "2025-05-05",
    categories: ["photography-tips", "online photography course"]
  },
  {
    id: 256968,
    title: "09 What is DEPTH OF FIELD in Photography: A Beginners Guide",
    page_url: "https://www.alanranger.com/blog-on-photography/what-is-depth-of-field",
    publish_date: "2025-02-20",
    categories: ["photography-tips", "online photography course"]
  }
];

// Simulate filterArticlesForSharpness
function filterArticlesForSharpness(articles, sharpIntent) {
  if (!sharpIntent) return articles.slice(0, 12);
  
  const filtered = articles.filter(a => {
    const title = (a.title || "").toLowerCase();
    return title.includes('sharp') || title.includes('focus') || title.includes('blur');
  });
  
  if (filtered.length < 6 && articles.length > filtered.length) {
    return [...filtered, ...articles.filter(a => !filtered.includes(a))].slice(0, 12);
  }
  
  return filtered.slice(0, 12);
}

// Simulate generateArticleAnswer (only uses first article)
function generateArticleAnswer(articles, query) {
  if (!articles || articles.length === 0) return '';
  const bestArticle = articles[0];
  // ... would extract answer from bestArticle
  return "Answer extracted from article";
}

// Simulate enrichTechnicalAnswerWithArticles
function enrichTechnicalAnswerWithArticles(articles, normalizedQuery, technicalResponse, qlc) {
  if (!articles || articles.length === 0 || (!qlc.includes('what is') && !qlc.includes('what\'s'))) {
    return technicalResponse;
  }
  
  const hasSpecific = true; // Assume true for "what is" queries
  const technicalResponseLength = technicalResponse.length;
  
  if (hasSpecific && technicalResponseLength >= 100) {
    console.log(`[SKIP] Keeping hardcoded technical answer for specific concept query`);
    return technicalResponse;
  }
  
  const articleAnswer = generateArticleAnswer(articles, normalizedQuery);
  if (!articleAnswer || articleAnswer.trim().length <= technicalResponseLength ||
      articleAnswer.includes("Based on Alan Ranger's expertise, here's what you need to know")) {
    return technicalResponse;
  }
  
  if (hasSpecific) {
    // Assume article answer is relevant
    console.log(`[SUCCESS] Enriched technical answer with relevant article content`);
    return articleAnswer;
  }
  
  return articleAnswer;
}

// Simulate handleTechnicalQueries
function handleTechnicalQueries(articles) {
  const sharpIntent = false; // "what is aperture" doesn't have sharp intent
  const technicalResponse = "**Aperture** controls the size..."; // Hardcoded answer
  
  // Step 1: Filter articles
  let filteredArticles = filterArticlesForSharpness(articles, sharpIntent);
  console.log(`After filterArticlesForSharpness: ${filteredArticles.length} articles`);
  
  // Step 2: Enrich answer (this doesn't modify articles)
  const finalAnswer = enrichTechnicalAnswerWithArticles(filteredArticles, "what is aperture", technicalResponse, "what is aperture");
  
  // Step 3: Return response
  return {
    success: true,
    confidence: 0.8,
    answer: finalAnswer,
    type: "advice",
    sources: { articles: filteredArticles || [] },
    structured: {
      intent: "technical_answer",
      articles: filteredArticles || [],  // <-- This should have multiple articles
      events: [],
      products: [],
      services: []
    }
  };
}

// Test
console.log("=".repeat(80));
console.log("TESTING: Why only 1 article shows");
console.log("=".repeat(80));

console.log(`\nInput: ${articlesFromFindArticles.length} articles from findArticles()`);
const result = handleTechnicalQueries(articlesFromFindArticles);

console.log(`\nOutput:`);
console.log(`  structured.articles.length: ${result.structured.articles.length}`);
console.log(`  Articles:`);
result.structured.articles.forEach((a, i) => {
  console.log(`    ${i + 1}. ${a.title} (ID: ${a.id})`);
});

console.log(`\n${"=".repeat(80)}`);
console.log("ANALYSIS");
console.log("=".repeat(80));

if (result.structured.articles.length === 1) {
  console.log(`\n❌ PROBLEM: Only 1 article in result, but filterArticlesForSharpness should return up to 12`);
  console.log(`   This suggests articles are being filtered/modified AFTER handleTechnicalQueries returns`);
} else {
  console.log(`\n✅ Articles are preserved through handleTechnicalQueries`);
  console.log(`   Problem must be elsewhere in the response flow`);
}


