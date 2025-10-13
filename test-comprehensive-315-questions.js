#!/usr/bin/env node

// Comprehensive Chat System Test Script - 315 Questions
// Tests all questions from the CSV file to identify gaps and issues

import { createClient } from "@supabase/supabase-js";
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Read test questions from CSV file
function loadTestQuestions() {
  try {
    const csvPath = path.join(process.cwd(), 'CSVSs from website', 'test quesitons.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    
    const questions = [];
    let currentCategory = '';
    
    for (let i = 1; i < lines.length; i++) { // Skip header
      const line = lines[i].trim();
      if (!line) continue;
      
      // Check if this is a category header (no comma, or starts with quotes)
      if (!line.includes(',') || line.startsWith('"') && !line.includes('",')) {
        currentCategory = line.replace(/"/g, '').replace(/,/g, '').trim();
        continue;
      }
      
      // Parse CSV line
      const parts = line.split(',');
      if (parts.length >= 1) {
        const query = parts[0].replace(/"/g, '').trim();
        if (query && query !== 'query' && !query.startsWith('General') && !query.startsWith('Courses') && !query.startsWith('Services') && !query.startsWith('Booking') && !query.startsWith('Technical')) {
          questions.push({
            query: query,
            category: currentCategory || 'General',
            lineNumber: i + 1
          });
        }
      }
    }
    
    return questions;
  } catch (error) {
    console.error('❌ Error loading test questions:', error.message);
    return [];
  }
}

// Test a single query
async function testQuery(question, index) {
  try {
    const response = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: question.query,
        pageContext: null
      })
    });

    if (!response.ok) {
      return {
        index: index + 1,
        query: question.query,
        category: question.category,
        status: 'error',
        error: `HTTP ${response.status}: ${response.statusText}`,
        confidence: 0
      };
    }

    const data = await response.json();
    
    // Analyze response quality
    const analysis = {
      index: index + 1,
      query: question.query,
      category: question.category,
      status: 'success',
      confidence: data.confidence || 0,
      hasAnswer: !!(data.answer_markdown && data.answer_markdown.trim()),
      answerLength: data.answer_markdown ? data.answer_markdown.length : 0,
      hasArticles: !!(data.structured && data.structured.articles && data.structured.articles.length > 0),
      hasProducts: !!(data.structured && data.structured.products && data.structured.products.length > 0),
      hasEvents: !!(data.structured && data.structured.events && data.structured.events.length > 0),
      articleCount: data.structured?.articles?.length || 0,
      productCount: data.structured?.products?.length || 0,
      eventCount: data.structured?.events?.length || 0,
      responseTime: data.meta?.duration_ms || 0
    };

    // Check for malformed content
    if (data.answer_markdown) {
      analysis.hasMalformedContent = data.answer_markdown.includes('ALAN+RANGER+photography+LOGO+BLACK') || 
                                   data.answer_markdown.includes('rotto 405') ||
                                   data.answer_markdown.includes('gitzo gt3532ls');
    }

    // Check if answer is too short (likely not helpful)
    analysis.isTooShort = analysis.answerLength < 50;

    // Check if confidence is too low (confidence is a decimal 0-1, so 0.6 = 60%)
    analysis.isLowConfidence = analysis.confidence < 0.6;

    return analysis;

  } catch (error) {
    return {
      index: index + 1,
      query: question.query,
      category: question.category,
      status: 'error',
      error: error.message,
      confidence: 0
    };
  }
}

// Main test function
async function runComprehensiveTests() {
  console.log('🚀 Starting Comprehensive Chat System Tests - 315 Questions from CSV\n');
  
  // Load test questions
  const questions = loadTestQuestions();
  console.log(`📋 Loaded ${questions.length} test questions from CSV file\n`);
  
  if (questions.length === 0) {
    console.log('❌ No questions loaded. Check CSV file path and format.');
    return;
  }

  // Test database connectivity first
  console.log('🔍 Testing Database Data Quality...\n');
  
  try {
    const csvCount = await supa.from('csv_metadata').select('*', { count: 'exact' });
    const entityCount = await supa.from('page_entities').select('*', { count: 'exact' });
    const articleCount = await supa.from('v_articles_unified').select('*', { count: 'exact' });
    
    console.log(`1. CSV Metadata: ${csvCount.count} records`);
    console.log(`2. Page Entities: ${entityCount.count} records`);
    console.log(`3. Articles View: ${articleCount.count} records\n`);
  } catch (error) {
    console.log('⚠️ Database connectivity test failed:', error.message);
  }

  // Run tests in batches to avoid overwhelming the API
  const BATCH_SIZE = 10;
  const results = [];
  let successCount = 0;
  let errorCount = 0;
  let malformedCount = 0;
  let lowConfidenceCount = 0;
  let tooShortCount = 0;

  console.log('🧪 Running comprehensive tests...\n');

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);
    console.log(`📊 Testing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(questions.length / BATCH_SIZE)} (questions ${i + 1}-${Math.min(i + BATCH_SIZE, questions.length)})`);
    
    const batchPromises = batch.map((question, batchIndex) => 
      testQuery(question, i + batchIndex)
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Update counters
    batchResults.forEach(result => {
      if (result.status === 'success') {
        successCount++;
        if (result.hasMalformedContent) malformedCount++;
        if (result.isLowConfidence) lowConfidenceCount++;
        if (result.isTooShort) tooShortCount++;
      } else {
        errorCount++;
      }
    });
    
    // Show progress
    const progress = ((i + BATCH_SIZE) / questions.length * 100).toFixed(1);
    console.log(`   Progress: ${progress}% (${successCount} success, ${errorCount} errors)\n`);
    
    // Small delay between batches
    if (i + BATCH_SIZE < questions.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Generate comprehensive report
  console.log('\n📊 COMPREHENSIVE TEST RESULTS SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Questions Tested: ${questions.length}`);
  console.log(`Successful Responses: ${successCount} (${(successCount/questions.length*100).toFixed(1)}%)`);
  console.log(`Errors: ${errorCount} (${(errorCount/questions.length*100).toFixed(1)}%)`);
  console.log(`Malformed Content: ${malformedCount} (${(malformedCount/questions.length*100).toFixed(1)}%)`);
  console.log(`Low Confidence (<60%): ${lowConfidenceCount} (${(lowConfidenceCount/questions.length*100).toFixed(1)}%)`);
  console.log(`Too Short Responses: ${tooShortCount} (${(tooShortCount/questions.length*100).toFixed(1)}%)`);

  // Category breakdown
  const categoryStats = {};
  results.forEach(result => {
    if (!categoryStats[result.category]) {
      categoryStats[result.category] = { total: 0, success: 0, errors: 0, malformed: 0, lowConfidence: 0, tooShort: 0 };
    }
    categoryStats[result.category].total++;
    if (result.status === 'success') {
      categoryStats[result.category].success++;
      if (result.hasMalformedContent) categoryStats[result.category].malformed++;
      if (result.isLowConfidence) categoryStats[result.category].lowConfidence++;
      if (result.isTooShort) categoryStats[result.category].tooShort++;
    } else {
      categoryStats[result.category].errors++;
    }
  });

  console.log('\n📈 Results by Category:');
  Object.entries(categoryStats).forEach(([category, stats]) => {
    const successRate = (stats.success / stats.total * 100).toFixed(1);
    console.log(`   ${category}: ${stats.success}/${stats.total} (${successRate}%)`);
    if (stats.malformed > 0) console.log(`     - Malformed: ${stats.malformed}`);
    if (stats.lowConfidence > 0) console.log(`     - Low Confidence: ${stats.lowConfidence}`);
    if (stats.tooShort > 0) console.log(`     - Too Short: ${stats.tooShort}`);
    if (stats.errors > 0) console.log(`     - Errors: ${stats.errors}`);
  });

  // Show worst performing queries
  const problematicQueries = results.filter(r => 
    r.status === 'error' || 
    r.hasMalformedContent || 
    r.isLowConfidence || 
    r.isTooShort
  ).slice(0, 20);

  if (problematicQueries.length > 0) {
    console.log('\n⚠️ Problematic Queries (Top 20):');
    problematicQueries.forEach(result => {
      const issues = [];
      if (result.status === 'error') issues.push('ERROR');
      if (result.hasMalformedContent) issues.push('MALFORMED');
      if (result.isLowConfidence) issues.push('LOW_CONFIDENCE');
      if (result.isTooShort) issues.push('TOO_SHORT');
      
      console.log(`   ${result.index}. [${result.category}] "${result.query}" - ${issues.join(', ')}`);
    });
  }

  // Show best performing queries
  const bestQueries = results.filter(r => 
    r.status === 'success' && 
    !r.hasMalformedContent && 
    !r.isLowConfidence && 
    !r.isTooShort &&
    r.confidence >= 80
  ).slice(0, 10);

  if (bestQueries.length > 0) {
    console.log('\n✅ Best Performing Queries (Top 10):');
    bestQueries.forEach(result => {
      console.log(`   ${result.index}. [${result.category}] "${result.query}" - ${result.confidence}% confidence`);
    });
  }

  // Overall assessment
  const overallSuccessRate = (successCount / questions.length * 100);
  console.log('\n🎯 Overall Assessment:');
  if (overallSuccessRate >= 90) {
    console.log('🎉 EXCELLENT - System is performing very well!');
  } else if (overallSuccessRate >= 80) {
    console.log('✅ GOOD - System is performing well with minor issues');
  } else if (overallSuccessRate >= 70) {
    console.log('⚠️ FAIR - System needs improvement in several areas');
  } else {
    console.log('❌ POOR - System has significant issues that need attention');
  }

  console.log('\n🏁 Comprehensive testing complete!');
}

// Run the tests
runComprehensiveTests().catch(console.error);
