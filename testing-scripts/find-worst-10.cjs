const fs = require('fs');
const path = require('path');

// Find the latest comparison file
const testResultsDir = path.join(__dirname, 'test results');
const files = fs.readdirSync(testResultsDir)
  .filter(f => f.startsWith('interactive-vs-951-') && f.endsWith('.json'))
  .map(f => ({
    name: f,
    time: fs.statSync(path.join(testResultsDir, f)).mtime.getTime()
  }))
  .sort((a, b) => b.time - a.time);

if (files.length === 0) {
  console.error('No comparison files found');
  process.exit(1);
}

const latestFile = path.join(testResultsDir, files[0].name);
const data = JSON.parse(fs.readFileSync(latestFile, 'utf8'));

// Filter for "worse" questions and calculate how much worse
const worseQuestions = data.results
  .filter(r => r.statusVsBaseline_live === 'worse')
  .map(r => {
    const baselineTotal = (r.baseline.counts.articles || 0) + 
                          (r.baseline.counts.services || 0) + 
                          (r.baseline.counts.events || 0) + 
                          (r.baseline.counts.products || 0);
    const liveTotal = (r.liveNow.counts.articles || 0) + 
                     (r.liveNow.counts.services || 0) + 
                     (r.liveNow.counts.events || 0) + 
                     (r.liveNow.counts.products || 0);
    const difference = baselineTotal - liveTotal;
    return {
      ...r,
      baselineTotal,
      liveTotal,
      difference
    };
  })
  .sort((a, b) => b.difference - a.difference) // Sort by biggest difference (most worse)
  .slice(0, 10); // Top 10 worst

console.log('\n========================================');
console.log('TOP 10 WORST QUESTIONS (after fixes)');
console.log('========================================\n');

worseQuestions.forEach((q, i) => {
  console.log(`${i + 1}. Q${q.index}: ${q.query}`);
  console.log(`   Category: ${q.category}`);
  console.log(`   Status: ${q.statusVsBaseline_live}`);
  console.log(`   Baseline: articles=${q.baseline.counts.articles}, services=${q.baseline.counts.services}, events=${q.baseline.counts.events}, products=${q.baseline.counts.products} (total=${q.baselineTotal})`);
  console.log(`   Live: articles=${q.liveNow.counts.articles}, services=${q.liveNow.counts.services}, events=${q.liveNow.counts.events}, products=${q.liveNow.counts.products} (total=${q.liveTotal})`);
  console.log(`   Difference: -${q.difference} items`);
  console.log('');
});

console.log('========================================\n');


