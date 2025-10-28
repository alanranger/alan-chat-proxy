// Test the remaining 6 problematic queries
const remainingQueries = [
  'weekend photography workshops',
  'group photography workshops', 
  'advanced photography workshops',
  'workshop equipment provided',
  'lightroom training',
  'photoshop courses'
];

async function testRemainingQueries() {
  for (const query of remainingQueries) {
    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await response.json();
      
      console.log(JSON.stringify({
        query,
        type: data.type,
        events: data.events?.length || 0,
        confidence: data.confidence,
        success: data.type === 'events' && (data.events?.length || 0) > 0
      }, null, 2));
      console.log('---');
    } catch (error) {
      console.error(`Error testing "${query}":`, error.message);
    }
  }
}

testRemainingQueries();
