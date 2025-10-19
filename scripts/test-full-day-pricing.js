import https from 'https';

// Test the full-day pricing fix
async function testFullDayPricing() {
  console.log('=== TESTING FULL-DAY PRICING ===\n');
  
  const testData = {
    query: "1 day workshops",
    pageContext: { clarificationLevel: 1, selectedOption: "1 day workshops" }
  };
  
  const postData = JSON.stringify(testData);
  
  const options = {
    hostname: 'alan-chat-proxy.vercel.app',
    port: 443,
    path: '/api/chat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.ok && response.events) {
            console.log(`Found ${response.events.length} events for "1 day workshops"`);
            
            // Check for Bluebell and Batsford full-day events
            const bluebellFullDay = response.events.filter(e => 
              e.event_title.includes('Bluebell') && e.event_title.includes('Full Day')
            );
            
            const batsfordFullDay = response.events.filter(e => 
              e.event_title.includes('Batsford') && e.event_title.includes('Full Day')
            );
            
            console.log(`\nBluebell Full Day events: ${bluebellFullDay.length}`);
            bluebellFullDay.forEach(event => {
              console.log(`- ${event.event_title}`);
              console.log(`  Price: £${event.price_gbp}`);
              console.log(`  Time: ${event.start_time} - ${event.end_time}`);
            });
            
            console.log(`\nBatsford Full Day events: ${batsfordFullDay.length}`);
            batsfordFullDay.forEach(event => {
              console.log(`- ${event.event_title}`);
              console.log(`  Price: £${event.price_gbp}`);
              console.log(`  Time: ${event.start_time} - ${event.end_time}`);
            });
            
            // Check if prices are correct
            const bluebellCorrect = bluebellFullDay.every(e => e.price_gbp === 150);
            const batsfordCorrect = batsfordFullDay.every(e => e.price_gbp === 150);
            
            console.log(`\n✅ Bluebell full-day pricing correct: ${bluebellCorrect}`);
            console.log(`✅ Batsford full-day pricing correct: ${batsfordCorrect}`);
            
            if (bluebellCorrect && batsfordCorrect) {
              console.log('\n🎉 All full-day pricing is correct!');
            } else {
              console.log('\n❌ Some full-day pricing is incorrect');
            }
            
          } else {
            console.log('❌ API response error:', response);
          }
          
          resolve(response);
        } catch (error) {
          console.error('❌ Error parsing response:', error);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request error:', error);
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

testFullDayPricing().catch(console.error);
