import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_CSV = process.env.CSV_PATH || path.resolve(__dirname, "..", "CSVSs from website", "questions_356_intent3.csv");
const OUTPUT_JSON = path.resolve(__dirname, "..", "results", "live", `api-baseline-${Date.now()}.json`);
const API_URL = "https://alan-chat-proxy.vercel.app/api/chat";

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

async function testApiQuery(question, timeoutMs = 30000) {
  const start = Date.now();
  let status = "error";
  let response = null;
  let error = null;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const apiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: question,
        previousQuery: null,
        pageContext: null
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!apiResponse.ok) {
      throw new Error(`HTTP ${apiResponse.status}: ${apiResponse.statusText}`);
    }
    
    response = await apiResponse.json();
    status = "ok";
    
  } catch (err) {
    error = err.message;
    status = "error";
  }
  
  const durationMs = Date.now() - start;
  
  return {
    question,
    status,
    durationMs,
    response,
    error,
    timestamp: new Date().toISOString()
  };
}

async function runBaselineTest() {
  console.log(`📊 Starting API baseline test...`);
  console.log(`📁 Input CSV: ${INPUT_CSV}`);
  console.log(`📁 Output JSON: ${OUTPUT_JSON}`);
  console.log(`🌐 API URL: ${API_URL}`);
  
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
  let errorCount = 0;
  
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    console.log(`${i + 1}/${questions.length} - Testing: "${question}"`);
    
    const result = await testApiQuery(question);
    results.push({
      idx: i + 1,
      ...result
    });
    
    if (result.status === "ok") {
      successCount++;
      // Log classification info for debugging
      if (result.response?.debug) {
        console.log(`  ✅ ${result.response.debug.intent} (${result.response.debug.classification}) - ${result.response.type}`);
      }
    } else {
      errorCount++;
      console.log(`  ❌ Error: ${result.error}`);
    }
    
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Save results
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(results, null, 2));
  
  console.log(`\n📊 Baseline test complete!`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📁 Results saved to: ${OUTPUT_JSON}`);
  
  // Generate summary
  const summary = {
    totalQuestions: questions.length,
    successful: successCount,
    errors: errorCount,
    timestamp: new Date().toISOString(),
    resultsFile: OUTPUT_JSON
  };
  
  const summaryFile = path.resolve(__dirname, "..", "results", "live", `api-baseline-summary-${Date.now()}.json`);
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`📊 Summary saved to: ${summaryFile}`);
}

// Run the test
runBaselineTest().catch(console.error);
