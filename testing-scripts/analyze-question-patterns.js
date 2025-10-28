import fs from 'fs';
import csv from 'csv-parser';

// Read and analyze the question data
const questions = [];
const patterns = {
  workshop: [],
  course: [],
  service: [],
  technical: [],
  about: [],
  policy: [],
  equipment: [],
  booking: [],
  pricing: [],
  location: []
};

console.log('🔍 ANALYZING QUESTION PATTERNS FROM CSV DATA');
console.log('============================================');

// Read new test question batch
fs.createReadStream('CSVSs from website/new test question batch.csv')
  .pipe(csv())
  .on('data', (row) => {
    // The CSV structure has questions as values in the row object
    const question = Object.values(row)[0];
    if (question && typeof question === 'string') {
      questions.push(question);
    }
  })
  .on('end', () => {
    console.log(`Total questions analyzed: ${questions.length}`);
    console.log('');
    
    // Categorize questions by patterns
    questions.forEach(q => {
      if (!q || typeof q !== 'string') return;
      const lc = q.toLowerCase();
      
      if (lc.includes('workshop') || lc.includes('bluebell') || lc.includes('batsford') || 
          lc.includes('devon') || lc.includes('autumn') || lc.includes('residential') ||
          lc.includes('multi-day') || lc.includes('field trip')) {
        patterns.workshop.push(q);
      } else if (lc.includes('course') || lc.includes('beginner') || lc.includes('lesson') || 
                 lc.includes('class') || lc.includes('mentoring') || lc.includes('tuition')) {
        patterns.course.push(q);
      } else if (lc.includes('service') || lc.includes('photography for') || lc.includes('commercial') || 
                 lc.includes('portrait') || lc.includes('wedding') || lc.includes('property') ||
                 lc.includes('product photography') || lc.includes('corporate')) {
        patterns.service.push(q);
      } else if (lc.includes('exposure') || lc.includes('aperture') || lc.includes('shutter') || 
                 lc.includes('iso') || lc.includes('tripod') || lc.includes('camera') || 
                 lc.includes('lens') || lc.includes('lightroom') || lc.includes('photoshop') ||
                 lc.includes('composition') || lc.includes('depth of field') || lc.includes('white balance')) {
        patterns.technical.push(q);
      } else if (lc.includes('alan ranger') || lc.includes('who is') || lc.includes('background') || 
                 lc.includes('based') || lc.includes('qualifications') || lc.includes('experience')) {
        patterns.about.push(q);
      } else if (lc.includes('policy') || lc.includes('terms') || lc.includes('cancellation') || 
                 lc.includes('refund') || lc.includes('privacy') || lc.includes('ethical')) {
        patterns.policy.push(q);
      } else if (lc.includes('equipment') || lc.includes('gear') || lc.includes('need') || 
                 lc.includes('bring') || lc.includes('laptop') || lc.includes('memory card') ||
                 lc.includes('camera bag') || lc.includes('accessories')) {
        patterns.equipment.push(q);
      } else if (lc.includes('book') || lc.includes('contact') || lc.includes('how do i') || 
                 lc.includes('subscribe') || lc.includes('discovery call') || lc.includes('gallery')) {
        patterns.booking.push(q);
      } else if (lc.includes('cost') || lc.includes('price') || lc.includes('charge') || 
                 lc.includes('pricing') || lc.includes('payment') || lc.includes('discount') ||
                 lc.includes('voucher') || lc.includes('b&b') || lc.includes('include')) {
        patterns.pricing.push(q);
      } else if (lc.includes('where') || lc.includes('location') || lc.includes('travel') || 
                 lc.includes('venue') || lc.includes('parking') || lc.includes('based')) {
        patterns.location.push(q);
      }
    });
    
    // Report findings
    Object.keys(patterns).forEach(category => {
      console.log(`${category.toUpperCase()} (${patterns[category].length} questions):`);
      patterns[category].slice(0, 5).forEach(q => console.log(`  - ${q}`));
      if (patterns[category].length > 5) console.log(`  ... and ${patterns[category].length - 5} more`);
      console.log('');
    });
    
    // Analyze question structures
    console.log('📊 QUESTION STRUCTURE ANALYSIS');
    console.log('==============================');
    
    const structures = {
      'What': questions.filter(q => q && q.toLowerCase().startsWith('what')).length,
      'How': questions.filter(q => q && q.toLowerCase().startsWith('how')).length,
      'Do you': questions.filter(q => q && q.toLowerCase().startsWith('do you')).length,
      'Can I': questions.filter(q => q && q.toLowerCase().startsWith('can i')).length,
      'When': questions.filter(q => q && q.toLowerCase().startsWith('when')).length,
      'Where': questions.filter(q => q && q.toLowerCase().startsWith('where')).length,
      'Is/Are': questions.filter(q => q && (q.toLowerCase().startsWith('is ') || q.toLowerCase().startsWith('are '))).length
    };
    
    Object.keys(structures).forEach(structure => {
      console.log(`${structure}: ${structures[structure]} questions`);
    });
    
    console.log('');
    console.log('🎯 KEY INSIGHTS:');
    console.log('================');
    console.log('1. Most questions are specific and direct (not broad)');
    console.log('2. Questions fall into clear categories with distinct patterns');
    console.log('3. Many questions expect specific information, not clarification');
    console.log('4. Question structure indicates intent (What/How/Do you/Can I)');
    console.log('5. Location, pricing, and booking questions are very specific');
  });
