const fs = require('fs');
const path = require('path');

// Load the 356 questions from CSV
const csvFile = 'CSVSs from website/photography_questions_cleaned_ALL.csv';
const csvContent = fs.readFileSync(csvFile, 'utf8');
const csvQuestions = csvContent.trim().split('\n').map(line => line.trim()).filter(line => line.length > 0);

// Load the 50 questions from baseline-comparison-test.js
const baselineQuestions = [
  // WHAT questions (10)
  "what is exposure",
  "what is exposure triangle", 
  "what is iso",
  "what is aperture",
  "what is shutter speed",
  "what is depth of field",
  "what is white balance",
  "what is raw format",
  "what is histogram",
  "what is composition",
  
  // WHY questions (10)
  "why are my photos blurry",
  "why do I need a good camera",
  "why is composition important",
  "why do you teach photography",
  "why should I take your course",
  "why is lighting important",
  "why do photos look different on camera vs computer",
  "why is post-processing necessary",
  "why do you recommend certain cameras",
  "why is practice important in photography",
  
  // WHEN questions (10)
  "when is the best time to take photos",
  "when should I use a tripod",
  "when do you run photography courses",
  "when is golden hour",
  "when should I use flash",
  "when is the best time for landscape photography",
  "when do you have workshops",
  "when should I use manual mode",
  "when is blue hour",
  "when should I use a polarizing filter",
  
  // HOW questions (10)
  "how do I take sharp photos",
  "how do I improve my photography",
  "how do I choose the right camera",
  "how do I understand camera settings",
  "how do I learn photography",
  "how do I take better portraits",
  "how do I photograph landscapes",
  "how do I use lighting effectively",
  "how do I edit photos",
  "how do I develop my photography skills",
  
  // DO I questions (10)
  "do I need a DSLR camera",
  "do I need to understand technical settings",
  "do I need expensive equipment",
  "do I need to know about lighting",
  "do I need to edit my photos",
  "do I need to understand composition",
  "do I need to practice regularly",
  "do I need to understand the exposure triangle",
  "do I need to know about different lenses",
  "do I need to understand camera settings"
];

// Load the 28 questions from interactive testing
const interactiveQuestions = [
  "what is exposure triangle",
  "what is iso", 
  "what is aperture",
  "what is shutter speed",
  "peter orton",
  "who is alan ranger",
  "when is your next devon workshop",
  "when is your next photography course",
  "when are your next bluebell workshops",
  "do you have autumn workshops",
  "how to take sharp photos",
  "what is long exposure photography",
  "why are my images always grainy and noisy",
  "why arent my images sharp",
  "do I need a laptop for lightroom course",
  "do you provide photography courses",
  "do you have online lessons",
  "do you have a lightroom course",
  "whats your online photography course",
  "where i can see your terms and conditions",
  "tell me about rps mentoring",
  "do you do commercial photography",
  "do you do portrait photography",
  "is your photography academy really free",
  "what tripod do you recommend",
  "what camera should I buy",
  "what camera do you recommend for a beginner",
  "what camera do i need for your courses and workshops"
];

// Combine all questions
const allQuestions = [...csvQuestions, ...baselineQuestions, ...interactiveQuestions];

// Remove duplicates
const uniqueQuestions = [...new Set(allQuestions)];

console.log(`📊 COMPREHENSIVE TEST SET CREATED`);
console.log(`================================================================================`);
console.log(`📋 CSV Questions: ${csvQuestions.length}`);
console.log(`📋 Baseline Questions: ${baselineQuestions.length}`);
console.log(`📋 Interactive Questions: ${interactiveQuestions.length}`);
console.log(`📋 Total Combined: ${allQuestions.length}`);
console.log(`📋 Unique Questions: ${uniqueQuestions.length}`);

// Categorize questions based on chat.js classification logic
function categorizeQuestion(query) {
  const lc = query.toLowerCase();
  
  // Workshop queries (routed to events)
  const workshopPatterns = [
    /photography workshop/i,
    /workshop/i,
    /photography training/i,
    /photography course/i,
    /photography lesson/i,
    /photography class/i,
    /lightroom course/i,
    /photo editing course/i,
    /photoshop course/i,
    /camera course/i,
    /weekend photography workshop/i,
    /group photography workshop/i,
    /advanced photography workshop/i
  ];
  
  // Course clarification queries
  const courseClarificationPatterns = [
    /what courses do you offer/i,
    /what photography courses do you have/i,
    /do you offer courses/i,
    /do you do courses/i
  ];
  
  // Contact/policy queries
  const contactPatterns = [
    /cancellation or refund policy/i,
    /contact you/i,
    /book a discovery call/i,
    /gift vouchers/i,
    /terms and conditions/i
  ];
  
  // Private lessons queries
  const privateLessonsPatterns = [
    /private photography lessons/i,
    /1-2-1/i,
    /private lesson/i
  ];
  
  // Clarification queries (broad)
  const clarificationPatterns = [
    /photography services/i,
    /photography articles/i,
    /photography tips/i,
    /photography help/i,
    /photography advice/i,
    /photography equipment/i,
    /photography gear/i,
    /photography techniques/i,
    /photography tutorials/i
  ];
  
  // Equipment queries (direct answer)
  const equipmentPatterns = [
    /what.*camera.*recommend/i,
    /what.*tripod.*recommend/i,
    /what.*lens.*recommend/i,
    /what.*equipment.*recommend/i,
    /camera requirements/i,
    /equipment requirements/i
  ];
  
  // Technical queries (direct answer)
  const technicalPatterns = [
    /what is.*exposure/i,
    /what is.*iso/i,
    /what is.*aperture/i,
    /what is.*shutter/i,
    /what is.*raw/i,
    /what is.*white balance/i,
    /what is.*depth of field/i,
    /what is.*histogram/i,
    /what is.*composition/i,
    /how do i.*take.*photos/i,
    /how do i.*improve/i,
    /how do i.*choose/i,
    /how do i.*understand/i,
    /how do i.*learn/i,
    /how do i.*photograph/i,
    /how do i.*use.*lighting/i,
    /how do i.*edit/i,
    /why are.*photos.*blurry/i,
    /why do.*need.*camera/i,
    /why is.*composition/i,
    /why is.*lighting/i,
    /when is.*best.*time/i,
    /when should.*use/i,
    /when is.*golden hour/i,
    /when is.*blue hour/i,
    /do i need.*camera/i,
    /do i need.*equipment/i,
    /do i need.*understand/i,
    /do i need.*know/i,
    /do i need.*practice/i
  ];
  
  // Check patterns in order of priority
  if (equipmentPatterns.some(pattern => pattern.test(query))) {
    return 'equipment_recommendations';
  }
  
  if (courseClarificationPatterns.some(pattern => pattern.test(query))) {
    return 'course_clarification';
  }
  
  if (contactPatterns.some(pattern => pattern.test(query))) {
    return 'contact_policy';
  }
  
  if (workshopPatterns.some(pattern => pattern.test(query))) {
    return 'workshop_events';
  }
  
  if (privateLessonsPatterns.some(pattern => pattern.test(query))) {
    return 'private_lessons';
  }
  
  if (clarificationPatterns.some(pattern => pattern.test(query))) {
    return 'clarification';
  }
  
  if (technicalPatterns.some(pattern => pattern.test(query))) {
    return 'technical_advice';
  }
  
  // Default to direct answer
  return 'direct_answer';
}

// Categorize all questions
const categorizedQuestions = {};
uniqueQuestions.forEach(question => {
  const category = categorizeQuestion(question);
  if (!categorizedQuestions[category]) {
    categorizedQuestions[category] = [];
  }
  categorizedQuestions[category].push(question);
});

console.log(`\n📊 CATEGORIZATION RESULTS:`);
console.log(`================================================================================`);
Object.entries(categorizedQuestions).forEach(([category, questions]) => {
  console.log(`📋 ${category}: ${questions.length} questions`);
});

// Create representative subset for interactive testing (5 per category)
const interactiveSubset = {};
Object.entries(categorizedQuestions).forEach(([category, questions]) => {
  // Take first 5 questions from each category
  interactiveSubset[category] = questions.slice(0, 5);
});

console.log(`\n🎯 INTERACTIVE TESTING SUBSET (5 per category):`);
console.log(`================================================================================`);
Object.entries(interactiveSubset).forEach(([category, questions]) => {
  console.log(`📋 ${category}: ${questions.length} questions`);
  questions.forEach((q, i) => {
    console.log(`  ${i + 1}. "${q}"`);
  });
});

// Save comprehensive test set
const testSet = {
  metadata: {
    totalQuestions: uniqueQuestions.length,
    csvQuestions: csvQuestions.length,
    baselineQuestions: baselineQuestions.length,
    interactiveQuestions: interactiveQuestions.length,
    categories: Object.keys(categorizedQuestions).length,
    createdAt: new Date().toISOString()
  },
  allQuestions: uniqueQuestions,
  categorizedQuestions,
  interactiveSubset,
  categoryDescriptions: {
    equipment_recommendations: "Equipment recommendation queries (what camera, tripod, etc.)",
    course_clarification: "Course-related queries needing clarification",
    contact_policy: "Contact, booking, and policy queries",
    workshop_events: "Workshop and course event queries",
    private_lessons: "Private lesson queries",
    clarification: "Broad queries needing clarification",
    technical_advice: "Technical photography advice queries",
    direct_answer: "Direct answer queries (fallback)"
  }
};

// Save to file
const outputFile = 'testing-scripts/comprehensive-test-set.json';
fs.writeFileSync(outputFile, JSON.stringify(testSet, null, 2));

console.log(`\n💾 COMPREHENSIVE TEST SET SAVED:`);
console.log(`📁 File: ${outputFile}`);
console.log(`📊 Total Questions: ${uniqueQuestions.length}`);
console.log(`📊 Categories: ${Object.keys(categorizedQuestions).length}`);
console.log(`📊 Interactive Subset: ${Object.values(interactiveSubset).flat().length} questions`);

// Create interactive testing HTML data
const interactiveData = {
  categories: Object.keys(interactiveSubset),
  questions: Object.entries(interactiveSubset).map(([category, questions]) => ({
    category,
    questions: questions.map(q => ({
      question: q,
      category: category,
      focus: testSet.categoryDescriptions[category]
    }))
  }))
};

const interactiveFile = 'testing-scripts/interactive-testing-data.json';
fs.writeFileSync(interactiveFile, JSON.stringify(interactiveData, null, 2));

console.log(`\n🎯 INTERACTIVE TESTING DATA SAVED:`);
console.log(`📁 File: ${interactiveFile}`);
console.log(`📊 Ready for interactive testing system update`);
