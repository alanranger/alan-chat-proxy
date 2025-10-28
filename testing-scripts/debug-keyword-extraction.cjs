const http = require('http');

// Debug the keyword extraction and search logic
async function debugKeywordExtraction() {
  console.log('🔍 DEBUGGING KEYWORD EXTRACTION AND SEARCH LOGIC');
  console.log('================================================================================');
  
  const testQuery = 'what is raw format';
  console.log(`Testing query: "${testQuery}"`);
  
  try {
    const response = await makeRequest(testQuery);
    const data = JSON.parse(response);
    
    console.log('\n📊 KEYWORD ANALYSIS:');
    console.log(`Query: "${testQuery}"`);
    
    // Simulate the keyword extraction logic
    const keywords = extractKeywords(testQuery);
    console.log(`Extracted keywords: [${keywords.join(', ')}]`);
    
    const lcQuery = testQuery.toLowerCase();
    const isConceptQuery = lcQuery.includes('what is');
    console.log(`Is concept query: ${isConceptQuery}`);
    
    // Extract primary keyword
    const allKws = keywords.map(k => k.toLowerCase());
    const stop = new Set(["what","when","where","how","which","the","a","an","your","you","next","is","are","do","i","me","my","course","workshop","lesson"]);
    const primaryKeyword = (allKws.find(k => k.length >= 5 && !stop.has(k)) || allKws.find(k => !stop.has(k)) || "").toLowerCase();
    
    console.log(`Primary keyword: "${primaryKeyword}"`);
    
    console.log('\n🔍 SEARCH PATTERNS:');
    console.log(`Specific guide search: %what-is-${primaryKeyword}%`);
    console.log(`Broader guide search: %what-is-% + %${primaryKeyword}%`);
    
    console.log('\n📋 DEBUG LOGS FROM RESPONSE:');
    if (data.debugInfo?.debugLogs) {
      data.debugInfo.debugLogs.forEach((log, i) => {
        console.log(`${i + 1}. ${log}`);
      });
    }
    
    console.log('\n🚨 ANALYSIS:');
    console.log(`The system is looking for articles with URL pattern: %what-is-${primaryKeyword}%`);
    console.log(`If not found, it searches for ANY "what is" article containing "${primaryKeyword}"`);
    console.log(`This explains why it returns irrelevant content!`);
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

// Simplified keyword extraction (from the actual code)
function extractKeywords(q) {
  let lc = (q || "").toLowerCase();
  
  // Apply synonym expansion
  lc = lc.replace(/\bdslr\b/g, 'dslr camera');
  lc = lc.replace(/\bmirrorless\b/g, 'mirrorless camera');
  
  const kws = new Set();
  
  // Add topic keywords
  const TOPIC_KEYWORDS = [
    "raw", "format", "jpeg", "iso", "aperture", "shutter", "exposure", 
    "metering", "manual", "depth of field", "focal length", "white balance",
    "tripod", "filters", "lens", "camera", "equipment"
  ];
  
  TOPIC_KEYWORDS.forEach(keyword => {
    if (lc.includes(keyword)) {
      kws.add(keyword);
    }
  });
  
  // Add technical and meaningful words
  const words = lc.split(/\s+/);
  words.forEach(word => {
    if (word.length >= 3 && !['the', 'and', 'for', 'with', 'from'].includes(word)) {
      kws.add(word);
    }
  });
  
  return Array.from(kws);
}

function makeRequest(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query });
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Run the debug
debugKeywordExtraction().catch(console.error);
