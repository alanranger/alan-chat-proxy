const fs = require('fs');image.png
const path = require('path');

// Node 18+ has native fetch - use it directly
const API_ENDPOINT = process.env.API_ENDPOINT || 'https://alan-chat-proxy.vercel.app/api/chat';

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

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  let body = null;
  try {
    body = await res.json();
  } catch {
    // ignore JSON parse error here
  }
  if (!res.ok) {
    const msg = body && body.error ? body.error : res.statusText;
    throw new Error(`HTTP ${res.status} for ${url}: ${msg}`);
  }
  return body;
}

async function fetchLiveResponse(query) {
  try {
    return await fetchJson(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
  } catch (error) {
    return { error: error.message };
  }
}

async function showQuality() {
  console.log('\n========================================');
  console.log('TOP 10 WORST QUESTIONS - QUALITY ANALYSIS');
  console.log('========================================\n');

  for (let i = 0; i < worseQuestions.length; i++) {
    const q = worseQuestions[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`${i + 1}. Q${q.index}: ${q.query}`);
    console.log(`   Category: ${q.category}`);
    console.log(`   Baseline: articles=${q.baseline.counts.articles}, services=${q.baseline.counts.services}, events=${q.baseline.counts.events}, products=${q.baseline.counts.products}`);
    console.log(`   Live: articles=${q.liveNow.counts.articles}, services=${q.liveNow.counts.services}, events=${q.liveNow.counts.events}, products=${q.liveNow.counts.products}`);
    console.log(`   Difference: -${q.difference} items`);
    console.log(`\n   BASELINE ANSWER PREVIEW:`);
    console.log(`   ${(q.baselineAnswerPreview || 'N/A').substring(0, 300)}...`);
    console.log(`\n   LIVE ANSWER PREVIEW:`);
    console.log(`   ${(q.liveAnswerPreview || 'N/A').substring(0, 300)}...`);
    
    // Fetch current live response to show actual articles
    console.log(`\n   Fetching current live response...`);
    const liveResponse = await fetchLiveResponse(q.query);
    
    if (liveResponse.error) {
      console.log(`   Error: ${liveResponse.error}`);
    } else {
      console.log(`\n   CURRENT LIVE RESPONSE:`);
      console.log(`   Answer: ${(liveResponse.answer || '').substring(0, 200)}...`);
      console.log(`   Confidence: ${((liveResponse.confidence || 0) * 100).toFixed(0)}%`);
      
      if (liveResponse.structured?.articles && liveResponse.structured.articles.length > 0) {
        console.log(`\n   Articles (${liveResponse.structured.articles.length}):`);
        liveResponse.structured.articles.forEach((a, idx) => {
          console.log(`     ${idx + 1}. ${a.title || 'NO TITLE'}`);
          console.log(`        URL: ${a.page_url || a.url || 'NO URL'}`);
        });
      } else {
        console.log(`\n   Articles: 0`);
      }
      
      if (liveResponse.structured?.services && liveResponse.structured.services.length > 0) {
        console.log(`\n   Services (${liveResponse.structured.services.length}):`);
        liveResponse.structured.services.slice(0, 5).forEach((s, idx) => {
          console.log(`     ${idx + 1}. ${s.title || s.service_name || 'NO TITLE'}`);
        });
      }
      
      if (liveResponse.structured?.events && liveResponse.structured.events.length > 0) {
        console.log(`\n   Events (${liveResponse.structured.events.length}):`);
        liveResponse.structured.events.slice(0, 3).forEach((e, idx) => {
          console.log(`     ${idx + 1}. ${e.event_title || 'NO TITLE'}`);
        });
      }
      
      if (liveResponse.structured?.products && liveResponse.structured.products.length > 0) {
        console.log(`\n   Products (${liveResponse.structured.products.length}):`);
        liveResponse.structured.products.slice(0, 3).forEach((p, idx) => {
          console.log(`     ${idx + 1}. ${p.title || 'NO TITLE'}`);
        });
      }
    }
    
    // Small delay to avoid rate limiting
    if (i < worseQuestions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`\n${'='.repeat(80)}\n`);
}

showQuality().catch(console.error);

