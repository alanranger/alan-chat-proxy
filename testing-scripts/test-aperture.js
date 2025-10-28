// Simple test script for aperture query
fetch('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'how to use aperture' })
})
.then(r => r.json())
.then(d => {
  console.log(JSON.stringify({
    query: 'how to use aperture',
    type: d.type,
    answerLen: d.answer_markdown?.length || 0,
    confidence: d.confidence,
    answerPreview: d.answer_markdown?.substring(0, 100)
  }, null, 2));
})
.catch(console.error);
