#!/usr/bin/env node
/**
 * Complexity Validation Script
 * Run this BEFORE editing code to check current complexity status
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHAT_JS = path.join(__dirname, '..', 'api', 'chat.js');

console.log('🔍 Checking complexity status of chat.js...\n');

try {
  // Run ESLint complexity check
  const eslintOutput = execSync(
    `npx eslint "${CHAT_JS}" --rule='complexity: [2, 15]' --format=compact 2>&1`,
    { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
  );

  // Parse complexity violations
  const complexityLines = eslintOutput
    .split('\n')
    .filter(line => line.includes('complexity') && line.includes('chat.js'));

  const violations = complexityLines.filter(line => {
    const match = line.match(/complexity from (\d+)/);
    return match && parseInt(match[1]) > 15;
  });

  const atRisk = complexityLines.filter(line => {
    const match = line.match(/complexity from (\d+)/);
    return match && (parseInt(match[1]) === 14 || parseInt(match[1]) === 15);
  });

  // Display results
  if (violations.length === 0 && atRisk.length === 0) {
    console.log('✅ All functions meet complexity requirements (≤15)');
    console.log('✅ Safe to proceed with edits\n');
    process.exit(0);
  }

  if (violations.length > 0) {
    console.log(`❌ CRITICAL: ${violations.length} function(s) exceed complexity limit:\n`);
    violations.forEach(v => {
      const match = v.match(/chat\.js:(\d+):.*complexity from (\d+)/);
      if (match) {
        console.log(`   Line ${match[1]}: Complexity ${match[2]} (limit: 15)`);
      }
    });
    console.log('\n⚠️  STOP: Refactor these functions BEFORE making other changes\n');
    process.exit(1);
  }

  if (atRisk.length > 0) {
    console.log(`⚠️  WARNING: ${atRisk.length} function(s) at complexity limit (14-15):\n`);
    atRisk.forEach(v => {
      const match = v.match(/chat\.js:(\d+):.*complexity from (\d+)/);
      if (match) {
        console.log(`   Line ${match[1]}: Complexity ${match[2]} - EXTREME CAUTION if modifying`);
      }
    });
    console.log('\n⚠️  RECOMMENDATION: Extract helper functions BEFORE modifying these functions\n');
    process.exit(0);
  }
} catch (error) {
  console.error('❌ Error running complexity check:', error.message);
  process.exit(1);
}
