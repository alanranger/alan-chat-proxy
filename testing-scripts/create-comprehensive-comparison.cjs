const fs = require('fs');

// Alan's manual scores from the CSV file
const alanScores = {
  "what is exposure triangle": 100,
  "what is iso": 100,
  "what is aperture": 100,
  "what is shutter speed": 100,
  "what tripod do you recommend": 100,
  "what camera should I buy": 100,
  "peter orton": 100,
  "who is alan ranger": 100,
  "when is your next devon workshop": 100,
  "when is your next photography course": 100,
  "how to take sharp photos": 100,
  "what is long exposure photography": 100,
  "do I need a laptop for lightroom course": 100,
  "do you provide photography courses": 100,
  "do you have online lessons": 100,
  "where i can see your terms and conditions": 100,
  "when are your next bluebell workshops": 100,
  "do you have autumn workshops": 100,
  "tell me about rps mentoring": 100,
  "do you have a lightroom course": 100,
  "do you do commercial photography": 10,
  "do you do portrait photography": 10,
  "why are my images always grainy and noisy": 10,
  "why arent my images sharp": 100,
  "what camera do i need for your courses and workshops": 10,
  "what camera do you recommend for a beginner": 100,
  "whats your online photography course": 100,
  "is your photography academy really free": 10
};

// Current automated scores from the test results
const currentScores = {
  "what is exposure triangle": 60,
  "what is iso": 60,
  "what is aperture": 60,
  "what is shutter speed": 60,
  "what tripod do you recommend": 60,
  "what camera should I buy": 40,
  "peter orton": 60,
  "who is alan ranger": 60,
  "when is your next devon workshop": 80,
  "when is your next photography course": 60,
  "how to take sharp photos": 60,
  "what is long exposure photography": 60,
  "do I need a laptop for lightroom course": 40,
  "do you provide photography courses": 20,
  "do you have online lessons": 60,
  "where i can see your terms and conditions": 60,
  "when are your next bluebell workshops": 80,
  "do you have autumn workshops": 60,
  "tell me about rps mentoring": 40,
  "do you have a lightroom course": 60,
  "do you do commercial photography": 60,
  "do you do portrait photography": 60,
  "why are my images always grainy and noisy": 60,
  "why arent my images sharp": 60,
  "what camera do i need for your courses and workshops": 60,
  "what camera do you recommend for a beginner": 60,
  "whats your online photography course": 20,
  "is your photography academy really free": 60
};

// Original scores from the baseline (before our changes)
const originalScores = {
  "what is exposure triangle": 87,
  "what is iso": 85,
  "what is aperture": 80,
  "what is shutter speed": 85,
  "what tripod do you recommend": 83,
  "what camera should I buy": 85,
  "peter orton": 80,
  "who is alan ranger": 77,
  "when is your next devon workshop": 78,
  "when is your next photography course": 71,
  "how to take sharp photos": 78,
  "what is long exposure photography": 78,
  "do I need a laptop for lightroom course": 40,
  "do you provide photography courses": 28,
  "do you have online lessons": 70,
  "where i can see your terms and conditions": 69,
  "when are your next bluebell workshops": 67,
  "do you have autumn workshops": 55,
  "tell me about rps mentoring": 75,
  "do you have a lightroom course": 43,
  "do you do commercial photography": 72,
  "do you do portrait photography": 72,
  "why are my images always grainy and noisy": 74,
  "why arent my images sharp": 80,
  "what camera do i need for your courses and workshops": 44,
  "what camera do you recommend for a beginner": 90,
  "whats your online photography course": 25,
  "is your photography academy really free": 69
};

// Create comprehensive comparison table
console.log("📊 COMPREHENSIVE SCORING COMPARISON TABLE");
console.log("=" .repeat(120));
console.log("Question | Alan's Score | Original Score | Current Score | Alan vs Current | Original vs Current");
console.log("-" .repeat(120));

const questions = Object.keys(alanScores);
let totalAlanDeviation = 0;
let totalOriginalDeviation = 0;
let count = 0;

questions.forEach(question => {
  const alanScore = alanScores[question];
  const originalScore = originalScores[question] || 0;
  const currentScore = currentScores[question];
  
  const alanDeviation = currentScore - alanScore;
  const originalDeviation = currentScore - originalScore;
  
  totalAlanDeviation += Math.abs(alanDeviation);
  totalOriginalDeviation += Math.abs(originalDeviation);
  count++;
  
  const alanDeviationStr = alanDeviation >= 0 ? `+${alanDeviation}` : `${alanDeviation}`;
  const originalDeviationStr = originalDeviation >= 0 ? `+${originalDeviation}` : `${originalDeviation}`;
  
  console.log(`${question.padEnd(35)} | ${alanScore.toString().padStart(11)} | ${originalScore.toString().padStart(13)} | ${currentScore.toString().padStart(12)} | ${alanDeviationStr.padStart(15)} | ${originalDeviationStr.padStart(17)}`);
});

console.log("-" .repeat(120));
console.log(`AVERAGE DEVIATION FROM ALAN: ${(totalAlanDeviation / count).toFixed(1)} points`);
console.log(`AVERAGE DEVIATION FROM ORIGINAL: ${(totalOriginalDeviation / count).toFixed(1)} points`);

// Summary statistics
const alanAverage = Object.values(alanScores).reduce((a, b) => a + b, 0) / Object.values(alanScores).length;
const currentAverage = Object.values(currentScores).reduce((a, b) => a + b, 0) / Object.values(currentScores).length;
const originalAverage = Object.values(originalScores).reduce((a, b) => a + b, 0) / Object.values(originalScores).length;

console.log("\n📈 SUMMARY STATISTICS");
console.log("=" .repeat(50));
console.log(`Alan's Average Score: ${alanAverage.toFixed(1)}/100`);
console.log(`Original Average Score: ${originalAverage.toFixed(1)}/100`);
console.log(`Current Average Score: ${currentAverage.toFixed(1)}/100`);
console.log(`\nCurrent vs Alan: ${(currentAverage - alanAverage).toFixed(1)} points`);
console.log(`Current vs Original: ${(currentAverage - originalAverage).toFixed(1)} points`);


