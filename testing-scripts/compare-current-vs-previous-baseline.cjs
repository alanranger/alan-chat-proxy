#!/usr/bin/env node
/**
 * Compare current test results with previous baseline CSV to identify all differences
 */

const fs = require('fs');
const path = require('path');

const resultsDir = 'testing-scripts/test results';

// Previous baseline CSV
const previousCsvPath = path.join(resultsDir, 'side-by-side-40q-oct28-baseline-vs-current-1761986082566.csv');

// Current test results JSON
const currentJsonPath = path.join(resultsDir, 'baseline-40-question-interactive-subset-2025-11-01T11-00-51-415Z.json');

console.log('📊 COMPARING CURRENT ANSWERS vs PREVIOUS BASELINE');
console.log('='.repeat(80));
console.log(`Previous: ${path.basename(previousCsvPath)}`);
console.log(`Current: ${path.basename(currentJsonPath)}\n`);

// Read previous CSV
const previousCsv = fs.readFileSync(previousCsvPath, 'utf8');
const previousLines = previousCsv.split('\n').filter(l => l.trim());

// Parse CSV header
const headers = previousLines[0].split(',').map(h => h.replace(/"/g, '').trim());

// Find column indices
const questionIdx = headers.indexOf('Question');
const currentAnswerIdx = headers.indexOf('Current Answer (Snippet)');
const currentStatusIdx = headers.indexOf('Current Status');

// Parse previous CSV data
const previousData = new Map();
for (let i = 1; i < previousLines.length; i++) {
  const line = previousLines[i];
  // Simple CSV parsing (handles quoted fields)
  const fields = [];
  let current = '';
  let inQuotes = false;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  
  if (fields.length > questionIdx) {
    const question = fields[questionIdx].replace(/^"|"$/g, '');
    const currentAnswer = fields[currentAnswerIdx]?.replace(/^"|"$/g, '').trim() || '';
    const currentStatus = fields[currentStatusIdx]?.replace(/^"|"$/g, '').trim() || '';
    
    previousData.set(question.toLowerCase().trim(), {
      question,
      answer: currentAnswer,
      status: currentStatus
    });
  }
}

// Read current JSON
const currentData = JSON.parse(fs.readFileSync(currentJsonPath, 'utf8'));

// Compare
const differences = [];

currentData.results.forEach((current, idx) => {
  const question = (current.query || '').trim();
  const lcQuestion = question.toLowerCase();
  const previous = previousData.get(lcQuestion);
  
  if (!previous) {
    console.warn(`⚠️  Question not found in previous CSV: "${question}"`);
    return;
  }
  
  const currentAnswer = String(current.response?.answer || '').trim();
  const previousAnswer = previous.answer.trim();
  
  // Normalize for comparison (remove extra whitespace, etc.)
  const normalizedCurrent = currentAnswer.replace(/\s+/g, ' ').trim();
  const normalizedPrevious = previousAnswer.replace(/\s+/g, ' ').trim();
  
  if (normalizedCurrent !== normalizedPrevious) {
    const currentStatus = current.response?.success && currentAnswer.length > 0 ? 'Pass' : 'Fail';
    const previousStatus = previous.status;
    
    // Analyze if it's better or worse
    let changeType = 'Changed';
    let betterOrWorse = 'Unknown';
    
    // Check for generic service responses (regression indicator)
    const genericServiceResponse = /I offer a range of photography services/i.test(currentAnswer);
    const wrongRouting = genericServiceResponse && !question.toLowerCase().includes('services') && !question.toLowerCase().includes('types');
    
    if (previousStatus === 'Fail' && currentStatus === 'Pass') {
      if (wrongRouting) {
        changeType = 'Content Worsened';
        betterOrWorse = '❌ Worse (Fixed but wrong routing - generic service response)';
      } else {
        changeType = 'Improved';
        betterOrWorse = '✅ Better (Fixed)';
      }
    } else if (previousStatus === 'Pass' && currentStatus === 'Fail') {
      changeType = 'Worsened';
      betterOrWorse = '❌ Worse (Broken)';
    } else if (previousStatus === 'Pass' && currentStatus === 'Pass') {
      // Both pass - check content quality
      const previousGeneric = previousAnswer.includes('Based on Alan Ranger') || previousAnswer.includes('I offer a range');
      const currentGeneric = currentAnswer.includes('Based on Alan Ranger') || currentAnswer.includes('I offer a range');
      
      // Check for wrong routing to services
      if (wrongRouting && !previousGeneric) {
        changeType = 'Content Worsened';
        betterOrWorse = '❌ Worse (Wrong routing - now generic service response)';
      } else if (previousGeneric && !currentGeneric && !wrongRouting) {
        changeType = 'Content Improved';
        betterOrWorse = '✅ Better (More specific content)';
      } else if (!previousGeneric && currentGeneric) {
        changeType = 'Content Worsened';
        betterOrWorse = '❌ Worse (More generic)';
      } else if (currentAnswer.length === 0 && previousAnswer.length > 0) {
        changeType = 'Worsened';
        betterOrWorse = '❌ Worse (Answer became empty)';
      } else {
        changeType = 'Changed';
        betterOrWorse = '⚠️  Changed (Need review)';
      }
    }
    
    differences.push({
      question: question,
      questionNum: idx + 1,
      previousAnswer: previousAnswer.substring(0, 200),
      currentAnswer: currentAnswer.substring(0, 200),
      previousStatus,
      currentStatus,
      changeType,
      betterOrWorse
    });
  }
});

// Sort by question number
differences.sort((a, b) => a.questionNum - b.questionNum);

// Output results
console.log(`\n📋 FOUND ${differences.length} QUESTIONS WITH DIFFERENT ANSWERS:\n`);

differences.forEach((diff, idx) => {
  console.log(`${idx + 1}. Q${diff.questionNum}: ${diff.betterOrWorse}`);
  console.log(`   Question: "${diff.question}"`);
  console.log(`   Status: ${diff.previousStatus} → ${diff.currentStatus}`);
  console.log(`   Change Type: ${diff.changeType}`);
  console.log(`\n   Previous Answer (first 200 chars):`);
  console.log(`   ${diff.previousAnswer}...`);
  console.log(`\n   Current Answer (first 200 chars):`);
  console.log(`   ${diff.currentAnswer}...`);
  console.log('\n' + '-'.repeat(80) + '\n');
});

// Summary
const improved = differences.filter(d => d.changeType === 'Improved' || d.changeType === 'Content Improved').length;
const worsened = differences.filter(d => d.changeType === 'Worsened' || d.changeType === 'Content Worsened').length;
const changed = differences.filter(d => d.changeType === 'Changed').length;

console.log('\n📊 SUMMARY:');
console.log(`   Total differences: ${differences.length}`);
console.log(`   ✅ Improved: ${improved}`);
console.log(`   ❌ Worsened: ${worsened}`);
console.log(`   ⚠️  Changed (need review): ${changed}`);

// List worsened questions
if (worsened > 0) {
  console.log('\n❌ WORSTENED QUESTIONS (Priority to fix):');
  differences.filter(d => d.changeType === 'Worsened' || d.changeType === 'Content Worsened').forEach(diff => {
    console.log(`   Q${diff.questionNum}: "${diff.question}"`);
  });
}

process.exit(0);

