#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const newFile = path.join(__dirname, 'test results', 'deployed-analytics-test-2025-11-01T19-25-10-197Z.json');
const data = JSON.parse(fs.readFileSync(newFile, 'utf8'));

const failed = data.results.filter(r => r.status === 500 || r.error);
const previouslyFailed = [
  'What types of photography services do you offer?',
  'What is the difference between prime and zoom lenses?',
  'Is the online photography course really free',
  'How do I get personalised feedback on my images',
  'Where is your gallery and can I submit my images for feedback?',
  'Can I hire you as a professional photographer in Coventry?',
  'peter orton',
  'How do I subscribe to the free online photography course?'
];

const nowPassing = previouslyFailed.map(q => {
  const result = data.results.find(r => r.query === q);
  return {
    question: q,
    status: result?.status,
    confidence: result?.confidence,
    answerLength: result?.answer?.length || 0
  };
});

console.log('\n✅ VERIFICATION: Previously Failed Questions');
console.log('='.repeat(80));
console.log('\nTotal Failed in This Run:', failed.length);
console.log('\nPreviously Failed Questions Status:');
nowPassing.forEach((q, i) => {
  console.log(`\n${i+1}. "${q.question}"`);
  console.log(`   Status: ${q.status} ${q.status === 200 ? '✅' : '❌'}`);
  console.log(`   Confidence: ${q.confidence}%`);
  console.log(`   Answer Length: ${q.answerLength} chars`);
});

console.log('\n' + '='.repeat(80));
if (failed.length === 0 && nowPassing.every(q => q.status === 200)) {
  console.log('✅ ALL 8 PREVIOUSLY FAILING QUESTIONS NOW PASS!');
  console.log('🎉 100% SUCCESS RATE ACHIEVED!');
} else {
  console.log('⚠️ Some questions still failing');
}


