#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const resultsFile = 'testing-scripts/test results/baseline-40-question-interactive-subset-2025-11-01T11-38-44-658Z.json';
const data = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));

console.log('🔍 QUESTIONS THAT MIGHT REFERENCE ARTICLES WITHOUT EXPLANATIONS:\n');
console.log('='.repeat(80));

const suspiciousQuestions = [];

data.results.forEach((r, i) => {
  const ans = String(r.response?.answer || '').trim();
  const query = r.query;
  
  // Check for various patterns that might indicate URL/article reference issues
  const hasArticleReference = 
    ans.includes('*For detailed information') ||
    ans.includes('read the full guide') ||
    ans.includes('Article Information') ||
    ans.includes('[http') ||
    ans.includes('www.alanranger.com/') ||
    (ans.includes('Based on Alan Ranger') && ans.length < 300);
  
  // Check if it's mostly just a reference (not substantial explanation)
  const isMostlyReference = 
    ans.length < 250 || // Short answers
    (ans.split('\n').filter(line => line.trim().length > 0).length < 3) || // Few lines
    (ans.includes('*For detailed information') && ans.length < 300) ||
    (ans.includes('Based on Alan Ranger') && !ans.includes('**') && ans.length < 250);
  
  if (hasArticleReference) {
    // Show all questions with article references so user can review
    suspiciousQuestions.push({
      questionNum: i + 1,
      question: query,
      answer: ans,
      answerLength: ans.length,
      hasSubstantialContent: ans.includes('**') && ans.length > 400,
      lineCount: ans.split('\n').filter(line => line.trim().length > 0).length
    });
  }
});

if (suspiciousQuestions.length === 0) {
  console.log('✅ No questions found with article references!');
} else {
  suspiciousQuestions.forEach(item => {
    const status = item.hasSubstantialContent ? '✅ Has content' : '⚠️  Suspicious';
    console.log(`\nQ${item.questionNum}: "${item.question}"`);
    console.log(`   ${status} - Length: ${item.answerLength} chars, Lines: ${item.lineCount}`);
    console.log(`   Answer:`);
    // Show full answer but truncate if very long
    const displayAnswer = item.answerLength > 500 ? item.answer.substring(0, 500) + '...' : item.answer;
    console.log(`   ${displayAnswer.split('\n').join('\n   ')}`);
    console.log(`   ${'-'.repeat(78)}`);
  });
  
  const suspiciousCount = suspiciousQuestions.filter(q => !q.hasSubstantialContent).length;
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total with article references: ${suspiciousQuestions.length}`);
  console.log(`   ⚠️  Suspicious (may need fixing): ${suspiciousCount}`);
  console.log(`   ✅ Has substantial content: ${suspiciousQuestions.length - suspiciousCount}`);
}
