// Test keyword extraction
function extractKeywords(query) {
  const lc = (query || "").toLowerCase();
  
  // Remove common question words and stop words
  const stopWords = ["what", "when", "where", "which", "how", "why", "who", "can", "will", "should", "could", "would", "do", "does", "did", "are", "is", "was", "were", "have", "has", "had", "you", "your", "yours", "me", "my", "mine", "we", "our", "ours", "they", "their", "theirs", "them", "us", "him", "her", "his", "hers", "it", "its"];
  
  // Split into words and filter
  const words = lc.split(/\s+/).filter(w => w.length >= 2);
  
  // Filter out stop words
  const filteredWords = words.filter(w => !stopWords.includes(w));
  
  // Technical terms that should always be included
  const technicalTerms = ["iso", "aperture", "shutter", "exposure", "focus", "composition", "lighting", "settings", "technique", "tips", "advice", "tripod", "camera", "lens", "filter", "flash", "macro", "landscape", "portrait", "street", "wildlife", "raw", "jpeg", "hdr", "focal", "length", "exposure", "white", "balance", "depth", "field", "metering"];
  
  // Combine and deduplicate
  const allKeywords = [...filteredWords, ...technicalTerms.filter(term => lc.includes(term))];
  const uniqueKeywords = [...new Set(allKeywords)];
  
  // Filter by length and relevance
  const finalKeywords = uniqueKeywords.filter((w) => w.length >= 3 && (technicalTerms.includes(w) || w.length >= 4) && !stopWords.includes(w));
  
  console.log(`Query: "${query}"`);
  console.log(`Words: ${words.join(', ')}`);
  console.log(`Filtered: ${filteredWords.join(', ')}`);
  console.log(`Technical terms found: ${technicalTerms.filter(term => lc.includes(term)).join(', ')}`);
  console.log(`Final keywords: ${finalKeywords.join(', ')}`);
  
  return finalKeywords;
}

// Test the queries
const testQueries = [
  'what is iso',
  'what is shutter speed',
  'peter orton'
];

testQueries.forEach(query => {
  console.log('\n=== Testing:', query, '===');
  const keywords = extractKeywords(query);
  console.log('Result:', keywords);
});
