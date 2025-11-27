// Create canonical 64Q list by:
// 1. Taking the 6 exact matches (pick best wording)
// 2. Taking the 10 same questions (pick best wording from each pair)
// 3. Taking all 24 unique from Interactive
// 4. Taking all 24 unique from Regression

const canonicalQuestions = [
  // Exact matches (6) - use best wording
  "whens the next bluebell workshops and whats the cost",
  "when is the next devon workshop",
  "what is your next workshop date and where is it",
  "when are your next Autumn workshops and where are they?",
  "How long are your workshops?",
  "How much is a residential photography course and does it include B&B",
  
  // Same question, different wording (10) - pick best wording
  "What is the difference between prime and zoom lenses?", // Interactive version (has ?)
  "What memory card should I buy?", // Interactive version (has ?)
  "Do you offer gift vouchers?", // Interactive version (has ?)
  "What is HDR photography?", // Interactive version (has ?)
  "What tripod do you recommend", // Interactive version (more natural)
  "What is long exposure and how can I find out more about it", // Interactive version (more complete)
  "How do I improve my composition and storytelling in photos?", // Interactive version (more specific)
  "\"What is the exposure triangle (aperture, shutter, ISO)?\"", // Interactive version (more complete)
  "How do I improve my photography skills?", // Interactive version (more specific)
  "What is your cancellation or refund policy for courses/workshops?", // Interactive version (more complete)
  
  // Truly unique in Interactive (24)
  "Do you do astrophotography workshops",
  "Can my 14yr old attend your workshop",
  "My pictures never seem sharp.  Can you advise on what I am doing wrong",
  "What types of photography services do you offer?",
  "What sort of camera do I need for your camera course",
  "What gear or equipment do I need to bring to a workshop?",
  "Do you I get a certificate with the photography course",
  "Do I need a laptop for the lightroom course",
  "Is the online photography course really free",
  "What courses do you offer for complete beginners?",
  "How many weeks is the beginners' photography course?",
  "How do I get personalised feedback on my images",
  "How can I contact you or book a discovery call?",
  "Where is your gallery and can I submit my images for feedback?",
  "\"What is depth of field, and how do I control it?\"",
  "What is white balance and how do I use it?",
  "Who is Alan Ranger and what is his photographic background?",
  "Where is Alan Ranger based?",
  "Can I hire you as a professional photographer in Coventry?",
  "peter orton",
  "who is alan ranger",
  "How do I subscribe to the free online photography course?",
  "How do I use flash photography?",
  "How do I edit RAW files?",
  
  // Truly unique in Regression (24)
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
  "what is ISO",
  "what is long exposure photography",
  "what is macro photography",
  "what is portrait photography",
  "what is shutter speed",
  "what is the best camera for beginners",
  "what is the best lens for landscape photography",
  "what is the best time of day for landscape photography",
  "what is the rule of thirds",
  "what is your cancellation policy",
  "what settings should I use for landscape photography",
  "what tripod should I buy"
];

// Create mapping from old questions to canonical questions
const questionMapping = {
  // Interactive questions -> Canonical
  "whens the next bluebell workshops and whats the cost": "whens the next bluebell workshops and whats the cost",
  "when is the next devon workshop": "when is the next devon workshop",
  "what is your next workshop date and where is it": "what is your next workshop date and where is it",
  "when are your next Autumn workshops and where are they?": "when are your next Autumn workshops and where are they?",
  "How long are your workshops?": "How long are your workshops?",
  "How much is a residential photography course and does it include B&B": "How much is a residential photography course and does it include B&B",
  "What is the difference between prime and zoom lenses?": "What is the difference between prime and zoom lenses?",
  "What memory card should I buy?": "What memory card should I buy?",
  "Do you offer gift vouchers?": "Do you offer gift vouchers?",
  "What is HDR photography?": "What is HDR photography?",
  "What tripod do you recommend": "What tripod do you recommend",
  "What is long exposure and how can I find out more about it": "What is long exposure and how can I find out more about it",
  "How do I improve my composition and storytelling in photos?": "How do I improve my composition and storytelling in photos?",
  "\"What is the exposure triangle (aperture, shutter, ISO)?\"": "\"What is the exposure triangle (aperture, shutter, ISO)?\"",
  "How do I improve my photography skills?": "How do I improve my photography skills?",
  "What is your cancellation or refund policy for courses/workshops?": "What is your cancellation or refund policy for courses/workshops?",
  // ... (all interactive questions map to themselves or canonical version)
};

// Regression questions -> Canonical
const regressionMapping = {
  "whens the next bluebell workshops and whats the cost": "whens the next bluebell workshops and whats the cost",
  "when is the next devon workshop": "when is the next devon workshop",
  "what is your next workshop date and where is it": "what is your next workshop date and where is it",
  "when are your next Autumn workshops and where are they?": "when are your next Autumn workshops and where are they?",
  "How long are your workshops?": "How long are your workshops?",
  "How much is a residential photography course and does it include B&B": "How much is a residential photography course and does it include B&B",
  "what is the difference between prime and zoom lenses": "What is the difference between prime and zoom lenses?",
  "what memory card should I buy": "What memory card should I buy?",
  "do you offer gift vouchers": "Do you offer gift vouchers?",
  "what is HDR photography": "What is HDR photography?",
  "what tripod should I buy": "What tripod do you recommend",
  "what is long exposure photography": "What is long exposure and how can I find out more about it",
  "what is composition in photography": "How do I improve my composition and storytelling in photos?",
  "what is aperture": "\"What is the exposure triangle (aperture, shutter, ISO)?\"",
  "how do I improve my photography": "How do I improve my photography skills?",
  "what is your cancellation policy": "What is your cancellation or refund policy for courses/workshops?",
  // ... (all regression questions map to canonical version)
};

console.log(`Canonical 64Q list created: ${canonicalQuestions.length} questions`);
console.log(`\nFirst 10 questions:`);
canonicalQuestions.slice(0, 10).forEach((q, i) => console.log(`${i + 1}. "${q}"`));

// Export for use in other scripts
module.exports = {
  canonicalQuestions,
  questionMapping,
  regressionMapping
};

