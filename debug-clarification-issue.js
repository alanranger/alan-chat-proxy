#!/usr/bin/env node

/**
 * Debug Clarification Issue
 * Test why "when is the next devon workshop" is triggering clarification
 */

// Mock the functions to debug
function detectIntent(query) {
  const lc = query.toLowerCase();
  
  // Events keywords
  const eventKeywords = ["workshop", "course", "class", "event", "training", "lesson"];
  if (eventKeywords.some(keyword => lc.includes(keyword))) {
    return "events";
  }
  
  // Advice keywords  
  const adviceKeywords = ["how", "what", "why", "advice", "help", "recommend", "best"];
  if (adviceKeywords.some(keyword => lc.includes(keyword))) {
    return "advice";
  }
  
  return "advice"; // default
}

function hasContentBasedConfidence(query, intent, content) {
  if (!query) return false;
  
  const lc = query.toLowerCase();
  
  // Detect clarification questions - these should never be confident
  if (lc.includes("what type of") && lc.includes("are you planning") && lc.includes("this will help")) {
    return false; // This is a clarification question, not a confident query
  }
  
  // Extract content metrics (handle different content types)
  const articleCount = content.articles?.length || 0;
  const eventCount = content.events?.length || 0;
  const productCount = content.products?.length || 0;
  const relevanceScore = content.relevanceScore || 0;
  const queryLength = query.length;
  
  // Calculate total content richness
  const totalContent = articleCount + eventCount + productCount;
  
  // Very short, vague queries = clarify (10% confidence)
  if (queryLength <= 10 && !hasSpecificKeywords(query)) {
    return false; // Too vague - needs clarification
  }
  
  // Very little content = clarify (10% confidence)
  if (totalContent <= 1 && relevanceScore < 0.3) {
    return false; // Too little content - needs clarification
  }
  
  // Rich, relevant content = confident (90% confidence)
  if (totalContent >= 3 && relevanceScore > 0.6) {
    return true; // Good content - be confident
  }
  
  // Medium content with specific keywords = confident
  if (totalContent >= 2 && relevanceScore > 0.5 && hasSpecificKeywords(query)) {
    return true; // Decent content with specific keywords - be confident
  }
  
  // Special case: Events queries with specific location/time should be confident
  if (intent === "events" && hasSpecificKeywords(query) && (eventCount > 0 || totalContent > 0)) {
    return true; // Events with specific keywords should be confident
  }
  
  // Default to clarification for safety
  return false; // When in doubt, clarify
}

function hasSpecificKeywords(query) {
  const lc = query.toLowerCase();
  const specificKeywords = [
    // Equipment
    "camera", "lens", "tripod", "filter", "bag", "memory card",
    // Courses/Workshops
    "beginner", "advanced", "rps", "lightroom", "online", "private", "course", "workshop",
    // Services
    "mentoring", "feedback", "critique", "lessons", "training", "service",
    // Technical
    "iso", "aperture", "shutter", "exposure", "composition", "lighting", "white balance",
    "depth of field", "framing", "macro", "portrait", "landscape", "street",
    // About
    "alan", "ranger", "about", "who is", "where is", "contact",
    // Location and time
    "devon", "when", "next", "date", "time", "location"
  ];
  
  return specificKeywords.some(keyword => lc.includes(keyword));
}

function generateClarificationQuestion(query) {
  const lc = query.toLowerCase();
  
  // Service-related queries (feedback, mentoring, private lessons, etc.)
  if (lc.includes("feedback") || lc.includes("personalised") || lc.includes("mentoring") || 
      lc.includes("private") || lc.includes("lessons") || lc.includes("services")) {
    console.log(`✅ Found service-related pattern - returning clarification question`);
    return {
      type: "service_clarification",
      question: "I'd be happy to help with photography services! What type of service are you looking for?",
      options: [
        { text: "Private photography lessons", query: "private photography lessons" },
        { text: "Photography mentoring", query: "photography mentoring" },
        { text: "RPS mentoring course", query: "RPS mentoring course" },
        { text: "Image feedback and critique", query: "photography image feedback" },
        { text: "General photography services", query: "photography services" }
      ],
      confidence: 10
    };
  }
  
  // Equipment queries
  if (lc.includes("equipment")) {
    return {
      type: "equipment_clarification",
      question: "I'd be happy to help with equipment recommendations! Could you be more specific about what type of photography you're interested in?",
      options: [
        { text: "Equipment for photography courses/workshops", query: "equipment for photography course" },
        { text: "General photography equipment advice", query: "photography equipment advice" },
        { text: "Specific camera/lens recommendations", query: "camera lens recommendations" }
      ],
      confidence: 10
    };
  }
  
  // Generic fallback
  console.log(`❌ No specific pattern matched for: "${query}" - using generic clarification`);
  return {
    type: "generic_clarification",
    question: "I'd be happy to help! Could you be more specific about what you're looking for?",
    options: [
      { text: "Photography equipment advice", query: "photography equipment advice" },
      { text: "Photography courses and workshops", query: "photography courses" },
      { text: "Photography services and mentoring", query: "photography services" },
      { text: "General photography advice", query: "photography advice" },
      { text: "About Alan Ranger", query: "about alan ranger" }
    ],
    confidence: 10
  };
}

// Test the problematic query
const testQuery = "when is the next devon workshop";

console.log("🔍 Debugging Clarification Issue\n");
console.log(`Query: "${testQuery}"`);

// Step 1: Intent detection
const intent = detectIntent(testQuery);
console.log(`Intent: ${intent}`);

// Step 2: Check if it has specific keywords
const hasKeywords = hasSpecificKeywords(testQuery);
console.log(`Has specific keywords: ${hasKeywords}`);

// Step 3: Mock content (simulating what RAG would return for events)
const mockContent = { 
  events: [1,2,3,4,5], // Rich events content for workshop query
  products: [1,2],     // Some products
  relevanceScore: 0.9  // High relevance
};

// Step 4: Check content-based confidence
const hasConfidence = hasContentBasedConfidence(testQuery, intent, mockContent);
console.log(`Content-based confidence: ${hasConfidence}`);
console.log(`Content: ${mockContent.events.length} events, ${mockContent.products.length} products, ${mockContent.relevanceScore} relevance`);

// Step 5: Check what clarification would be generated
const clarification = generateClarificationQuestion(testQuery);
console.log(`Clarification type: ${clarification.type}`);

console.log("\n📊 Analysis:");
console.log(`✅ Intent: ${intent} (correct - should be events)`);
console.log(`✅ Keywords: ${hasKeywords} (correct - has "devon", "workshop", "when")`);
console.log(`✅ Content: Rich (5 events, 2 products, 0.9 relevance)`);
console.log(`❌ Confidence: ${hasConfidence} (WRONG - should be true!)`);
console.log(`❌ Clarification: ${clarification.type} (WRONG - should not trigger!)`);

if (!hasConfidence) {
  console.log("\n🚨 PROBLEM FOUND:");
  console.log("The content-based confidence logic is too strict!");
  console.log("A specific query like 'when is the next devon workshop' should be confident.");
  console.log("The issue is likely in the confidence thresholds.");
} else {
  console.log("\n✅ Logic appears correct - issue must be elsewhere.");
}
