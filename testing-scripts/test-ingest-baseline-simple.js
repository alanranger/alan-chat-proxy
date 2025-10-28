#!/usr/bin/env node
/**
 * Simple Ingest Phase Baseline Test Script
 * Tests current system state before making changes
 */

import fs from 'fs';
import path from 'path';

console.log('🧪 INGEST PHASE BASELINE TEST');
console.log('================================');

async function runBaselineTest() {
// Test 1: Check current file sizes and dates

const filesToCheck = [
  'api/ingest.js',
  'api/csv-import.js', 
  'public/bulk-simple.html'
];

console.log('\n📁 Test 1: File Status');
filesToCheck.forEach(file => {
  try {
    const stats = fs.statSync(file);
    console.log(`✅ ${file}: ${stats.size} bytes, modified: ${stats.mtime}`);
  } catch (error) {
    console.log(`❌ ${file}: ${error.message}`);
  }
});

// Test 2: Check backup files
console.log('\n💾 Test 2: Backup Status');
const backupDir = 'backup/2025-10-19-ingest-phase';
try {
  const backupFiles = fs.readdirSync(backupDir);
  backupFiles.forEach(file => {
    const stats = fs.statSync(path.join(backupDir, file));
    console.log(`✅ ${file}: ${stats.size} bytes, created: ${stats.birthtime}`);
  });
} catch (error) {
  console.log(`❌ Backup directory: ${error.message}`);
}

// Test 3: Check complexity issues
console.log('\n🔍 Test 3: Complexity Check');
try {
  const { execSync } = await import('child_process');
  const complexityOutput = execSync('npx eslint api/ingest.js --format=json', { encoding: 'utf8' });
  const complexityData = JSON.parse(complexityOutput);
  const complexityIssues = complexityData[0]?.messages?.filter(msg => 
    msg.ruleId === 'sonarjs/cognitive-complexity' && msg.severity === 1
  ) || [];
  
  console.log(`✅ Complexity issues found: ${complexityIssues.length}`);
  complexityIssues.forEach(issue => {
    console.log(`   - Line ${issue.line}: Complexity ${issue.message.match(/from (\d+)/)?.[1] || 'unknown'}`);
  });
} catch (error) {
  console.log(`⚠️ Could not check complexity: ${error.message}`);
}

console.log('\n✅ BASELINE TEST COMPLETE');
console.log('\n📋 NEXT STEPS:');
console.log('1. Run database queries to get current state');
console.log('2. Begin Phase 1: Fix CSV category import bug');
console.log('3. Test each change against this baseline');
}

// Run the test
runBaselineTest().catch(console.error);
