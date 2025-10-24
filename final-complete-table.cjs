// Alan's manual scores from CSV with all questions
const alanScores = {
  // Technical Photography Concepts
  "what is exposure triangle": { score: 100, verdict: "perfect", group: "Technical Photography Concepts" },
  "what is iso": { score: 75, verdict: "very good", group: "Technical Photography Concepts" },
  "what is aperture": { score: 10, verdict: "very poor", group: "Technical Photography Concepts" },
  "what is shutter speed": { score: 50, verdict: "good", group: "Technical Photography Concepts" },
  
  // Equipment Recommendations
  "what tripod do you recommend": { score: 95, verdict: "nearly perfect", group: "Equipment Recommendations" },
  "what camera should I buy": { score: 50, verdict: "good", group: "Equipment Recommendations" },
  "what camera do you recommend for a beginner": { score: 50, verdict: "good", group: "Equipment Recommendations" },
  
  // Person Queries
  "peter orton": { score: 75, verdict: "very good", group: "Person Queries" },
  "who is alan ranger": { score: 75, verdict: "very good", group: "Person Queries" },
  
  // Event Queries
  "when is your next devon workshop": { score: 95, verdict: "nearly perfect", group: "Event Queries" },
  "when is your next photography course": { score: 30, verdict: "poor", group: "Event Queries" },
  "when are your next bluebell workshops": { score: 100, verdict: "perfect", group: "Event Queries" },
  "do you have autumn workshops": { score: 50, verdict: "good", group: "Event Queries" },
  
  // Technical Advice
  "how to take sharp photos": { score: 50, verdict: "good", group: "Technical Advice" },
  "what is long exposure photography": { score: 75, verdict: "very good", group: "Technical Advice" },
  "why are my images always grainy and noisy": { score: 10, verdict: "very poor", group: "Technical Advice" },
  "why arent my images sharp": { score: 50, verdict: "good", group: "Technical Advice" },
  
  // Course/Workshop Logistics
  "do I need a laptop for lightroom course": { score: 75, verdict: "very good", group: "Course/Workshop Logistics" },
  "do you provide photography courses": { score: 10, verdict: "very poor", group: "Course/Workshop Logistics" },
  "do you have online lessons": { score: 30, verdict: "poor", group: "Course/Workshop Logistics" },
  "do you have a lightroom course": { score: 75, verdict: "very good", group: "Course/Workshop Logistics" },
  "whats your online photography course": { score: 10, verdict: "very poor", group: "Course/Workshop Logistics" },
  
  // Business Information
  "where i can see your terms and conditions": { score: 95, verdict: "nearly perfect", group: "Business Information" },
  "tell me about rps mentoring": { score: 75, verdict: "very good", group: "Business Information" },
  "do you do commercial photography": { score: 10, verdict: "very poor", group: "Business Information" },
  "do you do portrait photography": { score: 10, verdict: "very poor", group: "Business Information" },
  "is your photography academy really free": { score: 10, verdict: "very poor", group: "Business Information" },
  
  // Equipment Requirements
  "what camera do i need for your courses and workshops": { score: 10, verdict: "very poor", group: "Equipment Requirements" }
};

// Test results from our comparison
const testResults = {
  "what is exposure triangle": { original: 0.70, current: 0.51 },
  "what is iso": { original: 0.60, current: 0.51 },
  "what is aperture": { original: 0.70, current: 0.51 },
  "what is shutter speed": { original: 0.60, current: 0.51 },
  "what tripod do you recommend": { original: 0.70, current: 0.76 },
  "what camera should I buy": { original: 0.70, current: 0.51 },
  "what camera do you recommend for a beginner": { original: 0.70, current: 0.76 },
  "peter orton": { original: 0.70, current: 0.51 },
  "who is alan ranger": { original: 0.70, current: 0.51 },
  "when is your next devon workshop": { original: 0.95, current: 0.76 },
  "when is your next photography course": { original: 0.95, current: 0.51 },
  "when are your next bluebell workshops": { original: 0.95, current: 0.76 },
  "do you have autumn workshops": { original: 0.95, current: 0.51 },
  "how to take sharp photos": { original: 0.70, current: 0.51 },
  "what is long exposure photography": { original: 0.60, current: 0.51 },
  "why are my images always grainy and noisy": { original: 0.60, current: 0.76 },
  "why arent my images sharp": { original: 0.60, current: 0.51 },
  "do I need a laptop for lightroom course": { original: 0.95, current: 0.31 },
  "do you provide photography courses": { original: 0.20, current: 0.20 },
  "do you have online lessons": { original: 0.70, current: 0.51 },
  "do you have a lightroom course": { original: 0.95, current: 0.51 },
  "whats your online photography course": { original: 0.20, current: 0.20 },
  "where i can see your terms and conditions": { original: 0.60, current: 0.51 },
  "tell me about rps mentoring": { original: 0.70, current: 0.31 },
  "do you do commercial photography": { original: 0.70, current: 0.51 },
  "do you do portrait photography": { original: 0.70, current: 0.51 },
  "is your photography academy really free": { original: 0.70, current: 0.51 },
  "what camera do i need for your courses and workshops": { original: 0.95, current: 0.51 }
};

// Group questions by category
const groupedQuestions = {};
Object.keys(alanScores).forEach(question => {
  const group = alanScores[question].group;
  if (!groupedQuestions[group]) {
    groupedQuestions[group] = [];
  }
  groupedQuestions[group].push(question);
});

console.log('📊 COMPLETE CONFIDENCE SCORING COMPARISON TABLE');
console.log('===============================================');
console.log('Question | Alan % | Original | Current | Current Diff to Alan');
console.log('---------|--------|----------|---------|-------------------');

// Display each group
Object.keys(groupedQuestions).forEach(group => {
  console.log(`\n📁 ${group}:`);
  console.log('---------|--------|----------|---------|-------------------');
  
  groupedQuestions[group].forEach(question => {
    const alanData = alanScores[question];
    const testData = testResults[question];
    
    const alanScore = alanData.score;
    const originalScore = (testData.original * 100).toFixed(0) + '%';
    const currentScore = (testData.current * 100).toFixed(0) + '%';
    const currentDiff = ((testData.current * 100) - alanScore).toFixed(1);
    
    const questionShort = question.length > 35 ? question.substring(0, 32) + '...' : question;
    
    console.log(`${questionShort.padEnd(35)} | ${alanScore.toString().padEnd(6)} | ${originalScore.padEnd(8)} | ${currentScore.padEnd(7)} | ${currentDiff.toString().padEnd(17)}`);
  });
});

console.log('\n📈 ANALYSIS:');
console.log('- Positive numbers = Overconfident (higher than Alan)');
console.log('- Negative numbers = Underconfident (lower than Alan)');
console.log('- Closer to 0 = Better alignment with Alan\'s assessment');


