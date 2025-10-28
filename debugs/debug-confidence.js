// Debug script to test the confidence calculation logic

const query = "When is the next Lightroom course in Coventry?";

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
    "alan", "ranger", "about", "who is", "where is", "contact"
  ];
  
  return specificKeywords.some(keyword => lc.includes(keyword));
}

function hasContentBasedConfidence(query, intent, content) {
  if (!query) return false;
  
  const lc = query.toLowerCase();
  
  // Extract content metrics
  const articleCount = content.articles?.length || 0;
  const eventCount = content.events?.length || 0;
  const productCount = content.products?.length || 0;
  const relevanceScore = content.relevanceScore || 0;
  const queryLength = query.length;
  
  // Calculate total content richness
  const totalContent = articleCount + eventCount + productCount;
  
  console.log(`Content metrics:`, {
    articleCount,
    eventCount,
    productCount,
    totalContent,
    relevanceScore,
    queryLength
  });
  
  // Special case: Events queries with specific location/time should be confident
  if (intent === "events" && hasSpecificKeywords(query) && (eventCount > 0 || totalContent > 0)) {
    console.log('✅ Events with specific keywords should be confident');
    return true; // Events with specific keywords should be confident
  }
  
  console.log('❌ Events confidence check failed');
  return false; // When in doubt, clarify
}

// Test with sample data
const sampleEvents = [
  {
    title: "Lightroom Classic Photo Editing Classes -Week 1 of 3 - 4-11",
    event_title: "Lightroom Classic Photo Editing Classes -Week 1 of 3 - 4-11",
    event_location: "Coventry",
    date_start: "2025-11-04T19:00:00Z"
  }
];

const contentForConfidence = { 
  events: sampleEvents, 
  products: [] 
};

console.log('Query:', query);
console.log('Has specific keywords:', hasSpecificKeywords(query));
console.log('Content for confidence:', contentForConfidence);

const hasConfidence = hasContentBasedConfidence(query, "events", contentForConfidence);
console.log('Has confidence:', hasConfidence);
