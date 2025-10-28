// Test if Batsford and Bluebell events are being filtered correctly
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
        console.log('=== API RESPONSE ===');
        console.log('Version:', response.debug?.version);
        console.log('Event count:', response.events?.length || 0);
        
        if (response.events && response.events.length > 0) {
          console.log('\n=== EVENT TITLES ===');
          response.events.forEach((event, index) => {
            console.log(`${index + 1}. ${event.event_title || event.title}`);
          });
          
          // Check for Batsford and Bluebell events
          const batsfordEvents = response.events.filter(e => 
            (e.event_title || e.title || '').toLowerCase().includes('batsford')
          );
          const bluebellEvents = response.events.filter(e => 
            (e.event_title || e.title || '').toLowerCase().includes('bluebell')
          );
          
          console.log(`\n=== BATSFORD EVENTS: ${batsfordEvents.length} ===`);
          batsfordEvents.forEach(event => {
            console.log(`- ${event.event_title || event.title}`);
            console.log(`  Categories: ${JSON.stringify(event.categories)}`);
            console.log(`  Session Type: ${event.session_type || 'none'}`);
          });
          
          console.log(`\n=== BLUEBELL EVENTS: ${bluebellEvents.length} ===`);
          bluebellEvents.forEach(event => {
            console.log(`- ${event.event_title || event.title}`);
            console.log(`  Categories: ${JSON.stringify(event.categories)}`);
            console.log(`  Session Type: ${event.session_type || 'none'}`);
          });
        }
      } catch (error) {
        console.log('Error parsing response:', error.message);
        console.log('Raw response:', data.substring(0, 500));
      }
    });
  });

  req.on('error', (error) => {
    console.log('Request error:', error.message);
  });

  req.write(postData);
  req.end();
};

testQuery();
