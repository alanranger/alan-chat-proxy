import fetch from 'node-fetch';

const testLocalAPI = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: "2.5hr - 4hr workshops",
        pageContext: {
          clarificationLevel: 1,
          selectedOption: "2.5hr - 4hr workshops"
        }
      })
    });

    if (!response.ok) {
      console.log('Response not OK:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    
    console.log('=== LOCAL API RESPONSE ===');
    console.log('Version:', data.debug?.version);
    console.log('Confidence:', data.confidence);
    console.log('Event count:', data.events?.length || 0);
    
    if (data.events && data.events.length > 0) {
      console.log('\n=== FIRST 5 EVENTS ===');
      data.events.slice(0, 5).forEach((event, i) => {
        console.log(`\nEvent ${i + 1}:`);
        console.log('  Title:', event.event_title);
        console.log('  Time:', event.start_time, '-', event.end_time);
        console.log('  Categories:', event.categories);
        console.log('  Session Type:', event.session_type);
      });
      
      console.log('\n=== CATEGORY ANALYSIS ===');
      const categoryCounts = {};
      const sessionTypeCounts = {};
      
      data.events.forEach(event => {
        // Count categories
        if (event.categories) {
          event.categories.forEach(cat => {
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
          });
        }
        
        // Count session types
        const sessionType = event.session_type || 'none';
        sessionTypeCounts[sessionType] = (sessionTypeCounts[sessionType] || 0) + 1;
      });
      
      console.log('Category distribution:', categoryCounts);
      console.log('Session type distribution:', sessionTypeCounts);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
};

testLocalAPI();



