// HTML structured data extraction functions
import { JSDOM } from 'jsdom';
import { createHash } from 'crypto';

/**
 * Extract structured data from HTML content
 * @param {string} html - Raw HTML content
 * @returns {Object} Extracted structured data
 */
export function extractStructuredDataFromHTML(html) {
  if (!html || typeof html !== 'string') {
    return {
      participants: null,
      experience_level: null,
      equipment_needed: null,
      location_address: null,
      time_schedule: null,
      fitness_level: null,
      what_to_bring: null,
      course_duration: null,
      instructor_info: null,
      availability_status: null
    };
  }

  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const extracted = {
      participants: null,
      experience_level: null,
      equipment_needed: null,
      location_address: null,
      time_schedule: null,
      fitness_level: null,
      what_to_bring: null,
      course_duration: null,
      instructor_info: null,
      availability_status: null
    };
    
    // Extract from all text content (including nested elements)
    const allText = document.body ? document.body.textContent : '';
    
    // 1. Participants extraction - look for "* Participants: Max X" pattern (handles asterisk prefix)
    const participantsMatch = allText.match(/\*\s*participants?\s*:?\s*max\s*(\d+)/i);
    if (participantsMatch) {
      extracted.participants = participantsMatch[1].trim();
    }
    
    // Fallback participants extraction without asterisk prefix
    if (!extracted.participants) {
      const participantsFallbackMatch = allText.match(/participants?\s*:?\s*max\s*(\d+)/i);
      if (participantsFallbackMatch) {
        extracted.participants = participantsFallbackMatch[1].trim();
      }
    }
    
    // 2. Experience Level extraction - look for "Experience - Level:" pattern
    const experienceMatch = allText.match(/experience\s*[-–]\s*level\s*:?\s*([^:\n\r]+)/i);
    if (experienceMatch) {
      extracted.experience_level = experienceMatch[1].trim();
    }
    
    // 3. Equipment Needed extraction - look for "EQUIPMENT NEEDED:" pattern
    const equipmentMatch = allText.match(/equipment\s*needed\s*:?\s*([^:\n\r]+)/i);
    if (equipmentMatch) {
      let equipmentText = equipmentMatch[1].trim();
      
      // Clean up the equipment text
      equipmentText = equipmentText
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/\*\s*/g, '• ') // Convert asterisks to bullets
        .trim();
      
      extracted.equipment_needed = equipmentText;
    }
    
    // 4. Location Address extraction - look for "* Location:" pattern (handles asterisk prefix and multi-line, avoids JS code)
    const locationMatch = allText.match(/\*\s*location\s*:?\s*(?:([a-zA-Z0-9\s\-\.\/]{1,100}?)(?:\s*\n|\s*$)|(?:\s*\n\s*([a-zA-Z0-9\s\-\.\/]{1,100}?)(?:\s*\n|\s*$)))/i);
    if (locationMatch) {
      extracted.location_address = (locationMatch[1] || locationMatch[2] || '').trim();
    }
    
    // Fallback location extraction without asterisk prefix
    if (!extracted.location_address) {
      const locationFallbackMatch = allText.match(/location\s*:?\s*(?:([a-zA-Z0-9\s\-\.\/]{1,100}?)(?:\s*\n|\s*$)|(?:\s*\n\s*([a-zA-Z0-9\s\-\.\/]{1,100}?)(?:\s*\n|\s*$)))/i);
      if (locationFallbackMatch) {
        extracted.location_address = (locationFallbackMatch[1] || locationFallbackMatch[2] || '').trim();
      }
    }
    
    // 5. Time Schedule extraction - look for "Time:" pattern (handles multi-line, avoids JS code)
    const timeMatch = allText.match(/time\s*:?\s*(?:([a-zA-Z0-9\s\-\.:]{1,50}?)(?:\s*\n|\s*$)|(?:\s*\n\s*([a-zA-Z0-9\s\-\.:]{1,50}?)(?:\s*\n|\s*$)))/i);
    if (timeMatch) {
      extracted.time_schedule = (timeMatch[1] || timeMatch[2] || '').trim();
    }
    
    // 6. Fitness Level extraction - look for "* Fitness:" pattern (handles asterisk prefix and multi-line, avoids JS code)
    const fitnessMatch = allText.match(/\*\s*fitness\s*:?\s*(?:([a-zA-Z0-9\s\-\.]{1,50}?)(?:\s*\n|\s*$)|(?:\s*\n\s*([a-zA-Z0-9\s\-\.]{1,50}?)(?:\s*\n|\s*$)))/i);
    if (fitnessMatch) {
      extracted.fitness_level = (fitnessMatch[1] || fitnessMatch[2] || '').trim();
    }
    
    // Alternative fitness extraction for multi-line format "* Fitness:\n2. Moderate"
    if (!extracted.fitness_level) {
      const fitnessMultiLineMatch = allText.match(/\*\s*fitness\s*:?\s*\n\s*([a-zA-Z0-9\s\-\.]{1,50}?)(?:\s*\n|\s*$)/i);
      if (fitnessMultiLineMatch) {
        extracted.fitness_level = fitnessMultiLineMatch[1].trim();
      }
    }
    
    // Fallback fitness extraction without asterisk prefix
    if (!extracted.fitness_level) {
      const fitnessFallbackMatch = allText.match(/fitness\s*:?\s*(?:([a-zA-Z0-9\s\-\.]{1,50}?)(?:\s*\n|\s*$)|(?:\s*\n\s*([a-zA-Z0-9\s\-\.]{1,50}?)(?:\s*\n|\s*$)))/i);
      if (fitnessFallbackMatch) {
        extracted.fitness_level = (fitnessFallbackMatch[1] || fitnessFallbackMatch[2] || '').trim();
      }
    }
    
    // 7. What to Bring extraction - look for "What to Bring:" pattern (handles multi-line, avoids JS code)
    const whatToBringMatch = allText.match(/what\s*to\s*bring\s*:?\s*(?:([a-zA-Z0-9\s\-\.\/,•]{1,200}?)(?:\s*\n|\s*$)|(?:\s*\n\s*([a-zA-Z0-9\s\-\.\/,•]{1,200}?)(?:\s*\n|\s*$)))/i);
    if (whatToBringMatch) {
      let whatToBringText = (whatToBringMatch[1] || whatToBringMatch[2] || '').trim();
      
      // Clean up the text
      whatToBringText = whatToBringText
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/\*\s*/g, '• ') // Convert asterisks to bullets
        .trim();
      
      extracted.what_to_bring = whatToBringText;
    }
    
    // 8. Course Duration extraction - look for "Duration:" pattern (handles multi-line, avoids JS code)
    const durationMatch = allText.match(/duration\s*:?\s*(?:([a-zA-Z0-9\s\-\.]{1,50}?)(?:\s*\n|\s*$)|(?:\s*\n\s*([a-zA-Z0-9\s\-\.]{1,50}?)(?:\s*\n|\s*$)))/i);
    if (durationMatch) {
      extracted.course_duration = (durationMatch[1] || durationMatch[2] || '').trim();
    }
    
    // 9. Instructor Info extraction - look for "Instructor:" pattern (handles multi-line, avoids JS code)
    const instructorMatch = allText.match(/instructor\s*:?\s*(?:([a-zA-Z0-9\s\-\.]{1,100}?)(?:\s*\n|\s*$)|(?:\s*\n\s*([a-zA-Z0-9\s\-\.]{1,100}?)(?:\s*\n|\s*$)))/i);
    if (instructorMatch) {
      extracted.instructor_info = (instructorMatch[1] || instructorMatch[2] || '').trim();
    }
    
    // 10. Availability Status extraction - look for "Availability:" pattern (handles multi-line, avoids JS code)
    const availabilityMatch = allText.match(/availability\s*:?\s*(?:([a-zA-Z0-9\s\-\.]{1,50}?)(?:\s*\n|\s*$)|(?:\s*\n\s*([a-zA-Z0-9\s\-\.]{1,50}?)(?:\s*\n|\s*$)))/i);
    if (availabilityMatch) {
      extracted.availability_status = (availabilityMatch[1] || availabilityMatch[2] || '').trim();
    }
    
    return extracted;
  } catch (error) {
    console.warn('HTML parsing error:', error.message);
    return {
      participants: null,
      experience_level: null,
      equipment_needed: null,
      location_address: null,
      time_schedule: null,
      fitness_level: null,
      what_to_bring: null,
      course_duration: null,
      instructor_info: null,
      availability_status: null
    };
  }
}

/**
 * Clean HTML and remove Squarespace artifacts from text
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
export function cleanHTMLText(text) {
  if (!text) return '';
  
  let cleaned = String(text)
    // Remove script tags and their content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Remove style tags and their content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove all HTML tags
    .replace(/<[^>]*>/g, ' ')
    // Remove HTML attributes that may have leaked through
    .replace(/\s*style="[^"]*"/gi, '')
    .replace(/\s*data-[a-z0-9_-]+="[^"]*"/gi, '')
    .replace(/\s*contenteditable="[^"]*"/gi, '')
    .replace(/\s*class="[^"]*"/gi, '')
    .replace(/\s*id="[^"]*"/gi, '')
    .replace(/\s*data-rte-[^=]*="[^"]*"/gi, '')
    .replace(/\s*data-indent="[^"]*"/gi, '')
    .replace(/\s*white-space:pre-wrap[^"]*"/gi, '')
    .replace(/\s*margin-left:[^"]*"/gi, '')
    // Remove HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
  
  // Split into lines and remove duplicates
  const lines = cleaned.split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .filter((line, index, arr) => {
      // Remove duplicate consecutive lines
      return index === 0 || line !== arr[index - 1];
    });
  
  return lines.join('\n');
}

/**
 * Enhance page entity description with structured data
 * @param {string} originalDescription - Original description from JSON-LD
 * @param {Object} structuredData - Extracted structured data
 * @returns {string} Enhanced description
 */
export function enhanceDescriptionWithStructuredData(originalDescription, structuredData) {
  const parts = [];
  
  // Create a clean, concise summary from the original description
  if (originalDescription && originalDescription.trim()) {
    const cleaned = cleanHTMLText(originalDescription);
    if (cleaned) {
      // Take only the first paragraph or first 200 characters as summary
      const firstParagraph = cleaned.split('\n\n')[0] || cleaned.split('\n')[0] || cleaned;
      const summary = firstParagraph.length > 200 ? firstParagraph.substring(0, 200) + '...' : firstParagraph;
      parts.push(summary);
    }
  }
  
  // Add structured data fields in a clean format
  if (structuredData.equipment_needed) {
    const equipment = cleanHTMLText(structuredData.equipment_needed);
    if (equipment && equipment.length < 200) { // Only add if reasonable length
      parts.push(`Equipment Needed: ${equipment}`);
    }
  }
  
  if (structuredData.experience_level) {
    const experience = cleanHTMLText(structuredData.experience_level);
    if (experience && experience.length < 100) { // Only add if reasonable length
      parts.push(`Experience Level: ${experience}`);
    }
  }
  
  if (structuredData.participants) {
    const participants = cleanHTMLText(structuredData.participants);
    if (participants && participants.length < 50) { // Only add if reasonable length
      parts.push(`Participants: ${participants}`);
    }
  }
  
  if (structuredData.location_address) {
    const location = cleanHTMLText(structuredData.location_address);
    if (location && location.length < 100) { // Only add if reasonable length
      parts.push(`Location: ${location}`);
    }
  }
  
  if (structuredData.time_schedule) {
    const time = cleanHTMLText(structuredData.time_schedule);
    if (time && time.length < 50) { // Only add if reasonable length
      parts.push(`Time: ${time}`);
    }
  }
  
  if (structuredData.fitness_level) {
    const fitness = cleanHTMLText(structuredData.fitness_level);
    if (fitness && fitness.length < 50) { // Only add if reasonable length
      parts.push(`Fitness: ${fitness}`);
    }
  }
  
  if (structuredData.what_to_bring) {
    const whatToBring = cleanHTMLText(structuredData.what_to_bring);
    if (whatToBring && whatToBring.length < 200) { // Only add if reasonable length
      parts.push(`What to Bring: ${whatToBring}`);
    }
  }
  
  if (structuredData.course_duration) {
    const duration = cleanHTMLText(structuredData.course_duration);
    if (duration && duration.length < 50) { // Only add if reasonable length
      parts.push(`Duration: ${duration}`);
    }
  }
  
  if (structuredData.instructor_info) {
    const instructor = cleanHTMLText(structuredData.instructor_info);
    if (instructor && instructor.length < 100) { // Only add if reasonable length
      parts.push(`Instructor: ${instructor}`);
    }
  }
  
  if (structuredData.availability_status) {
    const availability = cleanHTMLText(structuredData.availability_status);
    if (availability && availability.length < 50) { // Only add if reasonable length
      parts.push(`Availability: ${availability}`);
    }
  }
  
  return parts.join('\n\n');
}

/**
 * Generate content hash for HTML content
 * @param {string} html - HTML content
 * @returns {string} SHA-1 hash
 */
export function generateContentHash(html) {
  return createHash('sha1').update(html).digest('hex');
}
