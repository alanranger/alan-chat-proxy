const fs = require('fs');

// Load the comprehensive test set
const testSet = JSON.parse(fs.readFileSync('testing-scripts/comprehensive-test-set.json', 'utf8'));

// Business logic categorization based on user intent and business perspective
function categorizeByBusinessLogic(query) {
  const lc = query.toLowerCase();
  
  // 1. TECHNICAL PHOTOGRAPHY CONCEPTS - "What is..." questions about photography fundamentals
  if (lc.includes('what is') && (
    lc.includes('exposure') || lc.includes('iso') || lc.includes('aperture') || 
    lc.includes('shutter') || lc.includes('raw') || lc.includes('white balance') ||
    lc.includes('depth of field') || lc.includes('histogram') || lc.includes('composition') ||
    lc.includes('metering') || lc.includes('focal length') || lc.includes('hdr')
  )) {
    return 'Technical Photography Concepts';
  }
  
  // 2. EQUIPMENT RECOMMENDATIONS - Questions about what equipment to buy/use
  if ((lc.includes('what') || lc.includes('which') || lc.includes('recommend')) && (
    lc.includes('camera') || lc.includes('tripod') || lc.includes('lens') || 
    lc.includes('filter') || lc.includes('flash') || lc.includes('equipment') ||
    lc.includes('gear') || lc.includes('need for') || lc.includes('should i buy')
  )) {
    return 'Equipment Recommendations';
  }
  
  // 3. PERSON QUERIES - Questions about specific people
  if (lc.includes('who is') || lc.includes('peter orton') || lc.includes('alan ranger') ||
      lc.includes('background') || lc.includes('based') || lc.includes('photographer')) {
    return 'Person Queries';
  }
  
  // 4. EVENT QUERIES - Questions about workshops, courses, events, schedules
  if ((lc.includes('when') || lc.includes('next') || lc.includes('do you have') || 
       lc.includes('are your') || lc.includes('schedule')) && (
    lc.includes('workshop') || lc.includes('course') || lc.includes('class') || 
    lc.includes('lesson') || lc.includes('training') || lc.includes('event') ||
    lc.includes('devon') || lc.includes('bluebell') || lc.includes('autumn') ||
    lc.includes('spring') || lc.includes('summer') || lc.includes('winter')
  )) {
    return 'Event Queries';
  }
  
  // 5. TECHNICAL ADVICE - "How to..." and "Why..." questions about photography techniques
  if ((lc.includes('how to') || lc.includes('how do i') || lc.includes('why') || 
       lc.includes('why are') || lc.includes('why do') || lc.includes('why is')) && (
    lc.includes('take') || lc.includes('improve') || lc.includes('photograph') ||
    lc.includes('sharp') || lc.includes('blurry') || lc.includes('grainy') ||
    lc.includes('noisy') || lc.includes('lighting') || lc.includes('edit') ||
    lc.includes('compose') || lc.includes('exposure') || lc.includes('settings')
  )) {
    return 'Technical Advice';
  }
  
  // 6. COURSE/WORKSHOP LOGISTICS - Questions about course details, requirements, logistics
  if ((lc.includes('do i need') || lc.includes('do you provide') || lc.includes('do you have') ||
       lc.includes('what courses') || lc.includes('course') || lc.includes('workshop')) && (
    lc.includes('laptop') || lc.includes('equipment') || lc.includes('requirements') ||
    lc.includes('online') || lc.includes('zoom') || lc.includes('private') ||
    lc.includes('beginner') || lc.includes('advanced') || lc.includes('certificate') ||
    lc.includes('cost') || lc.includes('price') || lc.includes('booking')
  )) {
    return 'Course/Workshop Logistics';
  }
  
  // 7. BUSINESS INFORMATION - Questions about services, policies, contact, business details
  if (lc.includes('terms and conditions') || lc.includes('cancellation') || lc.includes('refund') ||
      lc.includes('contact') || lc.includes('book') || lc.includes('discovery call') ||
      lc.includes('gift voucher') || lc.includes('commercial photography') ||
      lc.includes('portrait photography') || lc.includes('property photography') ||
      lc.includes('product photography') || lc.includes('retouching') ||
      lc.includes('fine art prints') || lc.includes('turnaround') ||
      lc.includes('usage rights') || lc.includes('licensing') ||
      lc.includes('rps mentoring') || lc.includes('photography academy') ||
      lc.includes('free') || lc.includes('complimentary') ||
      lc.includes('ethical guidelines') || lc.includes('gallery') ||
      lc.includes('feedback') || lc.includes('subscribe')) {
    return 'Business Information';
  }
  
  // Default fallback
  return 'General Queries';
}

// Recategorize all questions
const businessCategorizedQuestions = {};
testSet.allQuestions.forEach(question => {
  const category = categorizeByBusinessLogic(question);
  if (!businessCategorizedQuestions[category]) {
    businessCategorizedQuestions[category] = [];
  }
  businessCategorizedQuestions[category].push(question);
});

console.log(`📊 BUSINESS LOGIC CATEGORIZATION:`);
console.log(`================================================================================`);
Object.entries(businessCategorizedQuestions).forEach(([category, questions]) => {
  console.log(`📋 ${category}: ${questions.length} questions`);
});

// Create representative subset for interactive testing (5 per category)
const interactiveSubset = {};
Object.entries(businessCategorizedQuestions).forEach(([category, questions]) => {
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

// Update the test set with business logic categories
const updatedTestSet = {
  ...testSet,
  metadata: {
    ...testSet.metadata,
    categorizationMethod: 'business_logic',
    updatedAt: new Date().toISOString()
  },
  businessCategorizedQuestions,
  interactiveSubset,
  categoryDescriptions: {
    'Technical Photography Concepts': 'Fundamental photography concepts and definitions',
    'Equipment Recommendations': 'Equipment advice and recommendations',
    'Person Queries': 'Questions about specific people',
    'Event Queries': 'Workshop, course, and event scheduling questions',
    'Technical Advice': 'How-to and troubleshooting photography advice',
    'Course/Workshop Logistics': 'Course details, requirements, and logistics',
    'Business Information': 'Services, policies, contact, and business details',
    'General Queries': 'Miscellaneous questions'
  }
};

// Save updated test set
fs.writeFileSync('testing-scripts/comprehensive-test-set.json', JSON.stringify(updatedTestSet, null, 2));

// Create interactive testing HTML data
const interactiveData = {
  categories: Object.keys(interactiveSubset),
  questions: Object.entries(interactiveSubset).map(([category, questions]) => ({
    category,
    questions: questions.map(q => ({
      question: q,
      category: category,
      focus: updatedTestSet.categoryDescriptions[category]
    }))
  }))
};

fs.writeFileSync('testing-scripts/interactive-testing-data.json', JSON.stringify(interactiveData, null, 2));

console.log(`\n💾 UPDATED TEST SET SAVED:`);
console.log(`📁 File: testing-scripts/comprehensive-test-set.json`);
console.log(`📊 Total Questions: ${testSet.allQuestions.length}`);
console.log(`📊 Business Categories: ${Object.keys(businessCategorizedQuestions).length}`);
console.log(`📊 Interactive Subset: ${Object.values(interactiveSubset).flat().length} questions`);

console.log(`\n🎯 INTERACTIVE TESTING DATA SAVED:`);
console.log(`📁 File: testing-scripts/interactive-testing-data.json`);
console.log(`📊 Ready for interactive testing system update`);
