// Test multiple workshop/course queries
const queries = [
  'photo editing courses',
  'when is your next wales workshop', 
  'devon photography workshop',
  'yorkshire photography course',
  'lightroom course',
  'photography classes warwickshire'
];

async function testQueries() {
  for (const query of queries) {
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

testQueries();
