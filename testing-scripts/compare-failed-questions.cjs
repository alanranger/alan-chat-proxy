#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const oldFile = path.join(__dirname, 'test results', 'deployed-analytics-test-2025-11-01T18-52-02-403Z.json');
const newFile = path.join(__dirname, 'test results', 'deployed-analytics-test-2025-11-01T19-09-12-735Z.json');

const oldData = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
const newData = JSON.parse(fs.readFileSync(newFile, 'utf8'));

const oldFailed = oldData.results.filter(r => r.status === 500 || r.error).map(r => r.query);
const newFailed = newData.results.filter(r => r.status === 500 || r.error).map(r => r.query);

console.log('\n📊 COMPARISON: Same 8 questions failed?');
console.log('='.repeat(80));
console.log('\nFirst run failed:');
oldFailed.forEach((q, i) => console.log(`  ${i+1}. "${q}"`));
console.log('\nSecond run failed:');
newFailed.forEach((q, i) => console.log(`  ${i+1}. "${q}"`));

const same = oldFailed.length === newFailed.length && oldFailed.every((q, i) => q === newFailed[i]);
console.log('\n' + (same ? '✅ IDENTICAL - Same 8 questions failed both times' : '⚠️ DIFFERENT - Some questions changed'));
console.log('\n💡 Conclusion: These are consistent failures, not intermittent issues.');
console.log('   This indicates a bug in the code for these specific query types.');

