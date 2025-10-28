// Simple test script to test classification
import fs from 'fs';

// Read the chat.js file and extract the classifyQuery function
const chatJs = fs.readFileSync('api/chat.js', 'utf8');

// Extract the classifyQuery function (simplified version)
function classifyQuery(query) {
  const lc = query.toLowerCase();
  console.log(`🔍 classifyQuery called with: "${query}"`);
  
  // COURSE QUERIES - Check these FIRST to ensure they go to clarification
  if (lc === "what courses do you offer" || lc.includes("what courses do you offer")) {
    console.log(`🎯 Course query detected: "${query}" - routing to clarification`);
    return { type: 'clarification', reason: 'course_query_needs_clarification' };
  }
  
  // CONTACT ALAN QUERIES - Check these SECOND to override workshop patterns
  const contactAlanPatterns = [
    /cancellation or refund policy for courses/i,
    /cancellation or refund policy for workshops/i,
    /how do i book a course or workshop/i,
    /can the gift voucher be used for any workshop/i,
    /can the gift voucher be used for any course/i,
    /how do i know which course or workshop is best/i,
    /do you do astrophotography workshops/i,
    /do you get a certificate with the photography course/i,
    /do i get a certificate with the photography course/i,
    /do you i get a certificate with the photography course/i, // Added typo variant
    /can my.*attend your workshop/i,
    /can.*year old attend your workshop/i,
    /how do i subscribe to the free online photography course/i,
    /how many students per workshop/i,
    /how many students per class/i,
    /what gear or equipment do i need to bring to a workshop/i,
    /what equipment do i need to bring to a workshop/i,
    /how early should i arrive before a class/i,
    /how early should i arrive before a workshop/i
  ];

  for (const pattern of contactAlanPatterns) {
    if (pattern.test(query)) {
      console.log(`📞 Contact Alan pattern matched: ${pattern} for query: "${query}"`);
      return { type: 'direct_answer', reason: 'contact_alan_query' };
    }
  }

  // WORKSHOP QUERIES - Check these THIRD to avoid conflicts with direct answer patterns
  const workshopPatterns = [
    /photography workshop/i,
    /workshop/i,
    /photography training/i,
    /photography course/i,
    /camera course/i,
    /camera courses/i,
    /weekend photography workshop/i,
    /weekend photography workshops/i,
    /group photography workshop/i,
    /group photography workshops/i,
    /advanced photography workshop/i,
    /advanced photography workshops/i,
    /workshop equipment/i,
    /workshop group/i,
    /workshop experience/i,
    /workshop booking/i,
    /workshop cancellation/i,
    /weekend.*workshop/i,
    /group.*workshop/i,
    /advanced.*workshop/i,
    /equipment.*provided/i,
    /photoshop.*course/i
  ];

  for (const pattern of workshopPatterns) {
    if (pattern.test(query)) {
      console.log(`🎯 Workshop pattern matched: ${pattern} for query: "${query}"`);
      return { type: 'workshop', reason: 'workshop_related_query' };
    }
  }

  // DIRECT ANSWER QUERIES - Should bypass clarification entirely
  const directAnswerPatterns = [
    // About Alan Ranger
    /who is alan ranger/i,
    /tell me about alan ranger/i,
    /alan ranger background/i,
    /alan ranger experience/i,
    /how long has alan ranger/i,
    /alan ranger qualifications/i,
    /how long have you been professional/i,
    /how long have you been/i,
    /professional experience/i,
    /where is alan ranger based/i,
    /alan ranger photographic background/i,
    
    // Business/Policy queries
    /terms and conditions/i,
    /terms anc conditions/i,  // Handle typo "anc" instead of "and"
    /where.*terms.*conditions/i,  // Handle "where can i find your terms and conditions"
    /cancellation policy/i,
    /refund policy/i,
    /booking policy/i,
    /privacy policy/i,
    /gift voucher/i,
    /gift certificate/i,
    /cancellation or refund policy/i,
    
    // Contact and booking queries
    /how can i contact you/i,
    /book a discovery call/i,
    /contact information/i,
    /phone number/i,
    /email address/i,
    /how do i book/i,
    /booking process/i,
    
    // Specific service queries
    /do you do commercial photography/i,
    /commercial photography services/i,
    /wedding photography services/i,
    /portrait photography services/i,
    /event photography services/i,
    /property photography/i,
    /real estate photography/i,
    /product photography/i,
    /e-commerce store/i,
    /pricing structure for portrait/i,
    /headshot work/i,
    /corporate photography/i,
    /retouching services/i,
    /editing services/i,
    /fine art prints/i,
    /turnaround time/i,
    /usage rights/i,
    /licensing for photos/i,
    /commission you for/i,
    /commercial photography project/i,
    /how far will you travel/i,
    
    // Specific information queries
    /customer reviews/i,
    /testimonials/i,
    /where can i read reviews/i,
    /what equipment do i need/i,
    /what gear do i need/i,
    /equipment needed/i,
    /what sort of camera do i need/i,
    /do i need a laptop/i,
    /certificate with the photography course/i,
    
    // Free course queries
    /free online photography/i,
    /free photography course/i,
    /free photography academy/i,
    /free online academy/i,
    /online photography course really free/i,
    /subscribe to the free online/i,
    
    // Technical queries that should have direct answers
    /explain the exposure triangle/i,
    /what is the exposure triangle/i,
    /camera settings for low light/i,
    /best camera settings/i,
    /tripod recommendation/i,
    /what tripod do you recommend/i,
    /best tripod for/i,
    /what is long exposure/i,
    /long exposure and how can i find out more/i,
    /pictures never seem sharp/i,
    /advise on what i am doing wrong/i,
    /personalised feedback on my images/i,
    /get personalised feedback/i,
    
    // Core technical photography concepts
    /how to use aperture/i,
    /what is aperture/i,
    /aperture explained/i,
    /aperture guide/i,
    /how to use iso/i,
    /what is iso/i,
    /iso explained/i,
    /iso guide/i,
    /how to use shutter/i,
    /what is shutter/i,
    /shutter speed explained/i,
    /shutter speed guide/i,
    /composition tips/i,
    /composition guide/i,
    /photography composition/i,
    /exposure triangle/i,
    /camera basics/i,
    /photography basics/i,
    /beginner photography/i,
    /photography tips/i,
    /how to improve photography/i,
    /photography advice/i,
    
    // Equipment recommendations
    /best camera for beginners/i,
    /what camera should i buy/i,
    /camera recommendation/i,
    /what lens should i buy/i,
    /lens recommendation/i,
    /camera bag recommendation/i,
    /photography equipment/i,
    /what equipment do i need/i,
    
    // Course and workshop specific queries
    /complete beginners/i,
    /evening classes in coventry/i,
    /how many weeks is the beginners/i,
    /get off auto class/i,
    /standalone/i,
    /topics are covered in the 5-week/i,
    /miss one of the weekly classes/i,
    /make it up/i,
    /online or zoom lessons/i,
    /mentoring/i,
    /1-2-1 private lessons cost/i,
    /private lessons cost/i,
    /residential workshops/i,
    /multi-day field trips/i,
    /how many students per workshop/i,
    /students per class/i,
    /sign up to monthly mentoring/i,
    /mentoring assignments/i,
    /post-processing courses/i,
    /rps mentoring/i,
    /prerequisites for advanced courses/i,
    
    // Location/venue queries
    /where are you located/i,
    /studio location/i,
    /workshop location/i,
    /meeting point/i,
    /parking/i,
    /public transport/i,
    /where is your gallery/i,
    /submit my images for feedback/i,
    
    // Age and accessibility queries
    /can my.*yr old attend/i,
    /age.*attend/i,
    /young.*attend/i,
    
    // Ethical and professional queries
    /ethical guidelines/i,
    /photography tutor/i,
    
    // Pick N Mix queries
    /what is pick n mix/i,
    /pick n mix in the payment plans/i
  ];

  for (const pattern of directAnswerPatterns) {
    if (pattern.test(query)) {
      return { type: 'direct_answer', reason: 'specific_information_query' };
    }
  }

  // CLARIFICATION QUERIES - Broad queries that need clarification
  const clarificationPatterns = [
    /photography services/i,
    /photography articles/i,
    /photography tips/i,
    /photography help/i,
    /photography advice/i,
    /photography equipment/i,
    /photography gear/i,
    /photography techniques/i,
    /photography tutorials/i,
    /what courses do you offer/i,
    /what courses/i,
    /do you offer courses/i,
    /do you do courses/i
  ];

  for (const pattern of clarificationPatterns) {
    if (pattern.test(query)) {
      return { type: 'clarification', reason: 'broad_query_needs_clarification' };
    }
  }

  // Default to clarification for unknown queries
  return { type: 'clarification', reason: 'unknown_query_default' };
}

// Test the function
console.log('Testing classification...');
const result = classifyQuery('what courses do you offer');
console.log('Result:', result);
