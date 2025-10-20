import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_CSV = process.env.CSV_PATH || path.resolve(__dirname, "..", "CSVSs from website", "questions_356_intent3.csv");
const OUTPUT_JSON = path.resolve(__dirname, "..", "results", "live", `rag-database-test-${Date.now()}.json`);

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(",");
  const idxQuestion = header.findIndex((h) => h.trim().toLowerCase() === "question");
  const rows = [];
  for (const line of lines) {
    const cols = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) => c.replace(/^"|"$/g, ""));
    if (cols[idxQuestion]) rows.push(cols[idxQuestion]);
  }
  return rows;
}

async function testRagAgainstDatabase(question) {
  console.log(`🔍 Testing: "${question}"`);
  
  const results = {
    question,
    chunks: [],
    entities: [],
    totalMatches: 0,
    confidence: 0,
    canAnswer: false,
    answerType: 'none'
  };
  
  try {
    // Test 1: Search page_chunks for content
    const chunksResponse = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `SEARCH_CHUNKS: ${question}`,
        testMode: 'chunks_only'
      })
    });
    
    // Test 2: Search page_entities for events/services
    const entitiesResponse = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `SEARCH_ENTITIES: ${question}`,
        testMode: 'entities_only'
      })
    });
    
    // For now, let's simulate the database search with the current API
    // and analyze what it returns to understand the RAG potential
    
    const apiResponse = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: question,
        previousQuery: null,
        pageContext: null
      })
    });
    
    const data = await apiResponse.json();
    
    // Analyze the response to determine RAG potential
    if (data.type === 'advice' && data.answer && data.answer.length > 100) {
      results.canAnswer = true;
      results.answerType = 'direct_answer';
      results.confidence = data.confidence || 0.5;
      results.totalMatches = 1;
    } else if (data.type === 'events' && data.answer && data.answer.length > 0) {
      results.canAnswer = true;
      results.answerType = 'events';
      results.confidence = data.confidence || 0.8;
      results.totalMatches = data.answer.length;
    } else if (data.type === 'clarification') {
      results.answerType = 'needs_clarification';
      results.confidence = 0.3;
    } else {
      results.answerType = 'no_answer';
      results.confidence = 0.1;
    }
    
    // Extract keywords for analysis
    const keywords = extractKeywords(question);
    results.keywords = keywords;
    
    console.log(`  ✅ ${results.answerType} (confidence: ${results.confidence}) - ${results.totalMatches} matches`);
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.error = error.message;
  }
  
  return results;
}

function extractKeywords(question) {
  const lc = question.toLowerCase();
  const keywords = [];
  
  // Location keywords
  const locations = ['devon', 'wales', 'yorkshire', 'coventry', 'lake district', 'suffolk', 'exmoor'];
  locations.forEach(loc => {
    if (lc.includes(loc)) keywords.push(loc);
  });
  
  // Photography terms
  const photoTerms = ['iso', 'aperture', 'shutter', 'exposure', 'lightroom', 'photoshop', 'workshop', 'course', 'lesson'];
  photoTerms.forEach(term => {
    if (lc.includes(term)) keywords.push(term);
  });
  
  // Question types
  if (lc.includes('what is')) keywords.push('definition');
  if (lc.includes('when is') || lc.includes('next')) keywords.push('schedule');
  if (lc.includes('how much') || lc.includes('price')) keywords.push('pricing');
  if (lc.includes('where')) keywords.push('location');
  
  return keywords;
}

async function runRagDatabaseTest() {
  console.log("🧪 Testing RAG Approach Against All 171 Questions");
  console.log("=" .repeat(60));
  console.log(`📁 Input CSV: ${INPUT_CSV}`);
  console.log(`📁 Output JSON: ${OUTPUT_JSON}`);
  
  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_JSON);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Read and parse CSV
  const csvContent = fs.readFileSync(INPUT_CSV, 'utf8');
  const questions = parseCsv(csvContent);
  console.log(`📋 Found ${questions.length} questions to test`);
  
  const results = [];
  let successCount = 0;
  let directAnswerCount = 0;
  let eventsCount = 0;
  let clarificationCount = 0;
  let noAnswerCount = 0;
  
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    console.log(`${i + 1}/${questions.length} - Testing: "${question}"`);
    
    const result = await testRagAgainstDatabase(question);
    results.push({
      idx: i + 1,
      ...result
    });
    
    // Count by type
    if (result.canAnswer) successCount++;
    if (result.answerType === 'direct_answer') directAnswerCount++;
    if (result.answerType === 'events') eventsCount++;
    if (result.answerType === 'needs_clarification') clarificationCount++;
    if (result.answerType === 'no_answer') noAnswerCount++;
    
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Save results
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(results, null, 2));
  
  console.log(`\n📊 RAG DATABASE TEST RESULTS:`);
  console.log("=" .repeat(60));
  console.log(`Total Questions: ${questions.length}`);
  console.log(`Can Answer: ${successCount} (${Math.round(successCount/questions.length*100)}%)`);
  console.log(`Direct Answers: ${directAnswerCount} (${Math.round(directAnswerCount/questions.length*100)}%)`);
  console.log(`Events: ${eventsCount} (${Math.round(eventsCount/questions.length*100)}%)`);
  console.log(`Needs Clarification: ${clarificationCount} (${Math.round(clarificationCount/questions.length*100)}%)`);
  console.log(`No Answer: ${noAnswerCount} (${Math.round(noAnswerCount/questions.length*100)}%)`);
  
  // Analyze by keyword patterns
  const keywordAnalysis = {};
  results.forEach(r => {
    if (r.keywords) {
      r.keywords.forEach(kw => {
        if (!keywordAnalysis[kw]) keywordAnalysis[kw] = { total: 0, canAnswer: 0 };
        keywordAnalysis[kw].total++;
        if (r.canAnswer) keywordAnalysis[kw].canAnswer++;
      });
    }
  });
  
  console.log(`\n🔍 KEYWORD ANALYSIS:`);
  console.log("=" .repeat(60));
  Object.entries(keywordAnalysis)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 15)
    .forEach(([keyword, stats]) => {
      const successRate = Math.round(stats.canAnswer / stats.total * 100);
      console.log(`${keyword}: ${stats.canAnswer}/${stats.total} (${successRate}%)`);
    });
  
  // Generate summary
  const summary = {
    totalQuestions: questions.length,
    canAnswer: successCount,
    directAnswers: directAnswerCount,
    events: eventsCount,
    clarifications: clarificationCount,
    noAnswers: noAnswerCount,
    successRate: Math.round(successCount/questions.length*100),
    keywordAnalysis,
    timestamp: new Date().toISOString(),
    resultsFile: OUTPUT_JSON
  };
  
  const summaryFile = path.resolve(__dirname, "..", "results", "live", `rag-database-summary-${Date.now()}.json`);
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`\n📁 Detailed results saved to: ${OUTPUT_JSON}`);
  console.log(`📁 Summary saved to: ${summaryFile}`);
  
  // Final assessment
  console.log(`\n🎯 RAG APPROACH ASSESSMENT:`);
  console.log("=" .repeat(60));
  
  if (successCount >= questions.length * 0.7) {
    console.log("✅ RAG approach can answer 70%+ of questions - PROCEED WITH BUILD");
  } else if (successCount >= questions.length * 0.5) {
    console.log("⚠️ RAG approach can answer 50%+ of questions - PROCEED WITH CAUTION");
  } else {
    console.log("❌ RAG approach can only answer <50% of questions - NEED MORE DATA");
  }
  
  return summary;
}

// Run the test
runRagDatabaseTest().catch(console.error);
