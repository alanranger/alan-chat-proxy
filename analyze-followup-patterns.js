/**
 * ANALYZE FOLLOW-UP PATTERNS
 * 
 * This script analyzes all user follow-up responses from the 20-question dataset
 * to understand the patterns we need to handle in the follow-up system.
 */

import fs from 'fs';

// Load the complete 20-question dataset
const testData = JSON.parse(fs.readFileSync('chatbot-test-results-2025-10-14 (3).json', 'utf8'));

console.log("🔍 ANALYZING FOLLOW-UP PATTERNS");
console.log("===============================");

const followUpPatterns = [];

// Extract all follow-up responses
testData.testResults.forEach((question, index) => {
  if (question.userFollowUpResponse) {
    followUpPatterns.push({
      questionId: question.questionId,
      category: question.category,
      userQuestion: question.userQuestion,
      userFollowUpResponse: question.userFollowUpResponse,
      expectedIntent: question.businessOwnerResponse.expectedIntent,
      expectedKind: question.businessOwnerResponse.expectedKind
    });
  }
});

console.log(`\n📊 Found ${followUpPatterns.length} follow-up responses to analyze:`);

// Group by patterns
const patternGroups = {
  "online_courses": [],
  "specific_course_types": [],
  "workshop_types": [],
  "equipment_advice": [],
  "about_information": [],
  "service_types": [],
  "technical_help": [],
  "location_preferences": [],
  "beginner_focus": [],
  "pricing_information": [],
  "other": []
};

followUpPatterns.forEach(pattern => {
  const response = pattern.userFollowUpResponse.toLowerCase();
  
  if (response.includes("online") || response.includes("can't get to coventry")) {
    patternGroups.online_courses.push(pattern);
  } else if (response.includes("camera course") || response.includes("editing course")) {
    patternGroups.specific_course_types.push(pattern);
  } else if (response.includes("bluebell") || response.includes("outdoor")) {
    patternGroups.workshop_types.push(pattern);
  } else if (response.includes("camera") || response.includes("lens") || response.includes("sony")) {
    patternGroups.equipment_advice.push(pattern);
  } else if (response.includes("alan") || response.includes("teaching") || response.includes("qualified")) {
    patternGroups.about_information.push(pattern);
  } else if (response.includes("private") || response.includes("lessons") || response.includes("shifts")) {
    patternGroups.service_types.push(pattern);
  } else if (response.includes("exposure") || response.includes("manual") || response.includes("settings")) {
    patternGroups.technical_help.push(pattern);
  } else if (response.includes("birmingham") || response.includes("close to")) {
    patternGroups.location_preferences.push(pattern);
  } else if (response.includes("beginner") || response.includes("complete beginners")) {
    patternGroups.beginner_focus.push(pattern);
  } else if (response.includes("cost") || response.includes("price") || response.includes("how much")) {
    patternGroups.pricing_information.push(pattern);
  } else {
    patternGroups.other.push(pattern);
  }
});

// Display analysis
Object.entries(patternGroups).forEach(([group, patterns]) => {
  if (patterns.length > 0) {
    console.log(`\n📋 ${group.toUpperCase().replace('_', ' ')} (${patterns.length} patterns):`);
    patterns.forEach(pattern => {
      console.log(`   Q${pattern.questionId}: "${pattern.userFollowUpResponse}"`);
      console.log(`      → Expected: ${pattern.expectedIntent} (${pattern.expectedKind})`);
    });
  }
});

// Generate follow-up handler patterns
console.log(`\n🔧 FOLLOW-UP HANDLER PATTERNS NEEDED:`);
console.log("=====================================");

const handlerPatterns = [];

Object.entries(patternGroups).forEach(([group, patterns]) => {
  if (patterns.length > 0) {
    console.log(`\n// ${group.toUpperCase().replace('_', ' ')} PATTERNS`);
    patterns.forEach(pattern => {
      const response = pattern.userFollowUpResponse.toLowerCase();
      const expectedIntent = pattern.expectedIntent;
      const expectedKind = pattern.expectedKind;
      
      // Generate pattern matching logic
      let patternMatch = '';
      if (response.includes("online")) {
        patternMatch = 'lc.includes("online")';
      } else if (response.includes("camera course")) {
        patternMatch = 'lc.includes("camera course")';
      } else if (response.includes("bluebell")) {
        patternMatch = 'lc.includes("bluebell")';
      } else if (response.includes("sony")) {
        patternMatch = 'lc.includes("sony")';
      } else if (response.includes("teaching")) {
        patternMatch = 'lc.includes("teaching")';
      } else if (response.includes("private")) {
        patternMatch = 'lc.includes("private")';
      } else if (response.includes("exposure")) {
        patternMatch = 'lc.includes("exposure")';
      } else if (response.includes("birmingham")) {
        patternMatch = 'lc.includes("birmingham")';
      } else if (response.includes("beginner")) {
        patternMatch = 'lc.includes("beginner")';
      } else if (response.includes("cost")) {
        patternMatch = 'lc.includes("cost")';
      } else {
        // Use key words from the response
        const words = response.split(' ').filter(word => word.length > 3);
        patternMatch = words.slice(0, 2).map(word => `lc.includes("${word}")`).join(' && ');
      }
      
      console.log(`if (${patternMatch}) {`);
      console.log(`  return {`);
      console.log(`    type: "route_to_${expectedIntent}",`);
      console.log(`    newQuery: "${response}",`);
      console.log(`    newIntent: "${expectedIntent}"`);
      console.log(`  };`);
      console.log(`}`);
      
      handlerPatterns.push({
        pattern: patternMatch,
        response: response,
        intent: expectedIntent,
        kind: expectedKind
      });
    });
  }
});

// Save analysis
const analysis = {
  timestamp: new Date().toISOString(),
  totalFollowUps: followUpPatterns.length,
  patternGroups,
  handlerPatterns
};

fs.writeFileSync('followup-patterns-analysis.json', JSON.stringify(analysis, null, 2));
console.log("\n📄 Analysis saved to: followup-patterns-analysis.json");

export { followUpPatterns, patternGroups, handlerPatterns };
