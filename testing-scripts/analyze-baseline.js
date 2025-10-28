import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASELINE_FILE = path.resolve(__dirname, "..", "results", "live", "api-baseline-1760976011673.json");

function analyzeBaseline() {
  console.log("📊 Analyzing baseline classification patterns...");
  
  const data = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  
  const patterns = {
    byType: {},
    byIntent: {},
    byClassification: {},
    fallbackCount: 0,
    clarificationCount: 0,
    eventsCount: 0,
    adviceCount: 0,
    totalQuestions: data.length
  };
  
  const problematicQueries = [];
  const workshopQueries = [];
  const directAnswerQueries = [];
  const fallbackQueries = [];
  
  for (const result of data) {
    const response = result.response;
    if (!response) continue;
    
    const type = response.type || 'unknown';
    const intent = response.debug?.intent || 'unknown';
    const classification = response.debug?.classification || 'unknown';
    
    // Count by type
    patterns.byType[type] = (patterns.byType[type] || 0) + 1;
    patterns.byIntent[intent] = (patterns.byIntent[intent] || 0) + 1;
    patterns.byClassification[classification] = (patterns.byClassification[classification] || 0) + 1;
    
    // Count specific categories
    if (type === 'fallback') patterns.fallbackCount++;
    if (type === 'clarification') patterns.clarificationCount++;
    if (type === 'events') patterns.eventsCount++;
    if (type === 'advice') patterns.adviceCount++;
    
    // Categorize queries for analysis
    if (intent === 'workshop' || classification === 'workshop') {
      workshopQueries.push({
        question: result.question,
        type,
        intent,
        classification,
        hasEvents: response.answer && response.answer.length > 0
      });
    }
    
    if (intent === 'direct_answer' || classification === 'direct_answer') {
      directAnswerQueries.push({
        question: result.question,
        type,
        intent,
        classification
      });
    }
    
    if (type === 'fallback') {
      fallbackQueries.push({
        question: result.question,
        intent,
        classification
      });
    }
    
    // Identify problematic patterns
    if (type === 'fallback' && result.question.toLowerCase().includes('workshop')) {
      problematicQueries.push({
        question: result.question,
        type,
        intent,
        classification,
        issue: 'Workshop query falling back to fallback'
      });
    }
    
    if (intent === 'workshop' && type === 'clarification') {
      problematicQueries.push({
        question: result.question,
        type,
        intent,
        classification,
        issue: 'Workshop intent but clarification response'
      });
    }
    
    if (intent === 'undefined' && type === 'events') {
      problematicQueries.push({
        question: result.question,
        type,
        intent,
        classification,
        issue: 'Undefined intent but events response'
      });
    }
  }
  
  console.log("\n📈 CLASSIFICATION SUMMARY:");
  console.log(`Total Questions: ${patterns.totalQuestions}`);
  console.log(`Fallback Responses: ${patterns.fallbackCount} (${Math.round(patterns.fallbackCount/patterns.totalQuestions*100)}%)`);
  console.log(`Clarification Responses: ${patterns.clarificationCount} (${Math.round(patterns.clarificationCount/patterns.totalQuestions*100)}%)`);
  console.log(`Events Responses: ${patterns.eventsCount} (${Math.round(patterns.eventsCount/patterns.totalQuestions*100)}%)`);
  console.log(`Advice Responses: ${patterns.adviceCount} (${Math.round(patterns.adviceCount/patterns.totalQuestions*100)}%)`);
  
  console.log("\n🎯 BY INTENT:");
  Object.entries(patterns.byIntent).forEach(([intent, count]) => {
    console.log(`  ${intent}: ${count} (${Math.round(count/patterns.totalQuestions*100)}%)`);
  });
  
  console.log("\n🏷️ BY CLASSIFICATION:");
  Object.entries(patterns.byClassification).forEach(([classification, count]) => {
    console.log(`  ${classification}: ${count} (${Math.round(count/patterns.totalQuestions*100)}%)`);
  });
  
  console.log("\n📋 BY RESPONSE TYPE:");
  Object.entries(patterns.byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} (${Math.round(count/patterns.totalQuestions*100)}%)`);
  });
  
  console.log("\n🚨 PROBLEMATIC QUERIES:");
  if (problematicQueries.length === 0) {
    console.log("  No problematic patterns detected!");
  } else {
    problematicQueries.forEach((q, i) => {
      console.log(`  ${i+1}. "${q.question}"`);
      console.log(`     Issue: ${q.issue}`);
      console.log(`     Intent: ${q.intent}, Classification: ${q.classification}, Type: ${q.type}`);
    });
  }
  
  console.log("\n🎓 WORKSHOP QUERIES:");
  workshopQueries.forEach((q, i) => {
    console.log(`  ${i+1}. "${q.question}"`);
    console.log(`     Intent: ${q.intent}, Classification: ${q.classification}, Type: ${q.type}`);
    console.log(`     Has Events: ${q.hasEvents ? 'Yes' : 'No'}`);
  });
  
  console.log("\n💬 DIRECT ANSWER QUERIES:");
  directAnswerQueries.slice(0, 10).forEach((q, i) => {
    console.log(`  ${i+1}. "${q.question}"`);
    console.log(`     Intent: ${q.intent}, Classification: ${q.classification}, Type: ${q.type}`);
  });
  if (directAnswerQueries.length > 10) {
    console.log(`  ... and ${directAnswerQueries.length - 10} more`);
  }
  
  console.log("\n❌ FALLBACK QUERIES:");
  fallbackQueries.slice(0, 10).forEach((q, i) => {
    console.log(`  ${i+1}. "${q.question}"`);
    console.log(`     Intent: ${q.intent}, Classification: ${q.classification}`);
  });
  if (fallbackQueries.length > 10) {
    console.log(`  ... and ${fallbackQueries.length - 10} more`);
  }
  
  // Save detailed analysis
  const analysis = {
    summary: patterns,
    problematicQueries,
    workshopQueries,
    directAnswerQueries: directAnswerQueries.slice(0, 20), // Limit for file size
    fallbackQueries: fallbackQueries.slice(0, 20),
    timestamp: new Date().toISOString()
  };
  
  const analysisFile = path.resolve(__dirname, "..", "results", "live", `baseline-analysis-${Date.now()}.json`);
  fs.writeFileSync(analysisFile, JSON.stringify(analysis, null, 2));
  console.log(`\n📁 Detailed analysis saved to: ${analysisFile}`);
}

analyzeBaseline();
