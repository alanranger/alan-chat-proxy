const fs = require('fs');
const path = require('path');

// Automatically pick the most recent interactive-vs-951 JSON so we always
// report against the latest comparison run, not a hard-coded snapshot.
const resultsDir = path.join(__dirname, 'test results');
const files = fs
  .readdirSync(resultsDir)
  .filter((f) => f.startsWith('interactive-vs-951-') && f.endsWith('.json'));

if (!files.length) {
  console.error('No interactive-vs-951-*.json files found in test results.');
  process.exit(1);
}

const newest = files
  .map((f) => ({
    name: f,
    mtime: fs.statSync(path.join(resultsDir, f)).mtimeMs
  }))
  .sort((a, b) => b.mtime - a.mtime)[0].name;

const filePath = path.join(resultsDir, newest);
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log(`\nUsing latest comparison file: ${path.basename(filePath)}\n`);

const worse = data.results.filter(r => r.statusVsBaseline_live === 'worse' || r.statusVsBaseline_951 === 'worse');
const mixed = data.results.filter(r => r.statusVsBaseline_live === 'mixed' || r.statusVsBaseline_951 === 'mixed');

console.log('\n=== WORSE questions (excluding Event Queries) ===\n');
worse
  .filter(r => r.category !== 'Event Queries')
  .forEach(r => {
    console.log(`Q${r.index}: ${r.query}`);
    console.log(`  Category: ${r.category}`);
    console.log(`  Baseline: articles=${r.baseline.counts.articles}, services=${r.baseline.counts.services}, events=${r.baseline.counts.events}, products=${r.baseline.counts.products}`);
    console.log(`  Live: articles=${r.liveNow.counts.articles}, services=${r.liveNow.counts.services}, events=${r.liveNow.counts.events}, products=${r.liveNow.counts.products}`);
    console.log('');
  });

console.log('\n=== MIXED questions (excluding Event Queries) ===\n');
mixed
  .filter(r => r.category !== 'Event Queries')
  .forEach(r => {
    console.log(`Q${r.index}: ${r.query}`);
    console.log(`  Category: ${r.category}`);
    console.log(`  Baseline: articles=${r.baseline.counts.articles}, services=${r.baseline.counts.services}, events=${r.baseline.counts.events}, products=${r.baseline.counts.products}`);
    console.log(`  Live: articles=${r.liveNow.counts.articles}, services=${r.liveNow.counts.services}, events=${r.liveNow.counts.events}, products=${r.liveNow.counts.products}`);
    console.log('');
  });


