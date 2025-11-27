const fs = require('fs');

// Interactive testing questions (from interactive-testing.html)
const interactiveQuestions = [
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

// Regression test questions (from regression-comparison.html)
const regressionQuestions = [
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

// Normalize for comparison (lowercase, trim)
function normalize(q) {
  return q.toLowerCase().trim().replace(/[""]/g, '"');
}

const interactiveNormalized = interactiveQuestions.map(normalize);
const regressionNormalized = regressionQuestions.map(normalize);

console.log('='.repeat(80));
console.log('QUESTION SET COMPARISON');
console.log('='.repeat(80));

// Find questions in interactive but NOT in regression
console.log('\n📋 QUESTIONS IN INTERACTIVE TESTING BUT NOT IN REGRESSION TEST:');
const onlyInInteractive = interactiveQuestions.filter((q, idx) => {
  const normalized = normalize(q);
  return !regressionNormalized.includes(normalized);
});

onlyInInteractive.forEach((q, idx) => {
  console.log(`${idx + 1}. "${q}"`);
});

// Find questions in regression but NOT in interactive
console.log('\n\n📋 QUESTIONS IN REGRESSION TEST BUT NOT IN INTERACTIVE TESTING:');
const onlyInRegression = regressionQuestions.filter((q, idx) => {
  const normalized = normalize(q);
  return !interactiveNormalized.includes(normalized);
});

onlyInRegression.forEach((q, idx) => {
  console.log(`${idx + 1}. "${q}"`);
});

// Find questions in both (for reference)
console.log('\n\n📋 QUESTIONS IN BOTH (for reference):');
const inBoth = interactiveQuestions.filter((q) => {
  const normalized = normalize(q);
  return regressionNormalized.includes(normalized);
});

console.log(`Total: ${inBoth.length} questions appear in both sets\n`);
inBoth.forEach((q, idx) => {
  console.log(`${idx + 1}. "${q}"`);
});

console.log('\n' + '='.repeat(80));
console.log(`\nSUMMARY:`);
console.log(`  Interactive Testing: ${interactiveQuestions.length} questions`);
console.log(`  Regression Test: ${regressionQuestions.length} questions`);
console.log(`  Only in Interactive: ${onlyInInteractive.length} questions`);
console.log(`  Only in Regression: ${onlyInRegression.length} questions`);
console.log(`  In Both: ${inBoth.length} questions`);

