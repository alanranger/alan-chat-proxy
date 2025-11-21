/**
 * Script to run all 40 questions from interactive-testing-data.json
 * and display the results with full response quality details
 * 
 * Usage:
 *   node testing-scripts/run-40q-test.js
 * 
 * Environment variables:
 *   API_ENDPOINT - Chat API endpoint (default: http://localhost:3000/api/chat)
 *   NEXT_PUBLIC_SUPABASE_URL - Supabase URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY - Supabase anon key
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the 40 questions
const questionsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'interactive-testing-data.json'), 'utf8')
);

// Extract all questions
const allQuestions = [];
questionsData.categories.forEach(category => {
  category.questions.forEach(q => {
    allQuestions.push({
      question: q.question,
      category: q.category,
      focus: q.focus
    });
  });
});

console.log(`Found ${allQuestions.length} questions to test\n`);

// Get API endpoint from environment or use default
const API_ENDPOINT = process.env.API_ENDPOINT || 'http://localhost:3000/api/chat';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  process.exit(1);
}

// Results storage
const results = [];
let successCount = 0;
let failCount = 0;

// Function to call the chat API
async function testQuestion(question, index) {
  try {
    console.log(`[${index + 1}/${allQuestions.length}] Testing: "${question.question}"`);
    console.log(`  Category: ${question.category}`);
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        message: question.question,
        sessionId: `test-${Date.now()}-${index}`
      })
    });

    const data = await response.json();
    
    const result = {
      index: index + 1,
      question: question.question,
      category: question.category,
      focus: question.focus,
      status: response.status,
      success: response.status === 200 && data.success !== false,
      response: data,
      timestamp: new Date().toISOString()
    };

    // Analyze response quality
    if (data.response) {
      result.analysis = {
        responseType: data.response.type,
        confidence: data.response.confidence,
        hasAnswer: !!data.response.answer,
        answerLength: data.response.answer?.length || 0,
        sources: {
          events: data.response.sources?.events?.length || 0,
          articles: data.response.sources?.articles?.length || 0,
          products: data.response.sources?.products?.length || 0,
          services: data.response.sources?.services?.length || 0
        },
        structured: {
          events: data.response.structured?.events?.length || 0,
          articles: data.response.structured?.articles?.length || 0,
          products: data.response.structured?.products?.length || 0,
          services: data.response.structured?.services?.length || 0
        }
      };

      // Show sample sources
      if (data.response.sources?.events?.length > 0) {
        result.analysis.sampleEvent = {
          title: data.response.sources.events[0].title,
          date: data.response.sources.events[0].date,
          price: data.response.sources.events[0].price
        };
      }
      if (data.response.sources?.articles?.length > 0) {
        result.analysis.sampleArticle = {
          title: data.response.sources.articles[0].title,
          href: data.response.sources.articles[0].href
        };
      }
      if (data.response.sources?.products?.length > 0) {
        result.analysis.sampleProduct = {
          title: data.response.sources.products[0].title,
          price: data.response.sources.products[0].price
        };
      }
    }

    if (result.success) {
      successCount++;
      console.log(`  ✓ SUCCESS (${result.analysis?.confidence ? (result.analysis.confidence * 100).toFixed(1) + '%' : 'N/A'})`);
    } else {
      failCount++;
      console.log(`  ✗ FAILED (Status: ${response.status})`);
    }

    if (result.analysis) {
      console.log(`  Response Type: ${result.analysis.responseType}`);
      console.log(`  Sources: ${result.analysis.sources.events} events, ${result.analysis.sources.articles} articles, ${result.analysis.sources.products} products`);
      console.log(`  Answer Length: ${result.analysis.answerLength} chars`);
    }

    results.push(result);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
    
  } catch (error) {
    console.error(`  ✗ ERROR: ${error.message}`);
    results.push({
      index: index + 1,
      question: question.question,
      category: question.category,
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    failCount++;
  }
}

// Main execution
async function runAllTests() {
  console.log('='.repeat(80));
  console.log('40-Question Regression Test Runner');
  console.log('='.repeat(80));
  console.log(`API Endpoint: ${API_ENDPOINT}`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log('='.repeat(80));
  console.log('');

  const startTime = Date.now();

  // Run all questions sequentially
  for (let i = 0; i < allQuestions.length; i++) {
    await testQuestion(allQuestions[i], i);
    console.log('');
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Summary
  console.log('='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Questions: ${allQuestions.length}`);
  console.log(`Successful: ${successCount} (${((successCount / allQuestions.length) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failCount} (${((failCount / allQuestions.length) * 100).toFixed(1)}%)`);
  console.log(`Duration: ${duration} seconds`);
  console.log('='.repeat(80));

  // Calculate average confidence
  const confidences = results
    .filter(r => r.analysis?.confidence !== undefined)
    .map(r => r.analysis.confidence);
  
  if (confidences.length > 0) {
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    console.log(`Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
  }

  // Count by response type
  const responseTypes = {};
  results.forEach(r => {
    if (r.analysis?.responseType) {
      responseTypes[r.analysis.responseType] = (responseTypes[r.analysis.responseType] || 0) + 1;
    }
  });
  console.log('\nResponse Types:');
  Object.entries(responseTypes).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // Count sources
  const totalSources = {
    events: 0,
    articles: 0,
    products: 0,
    services: 0
  };
  results.forEach(r => {
    if (r.analysis?.sources) {
      totalSources.events += r.analysis.sources.events;
      totalSources.articles += r.analysis.sources.articles;
      totalSources.products += r.analysis.sources.products;
      totalSources.services += r.analysis.sources.services;
    }
  });
  console.log('\nTotal Sources Found:');
  console.log(`  Events: ${totalSources.events}`);
  console.log(`  Articles: ${totalSources.articles}`);
  console.log(`  Products: ${totalSources.products}`);
  console.log(`  Services: ${totalSources.services}`);

  // Failed questions
  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('FAILED QUESTIONS:');
    console.log('='.repeat(80));
    failed.forEach(f => {
      console.log(`\n[${f.index}] ${f.question}`);
      console.log(`  Category: ${f.category}`);
      if (f.error) {
        console.log(`  Error: ${f.error}`);
      } else if (f.status) {
        console.log(`  Status: ${f.status}`);
      }
    });
  }

  // Save detailed results to file
  const outputFile = path.join(__dirname, `test-results-${Date.now()}.json`);
  fs.writeFileSync(outputFile, JSON.stringify({
    summary: {
      total: allQuestions.length,
      successful: successCount,
      failed: failCount,
      successRate: (successCount / allQuestions.length) * 100,
      duration: duration,
      timestamp: new Date().toISOString()
    },
    results: results
  }, null, 2));
  
  console.log(`\nDetailed results saved to: ${outputFile}`);
  console.log('='.repeat(80));
}

// Run the tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

