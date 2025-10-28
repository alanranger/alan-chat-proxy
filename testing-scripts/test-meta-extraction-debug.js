import { JSDOM } from 'jsdom';

// Extract meta description from HTML
function extractMetaDescription(html) {
  if (!html || typeof html !== 'string') return null;
  
  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && metaDesc.content) {
      return metaDesc.content.trim();
    }
    
    // Fallback: look for Open Graph description
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && ogDesc.content) {
      return ogDesc.content.trim();
    }
    
    return null;
  } catch (e) {
    console.error('Error extracting meta description:', e);
    return null;
  }
}

// Test with sample HTML
const sampleHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="description" content="Which tripod? is a frequent question, so I thought now is the time to update you with my recommendations for lightweight tripods | Photography News Blog">
  <title>Test Page</title>
</head>
<body>
  <h1>Test</h1>
</body>
</html>
`;

console.log('Testing extractMetaDescription function...');
const result = extractMetaDescription(sampleHTML);
console.log('Result:', result);
console.log('Expected: Which tripod? is a frequent question, so I thought now is the time to update you with my recommendations for lightweight tripods | Photography News Blog');
console.log('Match:', result === 'Which tripod? is a frequent question, so I thought now is the time to update you with my recommendations for lightweight tripods | Photography News Blog');
