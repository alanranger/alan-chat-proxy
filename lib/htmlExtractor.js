// HTML structured data extraction functions
import { JSDOM } from 'jsdom';

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
 * Enhance page entity description with structured data
 * @param {string} originalDescription - Original description from JSON-LD
 * @param {Object} structuredData - Extracted structured data
 * @returns {string} Enhanced description
 */
export function enhanceDescriptionWithStructuredData(originalDescription, structuredData) {
  const parts = [];
  
  // Add original description if it exists
  if (originalDescription && originalDescription.trim()) {
    parts.push(originalDescription.trim());
  }
  
  // Add structured data fields
  if (structuredData.equipmentNeeded) {
    parts.push(`Equipment Needed: ${structuredData.equipmentNeeded}`);
  }
  
  if (structuredData.experienceLevel) {
    parts.push(`Experience Level: ${structuredData.experienceLevel}`);
  }
  
  if (structuredData.participants) {
    parts.push(`Participants: ${structuredData.participants}`);
  }
  
  if (structuredData.location) {
    parts.push(`Location: ${structuredData.location}`);
  }
  
  if (structuredData.time) {
    parts.push(`Time: ${structuredData.time}`);
  }
  
  if (structuredData.fitness) {
    parts.push(`Fitness: ${structuredData.fitness}`);
  }
  
  return parts.join('\n\n');
}

/**
 * Generate content hash for HTML content
 * @param {string} html - HTML content
 * @returns {string} SHA-1 hash
 */
export function generateContentHash(html) {
  const crypto = require('crypto');
  return crypto.createHash('sha1').update(html).digest('hex');
}
