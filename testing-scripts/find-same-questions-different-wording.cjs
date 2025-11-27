// Questions from Interactive Testing (only in interactive)
const interactiveOnly = [
  "Do you do astrophotography workshops",
  "Can my 14yr old attend your workshop",
  "My pictures never seem sharp.  Can you advise on what I am doing wrong",
  "What types of photography services do you offer?",
  "What tripod do you recommend",
  "What sort of camera do I need for your camera course",
  "What gear or equipment do I need to bring to a workshop?",
  "What is the difference between prime and zoom lenses?",
  "What memory card should I buy?",
  "Do you I get a certificate with the photography course",
  "Do I need a laptop for the lightroom course",
  "Is the online photography course really free",
  "What courses do you offer for complete beginners?",
  "How many weeks is the beginners' photography course?",
  "How do I get personalised feedback on my images",
  "How can I contact you or book a discovery call?",
  "Do you offer gift vouchers?",
  "What is your cancellation or refund policy for courses/workshops?",
  "Where is your gallery and can I submit my images for feedback?",
  "What is long exposure and how can I find out more about it",
  "\"What is the exposure triangle (aperture, shutter, ISO)?\"",
  "\"What is depth of field, and how do I control it?\"",
  "What is white balance and how do I use it?",
  "What is HDR photography?",
  "Who is Alan Ranger and what is his photographic background?",
  "Where is Alan Ranger based?",
  "Can I hire you as a professional photographer in Coventry?",
  "peter orton",
  "who is alan ranger",
  "How do I subscribe to the free online photography course?",
  "How do I improve my composition and storytelling in photos?",
  "How do I use flash photography?",
  "How do I edit RAW files?",
  "How do I improve my photography skills?"
];

// Questions from Regression Test (only in regression)
const regressionOnly = [
  "do you offer gift vouchers",
  "how do I focus in landscape photography",
  "how do I improve my photography",
  "how do I photograph autumn colours",
  "how do I photograph bluebells",
  "how do I photograph flowers",
  "how do I photograph people",
  "how do I photograph seascapes",
  "how do I photograph sunsets",
  "how do I photograph waterfalls",
  "how do I photograph wildlife",
  "how do I take better landscape photos",
  "how do I use a tripod",
  "what camera should I buy",
  "what is a histogram",
  "what is aperture",
  "what is composition in photography",
  "what is depth of field",
  "what is golden hour",
  "what is HDR photography",
  "what is ISO",
  "what is long exposure photography",
  "what is macro photography",
  "what is portrait photography",
  "what is shutter speed",
  "what is the best camera for beginners",
  "what is the best lens for landscape photography",
  "what is the best time of day for landscape photography",
  "what is the difference between prime and zoom lenses",
  "what is the rule of thirds",
  "what is your cancellation policy",
  "what memory card should I buy",
  "what settings should I use for landscape photography",
  "what tripod should I buy"
];

function normalize(q) {
  return q.toLowerCase()
    .replace(/[""]/g, '"')
    .replace(/[?.,!]/g, '')
    .trim();
}

function extractKeywords(q) {
  const normalized = normalize(q);
  // Remove common words
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'do', 'does', 'can', 'should', 'what', 'how', 'where', 'when', 'who', 'your', 'you', 'i', 'my', 'me'];
  const words = normalized.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
  return new Set(words);
}

function calculateSimilarity(q1, q2) {
  const keywords1 = extractKeywords(q1);
  const keywords2 = extractKeywords(q2);
  
  const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
  const union = new Set([...keywords1, ...keywords2]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

function findMatches() {
  const matches = [];
  const usedRegression = new Set();
  
  console.log('='.repeat(80));
  console.log('FINDING SAME QUESTIONS WITH DIFFERENT WORDING');
  console.log('='.repeat(80));
  console.log('\n');
  
  // First pass: exact or near-exact matches
  for (const iq of interactiveOnly) {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const rq of regressionOnly) {
      if (usedRegression.has(rq)) continue; // Don't match same regression question twice
      
      const similarity = calculateSimilarity(iq, rq);
      if (similarity > bestScore && similarity > 0.4) { // Higher threshold
        bestScore = similarity;
        bestMatch = rq;
      }
    }
    
    if (bestMatch && bestScore > 0.4) {
      matches.push({
        interactive: iq,
        regression: bestMatch,
        similarity: bestScore,
        confidence: bestScore > 0.7 ? 'HIGH' : bestScore > 0.5 ? 'MEDIUM' : 'LOW'
      });
      usedRegression.add(bestMatch);
    }
  }
  
  // Manual checks for obvious matches the algorithm might miss
  const manualChecks = [
    { i: "What tripod do you recommend", r: "what tripod should I buy", reason: "recommend vs should buy" },
    { i: "What is long exposure and how can I find out more about it", r: "what is long exposure photography", reason: "long exposure question" },
    { i: "\"What is the exposure triangle (aperture, shutter, ISO)?\"", r: "what is aperture", reason: "exposure triangle includes aperture" },
    { i: "How do I improve my composition and storytelling in photos?", r: "what is composition in photography", reason: "composition related" }
  ];
  
  for (const check of manualChecks) {
    const iExists = interactiveOnly.includes(check.i);
    const rExists = regressionOnly.includes(check.r) && !usedRegression.has(check.r);
    
    if (iExists && rExists) {
      const similarity = calculateSimilarity(check.i, check.r);
      matches.push({
        interactive: check.i,
        regression: check.r,
        similarity: similarity,
        confidence: 'MANUAL',
        reason: check.reason
      });
      usedRegression.add(check.r);
    }
  }
  
  // Sort by similarity
  matches.sort((a, b) => b.similarity - a.similarity);
  
  // Separate by confidence
  const highConf = matches.filter(m => m.confidence === 'HIGH' || m.confidence === 'MANUAL');
  const medConf = matches.filter(m => m.confidence === 'MEDIUM');
  const lowConf = matches.filter(m => m.confidence === 'LOW');
  
  console.log(`Found ${matches.length} likely matches (same question, different wording):\n`);
  
  if (highConf.length > 0) {
    console.log(`\n✅ HIGH CONFIDENCE (${highConf.length}):\n`);
    highConf.forEach((match, idx) => {
      console.log(`${idx + 1}. Similarity: ${(match.similarity * 100).toFixed(0)}% ${match.reason ? `(${match.reason})` : ''}`);
      console.log(`   Interactive: "${match.interactive}"`);
      console.log(`   Regression:  "${match.regression}"`);
      console.log('');
    });
  }
  
  if (medConf.length > 0) {
    console.log(`\n⚠️  MEDIUM CONFIDENCE (${medConf.length}):\n`);
    medConf.forEach((match, idx) => {
      console.log(`${idx + 1}. Similarity: ${(match.similarity * 100).toFixed(0)}%`);
      console.log(`   Interactive: "${match.interactive}"`);
      console.log(`   Regression:  "${match.regression}"`);
      console.log('');
    });
  }
  
  if (lowConf.length > 0) {
    console.log(`\n❓ LOW CONFIDENCE (${lowConf.length}):\n`);
    lowConf.forEach((match, idx) => {
      console.log(`${idx + 1}. Similarity: ${(match.similarity * 100).toFixed(0)}%`);
      console.log(`   Interactive: "${match.interactive}"`);
      console.log(`   Regression:  "${match.regression}"`);
      console.log('');
    });
  }
  
  console.log('='.repeat(80));
  console.log(`\nSUMMARY:`);
  console.log(`  Total unique in Interactive: ${interactiveOnly.length}`);
  console.log(`  Total unique in Regression: ${regressionOnly.length}`);
  console.log(`  High confidence matches: ${highConf.length}`);
  console.log(`  Medium confidence matches: ${medConf.length}`);
  console.log(`  Low confidence matches: ${lowConf.length}`);
  console.log(`  Total likely same questions: ${matches.length}`);
  console.log(`  Truly unique in Interactive: ${interactiveOnly.length - matches.length}`);
  console.log(`  Truly unique in Regression: ${regressionOnly.length - matches.length}`);
  console.log(`  Total truly unique questions: ${interactiveOnly.length + regressionOnly.length - matches.length}`);
  
  return matches;
}

findMatches();

