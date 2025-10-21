// Test a single problematic query
fetch('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'camera courses for beginners' })
})
.then(r => r.json())
.then(d => {
  console.log(JSON.stringify({
    query: 'camera courses for beginners',
    type: d.type,
    events: d.events?.length || 0,
    confidence: d.confidence,
    success: d.type === 'events' && (d.events?.length || 0) > 0
  }, null, 2));
})
.catch(console.error);
