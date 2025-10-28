#!/usr/bin/env node

/**
 * Baseline Comparison Script
 * 
 * This script compares current system behavior against a captured baseline
 * to detect any regressions during refactoring.
 */

import fs from 'fs';
import path from 'path';

const API_ENDPOINT = 'https://alan-chat-proxy.vercel.app/api/chat';

async function compareAgainstBaseline(baselinePath) {
  console.log('🔍 Comparing against baseline...');
  
  // Load baseline
  if (!fs.existsSync(baselinePath)) {
    console.error(`❌ Baseline file not found: ${baselinePath}`);
    console.log('💡 Run capture-baseline.js first to create a baseline');
    process.exit(1);
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  console.log(`📄 Loaded baseline from: ${baselinePath}`);
  console.log(`📅 Baseline date: ${baseline.timestamp}`);

  const comparison = {
    timestamp: new Date().toISOString(),
    baselinePath,
    baselineTimestamp: baseline.timestamp,
    results: []
  };

  let regressions = 0;
  let improvements = 0;
  let unchanged = 0;

  for (const baselineTest of baseline.tests) {
    if (baselineTest.error) {
      console.log(`\n⚠️  Skipping test with baseline error: "${baselineTest.query}"`);
      continue;
    }

    console.log(`\n🔍 Testing: "${baselineTest.query}"`);
    
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: baselineTest.query })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const currentData = await response.json();
      
      // Compare with baseline
      const current = {
        type: currentData.type,
        confidence: currentData.confidence,
        hasEvents: Array.isArray(currentData.events) && currentData.events.length > 0,
        eventsCount: currentData.events?.length || 0,
        hasArticles: Array.isArray(currentData.structured?.articles) && currentData.structured.articles.length > 0,
        articlesCount: currentData.structured?.articles?.length || 0,
        hasClarification: currentData.type === 'clarification' || (currentData.structured?.clarification && currentData.structured.clarification.length > 0)
      };

      const baselineResponse = baselineTest.response;
      
      // Check for regressions
      const regression = {
        type: current.type !== baselineResponse.type,
        confidence: Math.abs(current.confidence - baselineResponse.confidence) > 0.2,
        events: baselineResponse.hasEvents && !current.hasEvents,
        articles: baselineResponse.hasArticles && !current.hasArticles,
        clarification: baselineResponse.hasClarification && !current.hasClarification
      };

      const hasRegression = Object.values(regression).some(Boolean);
      const hasImprovement = (
        (!baselineResponse.hasEvents && current.hasEvents) ||
        (!baselineResponse.hasArticles && current.hasArticles) ||
        (baselineResponse.confidence < 0.5 && current.confidence > 0.5)
      );

      const result = {
        query: baselineTest.query,
        baseline: baselineResponse,
        current,
        regression,
        hasRegression,
        hasImprovement,
        status: hasRegression ? 'REGRESSION' : hasImprovement ? 'IMPROVEMENT' : 'UNCHANGED'
      };

      comparison.results.push(result);

      // Log result
      if (hasRegression) {
        console.log(`   ❌ REGRESSION DETECTED`);
        if (regression.type) {
          console.log(`     - Type changed: ${baselineResponse.type} → ${current.type}`);
        }
        if (regression.confidence) {
          console.log(`     - Confidence changed: ${baselineResponse.confidence} → ${current.confidence}`);
        }
        if (regression.events) {
          console.log(`     - Events lost: had ${baselineResponse.eventsCount}, now ${current.eventsCount}`);
        }
        if (regression.articles) {
          console.log(`     - Articles lost: had ${baselineResponse.articlesCount}, now ${current.articlesCount}`);
        }
        if (regression.clarification) {
          console.log(`     - Clarification lost`);
        }
        regressions++;
      } else if (hasImprovement) {
        console.log(`   ✅ IMPROVEMENT DETECTED`);
        improvements++;
      } else {
        console.log(`   ✅ UNCHANGED`);
        unchanged++;
      }

    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      comparison.results.push({
        query: baselineTest.query,
        error: error.message,
        status: 'ERROR'
      });
      regressions++;
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Generate summary
  console.log('\n📊 COMPARISON SUMMARY');
  console.log('='.repeat(50));
  console.log(`❌ Regressions: ${regressions}`);
  console.log(`✅ Improvements: ${improvements}`);
  console.log(`➖ Unchanged: ${unchanged}`);
  console.log(`📈 Total tests: ${comparison.results.length}`);

  // Save comparison results
  const comparisonPath = `comparison-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(comparisonPath, JSON.stringify(comparison, null, 2));
  console.log(`\n📄 Comparison results saved to: ${comparisonPath}`);

  // Exit with error code if regressions detected
  if (regressions > 0) {
    console.log('\n❌ REGRESSIONS DETECTED - DO NOT DEPLOY');
    process.exit(1);
  } else {
    console.log('\n✅ NO REGRESSIONS DETECTED - SAFE TO DEPLOY');
    process.exit(0);
  }
}

// Get baseline path from command line argument
const baselinePath = process.argv[2];
if (!baselinePath) {
  console.error('❌ Please provide baseline file path');
  console.log('💡 Usage: node compare-against-baseline.js <baseline-file>');
  process.exit(1);
}

// Run comparison
compareAgainstBaseline(baselinePath).catch(error => {
  console.error('💥 Comparison failed:', error);
  process.exit(1);
});
