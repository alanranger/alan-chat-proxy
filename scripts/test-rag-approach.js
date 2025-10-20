import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test the RAG approach with a few key questions
const testQueries = [
  "what is ISO",
  "when is the next devon workshop", 
  "what is the exposure triangle",
  "how do I improve my photography skills"
];

async function testRagQuery(question) {
  console.log(`\n🔍 Testing RAG for: "${question}"`);
  
  try {
    const response = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: question,
        previousQuery: null,
        pageContext: null
      })
    });
    
    const data = await response.json();
    
    console.log(`  Response Type: ${data.type}`);
    console.log(`  Intent: ${data.debug?.intent || 'unknown'}`);
    console.log(`  Classification: ${data.debug?.classification || 'unknown'}`);
    console.log(`  Confidence: ${data.confidence || 'unknown'}`);
    
    if (data.type === 'advice' && data.answer) {
      console.log(`  Answer Preview: ${data.answer.substring(0, 200)}...`);
    } else if (data.type === 'events' && data.answer) {
      console.log(`  Events Found: ${data.answer.length}`);
      if (data.answer.length > 0) {
        console.log(`  First Event: ${data.answer[0].title || data.answer[0].event_title}`);
      }
    } else if (data.type === 'clarification') {
      console.log(`  Clarification: ${data.answer?.substring(0, 200)}...`);
    }
    
    return {
      question,
      type: data.type,
      intent: data.debug?.intent,
      classification: data.debug?.classification,
      confidence: data.confidence,
      hasDirectAnswer: data.type === 'advice' && data.answer && data.answer.length > 50,
      hasEvents: data.type === 'events' && data.answer && data.answer.length > 0,
      needsClarification: data.type === 'clarification'
    };
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return { question, error: error.message };
  }
}

async function runRagTest() {
  console.log("🧪 Testing RAG Approach vs Current System");
  console.log("=" .repeat(50));
  
  const results = [];
  
  for (const query of testQueries) {
    const result = await testRagQuery(query);
    results.push(result);
    
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log("\n📊 SUMMARY:");
  console.log("=" .repeat(50));
  
  const directAnswers = results.filter(r => r.hasDirectAnswer).length;
  const eventAnswers = results.filter(r => r.hasEvents).length;
  const clarifications = results.filter(r => r.needsClarification).length;
  const errors = results.filter(r => r.error).length;
  
  console.log(`Direct Answers: ${directAnswers}/${testQueries.length} (${Math.round(directAnswers/testQueries.length*100)}%)`);
  console.log(`Event Answers: ${eventAnswers}/${testQueries.length} (${Math.round(eventAnswers/testQueries.length*100)}%)`);
  console.log(`Clarifications: ${clarifications}/${testQueries.length} (${Math.round(clarifications/testQueries.length*100)}%)`);
  console.log(`Errors: ${errors}/${testQueries.length} (${Math.round(errors/testQueries.length*100)}%)`);
  
  console.log("\n🎯 RAG APPROACH ASSESSMENT:");
  console.log("=" .repeat(50));
  
  if (directAnswers >= 2) {
    console.log("✅ RAG is working for direct questions");
  } else {
    console.log("❌ RAG is not providing direct answers");
  }
  
  if (eventAnswers >= 1) {
    console.log("✅ Event queries are finding results");
  } else {
    console.log("❌ Event queries are not finding results");
  }
  
  if (clarifications <= 1) {
    console.log("✅ System is not over-clarifying");
  } else {
    console.log("❌ System is over-clarifying simple questions");
  }
  
  // Save results
  const outputFile = path.resolve(__dirname, "..", "results", "live", `rag-test-${Date.now()}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\n📁 Results saved to: ${outputFile}`);
}

runRagTest().catch(console.error);
