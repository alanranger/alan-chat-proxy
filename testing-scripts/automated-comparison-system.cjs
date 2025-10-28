const http = require('http');

// All questions from Alan's CSV
const allQuestions = [
  "what is exposure triangle",
  "what is iso", 
  "what is aperture",
  "what is shutter speed",
  "what tripod do you recommend",
  "what camera should I buy",
  "what camera do you recommend for a beginner",
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
  "what camera do i need for your courses and workshops"
];

// Alan's manual scores
const alanScores = {
  "what is exposure triangle": { score: 100, verdict: "perfect", group: "Technical Photography Concepts" },
  "what is iso": { score: 75, verdict: "very good", group: "Technical Photography Concepts" },
  "what is aperture": { score: 10, verdict: "very poor", group: "Technical Photography Concepts" },
  "what is shutter speed": { score: 50, verdict: "good", group: "Technical Photography Concepts" },
  "what tripod do you recommend": { score: 95, verdict: "nearly perfect", group: "Equipment Recommendations" },
  "what camera should I buy": { score: 50, verdict: "good", group: "Equipment Recommendations" },
  "what camera do you recommend for a beginner": { score: 50, verdict: "good", group: "Equipment Recommendations" },
  "peter orton": { score: 75, verdict: "very good", group: "Person Queries" },
  "who is alan ranger": { score: 75, verdict: "very good", group: "Person Queries" },
  "when is your next devon workshop": { score: 95, verdict: "nearly perfect", group: "Event Queries" },
  "when is your next photography course": { score: 30, verdict: "poor", group: "Event Queries" },
  "when are your next bluebell workshops": { score: 100, verdict: "perfect", group: "Event Queries" },
  "do you have autumn workshops": { score: 50, verdict: "good", group: "Event Queries" },
  "how to take sharp photos": { score: 50, verdict: "good", group: "Technical Advice" },
  "what is long exposure photography": { score: 75, verdict: "very good", group: "Technical Advice" },
  "why are my images always grainy and noisy": { score: 10, verdict: "very poor", group: "Technical Advice" },
  "why arent my images sharp": { score: 50, verdict: "good", group: "Technical Advice" },
  "do I need a laptop for lightroom course": { score: 75, verdict: "very good", group: "Course/Workshop Logistics" },
  "do you provide photography courses": { score: 10, verdict: "very poor", group: "Course/Workshop Logistics" },
  "do you have online lessons": { score: 30, verdict: "poor", group: "Course/Workshop Logistics" },
  "do you have a lightroom course": { score: 75, verdict: "very good", group: "Course/Workshop Logistics" },
  "whats your online photography course": { score: 10, verdict: "very poor", group: "Course/Workshop Logistics" },
  "where i can see your terms and conditions": { score: 95, verdict: "nearly perfect", group: "Business Information" },
  "tell me about rps mentoring": { score: 75, verdict: "very good", group: "Business Information" },
  "do you do commercial photography": { score: 10, verdict: "very poor", group: "Business Information" },
  "do you do portrait photography": { score: 10, verdict: "very poor", group: "Business Information" },
  "is your photography academy really free": { score: 10, verdict: "very poor", group: "Business Information" },
  "what camera do i need for your courses and workshops": { score: 10, verdict: "very poor", group: "Equipment Requirements" }
};

async function testQuery(query, port, label) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({query, sessionId: 'test-session'});
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve({
            label,
            query,
            status: res.statusCode,
            confidence: result.confidence,
            answer: typeof result.answer === 'string' ? result.answer : result.answer_markdown || '',
            answerLength: (typeof result.answer === 'string' ? result.answer : result.answer_markdown || '')?.length || 0,
            events: result.events?.length || 0,
            articles: result.sources?.articles?.length || 0
          });
        } catch (e) {
          reject(new Error(`${label} - Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`${label} - Connection error: ${err.message}`));
    });

    req.write(data);
    req.end();
  });
}

async function runAutomatedComparison() {
  console.log('🔍 AUTOMATED DUAL SERVER COMPARISON');
  console.log('===================================');
  console.log('Testing all questions...\n');
  
  const results = {};
  
  for (const query of allQuestions) {
    try {
      // Test both servers
      const [original, current] = await Promise.all([
        testQuery(query, 3001, 'ORIGINAL').catch(err => ({ 
          label: 'ORIGINAL', 
          query, 
          error: err.message, 
          confidence: null, 
          answer: 'ERROR',
          answerLength: 0,
          events: 0,
          articles: 0
        })),
        testQuery(query, 3000, 'CURRENT').catch(err => ({ 
          label: 'CURRENT', 
          query, 
          error: err.message, 
          confidence: null, 
          answer: 'ERROR',
          answerLength: 0,
          events: 0,
          articles: 0
        }))
      ]);
      
      results[query] = {
        original: original,
        current: current
      };
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results[query] = {
        original: { confidence: null, answer: 'ERROR', answerLength: 0, events: 0, articles: 0 },
        current: { confidence: null, answer: 'ERROR', answerLength: 0, events: 0, articles: 0 }
      };
    }
  }
  
  // Display Confidence Comparison Table
  displayConfidenceTable(results);
  
  // Display Content Comparison Table
  displayContentTable(results);
  
  return results;
}

function displayConfidenceTable(results) {
  console.log('\n📊 CONFIDENCE SCORING COMPARISON TABLE');
  console.log('===============================================');
  console.log('Question | Alan % | Original | Current | Current Diff to Alan');
  console.log('---------|--------|----------|---------|-------------------');

  // Group questions by category
  const groupedQuestions = {};
  Object.keys(alanScores).forEach(question => {
    const group = alanScores[question].group;
    if (!groupedQuestions[group]) {
      groupedQuestions[group] = [];
    }
    groupedQuestions[group].push(question);
  });

  // Display each group
  Object.keys(groupedQuestions).forEach(group => {
    console.log(`\n📁 ${group}:`);
    console.log('---------|--------|----------|---------|-------------------');
    
    groupedQuestions[group].forEach(question => {
      const alanData = alanScores[question];
      const testData = results[question];
      
      if (!testData) return;
      
      const alanScore = alanData.score;
      const originalConf = testData.original.confidence;
      const currentConf = testData.current.confidence;
      
      const originalScore = originalConf ? (originalConf * 100).toFixed(0) + '%' : 'ERROR';
      const currentScore = currentConf ? (currentConf * 100).toFixed(0) + '%' : 'ERROR';
      const currentDiff = currentConf ? ((currentConf * 100) - alanScore).toFixed(1) : 'N/A';
      
      const questionShort = question.length > 35 ? question.substring(0, 32) + '...' : question;
      
      console.log(`${questionShort.padEnd(35)} | ${alanScore.toString().padEnd(6)} | ${originalScore.padEnd(8)} | ${currentScore.padEnd(7)} | ${currentDiff.toString().padEnd(17)}`);
    });
  });
}

function displayContentTable(results) {
  console.log('\n\n📝 CONTENT COMPARISON TABLE');
  console.log('===============================================');
  console.log('Question | Original Response | Current Response | Same?');
  console.log('---------|-------------------|------------------|------');

  // Group questions by category
  const groupedQuestions = {};
  Object.keys(alanScores).forEach(question => {
    const group = alanScores[question].group;
    if (!groupedQuestions[group]) {
      groupedQuestions[group] = [];
    }
    groupedQuestions[group].push(question);
  });

  // Display each group
  Object.keys(groupedQuestions).forEach(group => {
    console.log(`\n📁 ${group}:`);
    console.log('---------|-------------------|------------------|------');
    
    groupedQuestions[group].forEach(question => {
      const testData = results[question];
      
      if (!testData) return;
      
      const originalAnswer = testData.original.answer || 'ERROR';
      const currentAnswer = testData.current.answer || 'ERROR';
      
      // Debug logging
      if (originalAnswer === 'ERROR' || currentAnswer === 'ERROR') {
        console.log(`⚠️  ERROR DETECTED for "${question}": Original="${originalAnswer}", Current="${currentAnswer}"`);
      }
      
      // Compare responses (normalize for comparison)
      const originalNormalized = originalAnswer.replace(/\s+/g, ' ').trim().toLowerCase();
      const currentNormalized = currentAnswer.replace(/\s+/g, ' ').trim().toLowerCase();
      const isSame = originalNormalized === currentNormalized;
      
      const questionShort = question.length > 20 ? question.substring(0, 17) + '...' : question;
      const originalShort = originalAnswer.length > 20 ? originalAnswer.substring(0, 17) + '...' : originalAnswer;
      const currentShort = currentAnswer.length > 20 ? currentAnswer.substring(0, 17) + '...' : currentAnswer;
      const sameIcon = isSame ? '✓' : '✗';
      
      console.log(`${questionShort.padEnd(20)} | ${originalShort.padEnd(17)} | ${currentShort.padEnd(16)} | ${sameIcon}`);
    });
  });
}

// Run the comparison
runAutomatedComparison().catch(console.error);
