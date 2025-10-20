import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testQuestions = [
  'What tripod do you recommend',
  'when is the next devon workshop',
  'what is ISO',
  'what is the exposure triangle'
];

async function testAPI(endpoint, question) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query: question, 
        previousQuery: null, 
        pageContext: null 
      })
    });
    
    if (!response.ok) {
      return { error: `HTTP ${response.status}: ${response.statusText}` };
    }
    
    const data = await response.json();
    return {
      type: data.type,
      confidence: data.confidence,
      answerLength: data.answer?.length || 0,
      debug: data.debug,
      hasAnswer: data.answer && data.answer.length > 0
    };
    
  } catch (error) {
    return { error: error.message };
  }
}

async function runPrototypeTest() {
  console.log("🧪 Testing RAG-First Prototype vs Current System");
  console.log("=" .repeat(60));
  
  const results = [];
  
  for (const question of testQuestions) {
    console.log(`\n🔍 Testing: "${question}"`);
    
    // Test current API
    console.log("  Testing current API...");
    const currentResult = await testAPI('https://alan-chat-proxy.vercel.app/api/chat', question);
    
    // Test RAG API
    console.log("  Testing RAG API...");
    const ragResult = await testAPI('https://alan-chat-proxy.vercel.app/api/chat-rag', question);
    
    const result = {
      question,
      current: currentResult,
      rag: ragResult,
      timestamp: new Date().toISOString()
    };
    
    results.push(result);
    
    // Display results
    console.log(`  Current API: ${currentResult.error || `${currentResult.type} (${currentResult.confidence}) - ${currentResult.answerLength} chars`}`);
    console.log(`  RAG API: ${ragResult.error || `${ragResult.type} (${ragResult.confidence}) - ${ragResult.answerLength} chars`}`);
    
    // Show improvement
    if (!currentResult.error && !ragResult.error) {
      const improvement = ragResult.answerLength - currentResult.answerLength;
      if (improvement > 0) {
        console.log(`  ✅ RAG improvement: +${improvement} characters`);
      } else if (improvement < 0) {
        console.log(`  ❌ RAG regression: ${improvement} characters`);
      } else {
        console.log(`  ➖ No change in answer length`);
      }
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Save results
  const outputFile = path.resolve(__dirname, "..", "results", "live", `rag-prototype-test-${Date.now()}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  
  console.log(`\n📊 SUMMARY:`);
  console.log("=" .repeat(60));
  
  const workingRAG = results.filter(r => !r.rag.error).length;
  const workingCurrent = results.filter(r => !r.current.error).length;
  
  console.log(`RAG API working: ${workingRAG}/${testQuestions.length}`);
  console.log(`Current API working: ${workingCurrent}/${testQuestions.length}`);
  
  if (workingRAG > 0) {
    const avgRAGLength = results
      .filter(r => !r.rag.error && r.rag.answerLength > 0)
      .reduce((sum, r) => sum + r.rag.answerLength, 0) / results.filter(r => !r.rag.error && r.rag.answerLength > 0).length;
    
    const avgCurrentLength = results
      .filter(r => !r.current.error && r.current.answerLength > 0)
      .reduce((sum, r) => sum + r.current.answerLength, 0) / results.filter(r => !r.current.error && r.current.answerLength > 0).length;
    
    console.log(`Average RAG answer length: ${Math.round(avgRAGLength)} chars`);
    console.log(`Average current answer length: ${Math.round(avgCurrentLength)} chars`);
    console.log(`Improvement: ${Math.round(avgRAGLength - avgCurrentLength)} chars`);
  }
  
  console.log(`\n📁 Results saved to: ${outputFile}`);
  
  return results;
}

runPrototypeTest().catch(console.error);
