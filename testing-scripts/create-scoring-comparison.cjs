// Alan's manual scores from CSV
const alanScores = {
  "what is exposure triangle": { score: 100, verdict: "perfect" },
  "what is iso": { score: 75, verdict: "very good" },
  "what is aperture": { score: 10, verdict: "very poor" },
  "what is shutter speed": { score: 50, verdict: "good" },
  "what tripod do you recommend": { score: 95, verdict: "nearly perfect" },
  "what camera should I buy": { score: 50, verdict: "good" },
  "what camera do you recommend for a beginner": { score: 50, verdict: "good" },
  "peter orton": { score: 75, verdict: "very good" },
  "who is alan ranger": { score: 75, verdict: "very good" },
  "when is your next devon workshop": { score: 95, verdict: "nearly perfect" },
  "when is your next photography course": { score: 30, verdict: "poor" },
  "when are your next bluebell workshops": { score: 100, verdict: "perfect" },
  "do you have autumn workshops": { score: 50, verdict: "good" },
  "how to take sharp photos": { score: 50, verdict: "good" },
  "what is long exposure photography": { score: 75, verdict: "very good" },
  "why are my images always grainy and noisy": { score: 10, verdict: "very poor" },
  "why arent my images sharp": { score: 50, verdict: "good" },
  "do I need a laptop for lightroom course": { score: 75, verdict: "very good" },
  "do you provide photography courses": { score: 10, verdict: "very poor" },
  "do you have online lessons": { score: 30, verdict: "poor" },
  "do you have a lightroom course": { score: 75, verdict: "very good" },
  "whats your online photography course": { score: 10, verdict: "very poor" },
  "where i can see your terms and conditions": { score: 95, verdict: "nearly perfect" },
  "tell me about rps mentoring": { score: 75, verdict: "very good" },
  "do you do commercial photography": { score: 10, verdict: "very poor" },
  "do you do portrait photography": { score: 10, verdict: "very poor" },
  "is your photography academy really free": { score: 10, verdict: "very poor" },
  "what camera do i need for your courses and workshops": { score: 10, verdict: "very poor" }
};

// Test results from our comparison
const testResults = [
  {
    query: "what is exposure triangle",
    original: { confidence: 0.70, status: 200 },
    current: { confidence: 0.51, status: 200 }
  },
  {
    query: "when is your next devon workshop", 
    original: { confidence: 0.95, status: 200 },
    current: { confidence: 0.76, status: 200 }
  },
  {
    query: "do you do commercial photography",
    original: { confidence: 0.70, status: 200 },
    current: { confidence: 0.51, status: 200 }
  },
  {
    query: "what camera do you recommend for a beginner",
    original: { confidence: 0.70, status: 200 },
    current: { confidence: 0.76, status: 200 }
  },
  {
    query: "do you have autumn workshops",
    original: { confidence: 0.95, status: 200 },
    current: { confidence: 0.51, status: 200 }
  }
];

console.log('📊 CONFIDENCE SCORING COMPARISON TABLE');
console.log('=====================================');
console.log('Question | Alan Score | Original | Current | Original Diff | Current Diff');
console.log('---------|------------|----------|---------|---------------|-------------');

testResults.forEach(result => {
  const alanData = alanScores[result.query];
  if (!alanData) return;
  
  const alanScore = alanData.score;
  const originalConf = result.original.confidence;
  const currentConf = result.current.confidence;
  
  const originalDiff = originalConf ? ((originalConf * 100) - alanScore).toFixed(1) : 'ERROR';
  const currentDiff = currentConf ? ((currentConf * 100) - alanScore).toFixed(1) : 'ERROR';
  
  const originalStr = originalConf ? `${(originalConf * 100).toFixed(0)}%` : 'ERROR';
  const currentStr = currentConf ? `${(currentConf * 100).toFixed(0)}%` : 'ERROR';
  
  console.log(`${result.query.substring(0, 30).padEnd(30)} | ${alanScore.toString().padEnd(10)} | ${originalStr.padEnd(8)} | ${currentStr.padEnd(7)} | ${originalDiff.toString().padEnd(13)} | ${currentDiff}`);
});

console.log('\n📈 ANALYSIS:');
console.log('- Positive numbers = Overconfident (higher than Alan)');
console.log('- Negative numbers = Underconfident (lower than Alan)');
console.log('- Closer to 0 = Better alignment with Alan\'s assessment');
console.log('\n🎯 KEY INSIGHTS:');
console.log('1. "exposure triangle": Alan=100, Original=70, Current=51');
console.log('   - Original is 30 points underconfident');
console.log('   - Current is 49 points underconfident');
console.log('   - Original is closer to Alan\'s assessment');
console.log('\n2. "commercial photography": Alan=10, Original=70, Current=51');
console.log('   - Both are massively overconfident (Alan says very poor)');
console.log('   - Current is slightly better (51 vs 70)');
console.log('\n3. "camera recommendation": Alan=50, Original=70, Current=76');
console.log('   - Both are overconfident');
console.log('   - Original is closer to Alan\'s assessment');