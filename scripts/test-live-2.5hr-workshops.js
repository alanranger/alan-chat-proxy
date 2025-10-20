import https from 'https';

const testQuery = async () => {
  const postData = JSON.stringify({
    query: "2.5hr - 4hr workshops",
    pageContext: {
      clarificationLevel: 1,
      selectedOption: "2.5hr - 4hr workshops"
    }
  });

  const options = {
    hostname: 'alan-ranger-chatbot.vercel.app',
    port: 443,
    path: '/api/chat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('=== LIVE API RESPONSE ===');
        console.log('Version:', response.debug?.version);
        console.log('Confidence:', response.confidence);
        console.log('Event count:', response.events?.length || 0);
        
        if (response.events && response.events.length > 0) {
          console.log('\n=== FIRST 3 EVENTS ===');
          response.events.slice(0, 3).forEach((event, i) => {
            console.log(`\nEvent ${i + 1}:`);
            console.log('  Title:', event.event_title);
            console.log('  Time:', event.start_time, '-', event.end_time);
            console.log('  Categories:', event.categories);
            console.log('  Session Type:', event.session_type);
          });
        }
        
        if (response.events && response.events.length > 0) {
          console.log('\n=== CATEGORY ANALYSIS ===');
          const categoryCounts = {};
          const sessionTypeCounts = {};
          
          response.events.forEach(event => {
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
        console.error('Error parsing response:', error);
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error);
  });

  req.write(postData);
  req.end();
};

testQuery();
