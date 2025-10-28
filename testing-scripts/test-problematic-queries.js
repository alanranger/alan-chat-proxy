// Test the problematic queries identified in the 171-question test
const problematicQueries = [
  'weekend photography workshops',
  'group photography workshops', 
  'advanced photography workshops',
  'workshop equipment provided',
  'lightroom training',
  'photoshop courses',
  'camera courses for beginners'
];

async function testProblematicQueries() {
  for (const query of problematicQueries) {
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

testProblematicQueries();
