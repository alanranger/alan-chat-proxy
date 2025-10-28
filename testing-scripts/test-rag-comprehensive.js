import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CURRENT_API_URL = "https://alan-chat-proxy.vercel.app/api/chat";
const RAG_API_URL = "https://alan-chat-proxy.vercel.app/api/chat-rag";
const OUTPUT_JSON = path.resolve(__dirname, "..", "results", "live", `rag-comprehensive-test-${Date.now()}.json`);

// 30 questions covering all categories
const testQuestions = [
  // General Business Enquiries (5)
  "What is Alan Ranger Photography?",
  "Where are you based?",
  "How long have you been in business?",
  "What services do you offer?",
  "How can I contact you?",
  
  // Courses (5)
  "What courses do you offer?",
  "When is the next Lightroom course?",
  "How long are your courses?",
  "What will I learn in the Lightroom course?",
  "Are your courses suitable for beginners?",
  
  // Workshops (5)
  "When is the next Devon workshop?",
  "When is the next Wales workshop?",
  "When is the next Yorkshire workshop?",
  "What workshops do you run?",
  "How much do workshops cost?",
  
  // Private Lessons (3)
  "Do you offer private lessons?",
  "How much are private lessons?",
  "What can I learn in private lessons?",
  
  // Free Online Course & Photography Academy (4)
  "Do you have a free online course?",
  "What is the Photography Academy?",
  "How do I access the free course?",
  "What's included in the Photography Academy?",
  
  // Equipment (4)
  "What tripod do you recommend?",
  "What camera should I buy?",
  "What lens do you recommend for landscape photography?",
  "What equipment do I need for workshops?",
  
  // Advice (4)
  "What is ISO?",
  "What is the exposure triangle?",
  "How do I improve my photography?",
  "What are the best photography tips?"
];

async function callApi(url, question) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: question }),
    });
    if (!response.ok) {
      return { error: `HTTP ${response.status}: ${response.statusText}` };
    }
    const data = await response.json();
    return data;
  } catch (error) {
    return { error: error.message };
  }
}

function categorizeQuestion(question) {
  const q = question.toLowerCase();
  if (q.includes('alan ranger') || q.includes('based') || q.includes('business') || q.includes('contact') || q.includes('services')) {
    return 'General Business';
  } else if (q.includes('course') && !q.includes('free')) {
    return 'Courses';
  } else if (q.includes('workshop') || q.includes('devon') || q.includes('wales') || q.includes('yorkshire')) {
    return 'Workshops';
  } else if (q.includes('private lesson')) {
    return 'Private Lessons';
  } else if (q.includes('free') || q.includes('academy')) {
    return 'Free Course/Academy';
  } else if (q.includes('tripod') || q.includes('camera') || q.includes('lens') || q.includes('equipment')) {
    return 'Equipment';
  } else if (q.includes('iso') || q.includes('exposure') || q.includes('improve') || q.includes('tip')) {
    return 'Advice';
  }
  return 'Other';
}

async function runComprehensiveTest() {
  console.log("🧪 Comprehensive RAG Testing - 30 Questions Across All Categories");
  console.log("==================================================================");

  const results = [];
  const categoryStats = {};

  for (let i = 0; i < testQuestions.length; i++) {
    const question = testQuestions[i];
    const category = categorizeQuestion(question);
    
    console.log(`\n${i + 1}/30 - [${category}] Testing: "${question}"`);

    // Test current API
    console.log("  Testing current API...");
    const currentApiResponse = await callApi(CURRENT_API_URL, question);
    const currentApiAnswerLength = currentApiResponse?.answer?.length || 0;
    const currentApiType = currentApiResponse?.type || 'N/A';
    const currentApiConfidence = currentApiResponse?.confidence || 'N/A';

    // Test RAG API
    console.log("  Testing RAG API...");
    const ragApiResponse = await callApi(RAG_API_URL, question);
    const ragApiAnswerLength = ragApiResponse?.answer?.length || 0;
    const ragApiType = ragApiResponse?.type || 'N/A';
    const ragApiConfidence = ragApiResponse?.confidence || 'N/A';

    console.log(`  Current: ${currentApiType} (${currentApiConfidence}) - ${currentApiAnswerLength} chars`);
    console.log(`  RAG: ${ragApiType} (${ragApiConfidence}) - ${ragApiAnswerLength} chars`);

    // Calculate improvement
    let improvement = 0;
    let status = 'neutral';
    
    if (ragApiResponse.ok && currentApiResponse.ok) {
      improvement = ragApiAnswerLength - currentApiAnswerLength;
      if (improvement > 100) {
        status = 'major_improvement';
        console.log(`  ✅ Major RAG improvement: +${improvement} characters`);
      } else if (improvement > 0) {
        status = 'improvement';
        console.log(`  ✅ RAG improvement: +${improvement} characters`);
      } else if (improvement < -100) {
        status = 'regression';
        console.log(`  ❌ RAG regression: ${improvement} characters`);
      } else {
        status = 'neutral';
        console.log(`  ➖ Similar performance`);
      }
    } else if (ragApiResponse.ok && !currentApiResponse.ok) {
      status = 'fixed_error';
      console.log(`  ✅ RAG fixed an error from current API`);
    } else if (!ragApiResponse.ok && currentApiResponse.ok) {
      status = 'introduced_error';
      console.log(`  ❌ RAG introduced an error`);
    }

    // Track category stats
    if (!categoryStats[category]) {
      categoryStats[category] = {
        total: 0,
        improvements: 0,
        regressions: 0,
        fixed_errors: 0,
        introduced_errors: 0,
        totalImprovement: 0
      };
    }
    
    categoryStats[category].total++;
    if (status.includes('improvement') || status === 'fixed_error') {
      categoryStats[category].improvements++;
    }
    if (status === 'regression' || status === 'introduced_error') {
      categoryStats[category].regressions++;
    }
    if (status === 'fixed_error') {
      categoryStats[category].fixed_errors++;
    }
    if (status === 'introduced_error') {
      categoryStats[category].introduced_errors++;
    }
    categoryStats[category].totalImprovement += improvement;

    results.push({
      question,
      category,
      currentApi: {
        response: currentApiResponse,
        answerLength: currentApiAnswerLength,
        type: currentApiType,
        confidence: currentApiConfidence
      },
      ragApi: {
        response: ragApiResponse,
        answerLength: ragApiAnswerLength,
        type: ragApiType,
        confidence: ragApiConfidence
      },
      improvement: improvement,
      status: status
    });
  }

  // Calculate overall stats
  const workingRagCount = results.filter(r => r.ragApi.response.ok).length;
  const workingCurrentCount = results.filter(r => r.currentApi.response.ok).length;
  const totalRagAnswerLength = results.reduce((sum, r) => sum + (r.ragApi.response.ok ? r.ragApi.answerLength : 0), 0);
  const totalCurrentAnswerLength = results.reduce((sum, r) => sum + (r.currentApi.response.ok ? r.currentApi.answerLength : 0), 0);
  const totalImprovement = results.reduce((sum, r) => sum + r.improvement, 0);
  const majorImprovements = results.filter(r => r.status === 'major_improvement').length;
  const improvements = results.filter(r => r.status === 'improvement').length;
  const regressions = results.filter(r => r.status === 'regression').length;

  console.log("\n📊 COMPREHENSIVE TEST RESULTS:");
  console.log("==================================================================");
  console.log(`Total Questions: ${testQuestions.length}`);
  console.log(`RAG API working: ${workingRagCount}/${testQuestions.length} (${((workingRagCount / testQuestions.length) * 100).toFixed(0)}%)`);
  console.log(`Current API working: ${workingCurrentCount}/${testQuestions.length} (${((workingCurrentCount / testQuestions.length) * 100).toFixed(0)}%)`);
  console.log(`Average RAG answer length: ${Math.round(totalRagAnswerLength / workingRagCount || 0)} chars`);
  console.log(`Average current answer length: ${Math.round(totalCurrentAnswerLength / workingCurrentCount || 0)} chars`);
  console.log(`Total improvement: ${totalImprovement} chars`);
  console.log(`Major improvements (>100 chars): ${majorImprovements}`);
  console.log(`Minor improvements: ${improvements}`);
  console.log(`Regressions: ${regressions}`);

  console.log("\n📋 BY CATEGORY:");
  console.log("==================================================================");
  for (const category in categoryStats) {
    const stats = categoryStats[category];
    const avgImprovement = Math.round(stats.totalImprovement / stats.total);
    console.log(`\n${category}:`);
    console.log(`  Questions: ${stats.total}`);
    console.log(`  Improvements: ${stats.improvements}/${stats.total} (${((stats.improvements / stats.total) * 100).toFixed(0)}%)`);
    console.log(`  Regressions: ${stats.regressions}/${stats.total} (${((stats.regressions / stats.total) * 100).toFixed(0)}%)`);
    console.log(`  Average improvement: ${avgImprovement} chars`);
  }

  console.log("\n🎯 RAG APPROACH ASSESSMENT:");
  console.log("==================================================================");
  if (majorImprovements >= 10) {
    console.log(`✅ EXCELLENT: ${majorImprovements} major improvements - RAG approach is highly effective`);
  } else if (majorImprovements >= 5) {
    console.log(`✅ GOOD: ${majorImprovements} major improvements - RAG approach shows promise`);
  } else {
    console.log(`❌ NEEDS WORK: Only ${majorImprovements} major improvements - RAG approach needs refinement`);
  }

  if (regressions === 0) {
    console.log(`✅ NO REGRESSIONS: RAG approach doesn't break existing functionality`);
  } else {
    console.log(`⚠️  ${regressions} regressions detected - need to investigate`);
  }

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify({
    summary: {
      totalQuestions: testQuestions.length,
      workingRagCount,
      workingCurrentCount,
      totalRagAnswerLength,
      totalCurrentAnswerLength,
      totalImprovement,
      majorImprovements,
      improvements,
      regressions
    },
    categoryStats,
    results
  }, null, 2));
  
  console.log(`\n📁 Detailed results saved to: ${OUTPUT_JSON}`);
}

runComprehensiveTest();
