#!/usr/bin/env node

/**
 * Test the specific questions we fixed to verify they're working correctly
 */

const fs = require('fs');
const path = require('path');

// Try multiple env file locations
const envFiles = ['.env.local', '.env', '.env.production'];
for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    require('dotenv').config({ path: envFile });
    break;
  }
}

const API_ENDPOINT = process.env.API_ENDPOINT || 'https://alan-chat-proxy.vercel.app/api/chat';

// Questions we fixed with expected behavior
const fixedQuestions = [
  {
    id: 'Q18',
    question: "Do I need a laptop for the lightroom course",
    expected: {
      hasAnswer: true,
      answerContains: ['laptop', 'computer', 'Lightroom'],
      maxArticles: 0,
      maxServices: 0, // Should not have services
      maxEvents: 0 // Should not have events
    }
  },
  {
    id: 'Q19',
    question: "Is the online photography course really free",
    expected: {
      hasAnswer: true,
      answerContains: ['free', '60-module'],
      maxArticles: 0,
      maxEvents: 0,
      hasServices: true
    }
  },
  {
    id: 'Q20',
    question: "What courses do you offer for complete beginners?",
    expected: {
      hasAnswer: true,
      answerContains: ['course', 'beginners'],
      answerNotContains: ['workshop'], // Should talk about courses, not workshops
      maxArticles: 0,
      hasEvents: true,
      hasServices: true
    }
  },
  {
    id: 'Q21',
    question: "How many weeks is the beginners' photography course?",
    expected: {
      hasAnswer: true,
      answerContains: ['3', 'week'], // "3-week" is acceptable
      maxArticles: 0,
      hasServices: true
    }
  },
  {
    id: 'Q22',
    question: "How do I get personalised feedback on my images",
    expected: {
      hasAnswer: true,
      answerContains: ['feedback', '1-2-1', 'private'],
      maxArticles: 0,
      hasServices: true
    }
  },
  {
    id: 'Q23',
    question: "How can I contact you or book a discovery call?",
    expected: {
      hasAnswer: true,
      answerContains: ['contact', 'phone', 'email', 'address'],
      maxArticles: 0,
      hasServices: true, // Should have contact landing page
      serviceContains: ['contact']
    }
  },
  {
    id: 'Q25',
    question: "What is your cancellation or refund policy for courses/workshops?",
    expected: {
      hasAnswer: true,
      answerContains: ['cancellation', 'refund', 'policy'],
      maxArticles: 0,
      hasServices: true, // Should have terms/conditions landing page
      serviceContains: ['terms', 'conditions']
    }
  },
  {
    id: 'Q26',
    question: "Where is your gallery and can I submit my images for feedback?",
    expected: {
      hasAnswer: true,
      answerContains: ['gallery', 'feedback', '1-2-1', 'private'],
      maxArticles: 0,
      hasServices: true,
      serviceContains: ['private', 'lessons', '1-2-1']
    }
  },
  {
    id: 'Q30',
    question: "What is white balance and how do I use it?",
    expected: {
      hasAnswer: true,
      answerContains: ['white balance', 'color temperature'],
      hasArticles: true // Technical queries can have articles
    }
  },
  {
    id: 'Q33',
    question: "Where is Alan Ranger based?",
    expected: {
      hasAnswer: true,
      answerContains: ['Coventry', 'based'],
      maxArticles: 0,
      hasServices: true,
      serviceContains: ['about', 'alan']
    }
  }
];

async function testQuestion(testCase) {
  try {
    console.log(`\n🔍 Testing ${testCase.id}: "${testCase.question}"`);
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: testCase.question,
        sessionId: `test-${Date.now()}`
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Extract counts
    const structured = data.structured || {};
    const articles = (structured.articles || []).length;
    const services = (structured.services || []).length;
    const events = (structured.events || []).length;
    const products = (structured.products || []).length;
    
    const answer = data.answer || data.answer_markdown || '';
    const answerLower = answer.toLowerCase();
    
    // Check expectations
    const results = {
      id: testCase.id,
      question: testCase.question,
      passed: true,
      issues: [],
      details: {
        hasAnswer: answer.length > 0,
        answerLength: answer.length,
        confidence: data.confidence || 0,
        articles,
        services,
        events,
        products,
        answerPreview: answer.substring(0, 100) + (answer.length > 100 ? '...' : '')
      }
    };
    
    // Check answer exists
    if (!testCase.expected.hasAnswer && answer.length > 0) {
      results.passed = false;
      results.issues.push('Unexpected answer present');
    } else if (testCase.expected.hasAnswer && answer.length === 0) {
      results.passed = false;
      results.issues.push('Missing answer');
    }
    
    // Check answer content
    if (testCase.expected.answerContains) {
      for (const term of testCase.expected.answerContains) {
        if (!answerLower.includes(term.toLowerCase())) {
          results.passed = false;
          results.issues.push(`Answer missing expected term: "${term}"`);
        }
      }
    }
    
    // Check answer should NOT contain
    if (testCase.expected.answerNotContains) {
      for (const term of testCase.expected.answerNotContains) {
        if (answerLower.includes(term.toLowerCase())) {
          results.passed = false;
          results.issues.push(`Answer contains unexpected term: "${term}"`);
        }
      }
    }
    
    // Check articles
    if (testCase.expected.maxArticles !== undefined) {
      if (articles > testCase.expected.maxArticles) {
        results.passed = false;
        results.issues.push(`Too many articles: ${articles} (max: ${testCase.expected.maxArticles})`);
      }
    }
    if (testCase.expected.hasArticles === false && articles > 0) {
      results.passed = false;
      results.issues.push(`Should not have articles, but has ${articles}`);
    }
    
    // Check events
    if (testCase.expected.maxEvents !== undefined) {
      if (events > testCase.expected.maxEvents) {
        results.passed = false;
        results.issues.push(`Too many events: ${events} (max: ${testCase.expected.maxEvents})`);
      }
    }
    if (testCase.expected.hasEvents === false && events > 0) {
      results.passed = false;
      results.issues.push(`Should not have events, but has ${events}`);
    }
    
    // Check services
    if (testCase.expected.hasServices === false && services > 0) {
      results.passed = false;
      results.issues.push(`Should not have services, but has ${services}`);
    }
    if (testCase.expected.hasServices === true && services === 0) {
      results.passed = false;
      results.issues.push(`Should have services, but has none`);
    }
    
    // Check service content
    if (testCase.expected.serviceContains && services > 0) {
      const serviceTitles = (structured.services || []).map(s => (s.title || s.page_url || '').toLowerCase()).join(' ');
      let found = false;
      for (const term of testCase.expected.serviceContains) {
        if (serviceTitles.includes(term.toLowerCase())) {
          found = true;
          break;
        }
      }
      if (!found) {
        results.passed = false;
        results.issues.push(`Services should contain one of: ${testCase.expected.serviceContains.join(', ')}`);
        results.details.serviceTitles = (structured.services || []).map(s => s.title || s.page_url).slice(0, 3);
      }
    }
    
    return results;
  } catch (error) {
    return {
      id: testCase.id,
      question: testCase.question,
      passed: false,
      issues: [`Error: ${error.message}`],
      details: { error: error.message }
    };
  }
}

async function runTests() {
  console.log('🧪 Testing Fixed Questions');
  console.log('='.repeat(80));
  
  const results = [];
  
  for (const testCase of fixedQuestions) {
    const result = await testQuestion(testCase);
    results.push(result);
    
    // Show immediate feedback
    if (result.passed) {
      console.log(`✅ ${result.id}: PASSED`);
      console.log(`   Answer: ${result.details.answerPreview}`);
      console.log(`   Content: ${result.details.articles}A ${result.details.services}S ${result.details.events}E | Confidence: ${(result.details.confidence * 100).toFixed(0)}%`);
    } else {
      console.log(`❌ ${result.id}: FAILED`);
      result.issues.forEach(issue => console.log(`   - ${issue}`));
      console.log(`   Answer: ${result.details.answerPreview}`);
      console.log(`   Content: ${result.details.articles}A ${result.details.services}S ${result.details.events}E | Confidence: ${(result.details.confidence * 100).toFixed(0)}%`);
      if (result.details.serviceTitles) {
        console.log(`   Services found: ${result.details.serviceTitles.join(', ')}`);
      }
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED QUESTIONS:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`\n${r.id}: "${r.question}"`);
      r.issues.forEach(issue => console.log(`   - ${issue}`));
    });
  }
  
  return results;
}

runTests().catch(console.error);

