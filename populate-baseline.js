// Auto-populate baseline scores from Alan's manual testing (2025-10-23)
const baselineScores = {
  "what is exposure triangle": {
    "confidenceScore": 85,
    "qualityScore": 100,
    "verdict": "perfect",
    "notes": "should have higher confidence - gave a good right answer and show perfectly matched article tiles",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "what is iso": {
    "confidenceScore": 70,
    "qualityScore": 75,
    "verdict": "very good",
    "notes": "didn't answer the question it referenced the article but did show relevant articles in article block",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "what is aperture": {
    "confidenceScore": 70,
    "qualityScore": 10,
    "verdict": "very poor",
    "notes": "didn't even attempt to answer question and no related articles section",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "what is shutter speed": {
    "confidenceScore": 70,
    "qualityScore": 50,
    "verdict": "good",
    "notes": "didn't answer the question showed one correct article but the pdf field checklist was from wrong blog and topic",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "what tripod do you recommend": {
    "confidenceScore": 85,
    "qualityScore": 95,
    "verdict": "nearly perfect",
    "notes": "should have higher confidence - gave a good right answer and show perfectly matched article tiles",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "what camera should I buy": {
    "confidenceScore": 70,
    "qualityScore": 50,
    "verdict": "good",
    "notes": "initial response good but related article tiles not great and there were better ones available not showing",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "what camera do you recommend for a beginner": {
    "confidenceScore": 70,
    "qualityScore": 50,
    "verdict": "good",
    "notes": "initial response good but related article tiles not great and there were better ones available not showing",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "peter orton": {
    "confidenceScore": 70,
    "qualityScore": 75,
    "verdict": "very good",
    "notes": "good but could have shown more related articles for other case studies too",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "who is alan ranger": {
    "confidenceScore": 70,
    "qualityScore": 75,
    "verdict": "very good",
    "notes": "good initial response but shouldn't have shown related articles, should shown orange pill linked to about-alan page",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "when is your next devon workshop": {
    "confidenceScore": 95,
    "qualityScore": 95,
    "verdict": "nearly perfect",
    "notes": "no changes required",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "when is your next photography course": {
    "confidenceScore": 95,
    "qualityScore": 30,
    "verdict": "poor",
    "notes": "it lists workshops not courses in the events block",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "when are your next bluebell workshops": {
    "confidenceScore": 95,
    "qualityScore": 100,
    "verdict": "perfect",
    "notes": "no changes required",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "do you have autumn workshops": {
    "confidenceScore": 95,
    "qualityScore": 50,
    "verdict": "good",
    "notes": "missing some events for autumn like peak district but need to check if they contain enough clues to be classified as autumn",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "how to take sharp photos": {
    "confidenceScore": 70,
    "qualityScore": 50,
    "verdict": "good",
    "notes": "initial response good but related article tiles not great and there were better ones available not showing",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "what is long exposure photography": {
    "confidenceScore": 70,
    "qualityScore": 75,
    "verdict": "very good",
    "notes": "didn't answer the question it referenced the article but did show relevant articles in article block",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "why are my images always grainy and noisy": {
    "confidenceScore": 70,
    "qualityScore": 10,
    "verdict": "very poor",
    "notes": "wrong initial response that isn't related and two related articles not related at all - should have found answers on ISO",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "why arent my images sharp": {
    "confidenceScore": 70,
    "qualityScore": 50,
    "verdict": "good",
    "notes": "initial response good but related article tiles showing two unrelated articles rather than better ones",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "do I need a laptop for lightroom course": {
    "confidenceScore": 95,
    "qualityScore": 75,
    "verdict": "very good",
    "notes": "initial response not good as didn't answer question but course tiles correct and they answer the question",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "do you provide photography courses": {
    "confidenceScore": 0.2,
    "qualityScore": 10,
    "verdict": "very poor",
    "notes": "confidence pill says 0.2% then classification options > go to wrong events these are not the classification options we agreed and had working before",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "do you have online lessons": {
    "confidenceScore": 70,
    "qualityScore": 30,
    "verdict": "poor",
    "notes": "initial response weak and links/pills to the landing pages or article tiles",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "do you have a lightroom course": {
    "confidenceScore": 95,
    "qualityScore": 75,
    "verdict": "very good",
    "notes": "listed right events but could also have responded initially with a better answer",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "whats your online photography course": {
    "confidenceScore": 0.2,
    "qualityScore": 10,
    "verdict": "very poor",
    "notes": "confidence pill says 0.2% then classification options > go to wrong events these are not the classification options we agreed and had working before",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "where i can see your terms and conditions": {
    "confidenceScore": 70,
    "qualityScore": 95,
    "verdict": "nearly perfect",
    "notes": "no changes required",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "tell me about rps mentoring": {
    "confidenceScore": 70,
    "qualityScore": 75,
    "verdict": "very good",
    "notes": "perfect initial response and did show one relevant article and one not relevant and could have easily found articles with rps",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "do you do commercial photography": {
    "confidenceScore": 70,
    "qualityScore": 10,
    "verdict": "very poor",
    "notes": "Initial response had nothing to do with question, related articles were not about the question",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "do you do portrait photography": {
    "confidenceScore": 70,
    "qualityScore": 10,
    "verdict": "very poor",
    "notes": "Initial response had nothing to do with question, related articles were not about the question",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "is your photography academy really free": {
    "confidenceScore": 70,
    "qualityScore": 10,
    "verdict": "very poor",
    "notes": "Initial response had nothing to do with question, related articles were not about the question",
    "timestamp": "2025-10-23T00:00:00.000Z"
  },
  "what camera do i need for your courses and workshops": {
    "confidenceScore": 95,
    "qualityScore": 10,
    "verdict": "very poor",
    "notes": "Initial response had nothing to do with question, related articles were not about the question",
    "timestamp": "2025-10-23T00:00:00.000Z"
  }
};

// Load existing scores
let savedScores = {};
const saved = localStorage.getItem('interactiveTestScores');
if (saved) {
  savedScores = JSON.parse(saved);
}

// Merge baseline scores (baseline takes precedence for questions that exist)
Object.keys(baselineScores).forEach(question => {
  savedScores[question] = baselineScores[question];
});

// Save back to localStorage
localStorage.setItem('interactiveTestScores', JSON.stringify(savedScores));

console.log('Baseline scores loaded:', Object.keys(baselineScores).length, 'questions');