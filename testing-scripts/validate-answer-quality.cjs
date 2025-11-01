#!/usr/bin/env node
/**
 * Validate answer quality - checks for generic responses and wrong routing
 * This should be run as part of test validation to catch regressions
 */

const fs = require('fs');
const path = require('path');

function validateAnswerQuality(question, answer, type, sources) {
  const errors = [];
  const warnings = [];
  const answerStr = String(answer || '').trim();
  const questionLower = question.toLowerCase();
  
  // Check 1: Empty answers
  if (answerStr.length === 0) {
    errors.push('Empty answer');
    return { errors, warnings, valid: false };
  }
  
  // Check 2: Generic service responses for non-service queries
  const genericServicePattern = /I offer a range of photography services/i;
  const isServiceQuery = questionLower.includes('services') || 
                         questionLower.includes('what types') ||
                         questionLower.includes('what kind of');
  
  if (genericServicePattern.test(answerStr) && !isServiceQuery) {
    errors.push('Wrong routing: Generic service response for non-service query');
  }
  
  // Check 3: Technical queries should have technical content
  const isTechnicalQuery = questionLower.includes('what is') && (
    questionLower.includes('exposure') || questionLower.includes('iso') ||
    questionLower.includes('aperture') || questionLower.includes('raw') ||
    questionLower.includes('white balance') || questionLower.includes('hdr') ||
    questionLower.includes('depth of field') || questionLower.includes('flash')
  ) || questionLower.includes('how do i') && (
    questionLower.includes('edit') || questionLower.includes('improve') ||
    questionLower.includes('use flash')
  );
  
  if (isTechnicalQuery) {
    const hasTechnicalContent = answerStr.toLowerCase().includes('exposure') ||
                               answerStr.toLowerCase().includes('iso') ||
                               answerStr.toLowerCase().includes('aperture') ||
                               answerStr.toLowerCase().includes('shutter') ||
                               answerStr.toLowerCase().includes('raw') ||
                               answerStr.toLowerCase().includes('composition') ||
                               answerStr.toLowerCase().includes('flash') ||
                               answerStr.toLowerCase().includes('white balance') ||
                               answerStr.toLowerCase().includes('depth of field');
    
    if (!hasTechnicalContent && genericServicePattern.test(answerStr)) {
      errors.push('Technical query returned generic service response (wrong routing)');
    } else if (!hasTechnicalContent) {
      warnings.push('Technical query may lack technical content');
    }
  }
  
  // Check 4: Person queries should have person information
  const isPersonQuery = questionLower.includes('alan ranger') || 
                        questionLower.includes('who is') ||
                        questionLower.includes('where is alan');
  
  if (isPersonQuery && genericServicePattern.test(answerStr)) {
    errors.push('Person query returned generic service response (wrong routing)');
  }
  
  // Check 5: Generic fallback patterns
  const genericPatterns = [
    /Based on Alan Ranger's expertise, here's what you need to know about your question/i,
    /I can't find a reliable answer/i
  ];
  
  for (const pattern of genericPatterns) {
    if (pattern.test(answerStr)) {
      warnings.push('Generic fallback response detected');
      break;
    }
  }
  
  // Check 6: Wrong article content (e.g., ISO content for lens query)
  if (questionLower.includes('prime') && questionLower.includes('zoom')) {
    if (answerStr.toLowerCase().includes('jpeg') && answerStr.toLowerCase().includes('raw') && 
        !answerStr.toLowerCase().includes('prime') && !answerStr.toLowerCase().includes('zoom')) {
      errors.push('Wrong content: JPEG/RAW content for lens query');
    }
  }
  
  const valid = errors.length === 0;
  return { errors, warnings, valid };
}

// If run directly, validate a single test result file
if (require.main === module) {
  const args = process.argv.slice(2);
  const testResultFile = args[0];
  
  if (!testResultFile) {
    console.error('Usage: node validate-answer-quality.cjs <test-result-file.json>');
    process.exit(1);
  }
  
  const resultsDir = 'testing-scripts/test results';
  const filePath = path.join(resultsDir, testResultFile);
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  
  const testData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const results = testData.results || [];
  
  console.log(`📊 VALIDATING ANSWER QUALITY: ${testResultFile}`);
  console.log('='.repeat(80));
  
  let errorCount = 0;
  let warningCount = 0;
  const issues = [];
  
  results.forEach((result, idx) => {
    const question = result.query || '';
    const response = result.response || {};
    const answer = response.answer || '';
    const type = response.type || '';
    const sources = response.sources || {};
    
    const validation = validateAnswerQuality(question, answer, type, sources);
    
    if (!validation.valid || validation.warnings.length > 0) {
      issues.push({
        questionNum: idx + 1,
        question,
        errors: validation.errors,
        warnings: validation.warnings
      });
      
      if (validation.errors.length > 0) {
        errorCount += validation.errors.length;
      }
      warningCount += validation.warnings.length;
    }
  });
  
  if (issues.length === 0) {
    console.log('✅ All answers passed quality validation!');
    process.exit(0);
  } else {
    console.log(`\n❌ Found ${issues.length} questions with quality issues:\n`);
    
    issues.forEach(issue => {
      console.log(`Q${issue.questionNum}: "${issue.question}"`);
      if (issue.errors.length > 0) {
        issue.errors.forEach(err => console.log(`   ❌ ${err}`));
      }
      if (issue.warnings.length > 0) {
        issue.warnings.forEach(warn => console.log(`   ⚠️  ${warn}`));
      }
      console.log('');
    });
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   ⚠️  Warnings: ${warningCount}`);
    process.exit(1);
  }
}

module.exports = { validateAnswerQuality };

