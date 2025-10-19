// Test the session splitting logic locally

// Simulate the event data from database
const testEvents = [
  {
    event_title: "Bluebell Photography Workshop | Warwickshire | 30 Apr",
    start_time: "05:45:00",
    end_time: "15:00:00",
    categories: ["1-day", "2.5hrs-4hrs"],
    product_description: `Bluebell woodlands photography workshop - Choose a sunrise or mid-morning 4hr bluebell photography shoot or both sessions at this private bluebell woodland with exclusive access
Summary
Location:
Warwickshire (Near Stratford Upon Avon)
Dates (are subject to the timing of the bluebell flowering and their peek display - you will be contacted nearer the time to consider alt-dates, please pick your initial first date choice but be flexible if nearer the time it needs to change)
Mon-20-Apr-26
Tue-21-Apr-26
Wed-22-Apr-26
Thu-23-Apr-26
Fri-24-Apr-26
Sat-25-Apr-26
Sun-26-Apr-26
Mon-27-Apr-26
Tue-28-Apr-26
Wed-29-Apr-26
Thu-30-Apr-26
Fri-01-May-26
Book and select either:
4hrs - 5:45 am to 9:45 am or 10:30 am to 2:30 pm
OR 1 day - 5:45 am to 2:30 pm
Brunch between 9:45-10:30 (not included)
Participants:
Max 6
Fitness:
1. Easy`
  },
  {
    event_title: "Batsford Arboretum Autumn Photography Workshop - 30/10",
    start_time: "08:00:00",
    end_time: "15:30:00",
    categories: ["1-day", "2.5hrs-4hrs"],
    product_description: `Batsford Arboretum Photography Workshops in autumn. Enjoy the colour and expert photographic guidance | Half or One Day Sessions | Any Level and Camera
Summary
Location:
Batsford Arboretum - Gloucestershire
Dates:
2025
Daily From: Fri 24th Oct to Fri 31st Oct
Half-Day morning workshops are 8 am to 11.30 am
Half-Day afternoon workshops are from 12:00 pm to 3:30 pm
One Day workshops are 8 am to 3:30 pm
Participants:
Max 6
Fitness:2. Easy-Moderate`
  }
];

// Simulate the session splitting logic
function testSessionSplitting(events, categoryType) {
  const filteredEvents = [];
  
  for (const event of events) {
    console.log(`\n🔍 Processing: ${event.event_title}`);
    console.log(`Categories: ${JSON.stringify(event.categories)}`);
    console.log(`Looking for: ${categoryType}`);
    
    const hasCategory = event.categories.includes(categoryType);
    console.log(`Has ${categoryType}: ${hasCategory}`);
    
    if (hasCategory) {
      // Check if this is a multi-session event
      if (event.categories.length > 1 && event.categories.includes('1-day') && event.categories.includes('2.5hrs-4hrs')) {
        console.log(`✅ Multi-session event detected`);
        
        if (categoryType === '2.5hrs-4hrs') {
          console.log(`🔍 Extracting session times for 2.5hrs-4hrs`);
          
          const productDesc = event.product_description || '';
          console.log(`Product description length: ${productDesc.length}`);
          
          if (productDesc.includes('batsford') || event.event_title.toLowerCase().includes('batsford')) {
            console.log(`🔍 Processing Batsford event`);
            const morningMatch = productDesc.match(/morning workshops are (\d+)\s*am to (\d+)\.(\d+)\s*am/i);
            const afternoonMatch = productDesc.match(/afternoon workshops are from (\d+):(\d+)\s*pm to (\d+):(\d+)\s*pm/i);
            
            console.log(`Morning match:`, morningMatch);
            console.log(`Afternoon match:`, afternoonMatch);
            
            if (morningMatch && afternoonMatch) {
              const earlyEndTime = `${morningMatch[2].padStart(2, '0')}:${morningMatch[3].padStart(2, '0')}:00`;
              const lateStartTime = `${afternoonMatch[1].padStart(2, '0')}:${afternoonMatch[2].padStart(2, '0')}:00`;
              console.log(`✅ Batsford times: early end ${earlyEndTime}, late start ${lateStartTime}`);
              
              // Create early and late sessions
              const earlySession = {
                ...event,
                session_type: 'early',
                start_time: event.start_time,
                end_time: earlyEndTime,
                categories: ['2.5hrs-4hrs'],
                event_title: `${event.event_title} (Early Session)`
              };
              const lateSession = {
                ...event,
                session_type: 'late',
                start_time: lateStartTime,
                end_time: event.end_time,
                categories: ['2.5hrs-4hrs'],
                event_title: `${event.event_title} (Late Session)`
              };
              
              filteredEvents.push(earlySession, lateSession);
              console.log(`✅ Added 2 Batsford sessions`);
            } else {
              console.log(`❌ Could not extract Batsford session times`);
            }
          } else if (productDesc.includes('bluebell') || event.event_title.toLowerCase().includes('bluebell')) {
            console.log(`🔍 Processing Bluebell event`);
            const sessionMatch = productDesc.match(/(\d+):(\d+)\s*am to (\d+):(\d+)\s*am or (\d+):(\d+)\s*am to (\d+):(\d+)\s*pm/i);
            
            console.log(`Session match:`, sessionMatch);
            
            if (sessionMatch) {
              const earlyEndTime = `${sessionMatch[3].padStart(2, '0')}:${sessionMatch[4].padStart(2, '0')}:00`;
              const lateStartTime = `${sessionMatch[5].padStart(2, '0')}:${sessionMatch[6].padStart(2, '0')}:00`;
              console.log(`✅ Bluebell times: early end ${earlyEndTime}, late start ${lateStartTime}`);
              
              // Create early and late sessions
              const earlySession = {
                ...event,
                session_type: 'early',
                start_time: event.start_time,
                end_time: earlyEndTime,
                categories: ['2.5hrs-4hrs'],
                event_title: `${event.event_title} (Early Session)`
              };
              const lateSession = {
                ...event,
                session_type: 'late',
                start_time: lateStartTime,
                end_time: event.end_time,
                categories: ['2.5hrs-4hrs'],
                event_title: `${event.event_title} (Late Session)`
              };
              
              filteredEvents.push(earlySession, lateSession);
              console.log(`✅ Added 2 Bluebell sessions`);
            } else {
              console.log(`❌ Could not extract Bluebell session times`);
            }
          } else {
            console.log(`❌ No specific session time extraction for ${event.event_title}`);
          }
        }
      } else {
        console.log(`✅ Single category event, adding as-is`);
        filteredEvents.push(event);
      }
    } else {
      console.log(`❌ Event does not have category ${categoryType}`);
    }
  }
  
  return filteredEvents;
}

// Test the logic
console.log('=== TESTING SESSION SPLITTING LOGIC ===');
const result = testSessionSplitting(testEvents, '2.5hrs-4hrs');

console.log(`\n=== FINAL RESULT ===`);
console.log(`Total events: ${result.length}`);
result.forEach((event, index) => {
  console.log(`${index + 1}. ${event.event_title} (${event.session_type || 'none'})`);
});
