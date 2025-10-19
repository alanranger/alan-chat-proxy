// Test the regex patterns against actual product descriptions

const batsfordDesc = `Batsford Arboretum Photography Workshops in autumn. Enjoy the colour and expert photographic guidance | Half or One Day Sessions | Any Level and Camera
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
Fitness:2. Easy-Moderate`;

const bluebellDesc = `Bluebell woodlands photography workshop - Choose a sunrise or mid-morning 4hr bluebell photography shoot or both sessions at this private bluebell woodland with exclusive access
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
1. Easy`;

console.log('=== TESTING BATSFORD REGEX PATTERNS ===');
const morningMatch = batsfordDesc.match(/morning workshops are (\d+)\s*am to (\d+)\.(\d+)\s*am/i);
const afternoonMatch = batsfordDesc.match(/afternoon workshops are from (\d+):(\d+)\s*pm to (\d+):(\d+)\s*pm/i);

console.log('Morning match:', morningMatch);
console.log('Afternoon match:', afternoonMatch);

if (morningMatch && afternoonMatch) {
  const earlyEndTime = `${morningMatch[2].padStart(2, '0')}:${morningMatch[3].padStart(2, '0')}:00`;
  const lateStartTime = `${afternoonMatch[1].padStart(2, '0')}:${afternoonMatch[2].padStart(2, '0')}:00`;
  console.log(`✅ Batsford times: early end ${earlyEndTime}, late start ${lateStartTime}`);
} else {
  console.log('❌ Batsford regex failed');
}

console.log('\n=== TESTING BLUEBELL REGEX PATTERNS ===');
const sessionMatch = bluebellDesc.match(/(\d+):(\d+)\s*am to (\d+):(\d+)\s*am or (\d+):(\d+)\s*am to (\d+):(\d+)\s*pm/i);

console.log('Session match:', sessionMatch);

if (sessionMatch) {
  const earlyEndTime = `${sessionMatch[3].padStart(2, '0')}:${sessionMatch[4].padStart(2, '0')}:00`;
  const lateStartTime = `${sessionMatch[5].padStart(2, '0')}:${sessionMatch[6].padStart(2, '0')}:00`;
  console.log(`✅ Bluebell times: early end ${earlyEndTime}, late start ${lateStartTime}`);
} else {
  console.log('❌ Bluebell regex failed');
}
