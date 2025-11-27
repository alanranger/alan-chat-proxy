const fs = require('fs');
const path = require('path');

// Load canonical 64Q list
const canonicalData = JSON.parse(fs.readFileSync('testing-scripts/canonical-64q-questions.json', 'utf8'));
const canonicalQuestions = canonicalData.questions.map(q => q.question);

// Old Interactive Testing questions (from interactive-testing.html)
const oldInteractiveQuestions = [
  "whens the next bluebell workshops and whats the cost",
  "when is the next devon workshop",
  "what is your next workshop date and where is it",
  "when are your next Autumn workshops and where are they?",
  "How long are your workshops?",
  "How much is a residential photography course and does it include B&B",
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

// Old Regression Test questions (from regression-comparison.html)
const oldRegressionQuestions = [
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
  "How long are your workshops?",
  "How much is a residential photography course and does it include B&B",
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
  "what is your next workshop date and where is it",
  "what memory card should I buy",
  "what settings should I use for landscape photography",
  "what tripod should I buy",
  "when are your next Autumn workshops and where are they?",
  "when is the next devon workshop",
  "whens the next bluebell workshops and whats the cost"
];

// Normalize function for matching
function normalize(q) {
  return q.toLowerCase()
    .replace(/[""]/g, '"')
    .replace(/[?.,!]/g, '')
    .trim();
}

// Create mapping
const mapping = {
  version: "1.0",
  created: new Date().toISOString(),
  description: "Maps old Interactive Testing and Regression Test questions to canonical 64Q questions",
  interactive_to_canonical: {},
  regression_to_canonical: {}
};

// Map Interactive questions
oldInteractiveQuestions.forEach(oldQ => {
  // Try exact match first
  const exactMatch = canonicalQuestions.find(cq => cq === oldQ);
  if (exactMatch) {
    mapping.interactive_to_canonical[oldQ] = exactMatch;
    return;
  }
  
  // Try normalized match
  const normalizedOld = normalize(oldQ);
  const normalizedMatch = canonicalQuestions.find(cq => normalize(cq) === normalizedOld);
  if (normalizedMatch) {
    mapping.interactive_to_canonical[oldQ] = normalizedMatch;
    return;
  }
  
  // Manual mappings for same questions with different wording
  const manualMappings = {
    "What tripod do you recommend": "What tripod do you recommend", // Same
    "What is long exposure and how can I find out more about it": "What is long exposure and how can I find out more about it", // Same
    "How do I improve my composition and storytelling in photos?": "How do I improve my composition and storytelling in photos?", // Same
    "\"What is the exposure triangle (aperture, shutter, ISO)?\"": "\"What is the exposure triangle (aperture, shutter, ISO)?\"", // Same
    "How do I improve my photography skills?": "How do I improve my photography skills?", // Same
    "What is your cancellation or refund policy for courses/workshops?": "What is your cancellation or refund policy for courses/workshops?" // Same
  };
  
  if (manualMappings[oldQ]) {
    mapping.interactive_to_canonical[oldQ] = manualMappings[oldQ];
  } else {
    // No match found - this question is unique to interactive
    mapping.interactive_to_canonical[oldQ] = oldQ; // Maps to itself (unique question)
  }
});

// Map Regression questions
oldRegressionQuestions.forEach(oldQ => {
  // Try exact match first
  const exactMatch = canonicalQuestions.find(cq => cq === oldQ);
  if (exactMatch) {
    mapping.regression_to_canonical[oldQ] = exactMatch;
    return;
  }
  
  // Try normalized match
  const normalizedOld = normalize(oldQ);
  const normalizedMatch = canonicalQuestions.find(cq => normalize(cq) === normalizedOld);
  if (normalizedMatch) {
    mapping.regression_to_canonical[oldQ] = normalizedMatch;
    return;
  }
  
  // Manual mappings for same questions with different wording
  const manualMappings = {
    "do you offer gift vouchers": "Do you offer gift vouchers?",
    "what is HDR photography": "What is HDR photography?",
    "what tripod should I buy": "What tripod do you recommend",
    "what is long exposure photography": "What is long exposure and how can I find out more about it",
    "what is composition in photography": "How do I improve my composition and storytelling in photos?",
    "what is aperture": "\"What is the exposure triangle (aperture, shutter, ISO)?\"",
    "how do I improve my photography": "How do I improve my photography skills?",
    "what is your cancellation policy": "What is your cancellation or refund policy for courses/workshops?",
    "what is the difference between prime and zoom lenses": "What is the difference between prime and zoom lenses?",
    "what memory card should I buy": "What memory card should I buy?"
  };
  
  if (manualMappings[oldQ]) {
    mapping.regression_to_canonical[oldQ] = manualMappings[oldQ];
  } else {
    // No match found - this question is unique to regression
    mapping.regression_to_canonical[oldQ] = oldQ; // Maps to itself (unique question)
  }
});

// Save mapping file
const mappingPath = path.join(__dirname, 'question-mapping.json');
fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));

console.log(`✅ Created question mapping file: ${mappingPath}`);
console.log(`   Interactive mappings: ${Object.keys(mapping.interactive_to_canonical).length}`);
console.log(`   Regression mappings: ${Object.keys(mapping.regression_to_canonical).length}`);

