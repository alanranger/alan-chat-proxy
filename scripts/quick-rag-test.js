import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_CSV = process.env.CSV_PATH || path.resolve(__dirname, "..", "CSVSs from website", "questions_356_intent3.csv");
const OUTPUT_JSON = path.resolve(__dirname, "..", "results", "live", `quick-rag-test-${Date.now()}.json`);

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

function categorizeQuestion(question) {
  const lc = question.toLowerCase();
  const keywords = extractKeywords(question);
  
  // Categorize based on content
  if (lc.includes('what is') && (lc.includes('iso') || lc.includes('aperture') || lc.includes('exposure'))) {
    return { category: 'photography_definition', confidence: 0.9, reason: 'Technical photography term' };
  }
  
  if (lc.includes('when is') && (lc.includes('workshop') || lc.includes('course'))) {
    return { category: 'event_schedule', confidence: 0.8, reason: 'Event timing query' };
  }
  
  if (lc.includes('workshop') || lc.includes('course')) {
    return { category: 'event_info', confidence: 0.7, reason: 'Event-related query' };
  }
  
  if (lc.includes('how much') || lc.includes('price') || lc.includes('cost')) {
    return { category: 'pricing', confidence: 0.6, reason: 'Pricing query' };
  }
  
  if (lc.includes('where') && (lc.includes('based') || lc.includes('located'))) {
    return { category: 'location', confidence: 0.6, reason: 'Location query' };
  }
  
  if (lc.includes('how do i') || lc.includes('how can i')) {
    return { category: 'how_to', confidence: 0.5, reason: 'Instructional query' };
  }
  
  return { category: 'general', confidence: 0.3, reason: 'General query' };
}

async function runQuickRagTest() {
  console.log("⚡ Quick RAG Potential Test");
  console.log("=" .repeat(50));
  console.log(`📁 Input CSV: ${INPUT_CSV}`);
  
  // Read and parse CSV
  const csvContent = fs.readFileSync(INPUT_CSV, 'utf8');
  const questions = parseCsv(csvContent);
  console.log(`📋 Found ${questions.length} questions to analyze`);
  
  const results = [];
  const categoryStats = {};
  
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const keywords = extractKeywords(question);
    const categorization = categorizeQuestion(question);
    
    const result = {
      idx: i + 1,
      question,
      keywords,
      category: categorization.category,
      confidence: categorization.confidence,
      reason: categorization.reason,
      canAnswer: categorization.confidence >= 0.6
    };
    
    results.push(result);
    
    // Count categories
    if (!categoryStats[categorization.category]) {
      categoryStats[categorization.category] = { total: 0, canAnswer: 0 };
    }
    categoryStats[categorization.category].total++;
    if (result.canAnswer) {
      categoryStats[categorization.category].canAnswer++;
    }
    
    // Show progress every 20 questions
    if ((i + 1) % 20 === 0) {
      console.log(`  Processed ${i + 1}/${questions.length} questions...`);
    }
  }
  
  // Save results
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(results, null, 2));
  
  console.log(`\n📊 QUICK RAG ANALYSIS RESULTS:`);
  console.log("=" .repeat(50));
  
  const totalCanAnswer = results.filter(r => r.canAnswer).length;
  const totalQuestions = results.length;
  
  console.log(`Total Questions: ${totalQuestions}`);
  console.log(`Can Answer (≥60% confidence): ${totalCanAnswer} (${Math.round(totalCanAnswer/totalQuestions*100)}%)`);
  
  console.log(`\n📋 BY CATEGORY:`);
  console.log("-" .repeat(50));
  Object.entries(categoryStats)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([category, stats]) => {
      const successRate = Math.round(stats.canAnswer / stats.total * 100);
      console.log(`${category}: ${stats.canAnswer}/${stats.total} (${successRate}%)`);
    });
  
  // Show sample questions by category
  console.log(`\n🔍 SAMPLE QUESTIONS BY CATEGORY:`);
  console.log("-" .repeat(50));
  
  const categories = [...new Set(results.map(r => r.category))];
  categories.forEach(category => {
    const samples = results.filter(r => r.category === category).slice(0, 3);
    console.log(`\n${category.toUpperCase()}:`);
    samples.forEach(sample => {
      console.log(`  • "${sample.question}" (${Math.round(sample.confidence*100)}%)`);
    });
  });
  
  // Final assessment
  console.log(`\n🎯 RAG APPROACH ASSESSMENT:`);
  console.log("=" .repeat(50));
  
  if (totalCanAnswer >= totalQuestions * 0.7) {
    console.log("✅ RAG approach can answer 70%+ of questions - PROCEED WITH BUILD");
  } else if (totalCanAnswer >= totalQuestions * 0.5) {
    console.log("⚠️ RAG approach can answer 50%+ of questions - PROCEED WITH CAUTION");
  } else {
    console.log("❌ RAG approach can only answer <50% of questions - NEED MORE DATA");
  }
  
  console.log(`\n📁 Results saved to: ${OUTPUT_JSON}`);
  
  return {
    totalQuestions,
    canAnswer: totalCanAnswer,
    successRate: Math.round(totalCanAnswer/totalQuestions*100),
    categoryStats
  };
}

// Run the test
runQuickRagTest().catch(console.error);
