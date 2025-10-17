#!/usr/bin/env node

/**
 * Baseline Capture Script
 * 
 * This script captures the current behavior of the live system
 * before any refactoring changes. This baseline will be used
 * to ensure no regressions occur during refactoring.
 */

import fs from 'fs';
import path from 'path';

const API_ENDPOINT = 'https://alan-chat-proxy.vercel.app/api/chat';

// Critical test cases that must not regress
const BASELINE_TESTS = [
  'When is the next Lightroom course in Coventry?',
  'What tripod do you recommend?',
  'How much is a residential photography workshop and does it include B&B?',
  'What photography workshops do you have?',
  'Do you have beginner photography courses?',
  'I want to learn photography',
  'What camera should I buy for landscape photography?',
  'Do you offer online photography courses?',
  'I need help with my camera',
  'asdfghjkl qwerty'
];

async function captureBaseline() {
  console.log('📸 Capturing baseline behavior...');
  console.log(`📡 Testing against: ${API_ENDPOINT}`);
  console.log(`📅 Baseline capture: ${new Date().toISOString()}`);

  const baseline = {
    timestamp: new Date().toISOString(),
    endpoint: API_ENDPOINT,
    tests: []
  };

  for (const query of BASELINE_TESTS) {
    console.log(`\n🔍 Capturing: "${query}"`);
    
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Capture key metrics
      const testResult = {
        query,
        timestamp: new Date().toISOString(),
        response: {
          type: data.type,
          confidence: data.confidence,
          hasEvents: Array.isArray(data.events) && data.events.length > 0,
          eventsCount: data.events?.length || 0,
          hasArticles: Array.isArray(data.structured?.articles) && data.structured.articles.length > 0,
          articlesCount: data.structured?.articles?.length || 0,
          hasClarification: data.type === 'clarification' || (data.structured?.clarification && data.structured.clarification.length > 0),
          answer: data.answer || null,
          debug: data.debug || null
        }
      };

      baseline.tests.push(testResult);
      console.log(`   ✅ Captured: ${data.type} (confidence: ${data.confidence})`);

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      baseline.tests.push({
        query,
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Save baseline
  const baselinePath = `baseline-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
  
  console.log(`\n📄 Baseline saved to: ${baselinePath}`);
  console.log(`📊 Captured ${baseline.tests.length} test cases`);
  
  return baselinePath;
}

// Run baseline capture
captureBaseline().catch(error => {
  console.error('💥 Baseline capture failed:', error);
  process.exit(1);
});
