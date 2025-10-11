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
      fitness: null,
      location: null,
      time: null,
      experienceLevel: null,
      equipmentNeeded: null
    };
  }

  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const extracted = {
      participants: null,
      fitness: null,
      location: null,
      time: null,
      experienceLevel: null,
      equipmentNeeded: null
    };
    
    // Extract from all text content (including nested elements)
    const allText = document.body ? document.body.textContent : '';
    
    // Participants extraction
    const participantsMatch = allText.match(/(?:participants?|group\s*size|max\s*participants?|class\s*size)\s*:?\s*([^\n\r]*?)(?:\n|$)/i);
    if (participantsMatch) {
      extracted.participants = participantsMatch[1].trim();
    }
    
    // Location extraction
    const locationMatch = allText.match(/location\s*:?\s*([^\n\r]*?)(?:\n|$)/i);
    if (locationMatch) {
      extracted.location = locationMatch[1].trim();
    }
    
    // Time extraction
    const timeMatch = allText.match(/time\s*:?\s*([^\n\r]*?)(?:\n|$)/i);
    if (timeMatch) {
      extracted.time = timeMatch[1].trim();
    }
    
    // Experience Level extraction
    const experienceMatch = allText.match(/experience\s*[-–]\s*level\s*:?\s*([^\n\r]*?)(?:\n|$)/i);
    if (experienceMatch) {
      extracted.experienceLevel = experienceMatch[1].trim();
    }
    
    // Fitness extraction (numeric scale)
    const fitnessMatch = allText.match(/(?:fitness|difficulty|experience|level)\s*:?\s*([0-5])\s*[\.\-]?\s*([^\n\r]*?)(?:\n|$)/i);
    if (fitnessMatch) {
      extracted.fitness = fitnessMatch[1] + (fitnessMatch[2] ? '. ' + fitnessMatch[2].trim() : '');
    }
    
    // Equipment Needed extraction - more comprehensive
    const equipmentMatch = allText.match(/\*?\s*equipment\s*needed\s*:?\s*([\s\S]*?)(?=\*?\s*[A-Z][A-Z\s]*:|dates?:|select\s*dates|quantity:|$)/i);
    if (equipmentMatch) {
      let equipmentText = equipmentMatch[1].trim();
      
      // Clean up the equipment text
      equipmentText = equipmentText
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/\*\s*/g, '• ') // Convert asterisks to bullets
        .trim();
      
      extracted.equipmentNeeded = equipmentText;
    }
    
    return extracted;
  } catch (error) {
    console.warn('HTML parsing error:', error.message);
    return {
      participants: null,
      fitness: null,
      location: null,
      time: null,
      experienceLevel: null,
      equipmentNeeded: null
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
  if (structuredData.equipmentNeeded) {
    const equipment = cleanHTMLText(structuredData.equipmentNeeded);
    if (equipment && equipment.length < 200) { // Only add if reasonable length
      parts.push(`Equipment Needed: ${equipment}`);
    }
  }
  
  if (structuredData.experienceLevel) {
    const experience = cleanHTMLText(structuredData.experienceLevel);
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
  
  if (structuredData.location) {
    const location = cleanHTMLText(structuredData.location);
    if (location && location.length < 100) { // Only add if reasonable length
      parts.push(`Location: ${location}`);
    }
  }
  
  if (structuredData.time) {
    const time = cleanHTMLText(structuredData.time);
    if (time && time.length < 50) { // Only add if reasonable length
      parts.push(`Time: ${time}`);
    }
  }
  
  if (structuredData.fitness) {
    const fitness = cleanHTMLText(structuredData.fitness);
    if (fitness && fitness.length < 50) { // Only add if reasonable length
      parts.push(`Fitness: ${fitness}`);
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
