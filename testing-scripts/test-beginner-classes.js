// Simple test script for beginner photography classes query
fetch('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'beginner photography classes' })
})
.then(r => r.json())
.then(d => {
  console.log(JSON.stringify({
    query: 'beginner photography classes',
    type: d.type,
    classification: d.debugInfo?.classification,
    events: d.events?.length || 0,
    confidence: d.confidence
  }, null, 2));
})
.catch(console.error);
