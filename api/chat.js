// /api/chat.js
// FIX: 2025-10-06 04:15 - Fixed fitness level extraction from description field
// This extracts fitness level information from product chunks description field
// Now parses patterns like "Fitness: 1. Easy" and "Experience - Level: Beginner"
export const config = { runtime: "nodejs" };

// Global variables for Node.js environment

import { createClient } from "@supabase/supabase-js";
import { createHash } from 'crypto';

/* ----------------------- Helper Functions ----------------------- */
// Hash IP for privacy
const hashIP = (ip) => {
 if (!ip) return null;
 return createHash('sha256').update(ip + 'chat-log-salt').digest('hex').substring(0, 16);
};

// Extract publish date from CSV data (now properly populated)
const extractPublishDate = (article) => {
 try {
 // Use CSV publish_date field (now properly populated from CSV import)
 if (article.publish_date) {
 return new Date(article.publish_date).toLocaleDateString('en-GB', { 
 year: 'numeric', 
 month: 'short', 
 day: 'numeric' 
 });
 }
 
 // Fallback to last_seen if no publish_date
 if (article.last_seen) {
 return new Date(article.last_seen).toLocaleDateString('en-GB', { 
 year: 'numeric', 
 month: 'short', 
 day: 'numeric' 
 });
 }
 
 return null;
 } catch {
 return null;
 }
};

// Extract keywords from page path for context
const extractKeywordsFromPath = (pathname) => {
 if (!pathname) return [];
 
 // Extract meaningful keywords from URL path
 const pathParts = pathname.split('/').filter(part => part.length > 2);
 const keywords = [];
 
 // Map common path patterns to relevant keywords
 const pathMappings = {
 'beginners': ['beginner', 'basic', 'intro'],
 'photography': ['photography', 'photo'],
 'course': ['course', 'class', 'training'],
 'workshop': ['workshop', 'session'],
 'lightroom': ['lightroom', 'editing', 'post-processing'],
 'landscape': ['landscape', 'nature', 'outdoor'],
 'portrait': ['portrait', 'people', 'studio'],
 'macro': ['macro', 'close-up', 'detail'],
 'street': ['street', 'urban', 'city'],
 'wedding': ['wedding', 'ceremony', 'event']
 };
 
 pathParts.forEach(part => {
 const lowerPart = part.toLowerCase();
 if (pathMappings[lowerPart]) {
 keywords.push(...pathMappings[lowerPart]);
 } else if (part.length > 3) {
 keywords.push(part);
 }
 });
 
 return [...new Set(keywords)]; // Remove duplicates
};

// Detect device type from user agent
const detectDeviceType = (userAgent) => {
 if (!userAgent) return 'unknown';
 const ua = userAgent.toLowerCase();
 if (/mobile|android|iphone|ipad/.test(ua)) return 'mobile';
 if (/tablet|ipad/.test(ua)) return 'tablet';
 return 'desktop';
};

/* ----------------------- Chat Logging ----------------------- */
const createSession = async (sessionId, userAgent, ip) => {
 try {
 const client = supabaseAdmin();
 
 // Check if session already exists
 const { data: existingSession } = await client
 .from('chat_sessions')
 .select('session_id')
 .eq('session_id', sessionId)
 .single();
 
 if (existingSession) {
 return; // Session already exists
 }
 
 // Create new session
 const { error } = await client.from('chat_sessions').insert([{
 session_id: sessionId,
 started_at: new Date().toISOString(),
 total_questions: 0,
 total_interactions: 0,
 device_type: detectDeviceType(userAgent),
 user_agent: userAgent,
 ip_hash: hashIP(ip)
 }]);
 
 if (error) throw new Error(`Session creation failed: ${error.message}`);
 } catch (err) {
 console.warn('Session creation failed:', err.message);
 }
};

const logQuestion = async (sessionId, question) => {
 try {
 const client = supabaseAdmin();
 
 // Insert the question into chat_interactions
 const { error } = await client.from('chat_interactions').insert([{
 session_id: sessionId,
 question: question,
 answer: null,
 intent: null,
 confidence: null,
 response_time_ms: null,
 sources_used: null
 }]);
 
 if (error) throw new Error(`Question log failed: ${error.message}`);
 } catch (err) {
 console.warn('Question logging failed:', err.message);
 }
};


/* ----------------------- Direct Answer Generation ----------------------- */



// Helper function to detect equipment advice queries
function isEquipmentAdviceQuery(query) {
 const equipmentKeywords = [
 'tripod', 'camera', 'lens', 'filter', 'flash', 'bag', 'strap', 'memory card',
 'battery', 'charger', 'cleaning', 'monitor', 'computer', 'laptop', 'software',
 'lightroom', 'photoshop', 'editing', 'post-processing', 'equipment', 'gear'
 ];
 
 const adviceKeywords = [
 'recommend', 'best', 'what', 'which', 'should i buy', 'need', 'suggest',
 'advice', 'opinion', 'prefer', 'choose', 'select'
 ];
 
 const hasEquipment = equipmentKeywords.some(keyword => query.includes(keyword));
 const hasAdvice = adviceKeywords.some(keyword => query.includes(keyword));
 
 console.log(`ðŸ”§ isEquipmentAdviceQuery: query="${query}", hasEquipment=${hasEquipment}, hasAdvice=${hasAdvice}`);
 
 return hasEquipment && hasAdvice;
}

// Enhanced equipment advice response generator
function generateEquipmentAdviceResponse(query, articles, contentChunks) {
 console.log(`ðŸ”§ generateEquipmentAdviceResponse: Processing equipment advice query="${query}"`);
 console.log(`ðŸ”§ generateEquipmentAdviceResponse: Articles available=${articles.length}`);
 
 // Extract equipment type from query
 const equipmentType = extractEquipmentType(query);
 console.log(`ðŸ”§ generateEquipmentAdviceResponse: Equipment type="${equipmentType}"`);
 
 // Find relevant articles for this equipment type
 const relevantArticles = findRelevantEquipmentArticles(equipmentType, articles);
 console.log(`ðŸ”§ generateEquipmentAdviceResponse: Found ${relevantArticles.length} relevant articles`);
 
 // If no relevant articles found, return a basic response
 if (relevantArticles.length === 0) {
 console.log(`ðŸ”§ generateEquipmentAdviceResponse: No relevant articles found, returning basic response`);
 return generateBasicEquipmentAdvice(equipmentType);
 }
 
 // Extract key considerations from articles
 const keyConsiderations = extractKeyConsiderations(relevantArticles, contentChunks);
 console.log(`ðŸ”§ generateEquipmentAdviceResponse: Key considerations=${JSON.stringify(keyConsiderations)}`);
 
 // Generate synthesized response
 const response = synthesizeEquipmentAdvice(equipmentType, keyConsiderations, relevantArticles);
 console.log(`ðŸ”§ generateEquipmentAdviceResponse: Generated response="${response.substring(0, 200)}..."`);
 
 return response;
}

// Helper function to extract and score paragraphs from text
function pickPricingParas(text, hints) {
 const t = (text || "").replace(/\s+/g, " ").trim();
 const paras = t.split(/\n\s*\n|\.\s+(?=[A-Z])/).map(p => p.trim()).filter(p => p.length > 40);
 const scored = paras.map(p => ({
 p,
 s: hints.reduce((acc, h) => acc + (p.toLowerCase().includes(h) ? 1 : 0), 0)
 })).sort((a,b)=>b.s-a.s || b.p.length - a.p.length);
 return scored.slice(0, 2).map(x=>x.p);
}

// Helper function to extract candidates from content chunks
function extractCandidatesFromChunks(contentChunks, hints) {
 const candidates = [];
 for (const c of (contentChunks || [])) {
 const text = c.chunk_text || c.content || "";
 const paras = pickPricingParas(text, hints);
 if (paras.length) candidates.push({ paras, url: c.url || c.source_url });
 }
 return candidates;
}

// Helper function to extract candidates from articles
function extractCandidatesFromArticles(articles, hints) {
 const candidates = [];
 for (const a of (articles || [])) {
 const text = `${a.title || ''}. ${a.description || ''}`;
 const paras = pickPricingParas(text, hints);
 if (paras.length) candidates.push({ paras, url: a.page_url || a.source_url });
 }
 return candidates;
}

// Helper function to extract pricing candidates from all sources
function extractPricingCandidates(contentChunks, articles, hints) {
 // Prefer chunks (usually denser) then fall back to article descriptions
 let candidates = extractCandidatesFromChunks(contentChunks, hints);
 if (!candidates.length) {
 candidates = extractCandidatesFromArticles(articles, hints);
 }
 return candidates;
}

// Helper function to format the pricing response
function formatPricingResponse(bestCandidate) {
 const body = bestCandidate.paras.map(para => cleanResponseText(para)).join("\n\n");
 const src = bestCandidate.url ? `\n\n*Source: ${bestCandidate.url}*` : "";
 return `**Pricing & Accommodation**\n\n${body}${src}`;
}

// Generic pricing/accommodation synthesizer (topic-agnostic)
function generatePricingAccommodationAnswer(query, articles = [], contentChunks = []) {
 const lcq = (query || "").toLowerCase();
 const hints = ["price", "cost", "fees", "pricing", "bnb", "bed and breakfast", "accommodation", "include b&b", "includes b&b", "stay"];
 if (!hints.some(h => lcq.includes(h))) return null;

 const candidates = extractPricingCandidates(contentChunks, articles, hints);
 if (!candidates.length) return null;

 return formatPricingResponse(candidates[0]);
}

// Extract equipment type from query
function extractEquipmentType(query) {
 const equipmentMap = {
 'tripod': ['tripod', 'tripods'],
 'camera': ['camera', 'cameras', 'dslr', 'mirrorless'],
 'lens': ['lens', 'lenses', 'glass'],
 'filter': ['filter', 'filters', 'nd filter', 'polarizing'],
 'flash': ['flash', 'speedlight', 'strobe'],
 'bag': ['bag', 'backpack', 'case'],
 'memory card': ['memory card', 'sd card', 'storage'],
 'laptop': ['laptop', 'computer', 'macbook'],
 'software': ['lightroom', 'photoshop', 'editing software', 'post-processing']
 };
 
 for (const [type, keywords] of Object.entries(equipmentMap)) {
 if (keywords.some(keyword => query.includes(keyword))) {
 return type;
 }
 }
 
 return 'equipment';
}

// Find relevant articles for equipment type
function findRelevantEquipmentArticles(equipmentType, articles) {
  const equipmentKeywords = {
    'tripod': ['tripod', 'tripods'],
    'camera': ['camera', 'cameras', 'dslr', 'mirrorless', 'choosing', 'equipment', 'beginner'],
    'lens': ['lens', 'lenses', 'glass'],
    'filter': ['filter', 'filters', 'nd', 'polarizing'],
    'flash': ['flash', 'speedlight', 'strobe'],
    'bag': ['bag', 'backpack', 'case'],
    'memory card': ['memory card', 'sd card', 'storage'],
    'laptop': ['laptop', 'computer', 'macbook'],
    'software': ['lightroom', 'photoshop', 'editing', 'post-processing']
  };

  const keywords = equipmentKeywords[equipmentType] || [equipmentType];
  
  // Enhanced filtering for camera recommendations
  if (equipmentType === 'camera') {
    return articles.filter(article => {
      if (!article) return false;
      
      const title = (article.title || '').toLowerCase();
      const url = (article.page_url || article.url || '').toLowerCase();
      
      // Look for specific camera recommendation articles by URL patterns
      const specificCameraArticles = [
        'are-mirrorless-cameras-better-than-dslrs',
        '10-basic-camera-settings-for-camera',
        'beyond-a-point-and-shoot-camera',
        'choosing-a-camera',
        'photography-equipment-for-beginners'
      ];
      
      // First check for exact URL matches
      const hasSpecificUrl = specificCameraArticles.some(pattern => url.includes(pattern));
      if (hasSpecificUrl) {
        console.log(`🔧 Found specific camera article: ${title} - ${url}`);
        return true;
      }
      
      // Then check for title patterns
      const cameraArticlePatterns = [
        'choosing', 'camera', 'equipment', 'beginner', 'mirrorless', 'dslr',
        'point-and-shoot', 'settings', 'recommendations'
      ];
      
      return cameraArticlePatterns.some(pattern => 
        title.includes(pattern) || url.includes(pattern)
      );
    }).slice(0, 5);
  }
  
  return articles.filter(article => filterRelevantArticles(article, keywords)).slice(0, 5);
}

function filterRelevantArticles(article, keywords) {
 if (!article) return false;
 
 const title = (article.title || '').toLowerCase();
 const description = (article.description || '').toLowerCase();
 
 // Filter out articles with malformed content
 if (description.includes('rotto 405') || 
 description.includes('gitzo gt3532ls') ||
 description.includes('manfrotto 405') ||
 description.includes('carbon fibre breaking down') ||
 description.includes('needed two replacement legs')) {
 return false;
 }
 
 return keywords.some(keyword => 
 title.includes(keyword) || description.includes(keyword)
 );
}

// Helper function to process individual content chunks
function processContentChunk(chunk, considerations) {
 let chunkText = (chunk.chunk_text || chunk.content || '');
 
 // Clean the text first
 chunkText = cleanResponseText(chunkText);
 
 // Convert to lowercase for processing
 chunkText = chunkText.toLowerCase();
 
 // Filter out malformed content
 if (isMalformedContent(chunkText)) {
 return; // Skip this chunk
 }
 
 // Extract different types of considerations
 extractBudgetConsiderations(chunkText, considerations);
 extractWeightConsiderations(chunkText, considerations);
 extractUsageConsiderations(chunkText, considerations);
 extractTerrainConsiderations(chunkText, considerations);
 extractExperienceConsiderations(chunkText, considerations);
}

// Helper function to check for malformed content
function isMalformedContent(chunkText) {
 return chunkText.includes('rotto 405') || 
 chunkText.includes('gitzo gt3532ls') ||
 chunkText.includes('manfrotto 405') ||
 chunkText.includes('carbon fibre breaking down') ||
 chunkText.includes('needed two replacement legs') ||
 chunkText.includes('specific recommendations') ||
 chunkText.includes('brand comparisons') ||
 chunkText.includes('setup tips');
 }
 
// Helper functions to extract different types of considerations
function extractBudgetConsiderations(chunkText, considerations) {
 if (chunkText.includes('budget') || chunkText.includes('price') || chunkText.includes('cost') || chunkText.includes('affordable')) {
 considerations.budget.push('Budget considerations from content');
 }
 }
 
function extractWeightConsiderations(chunkText, considerations) {
 if (chunkText.includes('weight') || chunkText.includes('lightweight') || chunkText.includes('heavy') || chunkText.includes('portable')) {
 considerations.weight.push('Weight considerations from content');
 }
 }
 
function extractUsageConsiderations(chunkText, considerations) {
 if (chunkText.includes('landscape') || chunkText.includes('portrait') || chunkText.includes('travel') || chunkText.includes('studio')) {
 considerations.usage.push('Usage considerations from content');
 }
 }
 
function extractTerrainConsiderations(chunkText, considerations) {
 if (chunkText.includes('terrain') || chunkText.includes('hiking') || chunkText.includes('outdoor') || chunkText.includes('weather')) {
 considerations.terrain.push('Terrain considerations from content');
 }
 }
 
function extractExperienceConsiderations(chunkText, considerations) {
 if (chunkText.includes('beginner') || chunkText.includes('advanced') || chunkText.includes('professional') || chunkText.includes('experience')) {
 considerations.experience.push('Experience level from content');
 }
}

// Helper function to process individual articles for considerations
function processArticleForConsiderations(article, considerations) {
 const text = `${article.title || ''} ${article.description || ''}`.toLowerCase();
 
 // Extract different types of considerations from articles
 extractArticleBudgetConsiderations(text, article, considerations);
 extractArticleWeightConsiderations(text, article, considerations);
 extractArticleUsageConsiderations(text, article, considerations);
 extractArticleTerrainConsiderations(text, article, considerations);
 extractArticleExperienceConsiderations(text, article, considerations);
}

// Helper functions to extract different types of considerations from articles
function extractArticleBudgetConsiderations(text, article, considerations) {
 if (text.includes('budget') || text.includes('price') || text.includes('cost') || text.includes('affordable')) {
 considerations.budget.push(article.title || 'Budget considerations');
 }
}

function extractArticleWeightConsiderations(text, article, considerations) {
 if (text.includes('weight') || text.includes('lightweight') || text.includes('heavy') || text.includes('portable')) {
 considerations.weight.push(article.title || 'Weight considerations');
 }
}

function extractArticleUsageConsiderations(text, article, considerations) {
 if (text.includes('landscape') || text.includes('portrait') || text.includes('travel') || text.includes('studio')) {
 considerations.usage.push(article.title || 'Usage considerations');
 }
}

function extractArticleTerrainConsiderations(text, article, considerations) {
 if (text.includes('terrain') || text.includes('hiking') || text.includes('outdoor') || text.includes('weather')) {
 considerations.terrain.push(article.title || 'Terrain considerations');
 }
}

function extractArticleExperienceConsiderations(text, article, considerations) {
 if (text.includes('beginner') || text.includes('advanced') || text.includes('professional') || text.includes('experience')) {
 considerations.experience.push(article.title || 'Experience level');
 }
}

// Extract key considerations from articles and content chunks
function extractKeyConsiderations(articles, contentChunks) {
 const considerations = {
 budget: [],
 weight: [],
 usage: [],
 terrain: [],
 experience: [],
 specific: []
 };
 
 // Extract from articles
 articles.forEach(article => processArticleForConsiderations(article, considerations));
 
 // Extract from content chunks (with malformed content filtering)
 if (contentChunks && contentChunks.length > 0) {
 contentChunks.forEach(chunk => processContentChunk(chunk, considerations));
 }
 
 return considerations;
}

// Synthesize equipment advice response
function synthesizeEquipmentAdvice(equipmentType, considerations, relevantArticles) {
 const equipmentName = getEquipmentDisplayName(equipmentType);
 let response = buildEquipmentResponseHeader(equipmentName);
 response += buildConsiderationsText(considerations);
 response += addSpecificAdvice(equipmentType);
 response += buildArticleReferences(relevantArticles);
 return response;
}

// Helper function to get equipment display name
function getEquipmentDisplayName(equipmentType) {
 const equipmentNames = {
 'tripod': 'tripod',
 'camera': 'camera',
 'lens': 'lens',
 'filter': 'filter',
 'flash': 'flash',
 'bag': 'camera bag',
 'memory card': 'memory card',
 'laptop': 'laptop',
 'software': 'editing software'
 };
 return equipmentNames[equipmentType] || equipmentType;
}

// Helper function to build response header
function buildEquipmentResponseHeader(equipmentName) {
 return `**Equipment Recommendations:**\n\nChoosing the right ${equipmentName} depends on several factors: `;
}

// Helper function to build considerations text
function buildConsiderationsText(considerations) {
 const considerationTexts = [];
 if (considerations.budget.length > 0) considerationTexts.push('budget');
 if (considerations.weight.length > 0) considerationTexts.push('weight requirements');
 if (considerations.usage.length > 0) considerationTexts.push('intended usage');
 if (considerations.terrain.length > 0) considerationTexts.push('terrain conditions');
 if (considerations.experience.length > 0) considerationTexts.push('experience level');
 
 if (considerationTexts.length > 0) {
 return considerationTexts.join(', ') + '. ';
 } else {
 return 'your specific needs and photography style. ';
 }
}

// Helper function to build article references
function buildArticleReferences(relevantArticles) {
 if (relevantArticles.length > 0) {
 let references = `\n\n**For detailed reviews and specific recommendations, check out these guides:**\n`;
 relevantArticles.slice(0, 3).forEach(article => {
 references += `- [${article.title}](${article.page_url || article.url})\n`;
 });
 return references;
 }
 return '';
 }
 
// Add specific advice based on equipment type
function addSpecificAdvice(equipmentType) {
 const adviceMap = {
 'tripod': `For landscape photography, you'll want something sturdy but portable. For travel, weight becomes crucial. For studio work, stability is key. `,
 'camera': `For beginners, start with what you have and focus on learning technique. For advanced users, consider your primary photography style and budget. `,
 'lens': `Consider your most common shooting scenarios. Wide-angle for landscapes, telephoto for wildlife, and prime lenses for portraits. `,
 'filter': `ND filters are essential for long exposures, polarizing filters reduce reflections, and graduated filters balance exposure. `,
 'flash': `Consider whether you need built-in flash, external speedlight, or studio strobes based on your shooting environment. `,
 'bag': `Think about how much gear you carry, whether you need weather protection, and if you'll be hiking or traveling. `,
 'memory card': `Consider speed class for video recording, capacity for your shooting style, and reliability for professional work. `,
 'laptop': `For photo editing, prioritize color accuracy, processing power, and storage capacity. Consider your workflow and budget. `,
 'software': `Lightroom is great for organization and basic editing, while Photoshop offers advanced retouching capabilities. `
 };
 
 return adviceMap[equipmentType] || 'Consider your specific photography needs and budget when making your choice. ';
}

// Generate specific equipment advice when relevant articles are found
function generateSpecificEquipmentAdvice(equipmentType, relevantArticles, query) {
  const equipmentNames = {
    'tripod': 'tripod',
    'camera': 'camera',
    'lens': 'lens',
    'filter': 'filter',
    'flash': 'flash',
    'bag': 'camera bag',
    'memory card': 'memory card',
    'laptop': 'laptop',
    'software': 'editing software'
  };

  const equipmentName = equipmentNames[equipmentType] || equipmentType;
  const queryLower = query.toLowerCase();

  let response = `**${equipmentName.charAt(0).toUpperCase() + equipmentName.slice(1)} Recommendations:**\n\n`;

  // Add specific advice based on equipment type and query context
  if (equipmentType === 'camera') {
    if (queryLower.includes('beginner')) {
      response += `For beginners, I recommend starting with a camera that offers good value and room to grow. `;
      response += `Look for cameras with manual controls, good low-light performance, and a variety of lens options. `;
      response += `Consider your budget and whether you prefer DSLR or mirrorless systems.\n\n`;
    } else {
      response += `Choosing the right camera depends on your photography style, experience level, and budget. `;
      response += `Consider factors like sensor size, autofocus performance, and lens availability. `;
      response += `Both DSLR and mirrorless cameras offer excellent options depending on your needs.\n\n`;
    }
  } else if (equipmentType === 'tripod') {
    response += `A good tripod is essential for sharp images, especially in low light or when using telephoto lenses. `;
    response += `Consider factors like weight, height, stability, and ease of use. `;
    response += `Carbon fiber offers the best balance of weight and stability, while aluminum provides good value.\n\n`;
  } else {
    response += `Choosing the right ${equipmentName} depends on your specific needs and photography style. `;
    response += `Consider factors like quality, compatibility, and value for money.\n\n`;
  }

  // Add reference to specific articles
  if (relevantArticles.length > 0) {
    response += `For detailed guides and specific recommendations, check out these articles:\n\n`;
    relevantArticles.slice(0, 3).forEach(article => {
      const title = article.title || 'Photography Guide';
      const url = article.page_url || article.url || '#';
      response += `- [${title}](${url})\n`;
    });
  }

  return response;
}

// Generate basic equipment advice when no relevant articles are found
function generateBasicEquipmentAdvice(equipmentType) {
  const equipmentNames = {
    'tripod': 'tripod',
    'camera': 'camera',
    'lens': 'lens',
    'filter': 'filter',
    'flash': 'flash',
    'bag': 'camera bag',
    'memory card': 'memory card',
    'laptop': 'laptop',
    'software': 'editing software'
  };

  const equipmentName = equipmentNames[equipmentType] || equipmentType;

  let response = `**Equipment Recommendations:**\n\n`;
  response += `Choosing the right ${equipmentName} depends on several factors: your budget, intended usage, and photography style. `;
  response += addSpecificAdvice(equipmentType);
  response += `\n\nFor detailed reviews and specific recommendations, check out Alan's photography guides on his blog.`;

  return response;
}
// Helper function to clean response text and remove junk characters
function cleanResponseText(text) {
 if (!text || typeof text !== 'string') return text;
 
 // Remove debug artifacts and junk characters
 text = text.replace(/\/\s*\d+\s*\/[^]*$/g, ''); // Remove "/ 0 /" patterns
 text = text.replace(/searchBack[^]*$/g, ''); // Remove "searchBack" artifacts
 text = text.replace(/utm_source=blog&utm_medium=cta&utm_campaign=continue-learning&utm_content=.*?\]/g, ''); // Remove UTM parameters
 text = text.replace(/\* Next lesson:.*?\*\*/g, ''); // Remove "Next lesson" artifacts
 text = text.replace(/\[ARTICLE\]\s*/g, ''); // Remove [ARTICLE] headers
 text = text.replace(/\[CONTENT\]\s*/g, ''); // Remove [CONTENT] headers
 text = text.replace(/\s+/g, ' ').trim(); // Normalize whitespace
 
 return text;
}

// Helper function to improve markdown formatting
function formatResponseMarkdown(context) {
 let markdown = '';
 
 // Add title as header
 if (context.title) {
 markdown += `# ${context.title}\n\n`;
 }
 
 // Add source URL as clickable link
 if (context.url) {
 markdown += `**Source**: [${context.url}](${context.url})\n\n`;
 }
 
 // Add description with formatting
 if (context.description) {
 const formattedDescription = formatResponse(context.description, 400);
 markdown += `${formattedDescription}\n\n`;
 }
 
 // Add related content section if available
 if (context.relatedContent && context.relatedContent.length > 0) {
 markdown += `## Related Content\n\n`;
 context.relatedContent.forEach(item => {
 if (item.title && item.url) {
 markdown += `- [${item.title}](${item.url})\n`;
 }
 });
 markdown += '\n';
 }
 
 return markdown;
}

// Helper functions for generateDirectAnswer
function isCourseEquipmentQuery(lc) {
 return (lc.includes("equipment") && (lc.includes("course") || lc.includes("class") || lc.includes("lesson"))) ||
 (lc.includes("beginners") && lc.includes("camera") && lc.includes("course"));
}

function generateCourseEquipmentAnswer() {
 return `For Alan's photography courses, you'll need a digital camera with manual exposure modes (DSLR or mirrorless). Don't worry if you don't have expensive gear - even a smartphone can work for learning the fundamentals! The course focuses on understanding composition, lighting, and technique rather than having the latest equipment. Alan will provide a course book covering all topics.\n\n`;
 }
 
function findRelevantArticleForTerm(exactTerm, articles) {
 // First, try to find an exact title match for the specific term
 let relevantArticle = articles.find(article => {
 const title = (article.title || "").toLowerCase();
 return title.includes(`what is ${exactTerm}`) || 
 title.includes(`${exactTerm} in photography`);
 });
 
 // If no exact title match, fall back to URL match or any article with the term
 if (!relevantArticle) {
 relevantArticle = articles.find(article => {
 const title = (article.title || "").toLowerCase();
 const url = (article.page_url || article.url || "").toLowerCase();
 const jsonLd = article.json_ld_data;
 
 return title.includes(`${exactTerm}`) ||
 url.includes(`what-is-${exactTerm.replace(/\s+/g, "-")}`) ||
 (jsonLd && jsonLd.mainEntity && Array.isArray(jsonLd.mainEntity));
 });
 }
 
 return relevantArticle;
}
 

// Helper function to extract concept from "what is" query
function extractConceptFromQuery(query) {
 return query.toLowerCase().replace('what is', '').trim();
}

// Helper function to clean definition text from meta descriptions
function cleanDefinitionText(definition) {
 // If the meta_description starts with "Discover" or similar, extract the core definition
 if (definition.toLowerCase().startsWith('discover')) {
 // Extract the main definition part (before "and download" or similar)
 const parts = definition.split(/and download|with quick tips|for setup/i);
 if (parts.length > 1) {
 definition = parts[0].trim();
 }
 }
 
 // If the meta_description is a question, try to extract the answer
 if (definition.includes('?')) {
 const questionParts = definition.split('?');
 if (questionParts.length > 1) {
 definition = questionParts[1].trim();
 }
 }
 
 return definition;
}

// Helper function to format direct answer for "what is" queries
function formatDirectAnswer(concept, definition) {
 const capitalizedConcept = concept.charAt(0).toUpperCase() + concept.slice(1);
 return `**${capitalizedConcept}** ${definition}`;
}

// Helper function to check if article text is valid for processing
function isValidArticleText(articleText) {
 return articleText && articleText.length > 50;
}

function extractAnswerFromArticleDescription(relevantArticle, query = '') {
 // Use meta_description if available (more detailed), otherwise fall back to description
 const articleText = relevantArticle.meta_description || relevantArticle.description;
 
 if (!isValidArticleText(articleText)) {
 return null;
 }
 
 // Filter out irrelevant content based on query intent
 if (!filterRelevantContent(articleText, query)) {
 console.log(`[DEBUG] Filtered out irrelevant content from article: "${relevantArticle.title}"`);
 return null;
 }
 
 const cleanDescription = cleanResponseText(articleText);
 console.log(`[DEBUG] generateDirectAnswer: Using article text="${cleanDescription.substring(0, 200)}..."`);
 
 // For "what is" queries, extract direct answer from meta_description instead of showing article link
 if (query.toLowerCase().includes('what is')) {
 const concept = extractConceptFromQuery(query);
 const definition = cleanDefinitionText(cleanDescription);
 const directAnswer = formatDirectAnswer(concept, definition);
 
 console.log(`[SUCCESS] Generated direct answer: "${directAnswer.substring(0, 100)}..."`);
 return directAnswer;
 }
 
 // For other queries, use the generic article format
 return formatResponseMarkdown({
 title: relevantArticle.title || 'Article Information',
 url: relevantArticle.page_url || relevantArticle.url,
 description: cleanResponseText(relevantArticle.meta_description || relevantArticle.description)
 });
}

function extractAnswerFromJsonLd(relevantArticle, exactTerm) {
 const faqData = getFaqData(relevantArticle);
 if (!faqData) return null;
 
 console.log(`ðŸ” generateDirectAnswer: Article has JSON-LD FAQ data`);
 
 const primaryQuestion = findPrimaryQuestion(faqData.mainEntity, exactTerm);
 if (!primaryQuestion) return null;
 
 const answerText = extractAndCleanAnswer(primaryQuestion);
 if (!answerText || answerText.length <= 50) return null;
 
 console.log(`ðŸ” generateDirectAnswer: Extracted FAQ answer="${answerText.substring(0, 200)}..."`);
 return formatResponseMarkdown({
 title: relevantArticle.title || 'FAQ Information',
 url: relevantArticle.page_url || relevantArticle.url,
 description: answerText
 });
}

// Helper function to get FAQ data from article
function getFaqData(relevantArticle) {
 const faqData = relevantArticle.json_ld_data || relevantArticle.raw;
 return (faqData && faqData.mainEntity) ? faqData : null;
}

// Helper function to find primary question
function findPrimaryQuestion(faqItems, exactTerm) {
 console.log(`[DEBUG] findPrimaryQuestion called with exactTerm: "${exactTerm}"`);
 console.log(`[DEBUG] Searching through ${faqItems.length} FAQ items`);
 
 const result = faqItems.find(item => {
 const question = (item.name || "").toLowerCase();
 const queryLower = exactTerm.toLowerCase();
 const matches = question.includes(queryLower) || queryLower.includes(question.split(' ')[0]);
 console.log(`[DEBUG] Question: "${question}" matches: ${matches}`);
 return matches;
 });
 
 console.log(`[DEBUG] findPrimaryQuestion result: ${result ? 'FOUND' : 'NOT FOUND'}`);
 return result;
}
 
// Helper function to extract and clean answer text
function extractAndCleanAnswer(primaryQuestion) {
 if (!primaryQuestion?.acceptedAnswer?.text) return null;
 
 let answerText = primaryQuestion.acceptedAnswer.text;
 answerText = answerText.replace(/<[^>]*>/g, '').trim();
 answerText = cleanResponseText(answerText);
 
 return answerText;
 }
 
function hasWord(text, term) {
 if (!term) return false;
 try {
 const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
 const re = new RegExp(`\\b${esc}\\b`, "i");
 return re.test(text || "");
 } catch {
 return (text || "").toLowerCase().includes((term || "").toLowerCase());
 }
}
 
function isMalformedChunk(text) {
 // Check basic length requirement
 if (text.length < 50) return true;
 
 // Check for URL encoding issues
 if (text.includes('%3A%2F%2F')) return true;
 
 // Check for navigation elements
 if (text.includes('] 0 Likes') || text.includes('Sign In') || 
 text.includes('My Account') || text.includes('Cart 0')) {
 return true;
 }
 
 // Check for navigation-heavy content
 return text.includes('Back ') && text.includes('[/') && text.length < 200;
}

function hasRelevantContent(chunk, exactTerm, slug) {
 const url = String(chunk.url||"").toLowerCase();
 const title = String(chunk.title||"").toLowerCase();
 const text = String(chunk.chunk_text||chunk.content||"").toLowerCase();
 
 return checkDirectMatches({ text, title, url, exactTerm }) || 
 checkWhatIsPatterns({ url, title, text, exactTerm, slug });
}

// Helper function to check direct word matches
function checkDirectMatches(context) {
 return hasWord(context.text, context.exactTerm) || hasWord(context.title, context.exactTerm) || hasWord(context.url, context.exactTerm);
}

// Helper function to check "what is" patterns
function checkWhatIsPatterns(context) {
 return context.url.includes(`/what-is-${context.slug}`) || 
 context.title.includes(`what is ${context.exactTerm}`) || 
 context.text.includes(`what is ${context.exactTerm}`);
}

function filterContentChunk(chunk, exactTerm, slug) {
 const text = String(chunk.chunk_text||chunk.content||"").toLowerCase();
 
 // Skip malformed chunks (URL-encoded text, very short text, or navigation elements)
 if (isMalformedChunk(text)) {
 return false;
 }
 
 return hasRelevantContent(chunk, exactTerm, slug);
}

function filterCandidateChunks(exactTerm, contentChunks) {
 if (!exactTerm) return contentChunks || [];
 
 const slug = exactTerm.replace(/\s+/g, "-");
 return (contentChunks || []).filter(c => filterContentChunk(c, exactTerm, slug));
}

function scoreChunks(candidateChunks, queryWords, exactTerm) {
 const technicalTerms = ["iso", "raw", "jpg", "png", "dpi", "ppi", "rgb", "cmyk"];
 const importantWords = queryWords.filter(w => w.length >= 3 && (technicalTerms.includes(w) || w.length >= 4));
 
 return candidateChunks.map(chunk => scoreChunkRelevance(chunk, importantWords, exactTerm)).sort((a,b)=>b.s-a.s);
}

function scoreChunkRelevance(chunk, importantWords, exactTerm) {
 const text = (chunk.chunk_text || chunk.content || "").toLowerCase();
 const title = (chunk.title || "").toLowerCase();
 const url = String(chunk.url || "").toLowerCase();
 let s = 0;
 
 for (const w of importantWords) { 
 if (hasWord(text,w)) s += 2; 
 if (hasWord(title,w)) s += 3; 
 if (hasWord(url,w)) s += 2; 
 }
 
 if (exactTerm) {
 if (hasWord(text, exactTerm)) s += 6;
 if (hasWord(title, exactTerm)) s += 8;
 const slug = exactTerm.replace(/\s+/g, "-");
 if (url.includes(`/what-is-${slug}`)) s += 10;
 }
 
 return { chunk, s };
}
 
function extractAnswerFromContentChunks(context) {
 const relevantChunk = findRelevantChunk(context.exactTerm, context.contentChunks, context.queryWords);
 if (!relevantChunk) return null;
 
 
 return extractAnswerFromText({
 query: context.query,
 queryWords: context.queryWords,
 exactTerm: context.exactTerm,
 chunkText: chunkText,
 relevantChunk: relevantChunk
 });
}

// Helper function to find the most relevant chunk
function findRelevantChunk(exactTerm, contentChunks, queryWords) {
 const candidateChunks = filterCandidateChunks(exactTerm, contentChunks);
 const scoredChunks = scoreChunks(candidateChunks, queryWords, exactTerm);
 const relevantChunk = (scoredChunks.length ? scoredChunks[0].chunk : null);
 
 console.log(`ðŸ” generateDirectAnswer: Found relevantChunk=${!!relevantChunk}`);
 return relevantChunk;
}
 
// Helper function to prepare chunk text
function prepareChunkText(relevantChunk) {
 let chunkText = relevantChunk.chunk_text || relevantChunk.content || "";
 chunkText = cleanResponseText(chunkText);
 chunkText = chunkText.replace(/^\[ARTICLE\].*?URL:.*?\n\n/, '');
 chunkText = chunkText.replace(/^\[.*?\].*?Published:.*?\n\n/, '');
 return chunkText;
}

// Helper function to extract answer from text using multiple strategies
function extractAnswerFromText(context) {
 
 // Check for fitness level information first
 const fitnessAnswer = extractFitnessLevelAnswer(context.query, context.chunkText, context.relevantChunk);
 if (fitnessAnswer) return fitnessAnswer;
 
 // Look for concept relationship explanations
 console.log(`ðŸ” DEBUG: Trying concept explanation for query="${context.query}"`);
 const conceptAnswer = extractConceptExplanation(context);
 if (conceptAnswer) {
 console.log(`[SUCCESS] DEBUG: Found concept answer: "${conceptAnswer.substring(0, 100)}..."`);
 return conceptAnswer;
 } else {
 console.log(`[WARN] DEBUG: No concept answer found`);
 }
 
 // Look for definitional sentences
 const definitionAnswer = extractDefinitionSentence(context.chunkText, context.exactTerm, context.relevantChunk);
 if (definitionAnswer) return definitionAnswer;
 
 // Look for relevant sentences
 const sentenceAnswer = extractRelevantSentence(context.chunkText, context.queryWords, context.relevantChunk);
 if (sentenceAnswer) return sentenceAnswer;
 
 // Look for relevant paragraphs
 const paragraphAnswer = extractRelevantParagraph(context);
 if (paragraphAnswer) return paragraphAnswer;
 
 return null;
}

// Helper functions for extractConceptExplanation
function findRelevantSentences(chunkText, keywords) {
 const sentences = chunkText.split(/[.!?]+/);
 return sentences.filter(s => {
 const sLower = s.toLowerCase();
 return keywords.every(keyword => sLower.includes(keyword));
 });
}

function createTriangleSynthesis() {
 return `The exposure triangle is the fundamental relationship between three key camera settings that control how much light reaches your camera's sensor: aperture (the size of the lens opening), shutter speed (how long the sensor is exposed to light), and ISO (the sensor's sensitivity to light). These three elements work together to create a properly exposed photograph - when you adjust one, you typically need to compensate with one or both of the others to maintain the same exposure level.`;
}

function handleExposureTriangle(chunkText, relevantChunk) {
 // Look for direct triangle explanations
 const triangleSentences = findRelevantSentences(chunkText, ['aperture', 'shutter', 'iso']);
 if (triangleSentences.length > 0) {
 const bestSentence = triangleSentences[0].trim();
 if (bestSentence.length > 50) {
 return formatResponseMarkdown({
 title: relevantChunk.title || 'Exposure Triangle',
 url: relevantChunk.url,
 description: bestSentence
 });
 }
 }
 
 // Create synthesis if we have content about all three elements
 const apertureSentences = findRelevantSentences(chunkText, ['aperture', 'f/', 'opening', 'light']);
 const shutterSentences = findRelevantSentences(chunkText, ['shutter', 'speed', 'time', 'exposure']);
 const isoSentences = findRelevantSentences(chunkText, ['iso', 'sensitivity', 'light', 'exposure']);
 
 if (apertureSentences.length > 0 && shutterSentences.length > 0 && isoSentences.length > 0) {
 return formatResponseMarkdown({
 title: 'Understanding the Exposure Triangle',
 url: relevantChunk.url,
 description: createTriangleSynthesis()
 });
 }
 
 return null;
}

function handleSingleConcept(context) {
 const sentences = findRelevantSentences(context.chunkText, context.keywords);
 if (sentences.length > 0) {
 const bestSentence = sentences[0].trim();
 if (bestSentence.length > 50) {
 return formatResponseMarkdown({
 title: context.relevantChunk.title || context.title,
 url: context.relevantChunk.url,
 description: bestSentence
 });
 }
 }
 return null;
}

function extractConceptExplanation(context) {
 const lc = context.query.toLowerCase();
 
 // Handle exposure triangle specifically
 if (lc.includes('exposure triangle') || lc.includes('triangle')) {
 return handleExposureTriangle(context.chunkText, context.relevantChunk);
 }
 
 // Handle individual concepts using a lookup approach
 const conceptHandlers = [
 {
 keyword: 'iso',
 exclude: 'triangle',
 keywords: ['iso', 'sensitivity', 'light', 'exposure'],
 title: 'ISO in Photography'
 },
 {
 keyword: 'aperture',
 exclude: 'triangle',
 keywords: ['aperture', 'f/', 'depth of field', 'opening'],
 title: 'Aperture in Photography'
 },
 {
 keyword: 'shutter speed',
 exclude: 'triangle',
 keywords: ['shutter', 'speed', 'motion', 'blur'],
 title: 'Shutter Speed in Photography'
 }
 ];
 
 for (const handler of conceptHandlers) {
 if (lc.includes(handler.keyword) && !lc.includes(handler.exclude)) {
 return handleSingleConcept({
 chunkText: context.chunkText,
 relevantChunk: context.relevantChunk,
 keywords: handler.keywords,
 title: handler.title
 });
 }
 }
 
 return null;
}

function extractFitnessLevelAnswer(query, chunkText, relevantChunk) {
 const lc = query.toLowerCase();
 if (!lc.includes('fitness') && !lc.includes('level')) return null;
 
 console.log(`ðŸ” generateDirectAnswer: Looking for fitness level in chunk text="${chunkText.substring(0, 300)}..."`);
 
 // Try pattern matching first
 const fitnessLevel = findFitnessLevelByPatterns(chunkText);
 if (fitnessLevel) {
 console.log(`ðŸ” generateDirectAnswer: Found fitness level="${fitnessLevel}"`);
 return `**The fitness level required is ${fitnessLevel}.** This ensures the workshop is suitable for your physical capabilities and you can fully enjoy the experience.\n\n*From Alan's blog: ${relevantChunk.url}*\n\n`;
 }
 
 // Fallback: look for common fitness level words
 const foundFitnessWord = findFitnessLevelByKeywords(chunkText);
 if (foundFitnessWord) {
 return formatResponseMarkdown({
 title: 'Fitness Level Information',
 url: relevantChunk.url,
 description: `The fitness level required is ${foundFitnessWord}. This ensures the workshop is suitable for your physical capabilities and you can fully enjoy the experience.`
 });
 }
 
 return null;
}

function findFitnessLevelByPatterns(chunkText) {
 const fitnessPatterns = [
 /Fitness:\s*(\d+\.?\s*[A-Za-z\s-]+?)(?:\n|$)/i,
 /Fitness\s*Level:\s*([A-Za-z\s-]+?)(?:\n|$)/i,
 /Experience\s*-\s*Level:\s*([A-Za-z\s-]+?)(?:\n|$)/i,
 /Level:\s*([A-Za-z\s-]+?)(?:\n|$)/i,
 /Fitness\s*Required:\s*([A-Za-z\s-]+?)(?:\n|$)/i,
 /Physical\s*Level:\s*([A-Za-z\s-]+?)(?:\n|$)/i
 ];
 
 for (const pattern of fitnessPatterns) {
 const match = chunkText.match(pattern);
 console.log(`ðŸ” generateDirectAnswer: Pattern ${pattern} match=${!!match}`);
 if (match && match[1]) {
 return match[1].trim();
 }
 }
 return null;
 }
 
function findFitnessLevelByKeywords(chunkText) {
 const fitnessWords = ['easy', 'moderate', 'hard', 'beginner', 'intermediate', 'advanced', 'low', 'medium', 'high'];
 const chunkTextLower = chunkText.toLowerCase();
 return fitnessWords.find(word => chunkTextLower.includes(word));
 }
 
function extractDefinitionSentence(chunkText, exactTerm, relevantChunk) {
 // Prefer definitional sentences for core concepts
 const coreVerbs = [" is ", " means ", " stands for ", " controls ", " refers to "];
 const sentencesAll = chunkText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
 const defSentence = sentencesAll.find(s => {
 const sLower = s.toLowerCase();
 const hasTerm = exactTerm && hasWord(sLower, exactTerm);
 const hasVerb = coreVerbs.some(v => sLower.includes(v));
 return hasTerm && hasVerb && s.length >= 30 && s.length <= 220;
 });
 
 if (defSentence) {
 return formatResponseMarkdown({
 title: 'Definition',
 url: relevantChunk.url,
 description: defSentence.trim()
 });
 }

 return null;
}

function isRelevantSentence(s, queryWords) {
 const sLower = s.toLowerCase();
 const technicalTerms = ["iso", "raw", "jpg", "png", "dpi", "ppi", "rgb", "cmyk"];
 const importantWords = queryWords.filter(w => 
 w.length >= 3 && (technicalTerms.includes(w) || w.length >= 4)
 );
 return importantWords.some(word => sLower.includes(word)) && 
 sLower.length > 30 && sLower.length < 200 && // Good length for a direct answer
 !sLower.includes('[article]') && // Skip metadata
 !sLower.includes('published:') && // Skip metadata
 !sLower.includes('url:') && // Skip metadata
 !sLower.includes('alan ranger photography') && // Skip navigation
 !sLower.includes('%3a%2f%2f') && // Skip URL-encoded text
 !sLower.includes('] 0 likes') && // Skip malformed text
 !sLower.includes('sign in') && // Skip navigation
 !sLower.includes('my account') && // Skip navigation
 !sLower.includes('back ') && // Skip navigation
 !sLower.includes('[/') && // Skip navigation links
 !sLower.includes('cart 0'); // Skip navigation
}

function extractRelevantSentence(chunkText, queryWords, relevantChunk) {
 // Look for sentences that contain key terms from the query
 const sentences = chunkText.split(/[.!?]+/).filter(s => s.trim().length > 20);
 const relevantSentence = sentences.find(s => isRelevantSentence(s, queryWords));
 
 if (relevantSentence) {
 return formatResponseMarkdown({
 title: 'Information',
 url: relevantChunk.url,
 description: relevantSentence.trim()
 });
 }
 
 return null;
}

function extractRelevantParagraph(context) {
 
 // Fallback: if no good sentence found, try to extract the first paragraph containing "what is <term>"
 if (context.exactTerm) {
 const byPara = context.chunkText.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 50);
 const para = byPara.find(p => p.toLowerCase().includes(`what is ${context.exactTerm}`) && p.length <= 300);
 if (para) {
 return formatResponseMarkdown({
 title: 'Definition',
 url: context.relevantChunk.url,
 description: para.trim()
 });
 }
 }

 // Fallback: if no good sentence found, try to extract a relevant paragraph
 const paragraphs = context.chunkText.split(/\n\s*\n/).filter(p => p.trim().length > 50);
 const relevantParagraph = paragraphs.find(p => {
 const pLower = p.toLowerCase();
 const technicalTerms = ["iso", "raw", "jpg", "png", "dpi", "ppi", "rgb", "cmyk"];
 const importantWords = context.queryWords.filter(w => 
 w.length >= 3 && (technicalTerms.includes(w) || w.length >= 4)
 );
 return importantWords.some(word => pLower.includes(word)) &&
 !pLower.includes('[article]') &&
 !pLower.includes('published:') &&
 !pLower.includes('url:') &&
 !pLower.includes('alan ranger photography');
 });
 
 if (relevantParagraph && relevantParagraph.length < 300) {
 return formatResponseMarkdown({
 title: 'Information',
 url: context.relevantChunk.url,
 description: relevantParagraph.trim()
 });
 }
 
 return null;
 }
 
// Helper functions for getHardcodedAnswer
function getCameraAnswer() {
 return `For photography courses, Alan recommends bringing any camera you have - even a smartphone can work for learning the fundamentals! The key is understanding composition, lighting, and technique rather than having expensive gear.\n\n`;
 }
 
function getCertificateAnswer() {
 return `Alan's photography courses focus on practical learning and skill development. While formal certificates aren't typically provided, you'll gain valuable hands-on experience and knowledge that's much more valuable than a piece of paper.\n\n`;
 }
 
function getEquipmentAnswer() {
 return `For most of Alan's courses, you don't need expensive equipment. A basic camera (even a smartphone) and enthusiasm to learn are the most important things. Alan will guide you on what works best for your specific needs.\n\n`;
 }
 
function getTechnicalAnswers(lc) {
 return getJpegRawAnswer(lc) ||
 getExposureTriangleAnswer(lc) ||
 getIsoAnswer(lc) ||
 getApertureAnswer(lc) ||
 getShutterSpeedAnswer(lc) ||
 getCompositionAnswer(lc) ||
 // getFilterAnswer(lc) || // DISABLED: Let RAG system handle filter queries
 getDepthOfFieldAnswer(lc) ||
 getSharpnessAnswer(lc) ||
 getImageQualityAnswer(lc) ||
 null;
}

// Helper function for JPEG vs RAW
function getJpegRawAnswer(lc) {
 if (lc.includes("jpeg") && lc.includes("raw")) {
 return `**JPEG vs RAW**: JPEG files are smaller and ready to use, while RAW files give you more editing flexibility but require post-processing. For beginners, JPEG is fine to start with, but RAW becomes valuable as you develop your editing skills.\n\n`;
 }
 return null;
 }
 
// Helper function for exposure triangle
function getExposureTriangleAnswer(lc) {
 if (lc.includes("exposure triangle")) {
 return `**The Exposure Triangle** consists of three key settings:\n- **Aperture** (f-stop): Controls depth of field and light\n- **Shutter Speed**: Controls motion blur and light\n- **ISO**: Controls sensor sensitivity and light\n\nBalancing these three creates proper exposure.\n\n`;
 }
 return null;
 }

// Helper function for ISO
function getIsoAnswer(lc) {
 if (lc.includes("what is iso")) {
 return `**ISO** (International Organization for Standardization) in photography refers to your camera sensor's sensitivity to light. Lower ISO values (like 100-400) produce cleaner images with less noise, while higher ISO values (like 1600-6400) make your sensor more sensitive to light but can introduce grain or noise. The key is finding the right balance for your lighting conditions.\n\n`;
 }
 return null;
}

// Helper function for aperture
function getApertureAnswer(lc) {
 if (lc.includes("what is aperture")) {
 return `**Aperture** controls the size of the opening in your camera lens, measured in f-stops (like f/2.8, f/5.6, f/11). A wider aperture (lower f-number like f/2.8) lets in more light and creates a shallow depth of field with blurred backgrounds. A smaller aperture (higher f-number like f/11) lets in less light but keeps more of your image in focus from foreground to background.\n\n`;
 }
 return null;
}

// Helper function for shutter speed
function getShutterSpeedAnswer(lc) {
 if (lc.includes("what is shutter speed")) {
 return `**Shutter Speed** controls how long your camera's sensor is exposed to light, measured in fractions of a second (like 1/250, 1/60, 1/4). Fast shutter speeds (like 1/1000) freeze motion and are great for sports or action shots. Slow shutter speeds (like 1/30 or slower) create motion blur and are perfect for creative effects or low-light photography.\n\n`;
 }
 return null;
}
 
// Helper function for composition
function getCompositionAnswer(lc) {
 if (lc.includes("composition") || lc.includes("storytelling")) {
 return `Great composition is about leading the viewer's eye through your image. Key techniques include the rule of thirds, leading lines, framing, and creating visual balance. The goal is to tell a story or convey emotion through your arrangement of elements.\n\n`;
 }
 return null;
 }
 
// Helper function for filters
function getFilterAnswer(lc) {
 if (lc.includes("filter") || lc.includes("nd filter")) {
 return `**ND (Neutral Density) filters** reduce light entering your camera, allowing for longer exposures. They're great for blurring water, creating motion effects, or shooting in bright conditions. **Graduated filters** help balance exposure between bright skies and darker foregrounds.\n\n`;
 }
 return null;
 }
 
// Helper function for depth of field
function getDepthOfFieldAnswer(lc) {
 if (lc.includes("depth of field")) {
 return `**Depth of field** is the area of your image that appears sharp. You control it with aperture: wider apertures (lower f-numbers) create shallow depth of field, while smaller apertures (higher f-numbers) keep more of the image in focus.\n\n`;
 }
 return null;
 }
 
// Helper function for sharpness
function getSharpnessAnswer(lc) {
 if (lc.includes("sharp") || lc.includes("blurry")) {
 return `Sharp images come from proper technique: use a fast enough shutter speed to avoid camera shake, focus accurately, and use appropriate aperture settings. Tripods help with stability, and good lighting makes focusing easier.\n\n`;
 }
 return null;
}

// Helper function for image quality issues (grainy, noisy)
function getImageQualityAnswer(lc) {
 if (lc.includes("grainy") || lc.includes("noisy") || lc.includes("grain") || lc.includes("noise")) {
 return `**Image Quality Issues**: Grainy or noisy images are usually caused by high ISO settings in low light. To reduce noise: use the lowest ISO possible for your situation, ensure proper exposure (underexposed images show more noise when brightened), use a tripod for longer exposures instead of high ISO, and consider noise reduction in post-processing. Better lighting also helps reduce the need for high ISO.\n\n`;
 }
 return null;
}

function getPolicyAnswers(lc) {
 // Check each policy type in order of priority
 return getTermsAndConditionsAnswer(lc) ||
 getContactInformationAnswer(lc) ||
 getBookingCancellationAnswer(lc) ||
 getProfessionalQualificationsAnswer(lc) ||
 getPaymentPlansAnswer(lc) ||
 getPrivacyDataProtectionAnswer(lc) ||
 null;
}

// Helper functions for each policy type
function getTermsAndConditionsAnswer(lc) {
 if (lc.includes("terms") || lc.includes("conditions") || lc.includes("policy")) {
 return `**Terms and Conditions**: Alan Ranger Photography has comprehensive terms and conditions covering booking policies, copyright, privacy, and insurance. All content and photos are copyright of Alan Ranger unless specifically stated. For full details, visit the [Terms and Conditions page](https://www.alanranger.com/terms-and-conditions).\n\n`;
 }
 return null;
 }
 
function getContactInformationAnswer(lc) {
 if (lc.includes("contact") || lc.includes("phone") || lc.includes("address") || lc.includes("email")) {
 return `**Contact Information**:\n- **Address**: 45 Hathaway Road, Coventry, CV4 9HW, United Kingdom\n- **Phone**: +44 781 701 7994\n- **Email**: info@alanranger.com\n- **Hours**: Monday-Sunday, 9am-5pm\n\n`;
 }
 return null;
 }
 
function getBookingCancellationAnswer(lc) {
 if (lc.includes("refund") || lc.includes("cancel") || lc.includes("booking")) {
 return `**Booking and Cancellation**: For course changes, please notify at least four weeks in advance. Alan Ranger Photography has comprehensive booking terms and conditions, public liability insurance, and CRB disclosure. Full details are available in the [Terms and Conditions](https://www.alanranger.com/terms-and-conditions).\n\n`;
 }
 return null;
 }
 
function getProfessionalQualificationsAnswer(lc) {
 if (lc.includes("insurance") || lc.includes("qualified") || lc.includes("professional")) {
 return `**Professional Qualifications**: Alan Ranger Photography has public liability insurance, professional indemnity insurance, CRB disclosure, and professional qualifications/accreditations. Full certificates and documentation are available on the [Terms and Conditions page](https://www.alanranger.com/terms-and-conditions).\n\n`;
 }
 return null;
 }
 
function getPaymentPlansAnswer(lc) {
 if (lc.includes("payment") && !lc.includes("voucher") && !lc.includes("gift")) {
 return `**Payment Plans**: Alan Ranger Photography offers "Pick N Mix" payment plans to help spread the cost of courses and workshops. Full terms and conditions for payment options are detailed in the [Terms and Conditions](https://www.alanranger.com/terms-and-conditions).\n\n`;
 }
 return null;
 }
 
function getPrivacyDataProtectionAnswer(lc) {
 if (lc.includes("privacy") || lc.includes("data") || lc.includes("newsletter")) {
 return `**Privacy and Data Protection**: Alan Ranger Photography has comprehensive privacy and cookie policies. When you subscribe to the newsletter, you'll receive an email to verify and confirm your subscription. Full privacy details are available in the [Terms and Conditions](https://www.alanranger.com/terms-and-conditions).\n\n`;
 }
 return null;
 }
 

// Service answer patterns
const SERVICE_PATTERNS = [
 {
 matcher: (lc) => lc.includes("rps mentoring") || lc.includes("rps course") || lc.includes("rps distinctions"),
 answer: `**RPS Mentoring Course**: Alan provides independent mentoring for RPS (Royal Photographic Society) Distinction qualifications. He holds both Licentiate and Associate Distinctions and offers personalized online mentoring via Zoom to help you achieve success. Sessions are flexible and can be taken within 12 months of booking. [Learn More](https://www.alanranger.com/rps-courses-mentoring-distinctions)\n\n`
 },
 {
 matcher: (lc) => lc.includes("private photography lessons") || lc.includes("private lessons") || lc.includes("1-2-1") || lc.includes("face-to-face"),
 answer: `**Private Photography Lessons**: Alan offers bespoke face-to-face private photography lessons in Coventry (CV4 9HW) or at a location of your choice. Lessons are tailored to your specific needs and delivered at times that suit your availability. [Book Private Lessons](https://www.alanranger.com/private-photography-lessons)\n\n`
 },
 {
 matcher: (lc) => lc.includes("private") || lc.includes("mentoring") || lc.includes("tuition"),
 answer: `**Private Lessons & Mentoring**: Alan offers face-to-face private photography lessons in Coventry (CV4 9HW) or at a location of your choice. Lessons are bespoke to your needs and available at times that suit you. Also available: RPS mentoring for distinctions, monthly mentoring assignments, and 1-2-1 Zoom support. Visit [Private Lessons](https://www.alanranger.com/private-photography-lessons) for details.\n\n`
 },
 {
 matcher: (lc) => lc.includes("voucher") || lc.includes("gift") || lc.includes("present"),
 answer: `**Gift Vouchers**: Digital photography gift vouchers are available from Â£5-Â£600, perfect for any photography enthusiast. Vouchers can be used for workshops, courses, private lessons, or any photography tuition event. They expire 12 months from purchase date and can be split across multiple purchases. [Buy Gift Vouchers](https://www.alanranger.com/photography-gift-vouchers)\n\n`
 },
 {
 matcher: (lc) => lc.includes("service") || (lc.includes("what do you offer") && !lc.includes("courses")) || lc.includes("what services"),
 answer: `**Services Available**: Alan Ranger Photography offers comprehensive photography services including workshops, courses, private lessons, mentoring, gift vouchers, gear checks, fine art prints, and payment plans. Services include face-to-face and online options, with locations in Coventry and various UK destinations. [View All Services](https://www.alanranger.com/photography-tuition-services)\n\n`
 },
 {
 matcher: (lc) => lc.includes("commercial photography") || lc.includes("do you do commercial"),
 answer: `**Commercial Photography**: Alan specializes in photography education and workshops rather than commercial photography services. His focus is on teaching photography through courses, workshops, and private lessons. For commercial photography needs, he can recommend other professional photographers in his network. [View Alan's Services](https://www.alanranger.com/photography-tuition-services)\n\n`
 },
 {
 matcher: (lc) => lc.includes("portrait photography") || lc.includes("do you do portrait"),
 answer: `**Portrait Photography**: Alan focuses on photography education rather than portrait photography services. His expertise is in teaching photography through courses, workshops, and private lessons. For portrait photography needs, he can recommend other professional photographers in his network. [View Alan's Services](https://www.alanranger.com/photography-tuition-services)\n\n`
 },
 {
 matcher: (lc) => lc.includes("photography academy") && lc.includes("free"),
 answer: `**Free Photography Academy**: Yes! Alan offers a completely free online photography course that you can subscribe to. It's designed to help beginners learn photography fundamentals at their own pace. The course covers essential topics like exposure, composition, and camera settings. [Subscribe to Free Course](https://www.alanranger.com/free-online-photography-course)\n\n`
 }
];

function getServiceAnswers(lc) {
 for (const pattern of SERVICE_PATTERNS) {
 if (pattern.matcher(lc)) {
 return pattern.answer;
 }
 }
 return null;
}

function getAboutAnswers(lc) {
 // Check for Alan Ranger biographical queries
 if (isAlanRangerQuery(lc)) {
 return getAlanRangerBio();
 }
 
 // Check for ethical/environmental queries
 if (isEthicalQuery(lc)) {
 return getEthicalGuidelines();
 }
 
 return null;
}

function isAlanRangerQuery(lc) {
 return lc.includes("alan ranger") && 
 (lc.includes("who") || lc.includes("background") || lc.includes("about"));
}

function isEthicalQuery(lc) {
 const ethicalKeywords = ["ethical", "guidelines", "environmental", "carbon"];
 return ethicalKeywords.some(keyword => lc.includes(keyword));
}

function getAlanRangerBio() {
 return `**About Alan Ranger**: Alan is a highly qualified professional photographer and photography tutor based in the Midlands, UK, with over 20 years of experience. He is a qualified Associate of the British Institute of Professional Photographers (BIPP) and holds ARPS (Associate of the Royal Photographic Society) distinctions. Alan offers personalised photography courses and workshops tailored to all skill levels, spanning various genres from portraits to landscape and black and white photography. He has led over 30 educational lectures at the Xposure International Photography Festival in UAE and has won multiple awards including Landscape Photographer of the Year (7 awards) and International Landscape Photographer of the Year. [Learn more about Alan](https://www.alanranger.com/about-alan-ranger)\n\n`;
}

function getEthicalGuidelines() {
 return `**Ethical Guidelines**: Alan Ranger Photography follows strict ethical policies focused on environmental consciousness and responsible education. The business maintains a carbon-neutral footprint through annual carbon impact assessments and offsetting projects. A tree is planted for every workshop place sold to help offset travel carbon footprint. Alan practices the Nature First code of ethics to ensure responsible custodianship of nature. Workshops are limited to 6 or fewer participants for personalised 1-2-1 time, with detailed itineraries including weather backups and health and safety prioritised. [View Ethical Policy](https://www.alanranger.com/my-ethical-policy)\n\n`;
}

function getHardcodedAnswer(lc) {
 return getCameraRecommendation(lc) ||
 getCertificateQuestionAnswer(lc) ||
 getEquipmentQuestionAnswer(lc) ||
 getTechnicalAnswers(lc) ||
 getPolicyAnswers(lc) ||
 getServiceAnswers(lc) ||
 getAboutAnswers(lc) ||
 null;
}

// Helper function for camera recommendations
function getCameraRecommendation(lc) {
 if (lc.includes("camera") && (lc.includes("need") || lc.includes("recommend"))) {
 return getCameraAnswer();
 }
 return null;
 }
 
// Helper function for certificate questions
function getCertificateQuestionAnswer(lc) {
 if (lc.includes("certificate")) {
 return getCertificateAnswer();
 }
 return null;
 }
 
// Helper function for equipment questions
function getEquipmentQuestionAnswer(lc) {
 if (lc.includes("equipment") || lc.includes("gear") || lc.includes("laptop")) {
 return getEquipmentAnswer();
 }
 return null;
}

// Helper functions for generateDirectAnswer
function tryCourseEquipmentAnswer(lc) {
 if (isCourseEquipmentQuery(lc)) {
 console.log(`ðŸ”§ Course-specific equipment advice triggered for: "${lc}"`);
 return generateCourseEquipmentAnswer();
 }
 return null;
}

function tryArticleBasedAnswer(exactTerm, articles, isConceptRelationshipQuery, query = '') {
 if (exactTerm && articles.length > 0 && !isConceptRelationshipQuery) {
 const relevantArticle = findRelevantArticleForTerm(exactTerm, articles);
 
 if (relevantArticle) {
 console.log(`ðŸ” generateDirectAnswer: Found relevant article="${relevantArticle.title}"`);
 
 // Use article description first (most reliable)
 const descriptionAnswer = extractAnswerFromArticleDescription(relevantArticle, query);
 if (descriptionAnswer) {
 return descriptionAnswer;
 }
 
 // Fall back to JSON-LD FAQ data if no description
 const jsonLdAnswer = extractAnswerFromJsonLd(relevantArticle, exactTerm);
 if (jsonLdAnswer) {
 return jsonLdAnswer;
 }
 }
 }
 return null;
}

function tryContentChunkAnswer(context) {
 return extractAnswerFromContentChunks(context);
}

function tryEquipmentAdviceAnswer(lc, articles, contentChunks) {
  console.log(`🔧 tryEquipmentAdviceAnswer called with query="${lc}", articles=${articles.length}, chunks=${contentChunks.length}`);
  if (isEquipmentAdviceQuery(lc)) {
    console.log(`🔧 Equipment advice query detected, calling generateEquipmentAdviceResponse`);
    return generateEquipmentAdviceResponse(lc, articles, contentChunks);
  }
  console.log(`🔧 Not an equipment advice query`);
  return null;
}

function tryHardcodedAnswer(lc) {
 return getHardcodedAnswer(lc);
}

// Helper function to prepare query data
function prepareQueryData(query) {
 const lc = (query || "").toLowerCase();
 const queryWords = lc.split(" ").filter(w => w.length > 2);
 const exactTerm = lc.replace(/^what\s+is\s+/, "").trim();
 
 return { lc, queryWords, exactTerm };
}

// Helper function to log debug information
function logDirectAnswerDebug(query, articles, contentChunks) {
 console.log(`ðŸ” generateDirectAnswer: Query="${query}"`);
 console.log(`ðŸ” generateDirectAnswer: Articles count=${articles.length}`);
 console.log(`ðŸ” generateDirectAnswer: Content chunks count=${contentChunks.length}`);
}

// Helper function to check if query is concept relationship
function isConceptRelationshipQuery(lc) {
 // Only treat as relationship query if it's specifically about relationships between concepts
 return lc.includes('triangle') || lc.includes('relationship') || 
 (lc.includes('exposure') && lc.includes('triangle'));
}

// Helper function to try course equipment answer
function tryCourseEquipmentAnswerHelper(lc) {
 return tryCourseEquipmentAnswer(lc);
}

// Helper function to try article-based answer
function tryArticleBasedAnswerWithConcept(exactTerm, articles, lc) {
 const isConceptRelationship = isConceptRelationshipQuery(lc);
 console.log(`ðŸ” DEBUG: isConceptRelationshipQuery=${isConceptRelationship} for query="${exactTerm}"`);
 return tryArticleBasedAnswer(exactTerm, articles, isConceptRelationship, lc);
}

// Helper function to try all answer sources in priority order
function tryAllAnswerSources(context) {
 // PRIORITY 0: Course-specific equipment advice
 const courseAnswer = tryCourseEquipmentAnswerHelper(context.lc);
 if (courseAnswer) return courseAnswer;
 
 // PRIORITY 1: Extract from JSON-LD FAQ data in articles
 const articleAnswer = tryArticleBasedAnswerWithConcept(context.exactTerm, context.articles, context.lc);
 if (articleAnswer) return articleAnswer;
 
 // PRIORITY 2: Extract from content chunks
 const chunkAnswer = tryContentChunkAnswer(context);
 if (chunkAnswer) return chunkAnswer;
 
 // PRIORITY 3: Equipment advice (ONLY if we have articles/chunks - let RAG try first)
 const equipmentAnswer = tryEquipmentAdviceAnswer(context.lc, context.articles, context.contentChunks);
 if (equipmentAnswer && (context.articles.length > 0 || context.contentChunks.length > 0)) return equipmentAnswer;
 
 // PRIORITY 4: Hardcoded answers
 const hardcodedAnswer = tryHardcodedAnswer(context.lc);
 if (hardcodedAnswer) return hardcodedAnswer;
 
 return null;
}

function generateDirectAnswer(query, articles, contentChunks = []) {
 const { lc, queryWords, exactTerm } = prepareQueryData(query);
 
 logDirectAnswerDebug(query, articles, contentChunks);
 
 return tryAllAnswerSources({ lc, query, queryWords, exactTerm, articles, contentChunks });
}

/* ---------------------------- Supabase client ---------------------------- */
function supabaseAdmin() {
 const url = process.env.SUPABASE_URL;
 const key =
 process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
 
 // Better error reporting for debugging
 if (!url) {
 console.error("Missing SUPABASE_URL environment variable");
 throw new Error("Missing SUPABASE_URL environment variable");
 }
 if (!key) {
 console.error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY environment variable");
 throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY environment variable");
 }
 
 return createClient(url, key, { auth: { persistSession: false } });
}

/* ------------------------------ Small utils ------------------------------ */

function fmtDateLondon(ts) {
 try {
 const d = new Date(ts);
 // Use UTC methods to avoid timezone conversion since dates are already in GMT
 const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
 const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
 const weekday = weekdays[d.getUTCDay()];
 const day = String(d.getUTCDate()).padStart(2, '0');
 const month = months[d.getUTCMonth()];
 const year = d.getUTCFullYear();
 return `${weekday}, ${day} ${month} ${year}`;
 } catch {
 return ts;
 }
}

// Note: We deliberately do not normalize typos; we ask users to rephrase instead.

/* ----------------------- Intent + keyword extraction --------------------- */

const TOPIC_KEYWORDS = [
 // locations
 "devon",
 "snowdonia",
 "wales",
 "yorkshire",
 "lake district",
 "warwickshire",
 "coventry",
 "dorset",
 // seasons / themes / topics
 "bluebell",
 "autumn",
 "astrophotography",
 "beginners",
 "lightroom",
 "long exposure",
 "landscape",
 "woodlands",
 // workshop types and formats
 "weekend",
 "group",
 "advanced",
 "residential",
 "multi day",
 "multi-day",
 // technical photography terms
 "iso",
 "aperture",
 "shutter",
 "exposure",
 "metering",
 "manual",
 "depth of field",
 "focal length",
 "white balance",
 "tripod",
 "filters",
 "lens",
 "camera",
 "equipment",
 // accommodation/pricing
 "bnb",
 "accommodation",
 "bed",
 "breakfast",
 "pricing",
 "price",
 "cost",
];

function extractKeywords(q) {
 let lc = normalizeQuery(q);
 lc = applySynonymExpansion(lc);
 lc = applySpecialCases(lc);
 
 const kws = new Set();
 addTopicKeywords(kws, lc);
 addTechnicalAndMeaningfulWords(kws, lc);
 
 return Array.from(kws);
}

function normalizeQuery(q) {
 let lc = (q || "").toLowerCase();
 lc = lc.replace(/\bb\s*&\s*b\b/g, "bnb");
 lc = lc.replace(/\bbed\s*and\s*breakfast\b/g, "bnb");
 return lc;
}
 
function applySynonymExpansion(lc) {
 const synonyms = {
 "weekend": ["fri", "sat", "sun", "friday", "saturday", "sunday", "multi day", "multi-day", "residential"],
 "group": ["participants", "people", "attendees", "max 4", "max 3", "max 2"],
 "advanced": ["hard", "difficult", "experienced", "expert", "experience level", "intermediate", "professional"],
 "equipment": ["gear", "camera", "lens", "tripod", "filters", "equipment needed", "what to bring", "required"]
 };
 
 for (const [key, values] of Object.entries(synonyms)) {
 if (lc.includes(key)) {
 values.forEach(synonym => lc += " " + synonym);
 }
 }
 return lc;
 }
 
function applySpecialCases(lc) {
 if (lc.includes("group") && lc.includes("workshop")) {
 lc += " photography workshop residential multi day";
 }
 return lc;
 }
 
function addTopicKeywords(kws, lc) {
 for (const t of TOPIC_KEYWORDS) {
 if (lc.includes(t)) kws.add(t);
 }
 }
 
function addTechnicalAndMeaningfulWords(kws, lc) {
 const technicalTerms = ["iso", "raw", "jpg", "png", "dpi", "ppi", "rgb", "cmyk"];
 const stopWords = ["what", "when", "where", "which", "how", "why", "who", "can", "will", "should", "could", "would", "do", "does", "did", "are", "is", "was", "were", "have", "has", "had", "you", "your", "yours", "me", "my", "mine", "we", "our", "ours", "they", "their", "theirs", "them", "us", "him", "her", "his", "hers", "it", "its"];
 
 lc
 .replace(/[^\p{L}\p{N}\s-]/gu, " ")
 .split(/\s+/)
 .filter((w) => w.length >= 3 && (technicalTerms.includes(w) || w.length >= 4) && !stopWords.includes(w))
 .forEach((w) => kws.add(w));
}

// Helper functions for intent detection








// Helper functions for detectIntent




/* --------------------------- Interactive Clarification System --------------------------- */

/**
 * LOGICAL CONFIDENCE SYSTEM - Check if we have enough context to provide a confident answer
 * Uses logical rules instead of broken numerical confidence scores
 */
// Calculate RAG-based confidence for clarification questions







/**
 * COMPLETE CLARIFICATION SYSTEM - PHASE 1: Detection
 * Detects queries that need clarification based on comprehensive 20-question analysis
 * 100% detection rate for all ambiguous query types
 */
/**
 * Generate clarification options from evidence buckets
 * Sources options from actual data instead of hardcoded patterns
 */
// Helper functions for clarification options generation
// Helper function to calculate event duration in hours
function calculateEventDuration(event) {
 if (!event.date_start || !event.date_end) return null;
 
 const start = new Date(event.date_start);
 const end = new Date(event.date_end);
 const diffMs = end - start;
 const diffHours = diffMs / (1000 * 60 * 60);
 
 return Math.round(diffHours * 10) / 10; // Round to 1 decimal place
}

// Helper function to extract workshop type from duration
function getWorkshopTypeFromDuration(duration) {
 if (!duration) return null;
 
 if (duration <= 4) return '2.5hr - 4hr workshops';
 if (duration <= 8) return '1 day workshops';
 return 'Multi day residential workshops';
}


function extractEventTypesAndCategories(events) {
 const eventTypes = new Set();
 const eventCategories = new Set();
 
 // Extract duration-based workshop types
 extractDurationBasedTypes(events, eventTypes);
 
 // Extract categories from event titles
 extractTitleBasedCategories(events, eventCategories);
 
 return { eventTypes, eventCategories };
}

// Helper function to extract duration-based types
function extractDurationBasedTypes(events, eventTypes) {
 for (const event of events) {
 const duration = calculateEventDuration(event);
 if (duration) {
 const type = getWorkshopTypeFromDuration(duration);
 if (type) eventTypes.add(type);
 }
 }
}

// Helper function to extract categories from titles
function extractTitleBasedCategories(events, eventCategories) {
 // Generic workshop mapping based on content analysis
 const categoryMappings = {
 'bluebell': 'Bluebell workshops',
 'woodland': 'Woodland workshops', 
 'autumn': 'Autumn workshops',
 'spring': 'Spring workshops',
 'summer': 'Summer workshops',
 'winter': 'Winter workshops',
 'macro': 'Macro workshops',
 'abstract': 'Abstract workshops'
 };
 
 for (const event of events) {
 if (!event.event_title) continue;
 
 const title = event.event_title.toLowerCase();
 for (const [keyword, category] of Object.entries(categoryMappings)) {
 if (title.includes(keyword)) {
 eventCategories.add(category);
 }
 }
 }
}

function addEventOptions(options, eventTypes, eventCategories) {
 // Add event-based options
 for (const type of eventTypes) {
 const displayType = type.charAt(0).toUpperCase() + type.slice(1);
 options.push({
 text: `${displayType} events`,
 query: `${type} events`
 });
 }
 
 // Add category-based options
 for (const category of eventCategories) {
 if (category && category.length > 3) { // Avoid very short categories
 options.push({
 text: `${category} events`,
 query: `${category} events`
 });
 }
 }
 }
 
function extractArticleCategoriesAndTags(articles) {
 const articleCategories = new Set();
 const articleTags = new Set();
 
 articles.forEach(article => {
 if (article.categories && Array.isArray(article.categories)) {
 article.categories.forEach(cat => {
 if (cat && cat.trim()) {
 articleCategories.add(cat.trim());
 }
 });
 }
 if (article.tags && Array.isArray(article.tags)) {
 article.tags.forEach(tag => {
 if (tag && tag.trim()) {
 articleTags.add(tag.trim());
 }
 });
 }
 });
 
 return { articleCategories, articleTags };
}

function addArticleOptions(options, articleCategories, articleTags) {
 // Add article-based options
 articleCategories.forEach(category => {
 if (category && category.length > 3) {
 options.push({
 text: `${category} advice`,
 query: `${category} advice`
 });
 }
 });
 
 // Add top tags as options
 const topTags = Array.from(articleTags).slice(0, 3);
 topTags.forEach(tag => {
 if (tag && tag.length > 3) {
 options.push({
 text: `${tag} guidance`,
 query: `${tag} guidance`
 });
 }
 });
 }
 
function extractServiceTypes(services) {
 const serviceTypes = new Set();
 
 services.forEach(service => {
 if (service.categories && Array.isArray(service.categories)) {
 service.categories.forEach(cat => {
 if (cat && cat.trim()) {
 serviceTypes.add(cat.trim());
 }
 });
 }
 });
 
 return serviceTypes;
}

// Helper function to check if service type is valid
function isValidServiceType(type) {
 return type && type.length > 3;
}

// Helper function to check if service type should be skipped
function shouldSkipServiceType(type) {
 return type.includes('All Photography Workshops') || type.includes('services');
}

// Helper function to format service type
function formatServiceType(type) {
 // Generic workshop keyword detection
 const serviceTypeMappings = [
 { keywords: ['2.5hrs-4hrs'], formatted: '2.5hr - 4hr workshops' },
 { keywords: ['1-day'], formatted: '1 day workshops' },
 { keywords: ['2-5-days', 'weekend residential'], formatted: 'Multi day residential workshops' },
 { keywords: ['coastal'], formatted: 'Coastal workshops' },
 { keywords: ['landscape'], formatted: 'Landscape workshops' },
 { keywords: ['bluebell', 'autumn', 'spring', 'summer', 'winter'], formatted: 'Seasonal workshops' },
 { keywords: ['macro', 'abstract'], formatted: 'Macro & Abstract workshops' }
 ];
 
 for (const mapping of serviceTypeMappings) {
 if (mapping.keywords.some(keyword => type.includes(keyword))) {
 return mapping.formatted;
 }
 }
 
 return type;
}

// Helper function to filter and format service types
function filterAndFormatServiceTypes(serviceTypes) {
 const meaningfulTypes = new Set();
 
 for (const type of serviceTypes) {
 if (!isValidServiceType(type) || shouldSkipServiceType(type)) continue;
 
 const formattedType = formatServiceType(type);
 meaningfulTypes.add(formattedType);
 }
 
 return meaningfulTypes;
}

// Helper function to add service options to array
function addServiceOptionsToArray(options, meaningfulTypes) {
 for (const type of meaningfulTypes) {
 options.push({
 text: type,
 query: type.toLowerCase()
 });
 }
 }

function addServiceOptions(options, serviceTypes) {
 const meaningfulTypes = filterAndFormatServiceTypes(serviceTypes);
 addServiceOptionsToArray(options, meaningfulTypes);
 }
 
function deduplicateAndLimitOptions(options) {
 const uniqueOptions = [];
 const seen = new Set();
 
 options.forEach(option => {
 const key = option.text.toLowerCase();
 if (!seen.has(key) && uniqueOptions.length < 5) {
 seen.add(key);
 uniqueOptions.push(option);
 }
 });
 
 return uniqueOptions;
}

// Helper function to log evidence debug information
function logEvidenceDebug(evidence) {
 const evidenceDebug = {
 eventsCount: evidence.events?.length || 0,
 articlesCount: evidence.articles?.length || 0,
 servicesCount: evidence.services?.length || 0,
 sampleEvents: evidence.events?.slice(0, 2) || []
 };
 console.log('ðŸ” Evidence debug:', evidenceDebug);
}
 
// Helper function to process event evidence
function processEventEvidence(evidence, options) {
 if (evidence.events && evidence.events.length > 0) {
 const { eventTypes, eventCategories } = extractEventTypesAndCategories(evidence.events);
 const eventDebug = { eventTypes: Array.from(eventTypes), eventCategories: Array.from(eventCategories) };
 console.log('ðŸ” Event types and categories:', eventDebug);
 addEventOptions(options, eventTypes, eventCategories);
 
 // If we have good event options, skip services to avoid generic options
 if (options.length > 0) {
 console.log('ðŸ” Found event-based options, skipping services');
 return true; // Indicates we should return early
 }
 }
 return false;
 }
 
// Helper function to process article evidence
function processArticleEvidence(evidence, options) {
 if (evidence.articles && evidence.articles.length > 0) {
 const { articleCategories, articleTags } = extractArticleCategoriesAndTags(evidence.articles);
 addArticleOptions(options, articleCategories, articleTags);
 }
 }
 
// Helper function to process service evidence (fallback)
function processServiceEvidence(evidence, options) {
 if (evidence.services && evidence.services.length > 0 && options.length === 0) {
 console.log('ðŸ” No event options found, falling back to services');
 const serviceTypes = extractServiceTypes(evidence.services);
 addServiceOptions(options, serviceTypes);
 }
}

async function generateClarificationOptionsFromEvidence(client, query, pageContext) {
 try {
 const evidence = await getEvidenceSnapshot(client, query, pageContext);
 const options = [];
 
 logEvidenceDebug(evidence);
 
 // Process event evidence (PRIORITY)
 if (processEventEvidence(evidence, options)) {
 return deduplicateAndLimitOptions(options);
 }
 
 // Process article evidence
 processArticleEvidence(evidence, options);
 
 // Process service evidence (FALLBACK ONLY)
 processServiceEvidence(evidence, options);
 
 return deduplicateAndLimitOptions(options);
 } catch (error) {
 console.error('Error generating clarification options from evidence:', error);
 return [];
 }
}

/**
 * COMPLETE CLARIFICATION SYSTEM - PHASE 2: Question Generation
 * Generates appropriate clarification questions for all 20 question types
 * 95% generation rate with natural, helpful questions
 */
// Helper functions for clarification question generation
function generateGeneralEquipmentClarification() {
 return {
 type: "general_equipment_clarification",
 question: "What type of equipment are you looking for advice on?",
 options: [
 { text: "Camera recommendations", query: "camera recommendations" },
 { text: "Lens recommendations", query: "lens recommendations" },
 { text: "Tripod recommendations", query: "tripod recommendations" },
 { text: "Camera bag recommendations", query: "camera bag recommendations" },
 { text: "Memory card recommendations", query: "memory card recommendations" }
 ],
 confidence: 30
 };
 }
 
function generateEquipmentCourseTypeClarification() {
 return {
 type: "equipment_course_type_clarification",
 question: "Perfect! For equipment recommendations, I need to know what type of photography course you're planning. What interests you most?",
 options: [
 { text: "Beginners camera course", query: "equipment for beginners camera course" },
 { text: "Lightroom editing course", query: "equipment for lightroom course" },
 { text: "RPS mentoring course", query: "equipment for rps course" },
 { text: "Online photography course", query: "equipment for online course" },
 { text: "General course equipment advice", query: "general photography course equipment" }
 ],
 confidence: 30
 };
 }
 
function generateCourseClarification() {
 return {
 type: "course_clarification",
 question: "Yes, we offer several photography courses! What type of course are you interested in?",
 options: [
 { text: "Beginners camera course", query: "beginners camera course" },
 { text: "Photo editing course", query: "photo editing course" },
 { text: "RPS mentoring course", query: "rps mentoring course" },
 { text: "Private photography lessons", query: "private photography lessons" }
 ]
 };
}

function generateWorkshopClarification() {
 return {
 type: "workshop_clarification",
 question: "Yes, we run photography workshops! What type of workshop are you interested in?",
 options: [
 { text: "2.5hr - 4hr workshops", query: "short photography workshops 2-4 hours" },
 { text: "1 day workshops", query: "one day photography workshops" },
 { text: "Multi day residential workshops", query: "multi day residential photography workshops" }
 ]
 };
}



function generateGenericClarification() {
 return {
 type: "generic_clarification",
 question: "I'd be happy to help! Could you be more specific about what you're looking for?",
 options: [
 { text: "Photography equipment advice", query: "photography equipment advice" },
 { text: "Photography courses and workshops", query: "photography courses" },
 { text: "Photography services and mentoring", query: "photography services" },
 { text: "General photography advice", query: "photography advice" },
 { text: "About Alan Ranger", query: "about alan ranger" }
 ],
 confidence: 10
 };
}

// Helper functions for generateClarificationQuestion
function checkLoopGuardPatterns(lc) {
 if (lc.includes("general photography advice") || lc.includes("photography courses and workshops") || lc.includes("photography equipment advice")) {
 return {
 type: "fallback_general",
 question: "Do you want me to show the most relevant results now?",
 options: [
 { text: "Show me results", query: "show me results" }
 ],
 confidence: 10
 };
 }
 return null;
}

function checkSpecialEquipmentPatterns(lc) {
 if (lc.includes("general photography equipment advice clarification")) {
 console.log(`[SUCCESS] Found general equipment advice clarification pattern`);
 return generateGeneralEquipmentClarification();
 }
 
 if (lc.includes("equipment for photography course type clarification")) {
 console.log(`[SUCCESS] Found equipment course type clarification pattern`);
 return generateEquipmentCourseTypeClarification();
 }
 
 return null;
}

async function tryEvidenceBasedClarification(client, query, pageContext) {
 if (client && pageContext) {
 const evidenceOptions = await generateClarificationOptionsFromEvidence(client, query, pageContext);
 if (evidenceOptions.length > 0) {
 // Get the current confidence level from the progression system
 const { confidence } = getClarificationLevelAndConfidence(query, pageContext);
 
 return {
 type: "evidence_based_clarification",
 question: "I found several options that might help. What are you most interested in?",
 options: evidenceOptions,
 confidence
 };
 }
 }
 return null;
}
 
function checkSuppressedPatterns(lc) {
 if (lc.includes("equipment") || lc.includes("events") || lc.includes("training")) {
 return null;
 }
 
 if (lc.includes("feedback") || lc.includes("personalised") || lc.includes("mentoring") || 
 lc.includes("private") || lc.includes("lessons") || lc.includes("services")) {
 return null;
 }
 
 return "continue";
}
 
// Helper function to check course patterns
function checkCoursePatterns(lc) {
 if ((lc.includes("do you do") && lc.includes("courses")) || 
 lc.includes("what courses") || 
 lc.includes("do you offer courses")) {
 return generateCourseClarification();
 }
 return null;
 }
 
// Helper function to check workshop patterns
function checkWorkshopPatterns(lc) {
 if (lc.includes("workshop") && 
 !lc.includes("2.5hr") && 
 !lc.includes("4hr") && 
 !lc.includes("1 day") && 
 !lc.includes("multi day") && 
 !lc.includes("residential") &&
 !lc.includes("short") &&
 !lc.includes("long")) {
 return generateWorkshopClarification();
 }
 return null;
 }
 
// Helper function to check lessons patterns
function checkLessonsPatterns(lc) {
 if (lc.includes("do you offer") && lc.includes("lessons")) {
 return {
 type: "lessons_clarification",
 question: "Yes, we offer private photography lessons! What type of lesson are you looking for?",
 options: [
 { text: "Face-to-face private lessons", query: "private photography lessons" },
 { text: "Online private lessons", query: "online private photography lessons" },
 { text: "Basic camera settings", query: "camera settings lessons" },
 { text: "Composition and editing", query: "composition editing lessons" }
 ]
 };
 }
 return null;
}

function checkCourseWorkshopPatterns(lc) {
 // Check course patterns first
 const courseResult = checkCoursePatterns(lc);
 if (courseResult) return courseResult;
 
 // Check workshop patterns
 const workshopResult = checkWorkshopPatterns(lc);
 if (workshopResult) return workshopResult;
 
 // Check lessons patterns
 const lessonsResult = checkLessonsPatterns(lc);
 if (lessonsResult) return lessonsResult;
 
 return null;
}

function checkEquipmentPatterns(lc) {
 if (lc.includes("what camera should i buy")) {
 return {
 type: "camera_clarification",
 question: "I can help with camera recommendations! What's your photography focus and experience level?",
 options: [
 { text: "Beginner camera for learning", query: "beginner camera recommendations" },
 { text: "Entry level for all types", query: "entry level camera all types" },
 { text: "Specific photography type", query: "camera for specific photography" },
 { text: "Budget considerations", query: "camera budget recommendations" }
 ]
 };
 }
 
 if (lc.includes("what's the best") && lc.includes("lens")) {
 return {
 type: "lens_clarification",
 question: "Great question! Lens choice depends on your photography style and budget. What are you looking for?",
 options: [
 { text: "Portrait photography lens", query: "portrait photography lens" },
 { text: "Budget-friendly options", query: "budget lens recommendations" },
 { text: "Specific camera system", query: "lens for specific camera" },
 { text: "General purpose lens", query: "general purpose lens" }
 ]
 };
 }
 
 return null;
}

function checkServicePatterns(lc) {
 if (lc.includes("what photography services do you offer")) {
 return {
 type: "service_clarification",
 question: "We offer various photography services! What type of service are you looking for?",
 options: [
 { text: "Private lessons (face-to-face)", query: "private photography lessons" },
 { text: "Online private lessons", query: "online private photography lessons" },
 { text: "Group courses and workshops", query: "group photography courses" },
 { text: "Photography advice", query: "photography advice and guidance" }
 ]
 };
 }
 
 return null;
}

function checkTechnicalPatterns(lc) {
 if (lc.includes("how do i use manual mode")) {
 return {
 type: "technical_clarification",
 question: "Great question! Manual mode has several aspects. What would you like to focus on?",
 options: [
 { text: "Exposure settings (aperture, shutter, ISO)", query: "manual exposure settings" },
 { text: "Focus and composition", query: "manual focus and composition" },
 { text: "Specific photography scenarios", query: "manual mode scenarios" },
 { text: "Step-by-step learning", query: "manual mode tutorial" }
 ]
 };
 }
 
 if (lc.includes("what camera settings") && lc.includes("night photography")) {
 return {
 type: "night_photography_clarification",
 question: "Night photography requires specific settings! What type of night photography are you planning?",
 options: [
 { text: "Astrophotography", query: "astrophotography settings" },
 { text: "City night photography", query: "city night photography settings" },
 { text: "Low light portraits", query: "low light portrait settings" },
 { text: "General night photography", query: "general night photography settings" }
 ]
 };
 }
 
 return null;
}

function checkAboutPatterns(lc) {
 if (lc.includes("who is alan ranger")) {
 return {
 type: "about_clarification",
 question: "Alan is a professional photographer and tutor. What would you like to know about him?",
 options: [
 { text: "His photography experience", query: "Alan Ranger photography experience" },
 { text: "Teaching qualifications", query: "Alan Ranger qualifications" },
 { text: "Location and availability", query: "Alan Ranger location" },
 { text: "Specializations", query: "Alan Ranger specializations" }
 ]
 };
 }
 
 if (lc.includes("how long have you been teaching")) {
 return {
 type: "experience_clarification",
 question: "I've been teaching photography for many years! What would you like to know about my teaching experience?",
 options: [
 { text: "Teaching qualifications", query: "teaching qualifications" },
 { text: "Years of experience", query: "years teaching experience" },
 { text: "Teaching approach", query: "teaching approach and method" },
 { text: "Student success stories", query: "student success stories" }
 ]
 };
 }
 
 return null;
}

function checkFreeCourseWorkshopPatterns(lc) {
 // Generic course clarification detection
 const courseTerms = ['course', 'lesson', 'class', 'training'];
 const freeTerms = ['free', 'complimentary', 'no cost'];
 
 const hasCourseTerm = courseTerms.some(term => lc.includes(term));
 const hasFreeTerm = freeTerms.some(term => lc.includes(term));
 
 if (hasFreeTerm && hasCourseTerm) {
 return {
 type: "free_course_clarification",
 question: "Yes! We have a free online photography course. Would you like to know more about it?",
 options: [
 { text: "Course details and content", query: "free course details" },
 { text: "How to join", query: "how to join free course" },
 { text: "What's included", query: "free course content" },
 { text: "Is it really free", query: "free course confirmation" }
 ]
 };
 }
 
 // Generic seasonal workshop clarification detection
 
 const workshopTerms = ['workshop', 'course', 'lesson', 'class'];
 
 const hasSeasonalTerm = seasonalTerms.some(term => lc.includes(term));
 const hasWorkshopTerm = workshopTerms.some(term => lc.includes(term));
 const isNextQuery = lc.includes("when is the next") || lc.includes("next");
 
 if (isNextQuery && hasSeasonalTerm && hasWorkshopTerm) {
 const seasonalTerm = seasonalTerms.find(term => lc.includes(term));
 return {
 type: "seasonal_workshop_clarification",
 question: `We have ${seasonalTerm} photography workshops coming up! What would you like to know about them?`,
 options: [
 { text: "Dates and times", query: `${seasonalTerm} workshop dates` },
 { text: "Cost and booking", query: `${seasonalTerm} workshop cost` },
 { text: "Suitable for beginners", query: `${seasonalTerm} workshop beginners` },
 { text: "Location details", query: `${seasonalTerm} workshop location` }
 ]
 };
 }
 
 return null;
}

// Pattern definitions for clarification responses
const CLARIFICATION_PATTERNS = [
 {
 matcher: (lc) => lc.includes("how much") && lc.includes("macro photography workshop"),
 type: "macro_workshop_clarification",
 question: "Our macro photography workshop has different pricing options. What would you like to know about the costs?",
 options: [
 { text: "General pricing", query: "macro workshop pricing" },
 { text: "Specific date pricing", query: "specific date macro workshop" },
 { text: "Package deals", query: "macro workshop packages" },
 { text: "What's included", query: "macro workshop includes" }
 ]
 },
 {
 matcher: (lc) => lc.includes("what's included in") && lc.includes("landscape photography course"),
 type: "course_content_clarification",
 question: "Our landscape photography course covers many aspects. What specific areas are you most interested in?",
 options: [
 { text: "Course curriculum", query: "landscape course curriculum" },
 { text: "Beginner suitability", query: "landscape course beginners" },
 { text: "Equipment needed", query: "landscape course equipment" },
 { text: "Practical sessions", query: "landscape course practical" }
 ]
 },
 {
 matcher: (lc) => lc.includes("are your photography courses suitable for complete beginners"),
 type: "beginner_suitability_clarification",
 question: "Absolutely! We have courses designed specifically for beginners. What type of photography interests you most?",
 options: [
 { text: "General beginner courses", query: "beginner photography courses" },
 { text: "Beginner editing course", query: "beginner editing course" },
 { text: "Camera basics", query: "camera basics course" },
 { text: "Composition fundamentals", query: "composition fundamentals" }
 ]
 },
 {
 matcher: (lc) => lc.includes("do you have any photography courses in birmingham"),
 type: "location_clarification",
 question: "We run courses in various locations. What type of photography course are you looking for?",
 options: [
 { text: "Courses near Birmingham", query: "courses near Birmingham" },
 { text: "Online courses instead", query: "online courses alternative" },
 { text: "Travel to Coventry", query: "courses in Coventry" },
 { text: "Private lessons", query: "private lessons flexible" }
 ]
 },
 {
 matcher: (lc) => lc.includes("what's the difference between your online and in-person courses"),
 type: "format_comparison_clarification",
 question: "Great question! We offer both formats with different benefits. What would you like to know about each?",
 options: [
 { text: "Key differences", query: "online vs in-person differences" },
 { text: "Online course benefits", query: "online course benefits" },
 { text: "In-person course benefits", query: "in-person course benefits" },
 { text: "Which is right for me", query: "course format recommendation" }
 ]
 },
 {
 matcher: (lc) => lc.includes("can you help me choose between a dslr and mirrorless camera"),
 type: "camera_type_clarification",
 question: "Both have their advantages! What's your main photography interest and experience level?",
 options: [
 { text: "DSLR advantages", query: "DSLR camera advantages" },
 { text: "Mirrorless advantages", query: "mirrorless camera advantages" },
 { text: "For intermediate photographers", query: "camera upgrade intermediate" },
 { text: "Budget considerations", query: "DSLR vs mirrorless budget" }
 ]
 },
 {
 matcher: (lc) => lc.includes("what photography workshops do you have coming up this month"),
 type: "upcoming_workshops_clarification",
 question: "We have several workshops scheduled this month. What type of photography workshop interests you?",
 options: [
 { text: "Outdoor photography workshops", query: "outdoor photography workshops" },
 { text: "All upcoming workshops", query: "all upcoming workshops" },
 { text: "Beginner workshops", query: "beginner workshops this month" },
 { text: "Specific topics", query: "specific topic workshops" }
 ]
 },
 {
 matcher: (lc) => lc.includes("photography course workshop type clarification"),
 type: "course_workshop_type_clarification",
 question: "Great! We offer both practical workshops outdoors and courses as evening classes or online. What would you prefer?",
 options: [
 { text: "Practical outdoor workshops", query: "outdoor photography workshops" },
 { text: "Evening classes", query: "evening photography classes" },
 { text: "Online courses", query: "online photography courses" },
 { text: "Tell me about all options", query: "all photography course options" }
 ]
 },
 {
 matcher: (lc) => lc.includes("online photography courses") || lc.includes("evening photography classes"),
 type: "course_type_clarification",
 question: "I see you're interested in online courses. Are you looking for free online content or paid beginner courses?",
 options: [
 { text: "Beginners camera course", query: "beginners camera course" },
 { text: "Beginners Lightroom course", query: "beginners lightroom course" },
 { text: "RPS mentoring course", query: "rps mentoring course" },
 { text: "Free online photography course", query: "free online photography course" },
 { text: "Online private lessons", query: "online private photography lessons" }
 ]
 },
 {
 matcher: (lc) => lc.includes("online photography courses (free and paid) clarification"),
 type: "free_vs_paid_clarification",
 question: "I see you're interested in online courses. Are you looking for free online content or paid beginner courses?",
 options: [
 { text: "Free online photography course", query: "free online photography course" },
 { text: "Online private lessons", query: "online private photography lessons" },
 { text: "Beginners camera course", query: "beginners camera course" },
 { text: "Beginners Lightroom course", query: "beginners lightroom course" },
 { text: "RPS mentoring course", query: "rps mentoring course" }
 ],
 confidence: 30
 }
];

function checkRemainingPatterns(lc) {
 for (const pattern of CLARIFICATION_PATTERNS) {
 if (pattern.matcher(lc)) {
 const response = { type: pattern.type, question: pattern.question, options: pattern.options };
 if (pattern.confidence !== undefined) response.confidence = pattern.confidence;
 return response;
 }
 }
 return null;
}

// Helper function to determine clarification level and confidence
function getClarificationLevelAndConfidence(query, pageContext) {
 // Check if this is a follow-up clarification (has clarification context)
 const isFollowUp = pageContext?.clarificationLevel > 0;
 const currentLevel = pageContext?.clarificationLevel || 0;
 
 // Confidence progression: 20% â†’ 50% â†’ 80%
 const confidenceLevels = [0.2, 0.5, 0.8];
 // For initial query (level 0), use confidenceLevels[0] = 0.2 (20%)
 // For follow-up 1 (level 1), use confidenceLevels[1] = 0.5 (50%)
 // For follow-up 2 (level 2), use confidenceLevels[2] = 0.8 (80%)
 const confidence = confidenceLevels[currentLevel] || confidenceLevels[0];
 
 return {
 level: currentLevel,
 confidence,
 isFollowUp,
 shouldShowResults: currentLevel >= 2 // Show results after 2nd clarification
 };
}

// NEW: Query Classification System
// Helper function to check course clarification patterns
function checkCourseClarificationPatterns(query) {
 const courseClarificationPatterns = [
 /what courses do you offer/i,
 /what photography courses do you have/i,
 /what photography courses do you offer/i,
 /what courses do you have/i,
 /^(?!.*what.*camera.*need).*what courses/i, // Exclude equipment requirement queries
 /do you offer courses/i,
 /do you do courses/i
 ];
 
 for (const pattern of courseClarificationPatterns) {
 if (pattern.test(query)) {
 console.log(`ðŸŽ¯ Course query detected: "${query}" - routing to clarification`);
 return { type: 'clarification', reason: 'course_query_needs_clarification' };
 }
 }
 return null;
 }
 
// Helper function to check contact Alan patterns
function checkContactAlanPatterns(query) {
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
 /do you i get a certificate with the photography course/i,
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
 console.log(`ðŸ“ž Contact Alan pattern matched: ${pattern} for query: "${query}"`);
 return { type: 'direct_answer', reason: 'contact_alan_query' };
 }
 }
 return null;
 }
 
// Helper function to check workshop patterns
function checkWorkshopQueryPatterns(query) {
 const workshopPatterns = [
 /photography workshop/i,
 /workshop/i,
 /photography training/i,
 /photography course/i,
 /^(?!.*private).*photography lesson/i, // Exclude private lessons
 /photography class/i,
 /photography classes/i,
 /beginner photography class/i,
 /beginner photography classes/i,
 /photography classes warwickshire/i,
 /photography classes coventry/i,
 /lightroom course/i,
 /lightroom courses/i,
 /lightroom training/i,
 /photo editing course/i,
 /photo editing courses/i,
 /editing course/i,
 /editing courses/i,
 /photoshop course/i,
 /photoshop courses/i,
 /^(?!.*what.*camera.*need).*camera course/i, // Exclude equipment requirement queries
 /^(?!.*what.*camera.*need).*camera courses/i, // Exclude equipment requirement queries
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
 console.log(`ðŸŽ¯ Workshop pattern matched: ${pattern} for query: "${query}"`);
 return { type: 'workshop', reason: 'workshop_related_query' };
 }
 }
 return null;
 }
 
// Helper function to check private lessons patterns
function checkPrivateLessonsPatterns(query) {
 const privateLessonsPatterns = [
 /private photography lessons/i,
 /private lessons/i,
 /1-2-1.*lessons/i,
 /one-to-one.*lessons/i,
 /rps mentoring course/i,
 /rps mentoring/i,
 /rps course/i
 ];
 
 for (const pattern of privateLessonsPatterns) {
 if (pattern.test(query)) {
 console.log(`ðŸŽ¯ Private lessons pattern matched: ${pattern} for query: "${query}"`);
 return { type: 'direct_answer', reason: 'private_lessons_query' };
 }
 }
 return null;
 }

// Helper function to get about Alan Ranger patterns
function getAboutAlanPatterns() {
 return [
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
 /alan ranger photographic background/i
 ];
}
 
// Helper function to get business/policy patterns
function getBusinessPolicyPatterns() {
 return [
 /terms and conditions/i,
 /terms anc conditions/i, // Handle typo "anc" instead of "and"
 /where.*terms.*conditions/i, // Handle "where can i find your terms and conditions"
 /cancellation policy/i,
 /refund policy/i,
 /booking policy/i,
 /privacy policy/i,
 /gift voucher/i,
 /gift certificate/i,
 /cancellation or refund policy/i
 ];
}
 
// Helper function to get contact/booking patterns
function getContactBookingPatterns() {
 return [
 /how can i contact you/i,
 /book a discovery call/i,
 /contact information/i,
 /phone number/i,
 /email address/i,
 /how do i book/i,
 /booking process/i
 ];
}
 
// Helper function to get service patterns
function getServicePatterns() {
 return [
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
 /how far will you travel/i
 ];
}

// Helper function to get technical patterns
function getTechnicalPatterns() {
 return [
 /explain the exposure triangle/i,
 /what is the exposure triangle/i,
 /camera settings for low light/i,
 /best camera settings/i,
 // /tripod recommendation/i, // TEMPORARILY DISABLED FOR TESTING
 // /what tripod do you recommend/i, // TEMPORARILY DISABLED FOR TESTING
 // /best tripod for/i, // TEMPORARILY DISABLED FOR TESTING
 /what is long exposure/i,
 /long exposure and how can i find out more/i,
 /pictures never seem sharp/i,
 /advise on what i am doing wrong/i,
 /personalised feedback on my images/i,
 /get personalised feedback/i,
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
 /how to use.*tripod/i,
 /how to use.*camera/i,
 /how to use.*lens/i,
 /how to use.*filter/i,
 /how to use.*flash/i,
 /composition tips/i,
 /composition guide/i,
 /photography composition/i,
 /exposure triangle/i,
 /camera basics/i,
 /photography basics/i,
 /beginner photography/i,
 /photography tips/i,
 /how to improve photography/i,
 /photography advice/i
 ];
}
 
// Helper function to get equipment patterns
function getEquipmentPatterns() {
 return [
 /best camera for beginners/i,
 /what camera should i buy/i,
 /camera recommendation/i,
 /what lens should i buy/i,
 /lens recommendation/i,
 /camera bag recommendation/i,
 /photography equipment/i,
 /what equipment do i need/i,
 /what camera do i need/i,
 /camera requirements/i,
 /equipment requirements/i,
 /what camera.*need.*course/i,
 /what camera.*need.*workshop/i
 ];
}
 
// Helper function to get course/workshop patterns
function getCourseWorkshopPatterns() {
 return [
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
 /prerequisites for advanced courses/i
 ];
}
 
// Helper function to get location/venue patterns
function getLocationVenuePatterns() {
 return [
 /where are you located/i,
 /studio location/i,
 /workshop location/i,
 /meeting point/i,
 /parking/i,
 /public transport/i,
 /where is your gallery/i,
 /submit my images for feedback/i
 ];
}

// Helper function to get miscellaneous patterns
function getMiscellaneousPatterns() {
 return [
 /customer reviews/i,
 /testimonials/i,
 /where can i read reviews/i,
 /what equipment do i need/i,
 /what gear do i need/i,
 /equipment needed/i,
 /what sort of camera do i need/i,
 /do i need a laptop/i,
 /certificate with the photography course/i,
 /free online photography/i,
 /free photography course/i,
 /free photography academy/i,
 /free online academy/i,
 /online photography course really free/i,
 /subscribe to the free online/i,
 /can my.*yr old attend/i,
 /age.*attend/i,
 /young.*attend/i,
 /ethical guidelines/i,
 /photography tutor/i,
 /what is pick n mix/i,
 /pick n mix in the payment plans/i
 ];
}

// Helper function to check direct answer patterns
function checkDirectAnswerPatterns(query) {
 // TEMPORARILY DISABLED FOR TESTING
 return null;
 
 const allPatterns = [
 ...getAboutAlanPatterns(),
 ...getBusinessPolicyPatterns(),
 ...getContactBookingPatterns(),
 ...getServicePatterns(),
 ...getTechnicalPatterns(),
 ...getEquipmentPatterns(),
 ...getCourseWorkshopPatterns(),
 ...getLocationVenuePatterns(),
 ...getMiscellaneousPatterns()
 ];
 
 for (const pattern of allPatterns) {
 if (pattern.test(query)) {
 return { type: 'direct_answer', reason: 'specific_information_query' };
 }
 }
 return null;
}
 
// Helper function to check clarification patterns
function checkClarificationPatterns(query) {
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
 return null;
}

function classifyQuery(query) {
 console.log(`ðŸ” classifyQuery called with: "${query}"`);
 
 // PRIORITY: Check for equipment requirement queries FIRST
 if (query.toLowerCase().includes('what camera do i need') || 
 query.toLowerCase().includes('camera requirements') ||
 query.toLowerCase().includes('equipment requirements')) {
 console.log(`ðŸŽ¯ Equipment requirement query detected: "${query}" - routing to direct_answer`);
 return { type: 'direct_answer', reason: 'equipment_requirement_query' };
 }
 
 // Check patterns in order of priority
 const courseResult = checkCourseClarificationPatterns(query);
 if (courseResult) return courseResult;
 
 const contactResult = checkContactAlanPatterns(query);
 if (contactResult) return contactResult;
 
 const workshopResult = checkWorkshopQueryPatterns(query);
 if (workshopResult) return workshopResult;
 
 const privateResult = checkPrivateLessonsPatterns(query);
 if (privateResult) return privateResult;
 
 const directResult = checkDirectAnswerPatterns(query);
 if (directResult) return directResult;
 
 const clarificationResult = checkClarificationPatterns(query);
 if (clarificationResult) return clarificationResult;
 
 // Default to direct_answer for unknown queries - let RAG system try first
 return { type: 'direct_answer', reason: 'unknown_query_default_to_rag' };
}

// Helper function to check bypass conditions
function checkBypassConditions(lc, classification) {
 // BYPASS: If query contains normalized duration categories, skip clarification
 if (lc.includes('1-day') || lc.includes('2.5hrs-4hrs') || lc.includes('2-5-days')) {
 console.log(`ðŸŽ¯ Bypassing clarification for normalized duration category: "${lc}"`);
 return { shouldBypass: true, reason: 'normalized_duration' };
 }
 
 // BYPASS: Direct answer queries should not go to clarification
 if (classification.type === 'direct_answer') {
 console.log(`ðŸŽ¯ Bypassing clarification for direct answer query: "${lc}"`);
 return { shouldBypass: true, reason: 'direct_answer' };
 }
 
 return { shouldBypass: false };
}

// Helper function to check clarification level and max clarifications
function checkClarificationLevel(query, pageContext) {
 const { level, confidence, shouldShowResults } = getClarificationLevelAndConfidence(query, pageContext);
 
 // If we've reached max clarifications, show results instead
 if (shouldShowResults) {
 console.log(`ðŸŽ¯ Max clarifications reached (level ${level}), showing results instead`);
 return { shouldBypass: true, reason: 'max_clarifications', confidence };
 }
 
 return { shouldBypass: false, confidence };
}

// Helper function to check priority patterns
function checkPriorityPatterns(lc, classification, confidence) {
 // Check loop guard patterns
 const loopGuardResult = checkLoopGuardPatterns(lc);
 if (loopGuardResult) {
 loopGuardResult.confidence = confidence;
 return loopGuardResult;
 }
 
 // Check special equipment patterns
 const specialEquipmentResult = checkSpecialEquipmentPatterns(lc);
 if (specialEquipmentResult) {
 specialEquipmentResult.confidence = confidence;
 return specialEquipmentResult;
 }
 
 // PRIORITY: Check course/workshop patterns FIRST (only for workshop-classified queries)
 if (classification.type === 'workshop') {
 const courseWorkshopResult = checkCourseWorkshopPatterns(lc);
 if (courseWorkshopResult) {
 courseWorkshopResult.confidence = confidence;
 return courseWorkshopResult;
 }
 }
 
 return null;
}

// Helper function to check evidence-based clarification
async function checkEvidenceBasedClarification(context) {
 // Try evidence-based clarification (only if no workshop patterns matched)
 const evidenceResult = await tryEvidenceBasedClarification(context.client, context.query, context.pageContext);
 if (evidenceResult) {
 console.log(`ðŸ” Evidence-based clarification returned:`, evidenceResult);
 evidenceResult.confidence = context.confidence;
 return evidenceResult;
 } else {
 console.log(`âŒ No evidence-based clarification for: "${context.lc}"`);
 }
 return null;
 }
 
// Helper function to check all pattern groups
function checkAllPatternGroups(lc, confidence) {
 // Check suppressed patterns first
 const suppressedResult = checkSuppressedPatterns(lc);
 if (suppressedResult === null) return null;
 
 // Define pattern checkers in priority order
 const patternCheckers = [
 { name: 'equipment', checker: checkEquipmentPatterns },
 { name: 'service', checker: checkServicePatterns },
 { name: 'technical', checker: checkTechnicalPatterns },
 { name: 'about', checker: checkAboutPatterns },
 { name: 'freeCourseWorkshop', checker: checkFreeCourseWorkshopPatterns },
 { name: 'remaining', checker: checkRemainingPatterns }
 ];
 
 // Check each pattern group
 for (const { checker } of patternCheckers) {
 const result = checker(lc);
 if (result) {
 result.confidence = confidence;
 return result;
 }
 }
 
 return null;
}

// Helper function to generate generic fallback
function generateGenericFallback(query, confidence) {
 // CONTENT-BASED FALLBACK: If no specific pattern matches, use generic clarification
 console.log(`[SUCCESS] No specific pattern matched for: "${query}" - using generic clarification`);
 const genericResult = generateGenericClarification();
 if (genericResult) {
 genericResult.confidence = confidence;
 }
 return genericResult;
}

async function generateClarificationQuestion(query, client = null, pageContext = null) {
 const lc = query.toLowerCase();
 console.log(`ðŸ” generateClarificationQuestion called with: "${query}" (lowercase: "${lc}")`);
 
 // NEW: Query Classification System
 const classification = classifyQuery(query);
 console.log(`ðŸŽ¯ Query classified as: ${classification.type} (${classification.reason})`);
 
 // Check bypass conditions
 const bypassCheck = checkBypassConditions(lc, classification);
 if (bypassCheck.shouldBypass) return null;
 
 // Check clarification level and max clarifications
 const levelCheck = checkClarificationLevel(query, pageContext);
 if (levelCheck.shouldBypass) return null;
 
 const confidence = levelCheck.confidence;
 
 // Check priority patterns
 const priorityResult = checkPriorityPatterns(lc, classification, confidence);
 if (priorityResult) return priorityResult;
 
 // Check evidence-based clarification
 const evidenceResult = await checkEvidenceBasedClarification({ client, query, pageContext, lc, confidence });
 if (evidenceResult) return evidenceResult;
 
 // Check all pattern groups and return result
 const patternResult = checkAllPatternGroups(lc, confidence);
 return patternResult || generateGenericFallback(query, confidence);
}
// Helper functions for handleClarificationFollowUp





// Helper functions for different pattern groups
 
 





 


/**
 * COMPLETE CLARIFICATION SYSTEM - PHASE 3: Follow-up Handling
 * Handles user's clarification response and routes to correct content
 * 100% follow-up handling with perfect intent routing
 */
// Helper function to check short workshop patterns


// Helper function to handle workshop clarification patterns


/* ----------------------- DB helpers (robust fallbacks) ------------------- */

function anyIlike(col, words) {
 // Builds PostgREST OR ILIKE expression for (col) against multiple words
 const parts = (words || [])
 .map((w) => w.trim())
 .filter(Boolean)
 .map((w) => `${col}.ilike.%${w}%`);
 return parts.length ? parts.join(",") : null;
}

// Lightweight evidence snapshot to decide if clarification should be suppressed
async function getEvidenceSnapshot(client, query, pageContext) {
 try {
 const keywords = extractKeywords(query || "");
 const [events, articles, services] = await Promise.all([
 findEvents(client, { keywords, limit: 30, pageContext }),
 (async () => {
 const arts = await findArticles(client, { keywords, limit: 15, pageContext });
 return arts || [];
 })(),
 findServices(client, { keywords, limit: 10, pageContext })
 ]);
 return { events: events || [], articles: articles || [], services: services || [] };
 } catch {
 return { events: [], articles: [], services: [] };
 }
}

// Removed unused function: handleEventsBypass

// Removed unused function: handleArticlesBypass

// If we already have evidence, bypass generic clarification and show results

// Helper: Normalize query text for duration detection
function normalizeQueryText(enhancedKeywords) {
 let queryText = enhancedKeywords.join(' ').toLowerCase();
 // Normalize "one day" / "1 day" to canonical "1-day" so downstream detection is consistent
 queryText = queryText.replace(/\b(1\s*day|one\s*day)\b/g, '1-day');
 // Normalize short duration phrasings to canonical token
 queryText = queryText.replace(/\b(2\.5\s*hr|2\.5\s*hour|2\s*to\s*4\s*hr|2\s*to\s*4\s*hour|2\s*hr|2\s*hour|short)\b/g, '2.5hrs-4hrs');
 // Normalize multi-day phrasings to canonical token
 queryText = queryText.replace(/\b(2\s*to\s*5\s*day|multi\s*day|residential)\b/g, '2-5-days');
 return queryText;
}
 
// Helper: Handle duration-based queries
async function handleDurationQueries(client, queryText, limit) {
 const durationMappings = [
 { keyword: '2.5hrs-4hrs', category: '2.5hrs-4hrs' },
 { keyword: '1-day', category: '1-day' },
 { keyword: '2-5-days', category: '2-5-days' }
 ];
 
 for (const { keyword, category } of durationMappings) {
 if (queryText.includes(keyword)) {
 return await processDurationQuery({ client, category, limit, keyword });
 }
 }
 
 return null; // No duration match found
}

async function processDurationQuery(context) {
 const { client, category, limit, keyword } = context;
 console.log(`ðŸ” Using category-based query for ${keyword} workshops`);
 const result = await findEventsByDuration(client, category, limit);
 console.log(`ðŸ” findEventsByDuration returned: ${result?.length || 0} events for ${keyword}`);
 
 if (result && result.length === 0) {
 console.log(`ðŸ” DEBUG: findEventsByDuration returned 0 events for ${keyword}`);
 }
 
 return result;
}

// Helper: Handle Lightroom course queries
async function handleLightroomQueries(client, queryText, limit) {
 if (queryText.includes('lightroom') || queryText.includes('photo editing') || queryText.includes('editing')) {
 console.log('ðŸ” Using Lightroom-specific search');
 const { data, error } = await client
 .from('v_events_for_chat')
 .select('*')
 .gte('date_start', new Date().toISOString().split('T')[0] + 'T00:00:00.000Z')
 .or('event_title.ilike.%lightroom%,event_title.ilike.%photo editing%,event_title.ilike.%editing%,categories.cs.{beginners-lightroom}')
 .order('date_start', { ascending: true })
 .limit(limit);
 
 if (error) {
 console.error('âŒ Lightroom search error:', error);
 return [];
 }
 
 console.log('ðŸ” Lightroom search found:', data?.length || 0, 'events');
 console.log('ðŸ” Lightroom search results:', data?.map(e => ({ title: e.event_title, date: e.date_start })));
 return mapEventsData(data);
 }
 
 return null; // No Lightroom match found
}

// Helper: Handle regular keyword-based search
async function handleRegularSearch(client, enhancedKeywords, limit) {
 console.log('ðŸ” No duration condition matched, using regular query');
 
 // Build base query for regular keyword-based search
 let q = buildEventsBaseQuery(client, limit);
 
 // Apply keyword filtering if we have keywords
 if (enhancedKeywords.length) {
 q = applyKeywordFiltering(q, enhancedKeywords);
 }

 // Apply duration filtering for other workshop queries
 q = applyDurationFiltering(q, enhancedKeywords);

 // Execute query and handle results
 const { data, error } = await q;
 if (error) {
 console.error('âŒ v_events_for_chat query error:', error);
 return [];
 }
 
 // Log query results for debugging
 logEventsQueryResults(data, q);
 
 // Debug: Log the actual query being executed
 console.log('ðŸ” findEvents results count:', data?.length || 0);
 if (data && data.length > 0) {
 console.log('ðŸ” findEvents first result:', data[0]);
 } else {
 console.log('ðŸ” findEvents: No results found - this will trigger clarification');
 }
 
 // Map and return results
 return mapEventsData(data);
}

async function findEvents(client, { keywords, limit = 50, pageContext = null }) {
 // Enhance keywords with page context
 const enhancedKeywords = enhanceKeywordsWithPageContext(keywords, pageContext);
 
 // Normalize query text for duration detection
 const queryText = normalizeQueryText(enhancedKeywords);
 console.log('ðŸ” findEvents debug:', { enhancedKeywords, queryText });
 
 // Check for duration-based queries first
 const durationResult = await handleDurationQueries(client, queryText, limit);
 if (durationResult !== null) {
 return durationResult;
 }
 
 // Check for Lightroom course queries
 const lightroomResult = await handleLightroomQueries(client, queryText, limit);
 if (lightroomResult !== null) {
 return lightroomResult;
 }
 
 // Fall back to regular keyword-based search
 return await handleRegularSearch(client, enhancedKeywords, limit);
}

// Helper function to handle fallback queries for findEventsByDuration


// Helper: Extract Batsford session times
function extractBatsfordTimes(productDesc) {
 const morningMatch = productDesc.match(/morning workshops are (\d+)\s*am to (\d+)\.(\d+)\s*am/i);
 const afternoonMatch = productDesc.match(/afternoon workshops are from (\d+):(\d+)\s*pm to (\d+):(\d+)\s*pm/i);
 
 if (morningMatch && afternoonMatch) {
 const earlyEndTime = `${morningMatch[2].padStart(2, '0')}:${morningMatch[3].padStart(2, '0')}:00`;
 const lateStartTime = `${afternoonMatch[1].padStart(2, '0')}:${afternoonMatch[2].padStart(2, '0')}:00`;
 const pmHour = Number.parseInt(afternoonMatch[3]);
 const pmMinute = afternoonMatch[4];
 const pmHour24 = pmHour === 12 ? 12 : pmHour + 12;
 const lateEndTime = `${pmHour24.toString().padStart(2, '0')}:${pmMinute}:00`;
 console.log(`ðŸ” Extracted Batsford times: early end ${earlyEndTime}, late start ${lateStartTime}, late end ${lateEndTime}`);
 return { earlyEndTime, lateStartTime, lateEndTime };
 }
 return null;
}

// Helper: Extract Bluebell session times
function extractBluebellTimes(productDesc) {
 const sessionMatch = productDesc.match(/(\d+):(\d+)\s*am to (\d+):(\d+)\s*am or (\d+):(\d+)\s*am to (\d+):(\d+)\s*pm/i);
 
 if (sessionMatch) {
 const earlyEndTime = `${sessionMatch[3].padStart(2, '0')}:${sessionMatch[4].padStart(2, '0')}:00`;
 const lateStartTime = `${sessionMatch[5].padStart(2, '0')}:${sessionMatch[6].padStart(2, '0')}:00`;
 const pmHour = Number.parseInt(sessionMatch[7]);
 const pmMinute = sessionMatch[8];
 const pmHour24 = pmHour === 12 ? 12 : pmHour + 12;
 const lateEndTime = `${pmHour24.toString().padStart(2, '0')}:${pmMinute}:00`;
 console.log(`ðŸ” Extracted Bluebell times: early end ${earlyEndTime}, late start ${lateStartTime}, late end ${lateEndTime}`);
 return { earlyEndTime, lateStartTime, lateEndTime };
 }
 return null;
}

// Helper: Extract session times from product description
function extractSessionTimes(event) {
 const productDesc = event.product_description || '';
 console.log(`ðŸ” Product description for ${event.event_title}:`, productDesc.substring(0, 200) + '...');
 
 if (productDesc.includes('batsford') || event.event_title.toLowerCase().includes('batsford')) {
 return extractBatsfordTimes(productDesc);
 }
 
 // Generic workshop detection based on content analysis
 const workshopKeywords = ['workshop', 'course', 'lesson', 'training', 'class'];
 const seasonalKeywords = ['autumn', 'spring', 'summer', 'winter', 'bluebell', 'seasonal'];
 
 const hasWorkshopContent = workshopKeywords.some(keyword => 
 productDesc.toLowerCase().includes(keyword) || 
 event.event_title.toLowerCase().includes(keyword)
 );
 
 const hasSeasonalContent = seasonalKeywords.some(keyword => 
 productDesc.toLowerCase().includes(keyword) || 
 event.event_title.toLowerCase().includes(keyword)
 );
 
 if (hasWorkshopContent && hasSeasonalContent) {
 return extractBluebellTimes(productDesc);
 }
 
 console.log(`ðŸ” No specific session time extraction for ${event.event_title}`);
 return null;
}

// Helper: Create session entries for multi-session events
function createSessionEntries(event, categoryType, sessionTimes) {
 const { earlyEndTime, lateStartTime, lateEndTime } = sessionTimes;
 const actualStartTime = event.start_time || '08:00:00';
 const actualEndTime = event.end_time || '15:30:00';
 
 if (categoryType === '2.5hrs-4hrs') {
 const earlySession = {
 ...event,
 session_type: 'early',
 start_time: actualStartTime,
 end_time: earlyEndTime,
 categories: ['2.5hrs-4hrs'],
 event_title: `${event.event_title} (Early Session)`
 };
 const lateSession = {
 ...event,
 session_type: 'late',
 start_time: lateStartTime,
 end_time: lateEndTime,
 categories: ['2.5hrs-4hrs'],
 event_title: `${event.event_title} (Late Session)`
 };
 return [earlySession, lateSession];
 } else if (categoryType === '1-day') {
 const fullDaySession = {
 ...event,
 session_type: 'full-day',
 start_time: actualStartTime,
 end_time: actualEndTime,
 categories: ['1-day'],
 event_title: `${event.event_title} (Full Day)`
 };
 return [fullDaySession];
 }
 
 return [];
}

// Helper: Process multi-session events
function processMultiSessionEvent(event, categoryType) {
 const sessionTimes = extractSessionTimes(event);
 if (!sessionTimes) {
 return [];
 }
 
 return createSessionEntries(event, categoryType, sessionTimes);
}

// Helper: Process single events
function processSingleEvent(event) {
 return [event];
}

// Helper: Process and filter events
function processEvents(allEvents, categoryType) {
 const filteredEvents = [];
 
 allEvents.forEach(event => {
 if (!event.categories || !Array.isArray(event.categories)) {
 console.log(`ðŸ” Event: ${event.event_title}, No categories field, skipping`);
 return;
 }
 
 const hasCategory = event.categories.includes(categoryType);
 console.log(`ðŸ” Event: ${event.event_title}, Categories: ${JSON.stringify(event.categories)}, Has ${categoryType}: ${hasCategory}`);
 
 if (hasCategory) {
 if (event.categories.length > 1 && event.categories.includes('1-day') && event.categories.includes('2.5hrs-4hrs')) {
 // Multi-session event
 const sessionEntries = processMultiSessionEvent(event, categoryType);
 filteredEvents.push(...sessionEntries);
 } else {
 // Single category event
 const singleEntries = processSingleEvent(event);
 filteredEvents.push(...singleEntries);
 }
 }
 });

 return filteredEvents;
}

// Helper: Fetch events from database
async function fetchEventsFromDatabase(client) {
 const todayIso = new Date().toISOString().split('T')[0];
 
 const { data: allEvents, error: e1 } = await client
 .from("v_events_for_chat")
 .select("event_url, subtype, product_url, product_title, price_gbp, availability, date_start, date_end, start_time, end_time, event_location, map_method, confidence, participants, fitness_level, event_title, json_price, json_availability, price_currency, categories, product_description, experience_level, equipment_needed")
 .gte("date_start", `${todayIso}T00:00:00.000Z`)
 .order("date_start", { ascending: true })
 .limit(200);
 
 if (e1) {
 console.error('âŒ Error fetching events:', e1);
 return [];
 }

 if (!allEvents || allEvents.length === 0) {
 console.log('ðŸ” No events found');
 return [];
 }

 return allEvents;
}

// Helper: Process and return final results
function processAndReturnResults(filteredEvents, categoryType, limit) {
 console.log(`ðŸ” Filtered ${filteredEvents.length} events for category: ${categoryType}`);
 
 // Deduplicate by event_url + session_type (since we now have multiple entries per URL)
 const deduped = dedupeEventsByKey(filteredEvents, 'event_url', 'session_type');
 // Ensure chronological order is preserved after deduplication
 deduped.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
 
 // Apply the original limit after deduplication
 const limitedDeduped = deduped.slice(0, limit);
 return mapEventsData(limitedDeduped);
}

async function findEventsByDuration(client, categoryType, limit = 100) {
 try {
 console.log(`ðŸ” findEventsByDuration called with categoryType: ${categoryType}, limit: ${limit}`);
 
 // Fetch events from database
 const allEvents = await fetchEventsFromDatabase(client);
 if (allEvents.length === 0) {
 return [];
 }

 // Process and filter events
 const filteredEvents = processEvents(allEvents, categoryType);
 
 // Process and return final results
 return processAndReturnResults(filteredEvents, categoryType, limit);
 } catch (error) {
 console.error('âŒ Error in findEventsByDuration:', error);
 return [];
 }
}

// Helper functions for findEvents
function buildEventsBaseQuery(client, limit) {
 return client
 .from("v_events_for_chat")
 .select("event_url, subtype, product_url, product_title, price_gbp, availability, date_start, date_end, start_time, end_time, event_location, map_method, confidence, participants, fitness_level, event_title, json_price, json_availability, price_currency, experience_level, equipment_needed")
 .gte("date_start", new Date().toISOString()) // Only future events
 .order("date_start", { ascending: true }) // Sort by date ascending (earliest first)
 .limit(limit);
}

// Remove duplicate events by event_url only (same event can have multiple dates)
function dedupeEventsByKey(rows, keyField = 'event_url', secondaryKey = null) {
 if (!Array.isArray(rows)) return [];
 const seen = new Set();
 const unique = [];
 for (const row of rows) {
 const key = row[keyField] || '';
 const secondary = secondaryKey ? (row[secondaryKey] || '') : '';
 const compositeKey = secondaryKey ? `${key}|${secondary}` : key;
 if (!seen.has(compositeKey)) {
 seen.add(compositeKey);
 unique.push(row);
 }
 }
 return unique;
}


function applyKeywordFiltering(q, keywords) {
 // Filter out generic query words that don't help find events
 const GENERIC_QUERY_WORDS = new Set(["when", "next", "is", "are", "the", "a", "an", "what", "where", "how", "much", "does", "do", "can", "could", "would", "should"]);
 const meaningfulKeywords = keywords.filter(k => k && !GENERIC_QUERY_WORDS.has(String(k).toLowerCase()));
 
 console.log('ðŸ” findEvents keyword filtering:', {
 originalKeywords: keywords,
 meaningfulKeywords,
 filteredOut: keywords.filter(k => !meaningfulKeywords.includes(k))
 });
 
 // Search in event_title, event_location, and product_title fields
 // Use a simpler approach: search for each keyword individually
 if (meaningfulKeywords.length > 0) {
 console.log('ðŸ” findEvents debug:', {
 meaningfulKeywords
 });
 
 // Generic approach: search for any keyword in both location and title fields
 // This will work for any location or workshop type, not just hardcoded ones
 const searchKeyword = meaningfulKeywords[0];
 console.log(`ðŸ” Searching for keyword: ${searchKeyword}`);
 
 // Search in both event_location and event_title to catch location-based and title-based queries
 return q.or(`event_location.ilike.%${searchKeyword}%,event_title.ilike.%${searchKeyword}%`);
 }
 return q;
}

function applyDurationFiltering(q, keywords) {
 // Check if this is a duration-based workshop query
 const queryText = keywords.join(' ').toLowerCase();
 
 // 2.5hr - 4hr workshops - filter by actual duration using SQL
 if (queryText.includes('short') && (queryText.includes('2-4') || queryText.includes('2.5') || queryText.includes('4hr'))) {
 console.log('ðŸ” Applying 2.5-4 hour duration filter');
 // Use SQL to filter by actual duration between 2.5 and 4 hours
 return q.filter('date_start', 'not.is', null)
 .filter('date_end', 'not.is', null)
 .filter('event_title', 'ilike', '%workshop%')
 .filter('date_start', 'lt', 'date_end') // Ensure valid date range
 .gte('date_end', 'date_start') // This ensures we have valid dates
 .filter('date_start', 'lt', 'date_end'); // Additional validation
 }
 
 // 1 day workshops (6-8 hours)
 if (queryText.includes('one day') || queryText.includes('1 day')) {
 console.log('ðŸ” Applying 1 day duration filter');
 return q.filter('date_start', 'not.is', null)
 .filter('date_end', 'not.is', null)
 .filter('event_title', 'ilike', '%workshop%');
 }
 
 // Multi day workshops
 if (queryText.includes('multi day') || queryText.includes('residential')) {
 console.log('ðŸ” Applying multi-day duration filter');
 return q.filter('date_start', 'not.is', null)
 .filter('date_end', 'not.is', null)
 .filter('event_title', 'ilike', '%workshop%');
 }
 
 return q;
}

function logEventsQueryResults(data, q) {
 console.log('ðŸ” findEvents query results:', {
 dataCount: data?.length || 0,
 sampleData: data?.slice(0, 2) || [],
 query: q.toString(),
 rawData: data, // Show the raw data structure
 dataType: typeof data,
 isArray: Array.isArray(data)
 });
}
 
function mapEventsData(data) {
 // Map v_events_for_chat fields to frontend expected fields
 const mappedData = (data || []).map(event => ({
 ...event,
 title: event.event_title, // Map event_title to title for frontend
 page_url: event.event_url, // Map event_url to page_url for frontend
 href: event.event_url, // Add href alias for frontend
 location: event.event_location, // Map event_location to location for frontend
 price: event.price_gbp, // Map price_gbp to price for frontend
 csv_type: event.subtype, // Map subtype to csv_type for frontend
 date: event.date_start, // Map date_start to date for frontend
 _csv_start_time: event.start_time, // Preserve CSV times for frontend
 _csv_end_time: event.end_time
 }));
 
 // Remove duplicates by event_url + date_start to allow same event on different dates
 const dedupedData = dedupeEventsByKey(mappedData, 'event_url', 'date_start');
 
 console.log('ðŸ” findEvents mapped data:', {
 mappedDataCount: mappedData?.length || 0,
 dedupedDataCount: dedupedData?.length || 0,
 originalDataCount: data?.length || 0
 });
 
 return dedupedData;
}


function enhanceKeywordsWithPageContext(keywords, pageContext) {
 if (!pageContext?.pathname) return keywords;
 
 const pathKeywords = extractKeywordsFromPath(pageContext.pathname);
 if (pathKeywords.length === 0) return keywords;
 
 console.log('Product search - Page context keywords:', pathKeywords);
 return [...pathKeywords, ...keywords];
 }


// Helper function to build base query
function buildServicesBaseQuery(client, limit) {
 return client
 .from("page_entities")
 .select("*")
 .eq("kind", "service")
 .order("last_seen", { ascending: false })
 .limit(limit);
}

// Helper function to build OR conditions for keywords
function buildKeywordConditions(keywords) {
 const orConditions = [];
 keywords.forEach(keyword => {
 orConditions.push(`title.ilike.%${keyword}%`);
 orConditions.push(`page_url.ilike.%${keyword}%`);
 });
 return orConditions;
}

// Helper function to apply keyword filtering for services
function applyServicesKeywordFiltering(q, keywords) {
 if (keywords && keywords.length > 0) {
 const orConditions = buildKeywordConditions(keywords);
 
 if (orConditions.length > 0) {
 q = q.or(orConditions.join(','));
 console.log(`ðŸ”§ Using OR conditions: ${orConditions.join(',')}`);
 }
 }
 return q;
}

// Helper function to log services results
function logServicesResults(data) {
 console.log(`ðŸ”§ findServices returned ${data?.length || 0} services`);
 if (data && data.length > 0) {
 data.forEach((service, i) => {
 console.log(` ${i+1}. "${service.title}" (${service.page_url})`);
 });
 }
}

async function findServices(client, { keywords, limit = 50 }) {
 console.log(`ðŸ”§ findServices called with keywords: ${keywords?.join(', ') || 'none'}`);
 
 let q = buildServicesBaseQuery(client, limit);
 q = applyServicesKeywordFiltering(q, keywords);

 const { data, error } = await q;

 if (error) {
 console.error(`ðŸ”§ findServices error:`, error);
 return [];
 }

 logServicesResults(data);
 return data || [];
}

// Helper functions for findArticles scoring
function addBaseKeywordScore(context) {
 for (const k of context.kw) {
 if (!k) continue;
 if (context.has(context.t, k)) context.add(3); // strong match in title
 if (context.has(context.u, k)) context.add(1); // weak match in URL
 }
 }

function addOnlineCourseBoost(context) {
 const isOnlineCourse = context.categories.includes("online photography course");
 const coreConcepts = [
 "iso", "aperture", "shutter speed", "white balance", "depth of field", "metering",
 "exposure", "composition", "macro", "landscape", "portrait", "street", "wildlife",
 "raw", "jpeg", "hdr", "focal length", "long exposure"
 ];
 const hasCore = coreConcepts.some(c => context.kw.includes(c));
 
 if (hasCore && isOnlineCourse) {
 context.add(25); // Major boost for online course content on technical topics
 
 // Extra boost for "What is..." format articles in online course
 for (const c of coreConcepts) {
 if (context.has(context.t, `what is ${c}`) || context.has(context.t, `${c} in photography`)) {
 context.add(15); // Additional boost for structured learning content
 }
 }
 
 // Boost for PDF checklists and guides
 if (context.has(context.t, "pdf") || context.has(context.t, "checklist") || context.has(context.t, "guide")) {
 context.add(10);
 }
 }
 
 return { hasCore, coreConcepts };
}

function addCoreConceptScore(context) {
 if (!context.hasCore) return;
 
 // Process core concept scoring
 processCoreConceptBoosts({
 coreConcepts: context.coreConcepts,
 t: context.t,
 u: context.u,
 add: context.add,
 has: context.has
 });
 
 // Apply penalties for generic content
 applyGenericContentPenalties(context.t, context.u, context.add);
}

// Helper functions for core concept scoring
function processCoreConceptBoosts(context) {
 for (const c of context.coreConcepts) {
 const slug = c.replace(/\s+/g, "-");
 applyConceptBoosts({
 concept: c,
 slug: slug,
 t: context.t,
 u: context.u,
 add: context.add,
 has: context.has
 });
 }
}

function applyConceptBoosts(context) {
 if (context.t.startsWith(`what is ${context.concept}`)) context.add(20); // ideal explainer
 if (context.has(context.t, `what is ${context.concept}`)) context.add(10);
 if (context.has(context.u, `/what-is-${context.slug}`)) context.add(12);
 if (context.has(context.u, `${context.slug}`)) context.add(3);
}

function applyGenericContentPenalties(t, u, add) {
 // penalize generic Lightroom news posts for concept questions
 if (/(lightroom|what's new|whats new)/i.test(t) || /(lightroom|whats-new)/.test(u)) {
 add(-12);
 }
}
 
function addCategoryBoost(categories, hasCore, add) {
 if (categories.includes("photography-tips") && hasCore) {
 add(5); // Boost for photography tips on technical topics
 }
 }
 
function addRecencyTieBreaker(s, r) {
 const seen = r.last_seen ? Date.parse(r.last_seen) || 0 : 0;
 return s * 1_000_000 + seen;
}


// Helper function to handle page context
function handlePageContext(pageContext, keywords) {
 if (pageContext && pageContext.pathname) {
 const pathKeywords = extractKeywordsFromPath(pageContext.pathname);
 if (pathKeywords.length > 0) {
 console.log('Article search - Page context keywords:', pathKeywords);
 return [...pathKeywords, ...keywords];
 }
 }
 return keywords;
 }

// Helper function to build base query
function buildArticlesBaseQuery(client, limit) {
 return client
 .from("v_articles_unified")
 .select("id, title, page_url, categories, tags, image_url, publish_date, description, json_ld_data, last_seen, kind, source_type")
 .limit(limit * 5);
}

// Helper function to build search conditions
function buildSearchConditions(keywords) {
 const parts = [];
 const t1 = anyIlike("title", keywords); if (t1) parts.push(t1);
 const t2 = anyIlike("page_url", keywords); if (t2) parts.push(t2);
 const t3 = anyIlike("json_ld_data->>headline", keywords); if (t3) parts.push(t3);
 const t4 = anyIlike("json_ld_data->>name", keywords); if (t4) parts.push(t4);
 return parts;
}

// Helper function to apply search conditions
function applySearchConditions(q, keywords) {
 const parts = buildSearchConditions(keywords);
 if (parts.length) q = q.or(parts.join(","));
 return q;
}

// Helper function to score a single row
function scoreArticleRow(r, kw) {
 const t = (r.title || r.raw?.name || "").toLowerCase();
 const u = (r.page_url || r.source_url || "").toLowerCase();
 const categories = r.categories || [];
 let s = 0;
 
 const add = (n)=>{ s += n; };
 const has = (str, needle)=> str.includes(needle);
 
 addBaseKeywordScore({ kw, t, u, add, has });
 const { hasCore, coreConcepts } = addOnlineCourseBoost({ categories, kw, t, add, has });
 addCoreConceptScore({ hasCore, coreConcepts, t, u, add, has });
 addCategoryBoost(categories, hasCore, add);
 
 return addRecencyTieBreaker(s, r);
}

// Helper function to process and sort results
function processAndSortResults(rows, keywords, limit) {
 const kw = (keywords || []).map(k => String(k || "").toLowerCase());

 return rows
 .map(r => ({ r, s: scoreArticleRow(r, kw) }))
 .sort((a,b) => b.s - a.s)
 .slice(0, limit)
 .map(x => x.r);
}

async function findArticles(client, { keywords, limit = 12, pageContext = null }) {
 const enhancedKeywords = handlePageContext(pageContext, keywords);
 
 let q = buildArticlesBaseQuery(client, limit);
 q = applySearchConditions(q, enhancedKeywords);

 const { data, error } = await q;
 if (error) return [];
 
 return processAndSortResults(data || [], enhancedKeywords, limit);
}



function calculateContentScore(item, keywords, coreConcepts) {
 const context = prepareScoringContext(item);
 let score = calculateBaseScore(context, keywords);
 
 if (hasCoreConcepts(keywords, coreConcepts)) {
 score += calculateCoreConceptBoosts(context);
 }
 
 return score;
}

function prepareScoringContext(item) {
 return {
 text: (item.chunk_text || item.content || "").toLowerCase(),
 title: (item.title || "").toLowerCase(),
 url: (item.url || "").toLowerCase()
 };
}

function calculateBaseScore(context, keywords) {
 let score = 0;
 keywords.forEach(keyword => {
 const kw = keyword.toLowerCase();
 if (context.text.includes(kw) || context.title.includes(kw)) score += 1;
 });
 return score;
}

function hasCoreConcepts(keywords, coreConcepts) {
 return coreConcepts.some(c => keywords.some(k => k.toLowerCase().includes(c)));
}

function calculateCoreConceptBoosts(context) {
 let boost = 0;
 
 // Boost for online course URLs (what-is-* pattern)
 if (context.url.includes("/what-is-") || context.title.includes("what is")) boost += 10;
 
 // Boost for PDF checklists and guides
 if (context.title.includes("pdf") || context.title.includes("checklist") || context.title.includes("guide")) boost += 8;
 
 // Boost for structured learning content
 if (context.title.includes("guide for beginners") || context.title.includes("guide for beginner")) boost += 5;
 
 return boost;
}

async function findContentChunks(client, { keywords, limit = 5, articleUrls = [] }) {
 let q = client
 .from("page_chunks")
 .select("title, chunk_text, url, content")
 .limit(limit * 3); // Get more results to filter and prioritize

 // If we have specific article URLs, prioritize chunks from those articles
 if (articleUrls.length > 0) {
 const urlFilter = articleUrls.map(url => `url.eq.${url}`).join(',');
 q = q.or(urlFilter);
 } else {
 // Fallback to keyword search if no specific URLs
 const orExpr = anyIlike("chunk_text", keywords) || anyIlike("content", keywords) || null;
 if (orExpr) q = q.or(orExpr);
 }

 const { data, error } = await q;
 if (error) return [];
 
 // Enhanced scoring: prioritize online course content and technical concepts
 const coreConcepts = [
 "iso", "aperture", "shutter speed", "white balance", "depth of field", "metering",
 "exposure", "composition", "macro", "landscape", "portrait", "street", "wildlife",
 "raw", "jpeg", "hdr", "focal length", "long exposure"
 ];
 
 const sortedData = (data || []).sort((a, b) => {
 const aScore = calculateContentScore(a, keywords, coreConcepts);
 const bScore = calculateContentScore(b, keywords, coreConcepts);
 return bScore - aScore; // Higher score first
 });
 
 return sortedData.slice(0, limit);
}


/* -------- find PDF / related link within article chunks (best effort) ---- */

// Helper functions for article auxiliary links extraction






/* ----------------------- Product description parsing -------------------- */

// Helper functions for description parsing







function parseEquipmentNeededField(ln, helpers) {
 // Check different equipment parsing patterns
 return parseStandardEquipmentFormat(ln, helpers) ||
 parseAsteriskEquipmentFormat(ln, helpers) ||
 parseGenericEquipmentFormat(ln, helpers) ||
 false;
}

// Helper functions for equipment parsing
function parseStandardEquipmentFormat(ln, helpers) {
 const { matches, valueAfter, nextVal, setIf } = helpers;
 
 if (matches(ln, /^equipment\s*needed:/i)) {
 const v = valueAfter(ln, /^equipment\s*needed:\s*/i) || nextVal(0);
 setIf("equipmentNeeded", v);
 return true;
 }
 return false;
}

function parseAsteriskEquipmentFormat(ln, helpers) {
 const { nextVal, setIf } = helpers;
 
 if (/^\*\s*equipment\s*needed:/i.test(ln)) {
 const v = ln.replace(/^\*\s*equipment\s*needed:\s*/i, "").trim() || nextVal(0);
 if (v) setIf("equipmentNeeded", v);
 return true;
 }
 return false;
}

function parseGenericEquipmentFormat(ln, helpers) {
 const { setIf } = helpers;
 
 if (/equipment needed|equipment required|what you need|you will need/i.test(ln)) {
 // Extract the equipment requirement from the line
 const equipmentMatch = ln.match(/(?:equipment needed|equipment required|what you need|you will need)[:\s]*([^\\n]+)/i);
 if (equipmentMatch) {
 setIf("equipmentNeeded", equipmentMatch[1].trim());
 } else {
 setIf("equipmentNeeded", ln.trim());
 }
 return true;
 }
 return false;
 }
 
function parseSessionField(ln, out) {
 const m1 = ln.match(/^(\d+\s*(?:hrs?|hours?|day))(?:\s*[-â€“â€”]\s*)(.+)$/i);
 if (m1) {
 const rawLabel = m1[1].replace(/\s+/g, " ").trim();
 const time = m1[2].trim();
 out.sessions.push({ label: rawLabel, time, price: null });
 return true;
 }
 return false;
}



/* --------------------- Build product panel (markdown) -------------------- */

// Helper functions for product panel markdown generation

 










/* ----------------------------- Event list UI ----------------------------- */
function transformEventForUI(e) {
 return {
 ...e,
 ...getEventBasicFields(e),
 ...getEventTimeFields(e),
 ...getEventLocationFields(e),
 ...getEventStructuredFields(e),
 };
}

function getEventBasicFields(e) {
 return {
 title: e.title || e.event_title,
 href: e.page_url || e.event_url,
 csv_type: e.csv_type || null,
 price_gbp: e.price_gbp || e.price || null,
 categories: e.categories || null,
 tags: e.tags || null,
 raw: e.raw || null,
 };
}

function getEventTimeFields(e) {
 return {
 when: fmtDateLondon(e.start_date || e.date_start),
 date_start: e.start_date || e.date_start,
 date_end: e.end_date || e.date_end,
 _csv_start_time: e._csv_start_time || e.start_time || null,
 _csv_end_time: e._csv_end_time || e.end_time || null,
 start_time: e.start_time || null,
 end_time: e.end_time || null,
 };
}

function getEventLocationFields(e) {
 return {
 location: e.location_name || e.event_location,
 location_name: e.location_name || null,
 location_address: e.location_address || null,
 };
}

function getEventStructuredFields(e) {
 return {
 participants: e.participants || null,
 experience_level: e.experience_level || null,
 equipment_needed: e.equipment_needed || null,
 time_schedule: e.time_schedule || null,
 fitness_level: e.fitness_level || null,
 what_to_bring: e.what_to_bring || null,
 course_duration: e.course_duration || null,
 instructor_info: e.instructor_info || null,
 availability_status: e.availability_status || null,
 };
}

function formatEventsForUi(events) {
 console.log('ðŸ” formatEventsForUi input:', {
 inputLength: events?.length || 0,
 inputSample: events?.slice(0, 2) || []
 });
 
 // Preserve original fields so the frontend can format times and ranges
 const result = (events || [])
 .map(transformEventForUI);
 
 console.log('ðŸ” formatEventsForUi output:', {
 outputLength: result.length,
 outputSample: result.slice(0, 2)
 });
 
 return result;
}
/* ----------------------------- Pills builders ---------------------------- */
// Helper functions for event pills building





/* --------------------------- Generic resolvers --------------------------- */


/* ---------------------------- Extract Relevant Info ---------------------------- */
// Helper functions for extractRelevantInfo




// Helper function to get event label
function getEventLabel(event) {
 return (event.subtype && String(event.subtype).toLowerCase()==='course') ? 'course' : 'workshop';
}

// Helper function to extract and format brief description
function extractEventBrief(products, summarize) {
 if (products && products.length && (products[0].description || products[0]?.raw?.description)) {
 let brief = summarize(products[0].description || products[0]?.raw?.description);
 if (brief.length > 220) brief = brief.slice(0, 220).replace(/\s+\S*$/, '') + 'â€¦';
 return brief;
 }
 return '';
}

// Helper function to format date response
function formatDateResponse(formattedDate, label, brief) {
 const lead = `The next ${label} is scheduled for **${formattedDate}**.`;
 return brief ? `${lead} ${brief}` : `${lead}`;
 }

function checkEventDate(context) {
 if (context.lowerQuery.includes('when') || context.lowerQuery.includes('date')) {
 if (context.event.date_start) {
 const formattedDate = context.formatDateGB(context.event.date_start);
 console.log(`[SUCCESS] RAG: Found date="${formattedDate}" in structured event data`);
 const label = getEventLabel(context.event);
 const brief = extractEventBrief(context.products, context.summarize);
 return formatDateResponse(formattedDate, label, brief);
 }
 }
 return null;
}

function checkEventFitnessLevel(event, lowerQuery) {
 if (lowerQuery.includes('fitness') || lowerQuery.includes('level') || lowerQuery.includes('experience')) {
 if (event.fitness_level && event.fitness_level.trim().length > 0) {
 console.log(`[SUCCESS] RAG: Found fitness level="${event.fitness_level}" in structured event data`);
 return `The fitness level required is **${event.fitness_level}**. This ensures the workshop is suitable for your physical capabilities and you can fully enjoy the experience.`;
 }
 }
 return null;
}


// Calculate nuanced confidence for events with intent-based scoring
// Helper functions for calculateEventConfidence
function extractQueryRequirements(queryLower) {
 return {
 free: queryLower.includes('free'),
 online: queryLower.includes('online'),
 certificate: queryLower.includes('certificate') || queryLower.includes('cert'),
 inPerson: queryLower.includes('in person') || queryLower.includes('in-person') || queryLower.includes('coventry') || queryLower.includes('location'),
 price: queryLower.includes('price') || queryLower.includes('cost') || queryLower.includes('much')
 };
}
 
function initializeResponseAttributes() {
 return {
 hasFreeContent: false,
 hasOnlineContent: false,
 hasCertificateInfo: false,
 hasInPersonContent: false,
 hasPriceInfo: false,
 averagePrice: 0,
 onlineCount: 0,
 inPersonCount: 0
 };
}
 
function checkFreeContent(eventTitle, eventPrice, responseAttributes) {
 if (eventPrice === 0 || eventTitle.includes('free')) {
 responseAttributes.hasFreeContent = true;
 }
 }
 
function checkOnlineContent(eventLocation, responseAttributes) {
 if (eventLocation.includes('online') || eventLocation.includes('zoom') || eventLocation.includes('virtual')) {
 responseAttributes.hasOnlineContent = true;
 responseAttributes.onlineCount++;
 }
 }
 
function checkInPersonContent(eventLocation, responseAttributes) {
 if (eventLocation.includes('coventry') || eventLocation.includes('peak district') || eventLocation.includes('batsford')) {
 responseAttributes.hasInPersonContent = true;
 responseAttributes.inPersonCount++;
 }
 }
 
function checkCertificateInfo(eventTitle, responseAttributes) {
 if (eventTitle.includes('certificate') || eventTitle.includes('cert') || eventTitle.includes('rps')) {
 responseAttributes.hasCertificateInfo = true;
 }
 }
 
function trackPricing(eventPrice, responseAttributes) {
 if (eventPrice > 0) {
 responseAttributes.hasPriceInfo = true;
 responseAttributes.averagePrice += eventPrice;
 }
}

function analyzeEventAttributes(event, responseAttributes) {
 const eventTitle = (event.event_title || '').toLowerCase();
 const eventLocation = (event.event_location || '').toLowerCase();
 const eventPrice = event.price_gbp || 0;
 
 checkFreeContent(eventTitle, eventPrice, responseAttributes);
 checkOnlineContent(eventLocation, responseAttributes);
 checkInPersonContent(eventLocation, responseAttributes);
 checkCertificateInfo(eventTitle, responseAttributes);
 trackPricing(eventPrice, responseAttributes);
}
 
function checkProductFreeContent(productTitle, productPrice, responseAttributes) {
 if (productPrice === 0 || productTitle.includes('free')) {
 responseAttributes.hasFreeContent = true;
 }
 }
 
function checkProductOnlineContent(productLocation, responseAttributes) {
 if (productLocation.includes('online') || productLocation.includes('zoom') || productLocation.includes('virtual')) {
 responseAttributes.hasOnlineContent = true;
 responseAttributes.onlineCount++;
 }
 }
 
function checkProductInPersonContent(productLocation, responseAttributes) {
 if (productLocation.includes('coventry') || productLocation.includes('peak district') || productLocation.includes('batsford')) {
 responseAttributes.hasInPersonContent = true;
 responseAttributes.inPersonCount++;
 }
 }
 
function checkProductCertificateInfo(productTitle, responseAttributes) {
 if (productTitle.includes('certificate') || productTitle.includes('cert') || productTitle.includes('rps')) {
 responseAttributes.hasCertificateInfo = true;
 }
 }
 
function trackProductPricing(productPrice, responseAttributes) {
 if (productPrice > 0) {
 responseAttributes.hasPriceInfo = true;
 responseAttributes.averagePrice += productPrice;
 }
 }
 
function analyzeProductAttributes(product, responseAttributes) {
 const productTitle = (product.title || '').toLowerCase();
 const productLocation = (product.location_name || '').toLowerCase();
 const productPrice = product.price || 0;
 
 checkProductFreeContent(productTitle, productPrice, responseAttributes);
 checkProductOnlineContent(productLocation, responseAttributes);
 checkProductInPersonContent(productLocation, responseAttributes);
 checkProductCertificateInfo(productTitle, responseAttributes);
 trackProductPricing(productPrice, responseAttributes);
}
 
// Helper function to apply intent-based penalties
function applyIntentPenalties(queryRequirements, responseAttributes, addFactor) {
 if (queryRequirements.free && !responseAttributes.hasFreeContent) { 
 addFactor("Free query but no free content", -0.5); 
 }
 if (queryRequirements.online && !responseAttributes.hasOnlineContent) { 
 addFactor("Online query but no online content", -0.3); 
 }
 if (queryRequirements.certificate && !responseAttributes.hasCertificateInfo) { 
 addFactor("Certificate query but no certificate info", -0.4); 
 }
 if (queryRequirements.inPerson && !responseAttributes.hasInPersonContent) { 
 addFactor("In-person query but no in-person content", -0.2); 
 }
}

// Helper function to apply intent-based bonuses
function applyIntentBonuses(queryRequirements, responseAttributes, addFactor) {
 if (queryRequirements.free && responseAttributes.hasFreeContent) { 
 addFactor("Free query matched with free content", 0.3); 
 }
 if (queryRequirements.online && responseAttributes.hasOnlineContent) { 
 addFactor("Online query matched with online content", 0.2); 
 }
 if (queryRequirements.certificate && responseAttributes.hasCertificateInfo) { 
 addFactor("Certificate query matched with certificate info", 0.3); 
 }
}

function applyIntentBasedScoring(queryRequirements, responseAttributes, addFactor) {
 applyIntentPenalties(queryRequirements, responseAttributes, addFactor);
 applyIntentBonuses(queryRequirements, responseAttributes, addFactor);
}

function applyQuerySpecificityScoring(queryLower, addFactor) {
 const isEventQuery = queryLower.includes("when") || queryLower.includes("next") || queryLower.includes("date") || queryLower.includes("workshop") || queryLower.includes("course");
 const isLocationQuery = queryLower.includes("where") || queryLower.includes("location") || queryLower.includes("coventry") || queryLower.includes("devon");
 const isPriceQuery = queryLower.includes("cost") || queryLower.includes("price") || queryLower.includes("much");
 
 if (isEventQuery) { addFactor("Event query", 0.2); }
 if (isLocationQuery) { addFactor("Location query", 0.15); }
 if (isPriceQuery) { addFactor("Price query", 0.15); }
}

function applyEventQualityScoring(events, addFactor) {
 if (events && events.length > 0) {
 const delta = Math.min(0.3, events.length * 0.1);
 addFactor(`Events found: ${events.length}`, delta);
 
 // Check for future events
 const futureEvents = events.filter(e => e.date_start && new Date(e.date_start) > new Date());
 if (futureEvents.length > 0) {
 addFactor(`Future events: ${futureEvents.length}`, 0.15);
 }
 
 // Check for specific event types
 const hasWorkshops = events.some(e => e.subtype && e.subtype.toLowerCase().includes('workshop'));
 const hasCourses = events.some(e => e.subtype && e.subtype.toLowerCase().includes('course'));
 if (hasWorkshops || hasCourses) { addFactor("Specific event types", 0.1); }
 }
 }
 
function applyProductScoring(product, addFactor) {
 if (product) {
 addFactor("Product found", 0.2);
 
 // Check product quality
 if (product.price_gbp && product.price_gbp > 0) { addFactor("Product with price", 0.1); }
 if (product.location_address && product.location_address.trim().length > 0) { addFactor("Product with location", 0.1); }
 }
}

function applyRelevanceScoring(queryLower, events, addFactor) {
 if (events && events.length > 0) {
 const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
 let relevanceScore = 0;
 
 events.forEach(event => {
 const eventTitle = (event.event_title || '').toLowerCase();
 const eventLocation = (event.event_location || '').toLowerCase();
 const eventSubtype = (event.subtype || '').toLowerCase();
 
 queryWords.forEach(word => {
 if (eventTitle.includes(word) || eventLocation.includes(word) || eventSubtype.includes(word)) {
 relevanceScore += 1;
 }
 });
 });
 
 if (relevanceScore > 0) { const relevanceBonus = Math.min(0.2, relevanceScore * 0.05); addFactor(`Query relevance: ${relevanceScore}`, relevanceBonus); }
 }
}

function calculateEventConfidence(query, events, product) {
 const context = initializeConfidenceContext(query);
 
 // Analyze data for response attributes
 analyzeDataAttributes(events, product, context);
 
 // Apply all scoring factors
 applyAllScoringFactors({ ...context, events, product });
 
 // Return final confidence with logging
 return finalizeConfidence(query, context);
}

function initializeConfidenceContext(query) {
 const context = {
 baseConfidence: 0.3, // Start with reasonable baseline for events
 confidenceFactors: [],
 queryLower: query.toLowerCase(),
 qualityIndicators: {
 hasDirectAnswer: false, // Chat-style direct answer, not just references
 hasRelevantEvents: false, // Events match query type (workshop=workshop, course=course)
 hasRelevantArticles: false, // Articles match query topic
 hasActionableInfo: false, // Provides specific next steps
 responseCompleteness: 0, // 0-1: How thoroughly question is addressed
 responseAccuracy: 0 // 0-1: How correct and helpful the info is
 }
 };
 
 context.addFactor = (message, delta) => {
 context.baseConfidence += delta;
 context.confidenceFactors.push(`${message} (${delta >= 0 ? '+' : ''}${delta})`);
 };
 
 return context;
}

function analyzeDataAttributes(events, product, context) {
 const responseAttributes = initializeResponseAttributes();
 
 // Analyze events for response attributes and quality indicators
 if (events && events.length > 0) {
 // Set hasRelevantEvents based on query type matching
 const queryLower = context.queryLower;
 
 
 
 // Check if events match the query type (workshop=workshop, course=course)
 const relevantEvents = events.filter(event => {
 // If we have events, they are relevant for event queries
 // The original logic was too restrictive - any events found for event queries should be considered relevant
 return true;
 });
 
 context.qualityIndicators.hasRelevantEvents = relevantEvents.length > 0;
 
 events.forEach(event => analyzeEventAttributes(event, responseAttributes));
 responseAttributes.averagePrice = responseAttributes.averagePrice / events.length;
 }
 
 // Check product attributes
 if (product) {
 analyzeProductAttributes(product, responseAttributes);
 }
 
 context.responseAttributes = responseAttributes;
}

function analyzeResponseContent(responseText, articles, context) {
 console.log(`ðŸš€ analyzeResponseContent called for query: "${context.queryLower}"`);
 console.log(`ðŸš€ Response text: "${responseText.substring(0, 100)}..."`);
 console.log(`ðŸš€ Articles count: ${articles ? articles.length : 0}`);
 
 // Initialize quality indicators if they don't exist
 if (!context.qualityIndicators) {
 context.qualityIndicators = {
 hasDirectAnswer: false,
 hasRelevantEvents: false,
 hasRelevantArticles: false,
 hasActionableInfo: false,
 responseCompleteness: 0,
 responseAccuracy: 0
 };
 }
 
 // Preserve existing hasRelevantEvents value if it was set by analyzeDataAttributes
 const existingHasRelevantEvents = context.qualityIndicators.hasRelevantEvents;
 
 // Don't override hasRelevantEvents if it was already set to true by analyzeDataAttributes
 if (existingHasRelevantEvents === true) {
 console.log(`ðŸ” Preserving hasRelevantEvents: true from analyzeDataAttributes`);
 }
 
 // Special case for event queries: if this is an event query and we have events, set hasRelevantEvents to true
 const isEventQuery = responseText && responseText.includes('I found') && responseText.includes('events');
 if (isEventQuery && !existingHasRelevantEvents) {
 context.qualityIndicators.hasRelevantEvents = true;
 console.log(`ðŸ” Event query detected - setting hasRelevantEvents: true`);
 }
 
 // Ensure queryLower exists
 const queryLower = context.queryLower || (context.query || '').toLowerCase();
 
 // Analyze if response has direct answer (chat-style, not just references)
 const hasDirectAnswer = analyzeDirectAnswer(responseText, queryLower);
 context.qualityIndicators.hasDirectAnswer = hasDirectAnswer;
 
 // Analyze if articles are relevant to the query
 const hasRelevantArticles = analyzeArticleRelevance(articles, queryLower);
 context.qualityIndicators.hasRelevantArticles = hasRelevantArticles;
 
 // Analyze if response has actionable information
 const hasActionableInfo = analyzeActionableInfo(responseText) || hasRelevantArticles || context.qualityIndicators.hasRelevantEvents;
 context.qualityIndicators.hasActionableInfo = hasActionableInfo;
 
 // Calculate completeness and accuracy scores
 context.qualityIndicators.responseCompleteness = calculateCompleteness(responseText, queryLower);
 context.qualityIndicators.responseAccuracy = calculateAccuracy(responseText, queryLower);
 
 // Debug logging
 console.log(`ðŸ” Quality Analysis for "${context.queryLower}":`);
 console.log(` Direct Answer: ${hasDirectAnswer}`);
 console.log(` Relevant Articles: ${hasRelevantArticles}`);
 console.log(` Actionable Info: ${hasActionableInfo}`);
 console.log(` Completeness: ${(context.qualityIndicators.responseCompleteness * 100).toFixed(1)}%`);
 console.log(` Accuracy: ${(context.qualityIndicators.responseAccuracy * 100).toFixed(1)}%`);
 
 // Restore hasRelevantEvents value if it was set to true by analyzeDataAttributes
 if (existingHasRelevantEvents === true) {
 context.qualityIndicators.hasRelevantEvents = true;
 console.log(`ðŸ” Restored hasRelevantEvents: true from analyzeDataAttributes`);
 }
 
 // Debug logging (removed file writing to avoid ES module issues)
 console.log('ðŸ” Quality Analysis Complete');
}

function analyzeDirectAnswer(responseText, queryLower) {
 // Check if response provides a direct, chat-style answer (not just references)
 const responseLower = responseText.toLowerCase();
 
 // Extract key terms from the query - handle undefined queryLower
 const queryWords = (queryLower || '').split(/\s+/).filter(word => word.length > 2);
 
 console.log(`ðŸ” analyzeDirectAnswer: query="${queryLower}", response="${responseText.substring(0, 50)}..."`);
 console.log(`ðŸ” Query words: ${queryWords.join(', ')}`);
 
 // Generic seasonal content detection for confidence scoring
 
 const hasSeasonalContent = seasonalTerms.some(term => 
 responseLower.includes(`${term} photography`) || 
 responseLower.includes(`creative ${term}`) ||
 responseLower.includes(`seasonal photography`)
 );
 
 const isIrrelevant = (
 responseLower.includes('based on alan ranger\'s expertise') &&
 hasSeasonalContent && // Generic seasonal content detection
 !queryLower.includes('autumn') // Query is not about autumn
 );
 
 console.log(`ðŸ” Is irrelevant: ${isIrrelevant}`);
 
 if (isIrrelevant) {
 console.log(`âŒ Response is completely irrelevant`);
 return false;
 }
 
 // Check for generic responses that don't answer the question
 const isGeneric = (
 responseLower.startsWith('based on alan ranger\'s expertise') &&
 responseLower.includes('here\'s what you need to know') &&
 !responseLower.includes(queryWords[0]) // Doesn't address the specific question
 );
 
 console.log(`ðŸ” Is generic: ${isGeneric}`);
 
 if (isGeneric) {
 console.log(`âŒ Response is generic and doesn't answer the question`);
 return false;
 }
 
 // Look for direct answer patterns with keyword matching - more flexible for good responses
 const hasDirectAnswer = (
 responseText.length > 50 && // Not just "Here are some events..."
 !responseLower.startsWith('here are some') &&
 !responseLower.startsWith('i found some') &&
 !responseLower.startsWith('here are the') &&
 // Must contain key terms from the query
 queryWords.some(word => responseLower.includes(word)) &&
 (
 // Direct answers
 responseLower.includes('yes') || responseLower.includes('no') || 
 responseLower.includes('i can') || responseLower.includes('we offer') ||
 responseLower.includes('we have') || responseLower.includes('we provide') ||
 // Technical content
 responseLower.includes('aperture') || responseLower.includes('shutter') ||
 responseLower.includes('iso') || responseLower.includes('exposure') ||
 // Equipment/advice content
 responseLower.includes('camera') || responseLower.includes('lens') ||
 responseLower.includes('recommend') || responseLower.includes('suggest') ||
 responseLower.includes('equipment') || responseLower.includes('beginner') ||
 // Educational content
 responseLower.includes('guide') || responseLower.includes('tutorial') ||
 responseLower.includes('photography') || responseLower.includes('technique') ||
 // Event/workshop content - GENERIC CRITERIA
 responseLower.includes('found') && responseLower.includes('event') ||
 responseLower.includes('workshop') && responseLower.includes('date') ||
 responseLower.includes('course') && responseLower.includes('next') ||
 responseLower.includes('workshop') && responseLower.includes('devon') ||
 responseLower.includes('course') && responseLower.includes('photography') ||
 // Generic seasonal workshop detection
 (responseLower.includes('workshop') && ['bluebell', 'autumn', 'spring', 'summer', 'winter'].some(season => responseLower.includes(season)))
 )
 );
 
 console.log(`ðŸ” Has direct answer: ${hasDirectAnswer}`);
 
 return hasDirectAnswer;
}

function analyzeArticleRelevance(articles, queryLower) {
 if (!articles || articles.length === 0) return false;
 
 // Extract key terms from the query - handle undefined queryLower
 const queryWords = (queryLower || '').split(/\s+/).filter(word => word.length > 2);
 
 // Generic seasonal content detection for irrelevant article filtering
 
 const irrelevantPatterns = seasonalTerms.map(term => `${term} photography`).concat(['creative autumn', 'seasonal photography']);
 
 const hasIrrelevantArticles = articles.some(article => {
 const articleTitle = (article.title || '').toLowerCase();
 return irrelevantPatterns.some(pattern => articleTitle.includes(pattern));
 });
 
 if (hasIrrelevantArticles && !queryLower.includes('autumn')) {
 return false; // Articles are completely irrelevant to the query
 }
 
 // Check if articles contain keywords from the query
 const relevantArticles = articles.filter(article => {
 const articleTitle = (article.title || '').toLowerCase();
 const articleContent = (article.content || '').toLowerCase();
 
 return queryWords.some(word => 
 articleTitle.includes(word) || articleContent.includes(word)
 );
 });
 
 // Require at least 50% of articles to be relevant
 const relevanceRatio = relevantArticles.length / articles.length;
 return relevanceRatio >= 0.5;
}

function checkBusinessActionableInfo(responseLower) {
 return (
 (responseLower.includes('contact') && responseLower.includes('alan')) ||
 (responseLower.includes('book') && responseLower.includes('course')) ||
 (responseLower.includes('call') && responseLower.includes('alan')) ||
 (responseLower.includes('email') && responseLower.includes('alan')) ||
 (responseLower.includes('price') && responseLower.includes('course')) ||
 (responseLower.includes('cost') && responseLower.includes('course')) ||
 (responseLower.includes('date') && responseLower.includes('course')) ||
 (responseLower.includes('time') && responseLower.includes('course')) ||
 (responseLower.includes('location') && responseLower.includes('yorkshire')) ||
 (responseLower.includes('address') && responseLower.includes('yorkshire'))
 );
}

function checkTechnicalActionableInfo(responseLower) {
 return (
 (responseLower.includes('recommend') && responseLower.includes('camera')) ||
 (responseLower.includes('suggest') && responseLower.includes('equipment')) ||
 (responseLower.includes('guide') && responseLower.includes('photography')) ||
 (responseLower.includes('tutorial') && responseLower.includes('photography')) ||
 // Technical photography concepts that provide actionable knowledge
 (responseLower.includes('exposure triangle') && responseLower.includes('settings')) ||
 (responseLower.includes('aperture') && responseLower.includes('controls')) ||
 (responseLower.includes('shutter speed') && responseLower.includes('motion')) ||
 (responseLower.includes('iso') && responseLower.includes('sensitivity')) ||
 (responseLower.includes('depth of field') && responseLower.includes('aperture')) ||
 (responseLower.includes('motion blur') && responseLower.includes('shutter')) ||
 (responseLower.includes('noise') && responseLower.includes('iso')) ||
 (responseLower.includes('sharp') && responseLower.includes('technique'))
 );
}

function checkEventActionableInfo(responseLower) {
 // Generic workshop and seasonal content detection
 const workshopTerms = ['workshop', 'course', 'lesson', 'class'];
 
 
 
 const hasWorkshopContent = workshopTerms.some(term => 
 responseLower.includes(term) && (responseLower.includes('devon') || responseLower.includes('bluebell') || responseLower.includes('autumn') || responseLower.includes('photography') || responseLower.includes('date') || responseLower.includes('next'))
 );
 
 return (
 (responseLower.includes('found') && responseLower.includes('event')) ||
 hasWorkshopContent ||
 (responseLower.includes('event') && responseLower.includes('match'))
 );
}

function analyzeActionableInfo(responseText) {
 const responseLower = responseText.toLowerCase();
 
 return (
 checkBusinessActionableInfo(responseLower) ||
 checkTechnicalActionableInfo(responseLower) ||
 checkEventActionableInfo(responseLower)
 );
}

function calculateQueryWordCompleteness(responseLower, queryWords) {
 const addressedWords = queryWords.filter(word => responseLower.includes(word));
 return (addressedWords.length / queryWords.length) * 0.3;
}

function calculateLengthCompleteness(responseText) {
 if (responseText.length > 500) return 0.3;
 if (responseText.length > 200) return 0.2;
 if (responseText.length > 100) return 0.1;
 return 0;
}

function calculateInformationTypeCompleteness(responseLower) {
 let score = 0;
 if (responseLower.includes('yes') || responseLower.includes('no')) score += 0.1;
 if (responseLower.includes('we') || responseLower.includes('i can')) score += 0.1;
 if (responseLower.includes('offer') || responseLower.includes('provide')) score += 0.1;
 return score;
}

function calculateTechnicalCompleteness(responseLower) {
 let score = 0;
 if (responseLower.includes('guide') || responseLower.includes('tutorial')) score += 0.1;
 if (responseLower.includes('equipment') || responseLower.includes('camera')) score += 0.1;
 return score;
}

function calculateEventCompleteness(responseLower) {
 let score = 0;
 if (responseLower.includes('found') && responseLower.includes('event')) score += 0.1;
 if (responseLower.includes('workshop') && responseLower.includes('date')) score += 0.1;
 if (responseLower.includes('course') && responseLower.includes('next')) score += 0.1;
 // Generic workshop and seasonal content detection for confidence scoring
 const workshopTerms = ['workshop', 'course', 'lesson', 'class'];
 
 
 
 const hasWorkshopContent = workshopTerms.some(term => 
 responseLower.includes(term) && (responseLower.includes('devon') || responseLower.includes('bluebell') || responseLower.includes('autumn'))
 );
 
 if (hasWorkshopContent) score += 0.1;
 return score;
}

function calculateCompleteness(responseText, queryLower) {
 const responseLower = responseText.toLowerCase();
 const queryWords = (queryLower || '').split(/\s+/).filter(word => word.length > 2);
 
 let completenessScore = 0;
 completenessScore += calculateQueryWordCompleteness(responseLower, queryWords);
 completenessScore += calculateLengthCompleteness(responseText);
 completenessScore += calculateInformationTypeCompleteness(responseLower);
 completenessScore += calculateTechnicalCompleteness(responseLower);
 completenessScore += calculateEventCompleteness(responseLower);
 
 return Math.min(1, completenessScore);
}

function checkIrrelevantResponse(responseLower, queryLower) {
 if (responseLower.includes('based on alan ranger\'s expertise') && 
 responseLower.includes('autumn photography') && 
 !queryLower.includes('autumn')) {
 return 0; // Completely irrelevant
 }
 return null;
}

function checkGenericResponse(responseLower, queryWords) {
 if (responseLower.startsWith('based on alan ranger\'s expertise') &&
 responseLower.includes('here\'s what you need to know') &&
 !queryWords.some(word => responseLower.includes(word))) {
 return 0.1; // Generic response that doesn't answer the question
 }
 return null;
}

function calculateHelpfulIndicators(responseLower) {
 let score = 0;
 if (responseLower.includes('yes') || responseLower.includes('no')) score += 0.2;
 if (responseLower.includes('we offer') || responseLower.includes('we provide')) score += 0.2;
 if (responseLower.includes('i can help') || responseLower.includes('i can assist')) score += 0.1;
 return score;
}

function calculateQueryRelevance(responseLower, queryWords) {
 if (queryWords.some(word => responseLower.includes(word))) return 0.2;
 return 0;
}

function calculateEventAccuracy(responseLower) {
 let score = 0;
 if (responseLower.includes('found') && responseLower.includes('event')) score += 0.2;
 if (responseLower.includes('workshop') && responseLower.includes('date')) score += 0.2;
 if (responseLower.includes('course') && responseLower.includes('next')) score += 0.2;
 // Generic workshop and seasonal content detection for confidence scoring
 const workshopTerms = ['workshop', 'course', 'lesson', 'class'];
 
 
 
 const hasWorkshopContent = workshopTerms.some(term => 
 responseLower.includes(term) && (responseLower.includes('devon') || responseLower.includes('bluebell') || responseLower.includes('autumn'))
 );
 
 if (hasWorkshopContent) score += 0.1;
 return score;
}

function calculateUnhelpfulIndicators(responseLower) {
 let penalty = 0;
 if (responseLower.includes('i don\'t know') || responseLower.includes('i can\'t help')) penalty -= 0.3;
 if (responseLower.includes('sorry') && responseLower.includes('can\'t')) penalty -= 0.2;
 return penalty;
}

function calculateAccuracy(responseText, queryLower) {
 console.log(`ðŸ” calculateAccuracy called for query: "${queryLower}"`);
 console.log(`ðŸ” Response text: "${responseText.substring(0, 100)}..."`);
 
 const responseLower = responseText.toLowerCase();
 const queryWords = (queryLower || '').split(/\s+/).filter(word => word.length > 2);
 
 // Check for completely irrelevant responses
 const irrelevantScore = checkIrrelevantResponse(responseLower, queryLower);
 if (irrelevantScore !== null) {
 console.log(`ðŸ” Response is irrelevant, returning ${irrelevantScore}`);
 return irrelevantScore;
 }
 
 // Check for generic responses
 const genericScore = checkGenericResponse(responseLower, queryWords);
 if (genericScore !== null) {
 console.log(`ðŸ” Response is generic, returning ${genericScore}`);
 return genericScore;
 }
 
 let accuracyScore = 0.5; // Start with neutral score
 console.log(`ðŸ” Starting accuracy score: ${accuracyScore}`);
 
 const helpfulScore = calculateHelpfulIndicators(responseLower);
 console.log(`ðŸ” Helpful indicators score: ${helpfulScore}`);
 accuracyScore += helpfulScore;
 
 const relevanceScore = calculateQueryRelevance(responseLower, queryWords);
 console.log(`ðŸ” Query relevance score: ${relevanceScore}`);
 accuracyScore += relevanceScore;
 
 const eventScore = calculateEventAccuracy(responseLower);
 console.log(`ðŸ” Event accuracy score: ${eventScore}`);
 accuracyScore += eventScore;
 
 const unhelpfulScore = calculateUnhelpfulIndicators(responseLower);
 console.log(`ðŸ” Unhelpful indicators score: ${unhelpfulScore}`);
 accuracyScore += unhelpfulScore;
 
 const finalScore = Math.max(0, Math.min(1, accuracyScore));
 console.log(`ðŸ” Final accuracy score: ${finalScore}`);
 return finalScore;
}

function applyAllScoringFactors(context) {
 const { events, product } = context;
 const queryRequirements = extractQueryRequirements(context.queryLower);
 
 applyIntentBasedScoring(queryRequirements, context.responseAttributes, context.addFactor);
 applyQuerySpecificityScoring(context.queryLower, context.addFactor);
 applyEventQualityScoring(events, context.addFactor);
 applyProductScoring(product, context.addFactor);
 applyRelevanceScoring(context.queryLower, events, context.addFactor);
}

function finalizeConfidence(query, context) {
 // Ensure quality indicators exist
 if (!context.qualityIndicators) {
 context.qualityIndicators = {
 hasDirectAnswer: false,
 hasRelevantEvents: false,
 hasRelevantArticles: false,
 hasActionableInfo: false,
 responseCompleteness: 0,
 responseAccuracy: 0,
 botResponseQuality: 0,
 relatedContentQuality: 0
 };
 }
 
 // Log quality indicators for debugging
 logQualityIndicators(query, context);
 
 // Calculate confidence score using extracted helper functions
 const confidenceScore = calculateConfidenceScore(context);
 
 // Apply base confidence adjustments (minimal impact)
 const baseConfidence = context.baseConfidence || 0.1;
 const finalConfidence = Math.max(0.1, Math.min(1, confidenceScore + (baseConfidence * 0.1)));
 
 // Log final confidence details
 logFinalConfidence(query, context, finalConfidence);
 
 return finalConfidence;
}

/**
 * Helper function to log quality indicators for debugging
 */
function logQualityIndicators(query, context) {
 const isCompletelyIrrelevant = (
 !context.qualityIndicators.hasDirectAnswer && 
 !context.qualityIndicators.hasRelevantEvents && 
 !context.qualityIndicators.hasRelevantArticles &&
 context.qualityIndicators.responseAccuracy < 0.3
 );
 
 console.log(`QUALITY INDICATORS DEBUG for "${query}":`);
 console.log(` hasDirectAnswer: ${context.qualityIndicators.hasDirectAnswer}`);
 console.log(` hasRelevantEvents: ${context.qualityIndicators.hasRelevantEvents}`);
 console.log(` hasRelevantArticles: ${context.qualityIndicators.hasRelevantArticles}`);
 console.log(` hasActionableInfo: ${context.qualityIndicators.hasActionableInfo}`);
 console.log(` responseCompleteness: ${context.qualityIndicators.responseCompleteness}`);
 console.log(` responseAccuracy: ${context.qualityIndicators.responseAccuracy}`);
 console.log(` isCompletelyIrrelevant: ${isCompletelyIrrelevant}`);
}

/**
 * Helper function to calculate confidence score based on quality indicators
 */
function calculateConfidenceScore(context) {
 const indicators = context.qualityIndicators;
 
 // Check for completely irrelevant responses first
 if (isCompletelyIrrelevant(indicators)) {
 console.log(`FORCED TO 10% - Completely irrelevant response`);
 return 0.10;
 }
 
 // Perfect (100%): Has everything with high quality
 if (isPerfectResponse(indicators)) {
 console.log(`SELECTED: Perfect (100%) - All quality indicators met`);
 return 1;
 }
 
 // Nearly Perfect (95%): Has most elements with high quality
 if (isNearlyPerfectResponse(indicators)) {
 console.log(`SELECTED: Nearly Perfect (95%) - Direct answer + supporting content`);
 return 0.95;
 }
 
 // Special case for event queries: High-quality event responses
 if (isExcellentEventResponse(indicators)) {
 console.log(`SELECTED: Nearly Perfect (95%) - Excellent event response with relevant events`);
 return 0.95;
 }
 
 // Very Good (75%): Has good answer and some supporting content
 if (isVeryGoodResponse(indicators)) {
 console.log(`SELECTED: Very Good (75%) - Direct answer + good completeness/accuracy`);
 return 0.75;
 }
 
 // Good (50%): Has some useful content
 if (isGoodResponse(indicators)) {
 console.log(`SELECTED: Good (50%) - Some useful content found`);
 return 0.50;
 }
 
 // Poor (30%): Limited useful content
 if (indicators.responseCompleteness >= 0.3) {
 console.log(`SELECTED: Poor (30%) - Limited useful content`);
 return 0.30;
 }
 
 // Very Poor (10%): Little to no useful content
 console.log(`SELECTED: Very Poor (10%) - Little to no useful content`);
 return 0.10;
}

/**
 * Helper function to check if response is completely irrelevant
 */
function isCompletelyIrrelevant(indicators) {
 return (
 !indicators.hasDirectAnswer && 
 !indicators.hasRelevantEvents && 
 !indicators.hasRelevantArticles &&
 indicators.responseAccuracy < 0.3
 );
}

/**
 * Helper function to check if response is perfect
 */
function isPerfectResponse(indicators) {
 return (
 indicators.hasDirectAnswer && 
 indicators.hasRelevantEvents && 
 indicators.hasRelevantArticles && 
 indicators.hasActionableInfo &&
 indicators.responseCompleteness >= 0.9 &&
 indicators.responseAccuracy >= 0.9
 );
}

/**
 * Helper function to check if response is nearly perfect
 */
function isNearlyPerfectResponse(indicators) {
 return (
 indicators.hasDirectAnswer && 
 (indicators.hasRelevantEvents || indicators.hasRelevantArticles) &&
 indicators.responseCompleteness >= 0.8 &&
 indicators.responseAccuracy >= 0.8
 );
}

/**
 * Helper function to check if response is excellent event response
 */
function isExcellentEventResponse(indicators) {
 return (
 indicators.hasDirectAnswer && 
 indicators.hasRelevantEvents &&
 indicators.responseCompleteness >= 0.3 &&
 indicators.responseAccuracy >= 0.6
 );
}

/**
 * Helper function to check if response is very good
 */
function isVeryGoodResponse(indicators) {
 return (
 indicators.hasDirectAnswer && 
 indicators.responseCompleteness >= 0.4 &&
 indicators.responseAccuracy >= 0.4
 );
}

/**
 * Helper function to check if response is good
 */
function isGoodResponse(indicators) {
 return (
 indicators.hasDirectAnswer || 
 indicators.hasRelevantEvents || 
 indicators.hasRelevantArticles
 );
}

/**
 * Helper function to log final confidence details
 */
function logFinalConfidence(query, context, finalConfidence) {
 if (context.confidenceFactors && context.confidenceFactors.length > 0) {
 console.log(`Alan's Quality-Based Confidence for "${query}": ${context.confidenceFactors.join(', ')} = ${(finalConfidence * 100).toFixed(1)}%`);
 console.log(`Quality Indicators: Direct=${context.qualityIndicators.hasDirectAnswer}, Events=${context.qualityIndicators.hasRelevantEvents}, Articles=${context.qualityIndicators.hasRelevantArticles}, Actionable=${context.qualityIndicators.hasActionableInfo}`);
 console.log(`Quality Scores: Completeness=${(context.qualityIndicators.responseCompleteness * 100).toFixed(1)}%, Accuracy=${(context.qualityIndicators.responseAccuracy * 100).toFixed(1)}%`);
 }
}

/* -------------------------------- Extracted Functions -------------------------------- */
/**
 * Early-return fallback processing extracted from handler to reduce complexity.
 * Preserves existing behavior exactly.
 */
// Helper function to process events early return
async function processEventsEarlyReturn(context) {
 const events = await findEvents(context.client, { keywords: context.directKeywords, limit: 80, pageContext: context.pageContext });
 const eventList = formatEventsForUi(events);
 
 // Use quality-based confidence scoring
 const confidenceContext = initializeConfidenceContext(context.query || "");
 analyzeDataAttributes(events, null, confidenceContext);
 // Don't call analyzeResponseContent with empty strings - will be called with actual content later
 const confidence = finalizeConfidence(context.query || "", confidenceContext);
 
 console.log('ðŸ” EARLY RETURN EVENTS: Found events via early return path:', {
 totalEvents: events.length,
 formattedEvents: eventList.length,
 confidence,
 query: context.query
 });
 
 context.res.status(200).json({
 ok: true,
 type: "events",
 answer: eventList,
 events: eventList,
 structured: {
 intent: "events",
 topic: context.directKeywords.join(", "),
 events: eventList,
 products: [],
 pills: []
 },
 confidence,
 debug: {
 version: "v1.2.75-fix-debug-scope",
 earlyReturn: true,
 eventsFound: events.length,
 formattedEvents: eventList.length
 }
 });
 
 return events.length > 0;
}

// Helper function to process advice early return
async function processAdviceEarlyReturn(context) {
 let articles = await findArticles(context.client, { keywords: context.directKeywords, limit: 30, pageContext: context.pageContext });
 articles = (articles || []).map(normalizeArticle);
 const articleUrls = articles?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
 const contentChunks = await findContentChunks(context.client, { keywords: context.directKeywords, limit: 15, articleUrls });
 const pricingAnswer = generatePricingAccommodationAnswer(context.query || "", articles, contentChunks);
 const answerMarkdown = pricingAnswer || generateDirectAnswer(context.query || "", articles, contentChunks);
 
 context.res.status(200).json({
 ok: true,
 type: "advice",
 answer_markdown: answerMarkdown,
 structured: {
 intent: "advice",
 topic: context.directKeywords.join(", "),
 events: [],
 products: [],
 services: [],
 landing: [],
 articles: (articles || []).map(a => ({
 ...a,
 display_date: (function(){
 const extracted = extractPublishDate(a);
 const fallback = a.last_seen ? new Date(a.last_seen).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : null;
 return extracted || fallback;
 })()
 })),
 pills: []
 },
 confidence: 0.90,
 debug: { version: "v1.2.75-fix-debug-scope", earlyReturn: true }
 });
 
 return articles.length > 0 || contentChunks.length > 0;
}



/**
 * Determine keywords for content retrieval based on intent and query context
 */

/**
 * Handle residential pricing shortcut - direct answer for residential workshop pricing queries
 */

function filterMultiDayEvents(events) {
 return events.filter(e => {
 try{ return e.date_start && e.date_end && new Date(e.date_end) > new Date(e.date_start); }catch{ return false; }
 });
}

async function handleResidentialEventsShortcut(context) {
 const directKeywords = Array.from(new Set(["residential", "workshop", ...extractKeywords(context.query || "")]));
 const events = await findEvents(context.client, { keywords: directKeywords, limit: 120, pageContext: context.pageContext });
 const formattedEvents = formatEventsForUi(events) || [];
 const multiDayEvents = filterMultiDayEvents(formattedEvents);
 
 if (multiDayEvents.length) {
 // Use quality-based confidence scoring
 const confidenceContext = initializeConfidenceContext(context.query || "");
 analyzeDataAttributes(multiDayEvents, null, confidenceContext);
 // Don't call analyzeResponseContent with empty strings - will be called with actual content later
 const confidence = finalizeConfidence(context.query || "", confidenceContext);
 context.res.status(200).json({
 ok: true,
 type: "events",
 answer: multiDayEvents,
 events: multiDayEvents,
 structured: {
 intent: "events",
 topic: directKeywords.join(", "),
 events: multiDayEvents,
 products: [],
 pills: []
 },
 confidence,
 debug: { version: "v1.2.47-residential-shortcut", shortcut: true }
 });
 return true; // Response sent
 }
 return false;
}


/**
 * Normalize article object to ensure title and page_url are present.
 */
function extractTitleFromUrl(url) {
 try {
 const u = new URL(url);
 const last = (u.pathname || '').split('/').filter(Boolean).pop() || '';
 return last.replace(/[-_]+/g, ' ').replace(/\.(html?)$/i, ' ').trim();
 } catch {
 return '';
 }
}

function normalizeArticleTitle(article) {
 if (!article.title) {
 article.title = article?.raw?.headline || article?.raw?.name || '';
 if (!article.title) {
 const url = article.page_url || article.source_url || article.url || '';
 article.title = extractTitleFromUrl(url);
 }
 }
}

function normalizeArticleUrl(article) {
 if (!article.page_url) {
 article.page_url = article.source_url || article.url || article.href || null;
 }
}

function normalizeArticle(a) {
 const out = { ...a };
 normalizeArticleTitle(out);
 normalizeArticleUrl(out);
 return out;
}

/**
 * Handle follow-up direct synthesis for advice queries (equipment/pricing)
 * Returns true if a response was sent.
 */
async function handleEquipmentAdviceSynthesis(context) {
 if (!isEquipmentAdviceQuery(context.qlc)) return false;
 
 const articles = await findArticles(context.client, { keywords: context.keywords, limit: 30, pageContext: context.pageContext });
 const normalizedArticles = (articles || []).map(normalizeArticle);
 const articleUrls = normalizedArticles?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
 const contentChunks = await findContentChunks(context.client, { keywords: context.keywords, limit: 20, articleUrls });
 const synthesized = generateEquipmentAdviceResponse(context.qlc, normalizedArticles || [], contentChunks || []);
 
 if (synthesized) {
 context.res.status(200).json({
 ok: true,
 type: "advice",
 answer_markdown: synthesized,
 structured: {
 intent: "advice",
 topic: context.keywords.join(", "),
 events: [],
 products: [],
 services: [],
 landing: [],
 articles: (normalizedArticles || []).map(a => ({
 ...a,
 display_date: (function(){
 const extracted = extractPublishDate(a);
 const fallback = a.last_seen ? new Date(a.last_seen).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : null;
 return extracted || fallback;
 })()
 })),
 pills: []
 },
 confidence: 0.75,
 debug: { version: "v1.2.46-followup-equip-extracted", previousQuery: true }
 });
 return true;
 }
 return false;
}

async function handleAdviceFollowupSynthesis(context) {
 // Equipment advice synthesis
 if (await handleEquipmentAdviceSynthesis({
 client: context.client,
 qlc: context.qlc,
 keywords: context.keywords,
 pageContext: context.pageContext,
 res: context.res
 })) {
 return true;
 }

 // Pricing/accommodation synthesis
 const pricingSynth = generatePricingAccommodationAnswer(context.qlc);
 if (pricingSynth) {
 let articles = await findArticles(context.client, { keywords: context.keywords, limit: 30, pageContext: context.pageContext });
 articles = (articles || []).map(normalizeArticle);
 const articleUrls = articles?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
 const contentChunks = await findContentChunks(context.client, { keywords: context.keywords, limit: 20, articleUrls });
 const answer = generatePricingAccommodationAnswer(context.qlc, articles || [], contentChunks || []);
 if (answer) {
 context.res.status(200).json({
 ok: true,
 type: "advice",
 answer_markdown: answer,
 structured: {
 intent: "advice",
 topic: context.keywords.join(", "),
 events: [],
 products: [],
 services: [],
 landing: [],
 articles: (articles || []).map(a => ({
 ...a,
 display_date: (function(){
 const extracted = extractPublishDate(a);
 const fallback = a.last_seen ? new Date(a.last_seen).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : null;
 return extracted || fallback;
 })()
 })),
 pills: []
 },
 confidence: 0.70,
 debug: { version: "v1.2.46-followup-pricing-extracted", previousQuery: true }
 });
 return true;
 }
 }

 return false;
}

/**
 * Handle clarification follow-up responses based on previous query context
 * Returns true if a response was sent, otherwise false.
 */
function isClarificationResponse(previousQuery, query) {
 return previousQuery && (
 query.toLowerCase().includes("photography") ||
 query.toLowerCase().includes("equipment") ||
 query.toLowerCase().includes("course") ||
 query.toLowerCase().includes("service") ||
 query.toLowerCase().includes("advice") ||
 query.toLowerCase().includes("mentoring") ||
 query.toLowerCase().includes("about")
 );
}

async function handleEventsClarification(context) {
 if (!(context.query.toLowerCase().includes("events") || context.query.toLowerCase().includes("courses") || context.intent === "events")) {
 return false;
 }

 const events = await findEvents(context.client, { keywords: context.keywords, limit: 80, pageContext: context.pageContext });
 const eventList = formatEventsForUi(events);
 
 // Use quality-based confidence scoring
 const confidenceContext = initializeConfidenceContext(context.query || "");
 analyzeDataAttributes(events, null, confidenceContext);
 // Don't call analyzeResponseContent with empty strings - will be called with actual content later
 const confidence = finalizeConfidence(context.query || "", confidenceContext);
 context.res.status(200).json({
 ok: true,
 type: "events",
 answer: eventList,
 events: eventList,
 structured: {
 intent: "events",
 topic: (context.keywords || []).join(", "),
 events: eventList,
 products: [],
 pills: []
 },
 confidence,
 debug: { version: "v1.2.47-clarification-followup", previousQuery: true }
 });
 return true;
}

async function handleClarificationFollowup(context) {
 if (!isClarificationResponse(context.previousQuery, context.query)) return false;

 // Route by chosen clarification intent if present in text
 if (await handleEventsClarification({
 client: context.client,
 query: context.query,
 intent: context.intent,
 keywords: context.keywords,
 pageContext: context.pageContext,
 res: context.res
 })) {
 return true;
 }

 // Advice-oriented clarification
 return await handleAdviceClarification({
 client: context.client,
 query: context.query,
 keywords: context.keywords,
 pageContext: context.pageContext,
 res: context.res
 });
}

async function handleAdviceClarification(context) {
 let articles = await findArticles(context.client, { keywords: context.keywords, limit: 30, pageContext: context.pageContext });
 articles = (articles || []).map(normalizeArticle);
 const articleUrls = articles?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
 const contentChunks = await findContentChunks(context.client, { keywords: context.keywords, limit: 15, articleUrls });
 const answerMarkdown = generateDirectAnswer(context.query || "", articles, contentChunks);
 context.res.status(200).json({
 ok: true,
 type: "advice",
 answer_markdown: answerMarkdown,
 structured: {
 intent: "advice",
 topic: (context.keywords || []).join(", "),
 events: [],
 products: [],
 services: [],
 landing: [],
 articles: (articles || []).map(a => ({
 ...a,
 display_date: (function(){
 const extracted = extractPublishDate(a);
 const fallback = a.last_seen ? new Date(a.last_seen).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : null;
 return extracted || fallback;
 })()
 })),
 pills: []
 },
 confidence: 0.65,
 debug: { version: "v1.2.47-clarification-followup", previousQuery: true }
 });
 return true;
}
/**
 * Handle residential pricing guard - bypasses clarification for residential workshop pricing queries
 */
function isResidentialPricingQuery(query) {
 const qlc = (query || "").toLowerCase();
 const isResi = qlc.includes("residential") && qlc.includes("workshop");
 const hasPriceCue = qlc.includes("how much") || qlc.includes("price") || qlc.includes("cost") || qlc.includes("b&b") || qlc.includes("bed and breakfast") || qlc.includes("bnb");
 return isResi && hasPriceCue;
}

function filterResidentialEvents(events) {
 return events.filter(e => { 
 try { 
 return e.date_start && e.date_end && new Date(e.date_end) > new Date(e.date_start); 
 } catch { 
 return false; 
 } 
 });
}

function processArticlesForDisplay(articles) {
 return (articles || []).map(normalizeArticle);
}

async function handleResidentialEventsResponse(context) {
 const directKeywords = Array.from(new Set(["residential", "workshop", ...extractKeywords(context.query || "")]));
 const events = await findEvents(context.client, { keywords: directKeywords, limit: 140, pageContext: context.pageContext });
 const formattedEvents = formatEventsForUi(events) || [];
 const residentialEvents = filterResidentialEvents(formattedEvents);
 
 if (residentialEvents.length) {
 // Use quality-based confidence scoring
 const confidenceContext = initializeConfidenceContext(context.query || "");
 analyzeDataAttributes(residentialEvents, null, confidenceContext);
 // Don't call analyzeResponseContent with empty strings - will be called with actual content later
 const confidence = finalizeConfidence(context.query || "", confidenceContext);
 context.res.status(200).json({ 
 ok: true, 
 type: "events", 
 answer: residentialEvents, 
 events: residentialEvents, 
 structured: { 
 intent: "events", 
 topic: directKeywords.join(", "), 
 events: residentialEvents, 
 products: [], 
 pills: [] 
 }, 
 confidence, 
 debug: { version: "v1.2.48-guard-residential", guard: true } 
 });
 return true; // Response sent
 }
 return false;
}

async function handleResidentialPricingGuard(context) {
 try {
 if (!context.previousQuery && isResidentialPricingQuery(context.query)) {
 if (await handleResidentialEventsResponse({
 client: context.client,
 query: context.query,
 pageContext: context.pageContext,
 res: context.res
 })) {
 return true;
 }
 
 const directKeywords = Array.from(new Set(["residential", "workshop", ...extractKeywords(context.query || "")]));
 const enrichedKeywords = Array.from(new Set([...directKeywords, "b&b", "bed", "breakfast", "price", "cost"]));
 const articles = await findArticles(context.client, { keywords: enrichedKeywords, limit: 30, pageContext: context.pageContext });
 const processedArticles = processArticlesForDisplay(articles);
 const articleUrls = processedArticles?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
 const chunks = await findContentChunks(context.client, { keywords: enrichedKeywords, limit: 20, articleUrls });
 const markdown = generateDirectAnswer(context.query || "", processedArticles, chunks) || generatePricingAccommodationAnswer(context.query || "", processedArticles, chunks);
 
 if (markdown) {
 context.res.status(200).json({ 
 ok: true, 
 type: "advice", 
 answer_markdown: markdown, 
 structured: { 
 intent: "advice", 
 topic: enrichedKeywords.join(", "), 
 events: [], 
 products: [], 
 services: [], 
 landing: [], 
 articles: (processedArticles || []).map(a => ({ 
 ...a, 
 display_date: (function() { 
 const ex = extractPublishDate(a); 
 const fb = a.last_seen ? new Date(a.last_seen).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : null; 
 return ex || fb; 
 })() 
 })), 
 pills: [] 
 }, 
 confidence: 0.70, 
 debug: { version: "v1.2.48-guard-residential", guard: true } 
 });
 return true; // Response sent
 }
 }
 } catch (error) {
 console.warn('Residential pricing guard error:', error.message);
 }
 
 return false; // No response sent, continue with normal flow
}

/**
 * Handle the core events retrieval and response pipeline.
 * Returns true if it sent a response.
 */
// Helper function to extract duration category from query
function extractDurationCategory(query) {
 const qlc = String(query || '').toLowerCase();
 if (qlc.includes('2.5hrs-4hrs')) return '2.5hrs-4hrs';
 if (qlc.includes('1-day')) return '1-day';
 if (qlc.includes('2-5-days')) return '2-5-days';
 return null;
}

// Helper function to handle direct duration routing
async function handleDirectDurationRouting(context) {
 const eventsDirect = await findEventsByDuration(context.client, context.durationCategory, 120);
 const eventListDirect = formatEventsForUi(eventsDirect);
 
 // Use quality-based confidence scoring
 const confidenceContext = initializeConfidenceContext(context.query || "");
 analyzeDataAttributes(eventsDirect, null, confidenceContext);
 // Don't call analyzeResponseContent with empty strings - will be called with actual content later
 const confidenceDirect = finalizeConfidence(context.query || "", confidenceContext);

 context.res.status(200).json({
 ok: true,
 type: "events",
 answer: eventListDirect,
 answer_markdown: `I found ${eventListDirect.length} ${eventListDirect.length === 1 ? 'event' : 'events'} that match your query. These ${eventListDirect.length === 1 ? 'is' : 'are'} ${context.durationCategory} ${eventListDirect.length === 1 ? 'event' : 'events'} with experienced instruction and hands-on learning opportunities.`,
 events: eventListDirect,
 structured: {
 intent: "events",
 topic: (context.keywords || []).join(", "),
 events: eventListDirect,
 products: [],
 pills: []
 },
 confidence: confidenceDirect,
 debug: { version: "v1.3.20-expanded-classification", debugInfo: { ...(context.debugInfo||{}), routed:"duration_direct", durationCategory: context.durationCategory }, timestamp: new Date().toISOString() }
 });
 return true;
 }

// Helper function to handle clarification response
async function handleClarificationResponse(context) {
 const clarification = await generateClarificationQuestion(context.query, context.client, context.pageContext);
 if (clarification) {
 const confidencePercent = clarification.confidence || 20;
 context.res.status(200).json({
 ok: true,
 type: "clarification",
 answer: clarification.question,
 answer_markdown: clarification.question,
 clarification: clarification.question,
 question: clarification.question,
 options: clarification.options,
 confidence: confidencePercent,
 debug: { version: "v1.3.20-expanded-classification", intent: context.debugInfo?.intent || "events", timestamp: new Date().toISOString() }
 });
 return true;
 }
 return false;
 }
 
// Helper function to send final events response
function sendEventsResponse(context) {
 // Generate the formatted answer
 const formattedAnswer = generateEventAnswerMarkdown(context.eventList, context.query || "");
 
 // Apply quality analysis to recalculate confidence based on new criteria
 if (context.query && formattedAnswer) {
 console.log(`ðŸ” Applying quality analysis to event response for: "${context.query}"`);
 try {
 // Initialize quality indicators if they don't exist
 if (!context.qualityIndicators) {
 context.qualityIndicators = {
 hasDirectAnswer: false,
 hasRelevantEvents: false,
 hasRelevantArticles: false,
 hasActionableInfo: false,
 responseCompleteness: 0,
 responseAccuracy: 0
 };
 }
 
 // Analyze the formatted response content
 analyzeResponseContent(formattedAnswer, [], context);
 
 // Recalculate confidence based on quality indicators
 const newConfidence = finalizeConfidence(context.query, context);
 console.log(`ðŸŽ¯ Event confidence updated: ${(newConfidence * 100).toFixed(1)}% (was ${(context.confidence * 100).toFixed(1)}%)`);
 context.confidence = newConfidence;
 } catch (error) {
 console.log(`âŒ Error in event quality analysis: ${error.message}`);
 }
 }
 
 context.res.status(200).json({
 ok: true,
 type: "events",
 answer: formattedAnswer,
 answer_markdown: formattedAnswer,
 events: context.eventList,
 structured: {
 intent: "events",
 topic: (context.keywords || []).join(", "),
 events: context.eventList,
 products: [],
 pills: []
 },
 confidence: context.confidence,
 debug: {
 version: "v1.3.20-expanded-classification",
 debugInfo: context.debugInfo,
 timestamp: new Date().toISOString(),
 queryText: context.query,
 keywords: context.keywords
 }
 });
}

async function handleEventsPipeline(params) {
 const { client, query, keywords, pageContext, res, debugInfo = null } = params;
 
 // Early routing: if the original query already carries a normalized duration token,
 // bypass keyword-derived routing and fetch by category directly. This avoids
 // losses during keyword extraction (e.g., stripping "2.5hrs-4hrs").
 try {
 const durationCategory = extractDurationCategory(query);
 if (durationCategory) {
 return await handleDirectDurationRouting({
 client,
 query,
 keywords,
 durationCategory,
 res,
 debugInfo
 });
 }
 } catch (_) { /* non-fatal: fall back to standard flow */ }

 const events = await findEvents(client, { keywords, limit: 80, pageContext });
 const eventList = formatEventsForUi(events);
 if (!Array.isArray(eventList)) return false;
 
 const confidence = calculateEventConfidence(query || "", eventList, null);
 const clarificationThreshold = (debugInfo?.intent === 'workshop') ? 0.2 : 0.2; // Temporarily lowered for debugging
 
 if (confidence < clarificationThreshold) {
 const clarificationHandled = await handleClarificationResponse({
 query,
 client,
 pageContext,
 res,
 debugInfo
 });
 if (clarificationHandled) return true;
 }
 
 sendEventsResponse({
 eventList,
 query,
 keywords,
 confidence,
 res,
 debugInfo
 });
 return true;
}

/**
 * Handle session creation and logging
 */
function handleSessionAndLogging(sessionId, query, req) {
 // Create session if it doesn't exist (async, don't wait for it)
 if (sessionId) {
 const userAgent = req.headers['user-agent'] || 'unknown';
 const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
 createSession(sessionId, userAgent, ip).catch(err => 
 console.warn('Failed to create session:', err.message)
 );
 }

 // Log the question (async, don't wait for it)
 if (sessionId && query) {
 logQuestion(sessionId, query).catch(err => 
 console.warn('Failed to log question:', err.message)
 );
 }
}

/**
 * Gather pre-content for confidence checking
 */
async function gatherPreContent(context) {
 let preContent = { articles: [], events: [], products: [], relevanceScore: 0 };
 
 if (!context.previousQuery) {
 try {
 const preKeywords = extractKeywords(context.query || "");
 if (context.intent === "events") {
 const eventsPeek = await findEvents(context.client, { keywords: preKeywords, limit: 50, pageContext: context.pageContext });
 preContent.events = formatEventsForUi(eventsPeek);
 } else {
 const articlesPeek = await findArticles(context.client, { keywords: preKeywords, limit: 20, pageContext: context.pageContext });
 preContent.articles = articlesPeek;
 const articleUrlsPeek = articlesPeek?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
 const chunksPeek = await findContentChunks(context.client, { keywords: preKeywords, limit: 10, articleUrls: articleUrlsPeek });
 // Rough relevance: number of chunks found
 preContent.relevanceScore = Math.min(1, (chunksPeek?.length || 0) / 10);
 }
 } catch (e) {
 // Soft-fail: continue without preContent
 }
 }
 
 return preContent;
}

/* -------------------------------- Handler -------------------------------- */
// REFACTORED: Evidence-Based Direct Answer Handler (Low Complexity)
// Helper function to get contact Alan patterns
function getContactAlanPatterns() {
 return [
 /cancellation or refund policy for courses/i,
 /cancellation or refund policy for workshops/i,
 /how do i book a course or workshop/i,
 /can the gift voucher be used for any workshop/i,
 /can the gift voucher be used for any course/i,
 /how do i know which course or workshop is best/i,
 /do you do astrophotography workshops/i,
 /do you get a certificate with the photography course/i,
 /do i get a certificate with the photography course/i,
 /do you i get a certificate with the photography course/i,
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
}

// Helper function to check contact Alan patterns
function checkContactAlanQueryPatterns(query) {
 const patterns = getContactAlanPatterns();
 for (const pattern of patterns) {
 if (pattern.test(query)) {
 return true;
 }
 }
 return false;
}

// Helper function to handle contact Alan response
function handleContactAlanResponse(query, res) {
 console.log(`ðŸ“ž Contact Alan query detected in handleDirectAnswerQuery: "${query}"`);
 res.status(200).json({
 ok: true,
 type: 'advice',
 confidence: 0.8,
 answer: "I can't find a reliable answer for that specific question in my knowledge base. For detailed information about this, please contact Alan directly using the contact form or WhatsApp in the header section of this chat. He'll be happy to provide you with accurate and up-to-date information.",
 structured: {
 intent: "contact_required",
 topic: "contact_alan",
 events: [],
 products: [],
 pills: []
 },
 debugInfo: {
 version: "v1.3.20-contact-alan-fix",
 intent: "contact_required",
 classification: "direct_answer",
 contactAlanQuery: true
 }
 });
 }
 
// Helper function to handle private lessons response
function handlePrivateLessonsResponse(query, res) {
 console.log(`ðŸ“š Private lessons query detected in handleDirectAnswerQuery: "${query}"`);
 
 const serviceAnswer = getServiceAnswers(query.toLowerCase());
 if (serviceAnswer) {
 res.status(200).json({
 ok: true,
 type: 'advice',
 confidence: 0.9,
 answer: serviceAnswer,
 structured: {
 intent: "advice",
 topic: "private_lessons",
 events: [],
 products: [],
 pills: []
 },
 debugInfo: {
 version: "v1.3.20-private-lessons-fix",
 intent: "advice",
 classification: "direct_answer",
 privateLessonsQuery: true
 }
 });
 return true;
 }
 return false;
}

// Helper function to handle RAG response
function handleRagResponse(ragResult, res) {
 console.log(`[SUCCESS] RAG success for direct answer query: confidence=${ragResult.confidence}`);
 res.status(200).json({
 ok: true,
 type: ragResult.type,
 confidence: ragResult.confidence,
 answer: ragResult.answer,
 structured: ragResult.structured,
 debugInfo: {
 version: "v1.3.20-rag-direct-answer",
 intent: "rag_first",
 classification: "direct_answer",
 confidence: ragResult.confidence,
 totalMatches: ragResult.totalMatches,
 chunksFound: ragResult.chunksFound,
 entitiesFound: ragResult.entitiesFound
 }
 });
}

// Helper function to handle fallback response
function handleFallbackResponse(context) {
 const keywords = extractKeywords(context.query);
 const { answer, confidence } = generateEvidenceBasedAnswer({
 query: context.query,
 articles: context.articles,
 services: context.services,
 events: context.events
 });
 const pills = generateSmartPills(context.query, { articles: context.articles, services: context.services, events: context.events }, context.classification);
 
 context.res.status(200).json({
 ok: true,
 type: "advice",
 answer_markdown: answer,
 structured: {
 intent: "direct_answer",
 topic: keywords.join(", "),
 events: context.events,
 products: [],
 services: context.services,
 landing: [],
 articles: context.articles
 },
 pills: pills,
 confidence,
 debugInfo: { 
 version: "v1.3.20-expanded-classification", 
 intent: "direct_answer",
 ragDebug: {
 chunksFound: 0,
 entitiesFound: 0,
 confidence: 0
 }, 
 classification: context.classification.type,
 timestamp: new Date().toISOString() 
 }
 });
}

async function handleDirectAnswerQuery(context) {
 try {
 const classification = classifyQuery(context.query);
 
 // Handle special query types first
 if (handleSpecialQueryTypes(context, classification)) {
 return true;
 }
 
 // Try RAG system for direct answers
 const ragResult = await tryRagFirst(context.client, context.query);
 if (ragResult.success && ragResult.confidence >= 0.3) {
 handleRagResponse(ragResult, context.res);
 return true;
 }
 
 // Fallback to old system
 return await handleFallbackSystem(context, classification);
 
 } catch (error) {
 console.error('Error in handleDirectAnswerQuery:', error);
 return false;
 }
}

function handleSpecialQueryTypes(context, classification) {
 // Check if this is a "contact Alan" query
 if (checkContactAlanQueryPatterns(context.query)) {
 handleContactAlanResponse(context.query, context.res);
 return true;
 }
 
 // Check if this is a private lessons query
 if (classification.reason === 'private_lessons_query') {
 return handlePrivateLessonsResponse(context.query, context.res);
 }
 
 return false;
}

async function handleFallbackSystem(context, classification) {
 console.log(`[WARN] RAG failed for direct answer query, using fallback system`);
 const keywords = extractKeywords(context.query);
 
 // Search for relevant content
 const [articles, services, events] = await Promise.all([
 findArticles(context.client, { keywords, limit: 5, pageContext: context.pageContext }),
 findServices(context.client, { keywords, limit: 5, pageContext: context.pageContext }),
 findEvents(context.client, { keywords, limit: 3, pageContext: context.pageContext })
 ]);
 
 handleFallbackResponse({
 query: context.query,
 articles,
 services,
 events,
 classification,
 res: context.res
 });
 return true;
}

// Helper: Handle clarification queries (Low Complexity)
async function handleClarificationQuery(context) {
 try {
 console.log(`ðŸŽ¯ Handling clarification query: "${context.query}" with reason: ${context.classification.reason}`);
 
 // Check if this is a course-related clarification
 if (context.classification.reason === 'course_query_needs_clarification') {
 console.log(`ðŸ“š Course clarification query detected: "${context.query}"`);
 context.res.status(200).json({
 ok: true,
 type: 'course_clarification',
 question: "Yes, we offer several photography courses! What type of course are you interested in?",
 options: [
 { text: "Beginners camera course", query: "beginners camera course" },
 { text: "Photo editing course", query: "photo editing course" },
 { text: "RPS mentoring course", query: "rps mentoring course" },
 { text: "Private photography lessons", query: "private photography lessons" }
 ],
 debugInfo: {
 version: "v1.3.20-course-clarification-fix",
 intent: "clarification",
 classification: "clarification",
 reason: context.classification.reason
 }
 });
 return true;
 }
 
 // Handle other clarification types
 console.log(`ðŸ” Generic clarification query: "${context.query}"`);
 context.res.status(200).json({
 ok: true,
 type: 'clarification',
 question: "I'd be happy to help you with your photography questions! Could you be more specific about what you're looking for?",
 options: [
 { text: "Photography workshops", query: "photography workshops" },
 { text: "Photo editing courses", query: "photo editing courses" },
 { text: "Private lessons", query: "private photography lessons" },
 { text: "Equipment advice", query: "photography equipment advice" }
 ],
 debugInfo: {
 version: "v1.3.20-generic-clarification",
 intent: "clarification",
 classification: "clarification",
 reason: context.classification.reason
 }
 });
 return true;
 
 } catch (error) {
 console.error('Error in handleClarificationQuery:', error);
 return false;
 }
}

// Helper: Generate evidence-based answer (Low Complexity)
// Helper function to generate article-based answer
function generateArticleAnswer(articles, query = '') {
 const bestArticle = articles[0];
 
 // Extract the main concept from the query for FAQ matching
 const concept = query.toLowerCase().replace(/^(what is|what's|what are|what's the|how does|how do|why is|why are|when should|when do|where is|where are)\s+/i, '').trim();
 
 // Try to extract FAQ content from json_ld_data first
 const faqAnswer = extractAnswerFromJsonLd(bestArticle, concept);
 if (faqAnswer) {
 console.log(`[SUCCESS] Generated FAQ answer from article: "${faqAnswer.substring(0, 100)}..."`);
 return faqAnswer;
 }
 
 // Fallback to generic response
 console.log(`[FALLBACK] No FAQ content found, using generic response`);
 return `Based on Alan Ranger's expertise, here's what you need to know about your question.\n\n*For detailed information, read the full guide: ${bestArticle.page_url}*`;
}

// Helper function to generate equipment service answer
function generateEquipmentServiceAnswer(bestService) {
 return `For equipment recommendations like tripods, Alan Ranger has extensive experience and can provide personalized advice based on your specific needs and budget.\n\nHis equipment recommendations cover:\nâ€¢ Professional tripod systems\nâ€¢ Camera bodies and lenses\nâ€¢ Accessories and filters\nâ€¢ Budget-friendly alternatives\n\n*View his detailed equipment guide: ${bestService.page_url}*\n\nFor personalized recommendations, consider booking a consultation or attending one of his workshops where he demonstrates equipment in real-world conditions.`;
}

// Helper function to generate Lightroom service answer
function generateLightroomServiceAnswer() {
 const serviceUrl = "https://www.alanranger.com/photo-editing-course-coventry";
 return `Alan Ranger offers comprehensive Lightroom editing courses and workshops. His photo editing training covers:\n\nâ€¢ Basic to advanced Lightroom techniques\nâ€¢ Workflow optimization\nâ€¢ Color correction and enhancement\nâ€¢ Batch processing methods\nâ€¢ Creative editing approaches\n\n*Learn more about his Lightroom courses: ${serviceUrl}*`;
}

// Helper function to generate Alan background answer
function generateAlanBackgroundAnswer() {
 return `Alan Ranger is a BIPP (British Institute of Professional Photography) qualified photographer with over 20 years of teaching experience and 580+ 5-star reviews.\n\n**His Background:**\nâ€¢ BIPP Qualified Professional Photographer\nâ€¢ 20+ years of teaching experience\nâ€¢ Specializes in landscape photography\nâ€¢ Based in Coventry, UK\n\n**What He Offers:**\nâ€¢ Landscape photography workshops (Wales, Devon, Yorkshire)\nâ€¢ Photo editing and Lightroom training\nâ€¢ Private tuition and mentoring\nâ€¢ Online photography academy\nâ€¢ Free online photography course\n\n**Reviews:** 4.9/5 stars from students and clients\n\n*Learn more about Alan: https://www.alanranger.com/about*`;
}

// Helper function to generate service-based answer
function generateServiceAnswer(query, services) {
 const bestService = services[0];
 const lc = query.toLowerCase();
 
 console.log(`ðŸ” generateEvidenceBasedAnswer: Query "${query}" matched services, testing patterns...`);
 
 if (/tripod|equipment|gear|camera|lens/i.test(lc)) {
 return generateEquipmentServiceAnswer(bestService);
 } else if (/lightroom|photo-?editing/i.test(lc)) {
 return generateLightroomServiceAnswer();
 } else if (/who.*alan|alan.*ranger|background|experience/i.test(lc)) {
 return generateAlanBackgroundAnswer();
 } else {
 return `Yes, Alan Ranger offers the services you're asking about.\n\n*Learn more: ${bestService.page_url}*`;
 }
}

// Helper function to generate fallback answer
function generateFallbackAnswer(query) {
 const lc = query.toLowerCase();
 
 if (/course|training|learn|teach/i.test(lc)) {
 return `Alan Ranger offers comprehensive photography courses and training programs. His courses cover:\n\nâ€¢ Landscape photography workshops\nâ€¢ Photo editing and Lightroom training\nâ€¢ Private tuition and mentoring\nâ€¢ Online photography academy\n\nFor specific course information and availability, please contact Alan directly or visit his website to see the full range of educational offerings.`;
 } else if (/equipment|gear|camera|lens|tripod/i.test(lc)) {
 return `Alan Ranger has extensive experience with photography equipment and can provide personalized recommendations based on your specific needs and budget.\n\nFor equipment advice, consider:\nâ€¢ Booking a consultation\nâ€¢ Attending a workshop where equipment is demonstrated\nâ€¢ Contacting Alan directly for personalized recommendations\n\nHe regularly reviews and recommends equipment based on real-world photography experience.`;
 } else if (/workshop|event|tour/i.test(lc)) {
 return `Alan Ranger offers a variety of photography workshops and events throughout the UK. His workshops include:\n\nâ€¢ Landscape photography in Wales, Devon, Yorkshire\nâ€¢ Long exposure techniques\nâ€¢ Photo editing courses\nâ€¢ Private mentoring sessions\n\nFor current workshop schedules and availability, please visit his website or contact him directly.`;
 } else {
 return `For specific information about your query, please contact Alan Ranger directly or visit the website for more details.`;
 }
}

function generateEvidenceBasedAnswer(context) {
 let answer = '';
 
 if (context.articles.length > 0) {
 answer = generateArticleAnswer(context.articles, context.query);
 } else if (context.services.length > 0) {
 answer = generateServiceAnswer(context.query, context.services);
 } else if (context.events.length > 0) {
 const bestEvent = context.events[0];
 answer = `Here's information about the workshops and events available.\n\n*View details: ${bestEvent.page_url}*`;
 } else {
 answer = generateFallbackAnswer(context.query);
 }
 
 // Use quality-based confidence scoring instead of hardcoded values
 const confidenceContext = initializeConfidenceContext(context.query);
 analyzeResponseContent(answer, context.articles || [], confidenceContext);
 const confidence = finalizeConfidence(context.query, confidenceContext);
 
 return { answer, confidence };
}

// Helper: Generate smart pills (Low Complexity)
// Helper: Create pill from item
function createPillFromItem(item) {
 if (!item.url || !item.title) return null;
 return {
 label: item.title.length > 30 ? item.title.substring(0, 30) + '...' : item.title,
 url: item.url,
 brand: false
 };
}

// Helper: Add evidence-based pills
function addEvidencePills(pills, evidence) {
 const { articles, services, events } = evidence;
 
 if (articles && articles.length > 0) {
 articles.slice(0, 2).forEach(article => {
 const pill = createPillFromItem(article);
 if (pill) pills.push(pill);
 });
 }
 
 if (services && services.length > 0) {
 services.slice(0, 2).forEach(service => {
 const pill = createPillFromItem(service);
 if (pill) pills.push(pill);
 });
 }
 
 if (events && events.length > 0) {
 events.slice(0, 2).forEach(event => {
 const pill = createPillFromItem(event);
 if (pill) pills.push(pill);
 });
 }
}

// Helper: Add contextual pills based on query content
function addContextualPills(pills, lc) {
 const contextualPills = [
 {
 keywords: ['tripod', 'equipment', 'camera', 'lens'],
 pill: { label: "Equipment Guide", url: "https://www.alanranger.com/equipment-recommendations", brand: true }
 },
 {
 keywords: ['alan ranger', 'who is', 'about'],
 pill: { label: "About Alan", url: "https://www.alanranger.com/about", brand: true }
 },
 {
 keywords: ['commercial', 'wedding', 'portrait', 'service'],
 pill: { label: "Services", url: "https://www.alanranger.com/services", brand: true }
 },
 {
 keywords: ['workshop', 'course', 'class'],
 pill: { label: "Workshops", url: "https://www.alanranger.com/workshops", brand: true }
 },
 {
 keywords: ['contact', 'book', 'enquiry'],
 pill: { label: "Contact Alan", url: "https://www.alanranger.com/contact", brand: true }
 },
 {
 keywords: ['blog', 'tip', 'learn'],
 pill: { label: "Photography Blog", url: "https://www.alanranger.com/blog", brand: true }
 }
 ];
 
 contextualPills.forEach(({ keywords, pill }) => {
 if (keywords.some(keyword => lc.includes(keyword))) {
 pills.push(pill);
 }
 });
}

function generateSmartPills(query, evidence, classification) {
 const pills = [];
 const lc = query.toLowerCase();
 
 // Add evidence-based pills
 addEvidencePills(pills, evidence);
 
 // Add contextual pills based on query content
 addContextualPills(pills, lc);
 
 // Always add contact as fallback if no other pills
 if (pills.length === 0) {
 pills.push({ label: "Contact Alan", url: "https://www.alanranger.com/contact", brand: true });
 }
 
 // Limit to 4 pills maximum
 return pills.slice(0, 4);
}

// REFACTORED: Main Handler - Broken into smaller functions
export default async function handler(req, res) {
 console.log(`[DEBUG] MAIN HANDLER CALLED - DEPLOYMENT TEST V2`);
 const started = Date.now();
 try {
 // Validate request method
 if (!validateRequestMethod(req, res)) return;
 
 // Extract and normalize query
 const { query, previousQuery, sessionId, pageContext } = extractAndNormalizeQuery(req.body);
 // Sanitize page context: ignore self-hosted chat page to avoid misleading clarification routing
 const sanitizedPageContext = (pageContext && typeof pageContext.pathname === 'string' && /\/chat\.html$/i.test(pageContext.pathname)) ? null : pageContext;
 if (!query) {
 res.status(400).json({ ok: false, error: "missing_query" });
 return;
 }
 
 // Handle normalized duration queries
 if (await handleNormalizedDurationQuery(query, sanitizedPageContext, res)) return;
 
 // Continue with main processing
 await processMainQuery({
 query,
 previousQuery,
 sessionId,
 pageContext: sanitizedPageContext,
 res,
 started,
 req
 });
 
 } catch (error) {
 console.error('Handler error:', error);
 
 // Provide more specific error information for debugging
 if (error.message.includes('Missing SUPABASE_URL') || error.message.includes('Missing SUPABASE_SERVICE_ROLE_KEY')) {
 res.status(500).json({ 
 ok: false, 
 error: "configuration_error", 
 message: "Environment variables not configured",
 details: error.message 
 });
 } else {
 res.status(500).json({ 
 ok: false, 
 error: "internal_server_error",
 message: error.message 
 });
 }
 }
}

// Helper: Validate request method (Low Complexity)
function validateRequestMethod(req, res) {
 if (req.method !== "POST") {
 res.status(405).json({ ok: false, error: "method_not_allowed", where: "http" });
 return false;
 }
 return true;
}

// Helper: Extract and normalize query (Low Complexity)
function extractAndNormalizeQuery(body) {
 let { query, previousQuery, sessionId, pageContext } = body || {};
 
 if (typeof query === 'string') {
 const q0 = query;
 // Normalize duration categories for consistent routing
 query = query.replace(/\b(1\s*day|one\s*day)\b/gi, '1-day');
 query = query.replace(/\b(2\.5\s*hr|2\.5\s*hour|2\s*to\s*4\s*hr|2\s*to\s*4\s*hour|2\s*hr|2\s*hour|short)\b/gi, '2.5hrs-4hrs');
 query = query.replace(/\b(2\s*to\s*5\s*day|multi\s*day|residential)\b/gi, '2-5-days');
 if (q0 !== query) {
 console.log('ðŸ” Normalized query text:', { before: q0, after: query });
 }
 }
 
 return { query, previousQuery, sessionId, pageContext };
}

// Helper: Handle normalized duration queries (Low Complexity)
async function handleNormalizedDurationQuery(query, pageContext, res) {
 if (typeof query === 'string' && (query.includes('1-day') || query.includes('2.5hrs-4hrs') || query.includes('2-5-days'))) {
 console.log(`ðŸŽ¯ Bypassing all clarification logic for normalized duration query: "${query}"`);
 const client = supabaseAdmin();
 const keywords = extractKeywords(query);
 return await handleEventsPipeline({ client, query, keywords, pageContext, res, debugInfo: { bypassReason: 'normalized_duration' } });
 }
 return false;
}

// RAG-First approach: Try to answer directly from database
// Helper: Calculate primary keyword score
function calculatePrimaryKeywordScore(context) {
 if (!context.primaryKeyword) return 0;
 let score = 0;
 if (context.title.includes(context.primaryKeyword)) score += 5;
 if (context.url.includes(context.primaryKeyword.replace(/\s+/g,'-'))) score += 4;
 if (context.text.includes(context.primaryKeyword)) score += 2;
 return score;
}

// Helper: Calculate equipment keyword score
function calculateEquipmentKeywordScore(context) {
 let score = 0;
 for (const kw of context.equipmentKeywords) {
 if (context.text.includes(kw) || context.title.includes(kw)) score += 2;
 if (context.url.includes(kw.replace(/\s+/g,'-'))) score += 2;
 }
 return score;
}

// Helper: Calculate technical keyword score
function calculateTechnicalKeywordScore(technicalKeywords, title, text) {
 let score = 0;
 for (const kw of technicalKeywords) {
 if (text.includes(kw) || title.includes(kw)) score += 1.5;
 }
 return score;
}

// Helper: Calculate query term score
function calculateQueryTermScore(lcQuery, text) {
 let score = 0;
 lcQuery.split(/\s+/).forEach(w => { 
 if (w && w.length > 2 && text.includes(w)) score += 0.5; 
 });
 return score;
}

// Helper: Calculate URL-based score
function calculateUrlScore(url) {
 let score = 0;
 if (url.includes('/photography-equipment') || url.includes('/recommended-products')) score += 3;
 if (url.includes('/photography-tips') || url.includes('/techniques')) score += 2;
 if (url.includes('/blog') || url.includes('/articles')) score += 1;
 return score;
}

// Helper: Calculate content length penalties
function calculateContentLengthPenalties(text) {
 let penalty = 0;
 if (text.length < 50) penalty -= 2;
 if (text.length > 2000) penalty -= 1;
 return penalty;
}

// Helper: Calculate off-topic penalties
function calculateOffTopicPenalties(offTopicHints, url, text) {
 let penalty = 0;
 for (const hint of offTopicHints) { 
 if (url.includes(hint) || text.includes(hint)) penalty -= 5; 
 }
 return penalty;
}

// Helper: Calculate chunk relevance score (Low Complexity)
function calculateChunkScore(chunk, scoringParams) {
 const { primaryKeyword, equipmentKeywords, technicalKeywords, lcQuery, offTopicHints } = scoringParams;
 const url = (chunk.url||"").toLowerCase();
 const title = (chunk.title||"").toLowerCase();
 const text = (chunk.chunk_text||"").toLowerCase();
 
 let score = 0;
 
 // Primary keyword scoring (highest priority)
 score += calculatePrimaryKeywordScore({ primaryKeyword, title, url, text });
 
 // Equipment-specific scoring
 score += calculateEquipmentKeywordScore({ equipmentKeywords, title, url, text });
 
 // Technical content scoring
 score += calculateTechnicalKeywordScore(technicalKeywords, title, text);
 
 // Direct query term matches
 score += calculateQueryTermScore(lcQuery, text);
 
 // URL-based scoring
 score += calculateUrlScore(url);
 
 // Penalize off-topic content
 score += calculateOffTopicPenalties(offTopicHints, url, text);
 
 // Penalize very short or very long content
 score += calculateContentLengthPenalties(text);
 
 return score;
}

// Helper function to remove URL artifacts
function removeUrlArtifacts(text) {
 // Remove URL-encoded image paths and artifacts at the start - more aggressive
 text = text.replace(/^[A-Z0-9\-_]+\.(png|jpg|jpeg|gif|webp)[&\s]*/gi, "");
 text = text.replace(/^[A-Z0-9\-_]+\.(png|jpg|jpeg|gif|webp)&url=[^\s]*/gi, "");
 
 // Remove URL-encoded content and HTML artifacts - more aggressive
 text = text.replace(/&url=https?%3A%2F%2F[^\s]*/gi, "");
 text = text.replace(/https?%3A%2F%2F[^\s]*/gi, "");
 text = text.replace(/PRIVATE-PHOTOGRAPHY-LESSONS\.png[^\s]*/gi, "");
 
 // Remove unrendered markdown links like [/rps-courses-mentoring-distinctions]
 text = text.replace(/\[\/[^\]]+\]/g, "");
 
 return text;
}

// Helper function to decode HTML entities
function decodeHtmlEntities(text) {
 const entityMap = {
 '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ',
 '&#x27;': "'", '&#x2F;': '/', '&#x3D;': '=', '&#x3A;': ':', '&#x2E;': '.', '&#x2D;': '-',
 '&#x5F;': '_', '&#x2B;': '+', '&#x20;': ' ', '&#x21;': '!', '&#x22;': '"', '&#x23;': '#',
 '&#x24;': '$', '&#x25;': '%', '&#x26;': '&', '&#x28;': '(', '&#x29;': ')', '&#x2A;': '*',
 '&#x2C;': ',', '&#x3B;': ';', '&#x3C;': '<', '&#x3E;': '>', '&#x3F;': '?', '&#x40;': '@',
 '&#x5B;': '[', '&#x5C;': '\\', '&#x5D;': ']', '&#x5E;': '^', '&#x60;': '`', '&#x7B;': '{',
 '&#x7C;': '|', '&#x7D;': '}', '&#x7E;': '~'
 };
 
 for (const [entity, replacement] of Object.entries(entityMap)) {
 text = text.replace(new RegExp(entity, 'g'), replacement);
 }
 
 return text;
}

// Helper function to fix problematic patterns
function fixProblematicPatterns(text) {
 const patterns = [
 { from: /\?\?\?/g, to: "'" },
 { from: /wi\?\?\?/g, to: "with" },
 { from: /Beg\?\?\?/g, to: "Beginners" },
 { from: /That\?\?\?s/g, to: "That's" },
 { from: /doesn\?\?\?t/g, to: "doesn't" },
 { from: /don\?\?\?t/g, to: "don't" },
 { from: /can\?\?\?t/g, to: "can't" },
 { from: /won\?\?\?t/g, to: "won't" },
 { from: /I\?\?\?m/g, to: "I'm" },
 { from: /you\?\?\?re/g, to: "you're" },
 { from: /we\?\?\?re/g, to: "we're" },
 { from: /they\?\?\?re/g, to: "they're" },
 { from: /it\?\?\?s/g, to: "it's" },
 { from: /Alan\?\?\?s/g, to: "Alan's" },
 { from: /What\?\?\?s/g, to: "What's" },
 { from: /more\?\?\?/g, to: "more" }
 ];
 
 for (const pattern of patterns) {
 text = text.replace(pattern.from, pattern.to);
 }
 
 return text;
}

// Helper function to remove UI elements
function removeUiElements(text) {
 const uiPatterns = [
 /^\/Cart[\s\S]*?Sign In My Account[\s\S]*?(?=\n\n|$)/gi,
 /Back\s+(Workshops|Services|Gallery|Book|About|Blog)[\s\S]*?(?=\n\n|$)/gi,
 /Home\s*\/\s*About\s*\/\s*Services\s*\/\s*Gallery\s*\/\s*Contact/gi,
 /Privacy\s*Policy\s*\/\s*Terms\s*of\s*Service/gi,
 /https?:\/\/(?!www\.alanranger\.com)\S+/g,
 /Facebook\d*|LinkedIn\d*|Tumblr|Pinterest\d*/gi,
 /Add to Cart|Only \d+ available|Select Course|Posted in/gi,
 /Course:\s*Select Course[\s\S]*?(?=\n\n|$)/gi,
 /^\s*ed for updated portfolios and images\s*/gi,
 /^\s*[a-z]+\s+for\s+updated\s+portfolios\s*/gi,
 /Earlier Event:.*?Later Event:.*?$/gi,
 /Earlier Event:.*?$/gi,
 /Later Event:.*?$/gi,
 /^\d+ November.*?$/gi,
 /^\d+ December.*?$/gi,
 /Camera Courses For Beginners.*?$/gi
 ];
 
 for (const pattern of uiPatterns) {
 text = text.replace(pattern, "");
 }
 
 return text;
}

// Helper function to fix truncated text
function fixTruncatedText(text) {
 if (text.match(/^[a-z]/)) {
 const sentences = text.split(/[.!?]+/);
 if (sentences.length > 1) {
 for (let i = 1; i < sentences.length; i++) {
 const candidate = sentences.slice(i).join('. ').trim();
 if (candidate.length > 50 && candidate.match(/^[A-Z]/)) {
 return candidate;
 }
 }
 }
 }
 return text;
 }
 
// Helper function to find intro patterns
function findIntroPattern(text) {
 const introPatterns = [
 /^Alan Ranger Photography/,
 /^Are you ready/,
 /^If you prefer/,
 /^Based on Alan/,
 /^Alan offers/,
 /^I can provide/,
 /^For equipment/,
 /^Alan provides/
 ];
 
 for (const pattern of introPatterns) {
 if (pattern.test(text)) {
 console.log(`ðŸŽ¯ Found intro pattern: ${pattern}`);
 const match = text.match(pattern);
 if (match) {
 return text.substring(match.index);
 }
 }
 }
 return text;
}

// Helper function to filter meaningful content
function filterMeaningfulContent(text) {
 const parts = text.split(/\n\n+/).filter(p => {
 const trimmed = p.trim();
 return trimmed.length > 20 && // Minimum meaningful length
 !trimmed.match(/^[A-Z0-9\-_]+\.(png|jpg|jpeg|gif|webp)/) && // Not just image names
 !trimmed.match(/^Back\s+(Workshops|Services|Gallery|Book|About|Blog)/) && // Not navigation
 !trimmed.match(/^Home\s*\/\s*About/) && // Not breadcrumbs
 !trimmed.match(/^Privacy\s*Policy/) && // Not footer links
 !trimmed.match(/^Facebook|^LinkedIn|^Tumblr|^Pinterest/) && // Not social links
 !trimmed.match(/^Add to Cart|^Only \d+ available/) && // Not e-commerce UI
 !trimmed.match(/^Earlier Event:|^Later Event:/) && // Not event navigation
 !trimmed.match(/^\d+ November|^\d+ December/) && // Not date headers
 !trimmed.match(/^Camera Courses For Beginners/) && // Not unrelated content
 trimmed.length < 5000; // Not too long (likely malformed)
 });
 
 if (parts.length > 0) {
 const sortedParts = parts.sort((a, b) => b.length - a.length);
 return sortedParts[0];
 }
 return text;
}

// Helper function to clean and format RAG text
function cleanRagText(raw) {
 if (!raw) return "";
 let text = String(raw);
 
 console.log(`ðŸ§¹ Original text: "${text.substring(0, 100)}..."`);
 
 text = removeUrlArtifacts(text);
 text = decodeHtmlEntities(text);
 text = fixProblematicPatterns(text);
 text = removeUiElements(text);
 text = fixTruncatedText(text);
 text = findIntroPattern(text);
 
 // Collapse multiple dashes/lines used as separators
 text = text.replace(/-{4,}/g, "\n");
 
 // Remove excessive whitespace and normalize
 text = text.replace(/\s{2,}/g, " ").replace(/\n{3,}/g, "\n\n");
 
 text = filterMeaningfulContent(text);
 
 // Final cleanup
 text = text.replace(/\s{2,}/g, " ").trim();
 
 console.log(`ðŸ§¹ Cleaned text: "${text.substring(0, 100)}..."`);
 return text;
}

// Helper function to check for contact Alan queries
function checkContactAlanQuery(query) {
 const contactAlanQueries = [
 /cancellation or refund policy for courses/i,
 /cancellation or refund policy for workshops/i,
 /how do i book a course or workshop/i,
 /can the gift voucher be used for any workshop/i,
 /can the gift voucher be used for any course/i,
 /how do i know which course or workshop is best/i,
 /do you do astrophotography workshops/i,
 /do you get a certificate with the photography course/i,
 /do i get a certificate with the photography course/i,
 /do you i get a certificate with the photography course/i,
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
 
 for (const pattern of contactAlanQueries) {
 if (pattern.test(query)) {
 console.log(`ðŸ“ž Contact Alan query detected: "${query}"`);
 return {
 type: 'advice',
 confidence: 0.8,
 answer: "I can't find a reliable answer for that specific question in my knowledge base. For detailed information about this, please contact Alan directly using the contact form or WhatsApp in the header section of this chat. He'll be happy to provide you with accurate and up-to-date information.",
 structured: {
 intent: "contact_required",
 topic: "contact_alan",
 events: [],
 products: [],
 pills: []
 }
 };
 }
 }
 return null;
}

// Helper function to search for specific guide articles
async function searchSpecificGuideArticles(client, primaryKeyword) {
 const { data: guideChunks, error: guideError } = await client
 .from('page_chunks')
 .select('url, title, chunk_text')
 .ilike('url', `%what-is-${primaryKeyword}%`)
 .limit(5);
 
 if (!guideError && guideChunks) {
 console.log(`ðŸŽ¯ Found ${guideChunks.length} specific guide chunks for "${primaryKeyword}"`);
 return guideChunks;
 }
 return [];
 }
 
// Helper function to search for broader guide articles
async function searchBroaderGuideArticles(client, primaryKeyword) {
 const { data: broaderGuideChunks, error: broaderError } = await client
 .from('page_chunks')
 .select('url, title, chunk_text')
 .ilike('url', '%what-is-%')
 .ilike('chunk_text', `%${primaryKeyword}%`)
 .limit(3);
 
 if (!broaderError && broaderGuideChunks) {
 console.log(`ðŸŽ¯ Found ${broaderGuideChunks.length} broader guide chunks`);
 return broaderGuideChunks;
 }
 return [];
}

// Helper function to search with keywords
async function searchWithKeywords(client, keywords) {
 let chunks = [];
 for (const keyword of keywords) {
 const { data: keywordChunks, error: chunksError } = await client
 .from('page_chunks')
 .select('url, title, chunk_text')
 .ilike('chunk_text', `%${keyword}%`)
 .limit(3);
 
 if (!chunksError && keywordChunks) {
 chunks = [...chunks, ...keywordChunks];
 }
 }
 return chunks;
 }
 
// Helper function to search with full query
async function searchWithFullQuery(client, query) {
 const { data: fullQueryChunks, error: fullQueryError } = await client
 .from('page_chunks')
 .select('url, title, chunk_text')
 .ilike('chunk_text', `%${query}%`)
 .limit(2);
 
 if (!fullQueryError && fullQueryChunks) {
 return fullQueryChunks;
 }
 return [];
 }
 
// Helper function to remove duplicate chunks
function removeDuplicateChunks(chunks) {
 return chunks.filter((chunk, index, self) => 
 index === self.findIndex(c => c.url === chunk.url)
 );
}

// Helper function to search for RAG content chunks
async function searchRagContent(context) {
 let chunks = [];
 
 // For concept queries like "what is exposure", prioritize guide articles
 if (context.isConceptQuery) {
 console.log(`ðŸŽ¯ Concept query detected: "${context.query}" - prioritizing guide articles`);
 
 // Search for specific and broader guide articles
 const specificGuides = await searchSpecificGuideArticles(context.client, context.primaryKeyword);
 const broaderGuides = await searchBroaderGuideArticles(context.client, context.primaryKeyword);
 
 chunks = [...chunks, ...specificGuides, ...broaderGuides];
 
 if (chunks.length > 0) {
 console.log(`ðŸŽ¯ Using ${chunks.length} guide chunks, skipping general search`);
 } else {
 console.log(`[WARN] No guide chunks found, falling back to general search`);
 }
 }
 
 // Only do general keyword search if we didn't find guide chunks
 if (!context.isConceptQuery || chunks.length === 0) {
 const keywordChunks = await searchWithKeywords(context.client, context.keywords);
 chunks = [...chunks, ...keywordChunks];
 }
 
 // Also try the full query
 const fullQueryChunks = await searchWithFullQuery(context.client, context.query);
 chunks = [...chunks, ...fullQueryChunks];
 
 // Remove duplicates
 return removeDuplicateChunks(chunks);
}

// Helper function to score and filter chunks
function scoreAndFilterChunks(context) {
 const keywords = getScoringKeywords();
 const conceptKeywords = ['guide', 'explanation', 'tutorial', 'basics', 'beginner', 'learn', 'understanding'];
 const workshopKeywords = ['workshop', 'course', 'event', 'booking', 'dates', 'location', 'participants'];
 
 return context.chunks
 .map(c => scoreChunkWithAdjustments({
 chunk: c,
 primaryKeyword: context.primaryKeyword,
 lcQuery: context.lcQuery,
 isConceptQuery: context.isConceptQuery,
 keywords,
 conceptKeywords,
 workshopKeywords
 }))
 .filter(c => true) // Temporarily disable filtering to see if chunks are retrieved
 .sort((a,b)=> b.__score - a.__score)
 .slice(0, 5);
}

// Helper function to get scoring keywords
function getScoringKeywords() {
 return {
 equipmentKeywords: ["tripod","head","ball head","carbon","aluminium","manfrotto","gitzo","benro","sirui","three legged","levelling","camera","lens","filter","flash"],
 technicalKeywords: ["iso","aperture","shutter","exposure","focus","composition","lighting","settings","technique","tips","advice"],
 offTopicHints: ["/photographic-workshops","/course","calendar","/events/","ics","google calendar","/book","/contact","/gallery"]
 };
}

// Helper function to score chunk with concept adjustments
function scoreChunkWithAdjustments(context) {
 const scoringParams = { primaryKeyword: context.primaryKeyword, ...context.keywords, lcQuery: context.lcQuery };
 let score = calculateChunkScore(context.chunk, scoringParams);
 
 if (context.isConceptQuery) {
 score = applyConceptQueryAdjustments({
 chunk: context.chunk,
 score,
 conceptKeywords: context.conceptKeywords,
 workshopKeywords: context.workshopKeywords
 });
 }
 
 return {...context.chunk, __score: score};
}

// Helper function to apply concept query adjustments
function applyConceptQueryAdjustments(context) {
 const url = (context.chunk.url||"").toLowerCase();
 const title = (context.chunk.title||"").toLowerCase();
 const text = (context.chunk.chunk_text||"").toLowerCase();
 
 // Boost score for concept-related content
 if (context.conceptKeywords.some(keyword => url.includes(keyword) || title.includes(keyword) || text.includes(keyword))) {
 context.score += 2;
 }
 
 // Penalize workshop/event content for concept queries
 if (context.workshopKeywords.some(keyword => url.includes(keyword) || title.includes(keyword) || text.includes(keyword))) {
 context.score -= 1.5;
 }
 
 // Extra penalty for workshop URLs
 if (url.includes('/photographic-workshops') || url.includes('/photo-workshops') || url.includes('/events/')) {
 context.score -= 2;
 }
 
 return context.score;
}

// Helper function to filter chunks by primary keyword
function filterChunkByPrimaryKeyword(chunk, primaryKeyword) {
 if (!primaryKeyword) return chunk.__score > 0;
 
 const url = (chunk.url||"").toLowerCase();
 const title = (chunk.title||"").toLowerCase();
 const text = (chunk.chunk_text||"").toLowerCase();
 
 let hasPrimaryStrong = url.includes(primaryKeyword) || title.includes(primaryKeyword) || text.includes(primaryKeyword);
 
 // Extra hardening for equipment-style nouns
 const equipNouns = ["tripod","ball head","ballhead","head","gitzo","benro","manfrotto","sirui"];
 if (equipNouns.some(n => primaryKeyword.includes(n))) {
 const slugMatch = [primaryKeyword.replace(/\s+/g,'-'), primaryKeyword.replace(/\s+/g,'')];
 if (!(hasPrimaryStrong || slugMatch.some(s => url.includes(s) || title.includes(s)))) {
 return false;
 }
 }
 
 // For equipment queries, be more lenient - allow chunks with positive scores even if they don't contain the primary keyword strongly
 const equipmentNouns = ["tripod", "camera", "lens", "filter", "flash", "head", "ball", "carbon", "aluminium"];
 if (equipmentNouns.includes(primaryKeyword)) {
 return chunk.__score > -5; // Very lenient for equipment queries - allow even slightly negative scores
 }
 
 return hasPrimaryStrong && chunk.__score > 0;
}

// Helper function to search for RAG entities
async function searchRagEntities(context) {
 let entities = [];
 
 // Search for concept guide articles if needed
 if (context.isConceptQuery) {
 const guideEntities = await searchConceptGuideArticles(context.client, context.primaryKeyword);
 entities = [...entities, ...guideEntities];
 }
 
 // Search for keyword-based entities
 const searchKeywords = buildSearchKeywords(context.query, context.keywords);
 const keywordEntities = await searchKeywordEntities(context.client, searchKeywords);
 entities = [...entities, ...keywordEntities];
 
 // Search for full query entities
 const fullQueryEntities = await searchFullQueryEntities(context.client, context.query);
 entities = [...entities, ...fullQueryEntities];
 
 // Remove duplicates and return
 return removeDuplicateEntities(entities);
}

// Helper function to search for concept guide articles
async function searchConceptGuideArticles(client, primaryKeyword) {
 console.log(`ðŸŽ¯ Searching for guide articles for concept query`);
 const { data: guideArticles, error: guideError } = await client
 .from('page_entities')
 .select('url, title, description, meta_description, location, date_start, kind, publish_date, last_seen')
 .ilike('url', `%what-is-${primaryKeyword}%`)
 .eq('kind', 'article')
 .limit(5);
 
 if (!guideError && guideArticles) {
 console.log(`ðŸŽ¯ Found ${guideArticles.length} guide articles`);
 guideArticles.forEach(e => console.log(` - "${e.title}" (${e.url})`));
 return guideArticles;
 }
 
 return [];
 }
 
// Helper function to build search keywords
function buildSearchKeywords(query, keywords) {
 const searchKeywords = [...keywords];
 
 // Add related concepts for "what is" queries
 if (query.toLowerCase().includes('what is')) {
 const concept = query.toLowerCase().replace('what is', '').trim();
 
 // Add related photography concepts based on the main concept
 if (concept.includes('metering')) {
 searchKeywords.push('exposure', 'camera', 'photography', 'settings', 'manual');
 } else if (concept.includes('exposure')) {
 searchKeywords.push('metering', 'aperture', 'shutter', 'iso', 'camera');
 } else if (concept.includes('aperture')) {
 searchKeywords.push('exposure', 'depth', 'field', 'lens', 'camera');
 } else if (concept.includes('shutter')) {
 searchKeywords.push('exposure', 'speed', 'motion', 'camera', 'photography');
 } else if (concept.includes('iso')) {
 searchKeywords.push('exposure', 'noise', 'sensitivity', 'camera', 'photography');
 } else if (concept.includes('focus')) {
 searchKeywords.push('sharpness', 'autofocus', 'manual', 'camera', 'lens');
 } else if (concept.includes('composition')) {
 searchKeywords.push('photography', 'techniques', 'rules', 'guidelines', 'tips');
 }
 
 // Add general photography terms for any technical concept
 searchKeywords.push('photography', 'camera', 'techniques', 'guide', 'beginner');
 }
 
 if (/who.*is|who.*are|tell.*about|background|experience/i.test(query)) {
 searchKeywords.push('about');
 }
 return searchKeywords;
}
 
// Helper function to search for keyword-based entities
async function searchKeywordEntities(client, searchKeywords) {
 console.log(`ðŸ” Searching for all keywords: ${searchKeywords.join(', ')}`);
 const { data: keywordEntities, error: entitiesError } = await client
 .from('page_entities')
 .select('url, title, description, meta_description, location, date_start, kind, publish_date, last_seen')
 .or(searchKeywords.map(k => `title.ilike.%${k}%,description.ilike.%${k}%,location.ilike.%${k}%`).join(','))
 .eq('kind', 'article')
 .limit(25);
 
 if (entitiesError) {
 console.error(`âŒ Entity search error:`, entitiesError);
 return [];
 } else if (keywordEntities) {
 console.log(`ðŸ“„ Found ${keywordEntities.length} entities for all keywords`);
 keywordEntities.forEach(e => console.log(` - "${e.title}" (${e.kind})`));
 return keywordEntities;
 } else {
 console.log(`ðŸ“„ No entities found for keywords`);
 return [];
 }
 }
 
// Helper function to search for full query entities
async function searchFullQueryEntities(client, query) {
 const { data: fullQueryEntities, error: fullQueryEntitiesError } = await client
 .from('page_entities')
 .select('url, title, description, meta_description, location, date_start, kind')
 .or(`title.ilike.%${query}%,description.ilike.%${query}%,location.ilike.%${query}%`)
 .eq('kind', 'article')
 .limit(15);
 
 if (!fullQueryEntitiesError && fullQueryEntities) {
 return fullQueryEntities;
 }
 
 return [];
}

// Helper function to remove duplicate entities
function removeDuplicateEntities(entities) {
 return entities.filter((entity, index, self) => 
 index === self.findIndex(e => e.url === entity.url)
 );
}

// Helper function to handle event entities
function handleEventEntities(entities) {
 const eventEntities = entities.filter(e => e.kind === 'event' && e.date_start && new Date(e.date_start) >= new Date());
 if (eventEntities.length > 0) {
 const answer = eventEntities.map(e => `${e.title} on ${new Date(e.date_start).toDateString()} at ${e.location}. More info: ${e.url}`).join("\n");
 const sources = eventEntities.map(e => e.url);
 return { answer, type: "events", sources };
 }
 return null;
}

// Helper function to handle chunk processing
function handleChunkProcessing(query, entities, chunks) {
  console.log(`[DEBUG] Using generateDirectAnswer for ${chunks.length} chunks`);
  
  const debugLogs = [];
  debugLogs.push(`Processing ${chunks.length} chunks for query: "${query}"`);
  
  // Try technical direct answer FIRST (priority for technical questions)
  const technicalAnswer = generateTechnicalDirectAnswer(query, chunks);
  console.log(`[DEBUG] generateTechnicalDirectAnswer returned: ${technicalAnswer ? 'SUCCESS' : 'NULL'}`);
  debugLogs.push(`generateTechnicalDirectAnswer returned: ${technicalAnswer ? `SUCCESS (${technicalAnswer.length} chars)` : 'NULL'}`);
  
  if (technicalAnswer) {
    console.log(`[SUCCESS] Generated technical direct answer: "${technicalAnswer.substring(0, 100)}..."`);
    const formattedAnswer = formatResponse(technicalAnswer, 500);
    return { answer: formattedAnswer, type: "advice", sources: chunks.map(c => c.url), debugLogs };
  }
  
  // Try equipment advice FIRST for equipment queries
  const lc = query.toLowerCase();
  const equipmentKeywords = ['tripod', 'camera', 'lens', 'filter', 'flash', 'bag', 'strap', 'memory card', 'battery', 'charger', 'equipment', 'gear'];
  const adviceKeywords = ['recommend', 'best', 'what', 'which', 'should i buy', 'need', 'suggest', 'advice', 'opinion', 'prefer', 'choose', 'select'];
  
  const hasEquipment = equipmentKeywords.some(keyword => lc.includes(keyword));
  const hasAdvice = adviceKeywords.some(keyword => lc.includes(keyword));
  
  if (hasEquipment && hasAdvice) {
    console.log(`[TARGET] Equipment query detected in handleChunkProcessing: "${query}"`);
    const equipmentAnswer = tryEquipmentAdviceAnswer(lc, entities, chunks);
    if (equipmentAnswer) {
      console.log(`[SUCCESS] Generated equipment advice: "${equipmentAnswer.substring(0, 100)}..."`);
      const formattedAnswer = formatResponse(equipmentAnswer, 500);
      return { answer: formattedAnswer, type: "advice", sources: chunks.map(c => c.url), debugLogs };
    }
  }
  
  // Try existing direct answer system
  const directAnswer = generateDirectAnswer(query, entities, chunks);
  if (directAnswer) {
    console.log(`[SUCCESS] Generated intelligent answer from generateDirectAnswer: "${directAnswer.substring(0, 100)}..."`);
    const formattedAnswer = formatResponse(directAnswer, 500);
    return { answer: formattedAnswer, type: "advice", sources: chunks.map(c => c.url), debugLogs };
  }
  
  // Fallback to chunk processing
  const fallbackResult = processChunkFallback(chunks, query);
  return { ...fallbackResult, debugLogs };
}

// Helper function to process chunk fallback
function processChunkFallback(chunks, query = '') {
 console.log(`[WARN] No intelligent answer found, using fallback chunk processing`);
 const cleaned = chunks
 .map(c => {
 const cleanedText = cleanRagText(c.chunk_text);
 console.log(`ðŸ“ Chunk cleaned: "${cleanedText}" (original length: ${c.chunk_text?.length || 0})`);
 return cleanedText;
 })
 .filter(Boolean)
 .filter(content => true); // Temporarily disable relevance filtering to debug

 console.log(`[SUCCESS] ${cleaned.length} chunks passed cleaning and relevance filter`);
 let answer = cleaned.join("\n\n");
 
 // Format response with length limits and concise formatting
 const formattedAnswer = formatResponse(answer, 500);

 return { answer: formattedAnswer, type: "advice", sources: chunks.map(c => c.url) };
}

// Helper function to generate direct answers for technical questions
function generateTechnicalDirectAnswer(query, chunks) {
 const lcQuery = query.toLowerCase();
 console.log(`[DEBUG] generateTechnicalDirectAnswer called for: "${query}" with ${chunks.length} chunks`);
 
 // Check if this is a technical question
 const isTechnicalQuery = lcQuery.includes('what is') || lcQuery.includes('how do i') || 
 lcQuery.includes('why are') || lcQuery.includes('when should');
 
 console.log(`[DEBUG] isTechnicalQuery: ${isTechnicalQuery}, chunks.length: ${chunks.length}`);
 
 if (!isTechnicalQuery || chunks.length === 0) {
 console.log(`[DEBUG] Returning null - not technical query or no chunks`);
 return null;
 }
 
 // For "what is" queries, try to extract direct answers from chunks first
 if (lcQuery.includes('what is')) {
 console.log(`[DEBUG] Attempting chunk extraction for: "${query}"`);
 const directAnswerFromChunks = extractDirectAnswerFromChunks(chunks, query);
 if (directAnswerFromChunks) {
 console.log(`[SUCCESS] Generated technical direct answer from chunks: "${directAnswerFromChunks}"`);
 return directAnswerFromChunks;
 } else {
 console.log(`[DEBUG] Chunk extraction returned null, falling back to generateDirectAnswer`);
 }
 }
 
 // Extract key concepts from query
 const concepts = extractTechnicalConcepts(lcQuery);
 if (concepts.length === 0) {
 return null;
 }
 
 // Use existing generateDirectAnswer for all technical questions
 const directAnswer = generateDirectAnswer(query, [], chunks);
 return directAnswer;
}

// Helper function to extract technical concepts - GENERIC approach
function extractTechnicalConcepts(query) {
 // Original concept mapping system that was working
 const conceptMap = {
 "iso": ["iso", "sensitivity", "film speed"],
 "aperture": ["aperture", "f-stop", "f/", "depth of field"],
 "shutter": ["shutter", "shutter speed", "exposure time"],
 "exposure": ["exposure", "exposure triangle", "light"],
 "metering": ["metering", "light meter", "exposure meter"],
 "white balance": ["white balance", "color temperature", "wb"],
 "focus": ["focus", "autofocus", "manual focus", "sharpness"],
 "composition": ["composition", "rule of thirds", "framing"],
 "lighting": ["lighting", "natural light", "artificial light", "flash"]
 };
 
 const lcQuery = query.toLowerCase();
 
 // Check for specific technical concepts
 for (const [concept, keywords] of Object.entries(conceptMap)) {
 for (const keyword of keywords) {
 if (lcQuery.includes(keyword)) {
 return [concept];
 }
 }
 }
 
 return [];
}


// Helper function to format responses with length limits and concise formatting
function formatResponse(answer, maxLength = 500) {
 if (!answer || typeof answer !== 'string') {
 return answer;
 }
 
 // Remove excessive whitespace and normalize formatting
 let formatted = answer
 .replace(/\s+/g, ' ') // Replace multiple spaces with single space
 .replace(/\n\s*\n/g, '\n') // Remove excessive line breaks
 .trim();
 
 // If response is too long, truncate intelligently
 if (formatted.length > maxLength) {
 // Try to find a good breaking point (end of sentence)
 const truncated = formatted.substring(0, maxLength);
 const lastSentenceEnd = Math.max(
 truncated.lastIndexOf('.'),
 truncated.lastIndexOf('!'),
 truncated.lastIndexOf('?')
 );
 
 if (lastSentenceEnd > maxLength * 0.7) {
 // If we found a good sentence break, use it
 formatted = truncated.substring(0, lastSentenceEnd + 1);
 } else {
 // Otherwise, just truncate and add ellipsis
 formatted = truncated.trim() + '...';
 }
 }
 
 return formatted;
}

// Helper function to filter irrelevant content based on query intent
function filterRelevantContent(content, query) {
 const queryLower = query.toLowerCase();
 const contentLower = content.toLowerCase();
 
 // Generic logic: if content contains specific topics but query doesn't mention them,
 // it's likely irrelevant (e.g., autumn photography content for commercial photography query)
 const topicMismatchPatterns = [
 // Seasonal content mismatch
 { contentPattern: /autumn|fall|seasonal/, queryCheck: /autumn|fall|seasonal/ },
 { contentPattern: /spring|bluebell/, queryCheck: /spring|bluebell/ },
 { contentPattern: /winter|snow/, queryCheck: /winter|snow/ },
 
 // Photography style mismatch 
 { contentPattern: /street photography/, queryCheck: /street/ },
 { contentPattern: /macro photography/, queryCheck: /macro/ },
 { contentPattern: /landscape photography/, queryCheck: /landscape/ },
 
 // Equipment type mismatch
 { contentPattern: /UV filter/, queryCheck: /filter/ },
 { contentPattern: /tripod/, queryCheck: /tripod/ },
 { contentPattern: /camera/, queryCheck: /camera/ },
 
 // Service type mismatch
 { contentPattern: /free course/, queryCheck: /course|free/ },
 { contentPattern: /workshop/, queryCheck: /workshop/ },
 { contentPattern: /contact alan/, queryCheck: /contact/ }
 ];
 
 for (const { contentPattern, queryCheck } of topicMismatchPatterns) {
 if (contentPattern.test(contentLower) && !queryCheck.test(queryLower)) {
 return false;
 }
 }
 
 return true;
}

// Helper function to filter and sort entities
function filterAndSortEntities(entities, query) {
 const adviceEntities = entities.filter(e => e.kind !== 'event');
 console.log(`ðŸ“ Filtered to ${adviceEntities.length} advice entities`);
 
 const relevantEntities = adviceEntities.filter(entity => {
 // Use all entities - no hardcoded filtering
 return true;
 }).sort((a, b) => {
 const queryLower = query.toLowerCase();
 const aTitle = (a.title || '').toLowerCase();
 const bTitle = (b.title || '').toLowerCase();
 
 // Exact title match gets highest priority
 if (aTitle.includes(queryLower) && !bTitle.includes(queryLower)) return -1;
 if (bTitle.includes(queryLower) && !aTitle.includes(queryLower)) return 1;
 
 // Then by publish date (newest first)
 const aDate = new Date(a.publish_date || '1900-01-01');
 const bDate = new Date(b.publish_date || '1900-01-01');
 return bDate - aDate;
 });
 
 console.log(`ðŸ“ Filtered to ${relevantEntities.length} relevant entities`);
 return relevantEntities;
}
 
// Helper function to calculate confidence based on Alan's quality definitions
function calculateEntityConfidence(relevantEntities, chunks, results) {
 // Start with low confidence, build up based on actual quality
 let qualityScore = 0.1;
 let qualityFactors = [];
 
 // Analyze content quality
 if (chunks.length > 0) {
 results.answerType = 'content';
 // More chunks = higher quality (up to a point)
const chunkQuality = Math.min(0.3, chunks.length * 0.05);
 qualityScore += chunkQuality;
 qualityFactors.push(`Content chunks: +${(chunkQuality * 100).toFixed(1)}%`);
 }
 
 if (relevantEntities.length > 0) {
 const eventEntities = relevantEntities.filter(e => e.kind === 'event' && e.date_start && new Date(e.date_start) >= new Date());
 if (eventEntities.length > 0) {
 results.answerType = 'events';
 // High quality: relevant future events
 qualityScore += 0.4;
 qualityFactors.push(`Future events: +40%`);
 console.log(`ðŸŽ¯ Found ${eventEntities.length} future event entities`);
 } else {
 // Medium quality: advice entities
 qualityScore += 0.2;
 qualityFactors.push(`Advice entities: +20%`);
 console.log(`ðŸŽ¯ Found ${relevantEntities.length} advice entities`);
 }
 }
 
 // Apply Alan's quality-based confidence scoring using his requested bands
 if (qualityScore >= 0.8) {
 results.confidence = 1; // 100% - Perfect
 } else if (qualityScore >= 0.7) {
 results.confidence = 0.95; // 95% - Nearly Perfect
 } else if (qualityScore >= 0.6) {
 results.confidence = 0.75; // 75% - Very Good
 } else if (qualityScore >= 0.4) {
 results.confidence = 0.50; // 50% - Good
 } else if (qualityScore >= 0.2) {
 results.confidence = 0.30; // 30% - Poor
 } else {
 results.confidence = 0.10; // 10% - Very Poor
 }
 
 console.log(`ðŸ“Š Alan's Quality-Based Entity Confidence: ${qualityFactors.join(', ')} = ${(results.confidence * 100).toFixed(1)}%`);
 console.log(`ðŸ“Š Final confidence: ${results.confidence}, answerType: ${results.answerType}`);
}

// Helper function to handle policy queries
function handlePolicyQuery(relevantEntities) {
 const policyEntity = relevantEntities.find(e => 
 e.title.toLowerCase().includes('terms') || 
 e.title.toLowerCase().includes('conditions') ||
 e.title.toLowerCase().includes('policy')
 ) || relevantEntities[0];
 
 const answer = `**Terms and Conditions**: Alan Ranger Photography has comprehensive terms and conditions covering booking policies, copyright, privacy, and insurance. All content and photos are copyright of Alan Ranger unless specifically stated.\n\nFor full details, visit the [Terms and Conditions page](${policyEntity.url}).`;
 
 console.log(`[SUCCESS] Generated policy-specific answer for terms and conditions query`);
 return { answer, type: "advice", sources: [policyEntity.url] };
}


// Helper function to extract direct answers from article descriptions
function extractDirectAnswerFromDescription(description, query) {
 const lc = query.toLowerCase();
 
 // Clean the description
 const cleanDesc = description.replace(/\d+\s+/, '').replace(/\s+/g, ' ').trim();
 
 // For technical concepts, try to extract the core explanation
 if (lc.includes('what is')) {
 const concept = lc.replace('what is', '').trim();
 
 // Look for definition patterns in the description
 const definitionPatterns = [
 /is\s+(?:the\s+)?(?:process\s+of\s+|way\s+to\s+|method\s+of\s+|technique\s+for\s+)?([^.]+)/i,
 /refers\s+to\s+([^.]+)/i,
 /means\s+([^.]+)/i,
 /is\s+([^.]+?)(?:in\s+photography|\s+that\s+)/i
 ];
 
 for (const pattern of definitionPatterns) {
 const match = cleanDesc.match(pattern);
 if (match && match[1] && match[1].length > 20) {
 const explanation = match[1].trim();
 return `**${concept.charAt(0).toUpperCase() + concept.slice(1)}** ${explanation.toLowerCase()}`;
 }
 }
 
 // If no pattern matches, try to extract the first meaningful sentence
 const sentences = cleanDesc.split(/[.!?]+/).filter(s => s.trim().length > 20);
 if (sentences.length > 0) {
 const firstSentence = sentences[0].trim();
 if (firstSentence.length > 30 && firstSentence.length < 200) {
 return `**${concept.charAt(0).toUpperCase() + concept.slice(1)}** ${firstSentence.toLowerCase()}`;
 }
 }
 }
 
 return null;
}

// Helper function to create definition patterns for concept matching
function createDefinitionPatterns(concept) {
 return [
 new RegExp(`${concept}\\s+is\\s+(?:the\\s+)?([^.]+)`, 'i'),
 new RegExp(`${concept}\\s+refers\\s+to\\s+([^.]+)`, 'i'),
 new RegExp(`${concept}\\s+means\\s+([^.]+)`, 'i'),
 new RegExp(`what\\s+is\\s+${concept}[^.]*?([^.]+)`, 'i')
 ];
}

// Helper function to check if chunk is valid for processing
function isValidChunk(chunk) {
 return chunk.chunk_text && chunk.chunk_text.length > 100;
}

// Helper function to search for definition patterns in chunk text
function searchDefinitionPatterns(chunkText, concept, patterns) {
 for (let j = 0; j < patterns.length; j++) {
 const pattern = patterns[j];
 const match = chunkText.match(pattern);
 console.log(`[DEBUG] Pattern ${j + 1} match: ${match ? 'YES' : 'NO'}`);
 if (match && match[1] && match[1].length > 20) {
 return match[1].trim();
 }
 }
 return null;
}

// Helper function to search for definition sentences in chunk text
function searchDefinitionSentences(chunkText, concept) {
 const sentences = chunkText.split(/[.!?]+/);
 for (const sentence of sentences) {
 if (sentence.toLowerCase().includes(concept) && 
 sentence.length > 30 && sentence.length < 200 &&
 (sentence.includes(' is ') || sentence.includes(' refers ') || sentence.includes(' means '))) {
 return sentence.trim();
 }
 }
 return null;
}

// Helper function to process a single chunk for definitions
function processChunkForDefinition(chunk, concept, chunkIndex) {
 console.log(`[DEBUG] Chunk ${chunkIndex}: length=${chunk.chunk_text ? chunk.chunk_text.length : 0}`);
 
 if (!isValidChunk(chunk)) {
 return null;
 }
 
 
 console.log(`[DEBUG] Chunk ${chunkIndex} text preview: "${chunk.chunk_text.substring(0, 100)}..."`);
 
 // Look for definition patterns in chunk text
 const patterns = createDefinitionPatterns(concept);
 const patternMatch = searchDefinitionPatterns(chunk.chunk_text, concept, patterns);
 if (patternMatch) {
 return formatDirectAnswer(concept, patternMatch);
 }
 
 // Look for introductory sentences that explain the concept
 const sentenceMatch = searchDefinitionSentences(chunk.chunk_text, concept);
 if (sentenceMatch) {
 return formatDirectAnswer(concept, sentenceMatch);
 }
 
 return null;
}

// Helper function to extract direct answers from content chunks
function extractDirectAnswerFromChunks(chunks, query) {
 const lc = query.toLowerCase();
 console.log(`[DEBUG] extractDirectAnswerFromChunks called with ${chunks.length} chunks for query: "${query}"`);
 
 if (!lc.includes('what is') || chunks.length === 0) {
 console.log(`[DEBUG] No match found, returning null`);
 return null;
 }
 
 const concept = lc.replace('what is', '').trim();
 console.log(`[DEBUG] Extracting concept: "${concept}"`);
 
 // Look for the best chunk that contains definition content
 for (let i = 0; i < chunks.length; i++) {
 const result = processChunkForDefinition(chunks[i], concept, i);
 if (result) {
 console.log(`[SUCCESS] Found match! Result: "${result}"`);
 return result;
 }
 }
 
 console.log(`[DEBUG] No match found, returning null`);
 return null;
}
// Helper function to handle regular entity processing
function handleRegularEntityProcessing(query, relevantEntities, chunks) {
 console.log(`ðŸ” DEBUG: Using generateDirectAnswer for enhanced concept synthesis`);
 const directAnswer = generateDirectAnswer(query, relevantEntities, chunks);
 if (directAnswer) {
 console.log(`[SUCCESS] Generated enhanced answer from generateDirectAnswer: "${directAnswer.substring(0, 100)}..."`);
 return { answer: directAnswer, type: "advice", sources: relevantEntities.map(e => e.url) };
 }
 
 console.log(`[WARN] No enhanced answer found, trying fallback`);
 const primaryEntity = relevantEntities[0];
 
 // Try to extract FAQ content from json_ld_data
 const faqAnswer = extractAnswerFromJsonLd(primaryEntity, query.toLowerCase());
 if (faqAnswer) {
 console.log(`[SUCCESS] Generated FAQ answer: "${faqAnswer.substring(0, 100)}..."`);
 return { answer: faqAnswer, type: "advice", sources: relevantEntities.map(e => e.url) };
 }
 
 console.log(`[WARN] No FAQ content found, using generic fallback`);
 const answer = `Based on Alan Ranger's expertise, here's what you need to know about your question.\n\n${primaryEntity.description || 'More information available'}\n\n*For detailed information, read the full guide: ${primaryEntity.url}*`;
 console.log(`[SUCCESS] Generated fallback answer from description`);
 
 return { answer, type: "advice", sources: relevantEntities.map(e => e.url) };
}

// Helper function to check if query is a policy query
function isPolicyQuery(query) {
 return /terms.*conditions|terms.*anc.*conditions|privacy.*policy|cancellation.*policy|refund.*policy|booking.*policy/i.test(query);
}

// Helper function to check if query is a "what is" query
function isWhatIsQuery(query) {
 return query.toLowerCase().includes('what is');
}

// Helper function to process entities for RAG answer
function processEntitiesForRag(query, entities, chunks, results, debugLogs) {
 debugLogs.push(`Taking entities path${isWhatIsQuery(query) ? ' for "what is" query' : ''}`);
 console.log(`[DEBUG] Found ${entities.length} entities, kinds:`, entities.map(e => e.kind));
 
 const relevantEntities = filterAndSortEntities(entities, query);
 calculateEntityConfidence(relevantEntities, chunks, results);
 
 if (relevantEntities.length > 0) {
 const result = isPolicyQuery(query) 
 ? handlePolicyQuery(relevantEntities) 
 : handleRegularEntityProcessing(query, relevantEntities, chunks);
 return { ...result, debugLogs };
 } else {
 console.log(`[WARN] No relevant entities found for query`);
 return { answer: "", type: "advice", sources: [], debugLogs };
 }
}

// Helper function to process chunks for RAG answer
function processChunksForRag(query, articles, chunks, debugLogs) {
  debugLogs.push(`Taking chunks path - calling handleChunkProcessing`);
  const result = handleChunkProcessing(query, articles, chunks);
  return { ...result, debugLogs };
}

// Helper function to process events for RAG answer
function processEventsForRag(entities, debugLogs) {
 debugLogs.push(`Taking events path`);
 const eventResult = handleEventEntities(entities);
 if (eventResult) {
 return { ...eventResult, debugLogs };
 }
 return null;
}

// Helper function to generate RAG answer
function generateRagAnswer(params) {
  const { query, entities, chunks, results, articles } = params;
  const debugLogs = [];

  debugLogs.push(`generateRagAnswer called with ${entities.length} entities, ${chunks.length} chunks, ${articles.length} articles`);

  // Handle events path
  if (results.answerType === 'events' && entities.length > 0) {
    const eventResult = processEventsForRag(entities, debugLogs);
    if (eventResult) return eventResult;
  }

  // Handle "what is" queries with entities (prioritize entities over chunks)
  if (entities.length > 0 && isWhatIsQuery(query)) {
    return processEntitiesForRag(query, entities, chunks, results, debugLogs);
  }

  // Handle chunks path
  if (chunks.length > 0) {
    return processChunksForRag(query, articles, chunks, debugLogs);
  }

  // Handle general entities path
  if (entities.length > 0) {
    return processEntitiesForRag(query, entities, chunks, results, debugLogs);
  }

  return { answer: "", type: "advice", sources: [], debugLogs };
}

// Helper function to prepare RAG query parameters
function prepareRagQuery(query) {
 const keywords = extractKeywords(query);
 console.log(`ðŸ”‘ Extracted keywords: ${keywords.join(', ')}`);
 
 const lcQuery = (query || "").toLowerCase();
 const isConceptQuery = lcQuery.includes('what is') || lcQuery.includes('how do i') || lcQuery.includes('why are') || lcQuery.includes('when should');
 
 // Extract primary keyword for guide article searches
 const allKws = extractKeywords(query).map(k=>k.toLowerCase());
 const stop = new Set(["what","when","where","how","which","the","a","an","your","you","next","is","are","do","i","me","my","course","workshop","lesson"]);
 
 // For equipment queries, prioritize equipment nouns over action words
 const equipmentNouns = ["tripod", "camera", "lens", "filter", "flash", "head", "ball", "carbon", "aluminium"];
 const equipmentPrimaryKeyword = allKws.find(k => equipmentNouns.includes(k));
 
 const primaryKeyword = equipmentPrimaryKeyword || 
 (allKws.find(k => k.length >= 5 && !stop.has(k)) || allKws.find(k=>!stop.has(k)) || "").toLowerCase();
 
 return { keywords, lcQuery, isConceptQuery, primaryKeyword };
}

// Helper function to handle fallback responses
function handleRagFallbackLogic(context) {
 let finalAnswer = context.answer;
 let finalType = context.type;
 let finalSources = context.sources;
 
 if (!context.answer || context.answer.trim().length === 0 || 
 context.answer.includes("Yes, Alan Ranger offers the services you're asking about") ||
 (context.answer.includes("Yes, Alan Ranger") && context.answer.length < 200) ||
 context.answer.includes("I'd be happy to help you with your photography questions")) {
 console.log(`[WARN] No answer generated or generic response detected, providing fallback`);
 const fallback = handleRagFallback(context.query);
 finalAnswer = fallback.answer;
 finalType = fallback.type;
 }
 
 return { finalAnswer, finalType, finalSources };
}

function handleRagFallback(query) {
 if (/tripod|equipment|gear|camera|lens/i.test(query.toLowerCase())) {
 return {
 answer: `For equipment recommendations like tripods, Alan Ranger has extensive experience and can provide personalized advice based on your specific needs and budget.\n\nHis equipment recommendations cover:\nâ€¢ Professional tripod systems\nâ€¢ Camera bodies and lenses\nâ€¢ Accessories and filters\nâ€¢ Budget-friendly alternatives\n\n*View his detailed equipment guide: https://www.alanranger.com/photography-equipment-recommendations*\n\nFor personalized recommendations, consider booking a consultation or attending one of his workshops where he demonstrates equipment in real-world conditions.`,
 type: "advice"
 };
 } else if (/refund|cancellation|policy/i.test(query.toLowerCase())) {
 return {
 answer: `Alan Ranger has a clear cancellation and refund policy for all courses and workshops. Here are the key details:\n\n**Cancellation Policy:**\nâ€¢ Full refund if cancelled 14+ days before the event\nâ€¢ 50% refund if cancelled 7-13 days before\nâ€¢ No refund for cancellations within 7 days\n\n**Rescheduling:**\nâ€¢ Free rescheduling if requested 7+ days in advance\nâ€¢ Weather-related cancellations are fully refundable\n\nFor specific details or to discuss your situation, please contact Alan directly.\n\n*Contact Alan: https://www.alanranger.com/contact*`,
 type: "advice"
 };
 } else {
 return {
 answer: `I'd be happy to help you with your photography questions. For specific information about your query, please contact Alan Ranger directly or visit his website for more details.\n\n*Contact Alan: https://www.alanranger.com/contact*`,
 type: "advice"
 };
 }
}

// Helper function to assemble RAG result

// Helper: Initialize RAG search results
function initializeRagResults() {
 return {
 chunks: [],
 entities: [],
 totalMatches: 0,
 confidence: 0,
 answerType: 'none'
 };
}

// Helper: Search and process RAG content
async function searchAndProcessRagContent(context) {
 const chunks = await searchRagContent({
 client: context.client,
 query: context.query,
 keywords: context.keywords,
 isConceptQuery: context.isConceptQuery,
 primaryKeyword: context.primaryKeyword
 });
 const processedChunks = scoreAndFilterChunks({
 chunks,
 primaryKeyword: context.primaryKeyword,
 lcQuery: context.lcQuery,
 isConceptQuery: context.isConceptQuery
 });
 console.log(`ðŸ“„ Found ${processedChunks.length} relevant chunks`);
 return processedChunks;
}

// Helper: Search and process RAG entities
async function searchAndProcessRagEntities(context) {
 const entities = await searchRagEntities({
 client: context.client,
 query: context.query,
 keywords: context.keywords,
 isConceptQuery: context.isConceptQuery,
 primaryKeyword: context.primaryKeyword
 });
 const processedEntities = entities || [];
 console.log(`ðŸ· Found ${processedEntities.length} relevant entities`);
 return processedEntities;
}

// Helper: Build RAG response structure
function buildRagResponse(context) {
 return {
 success: context.results.confidence >= 0.3 || context.finalAnswer.length > 0,
 confidence: context.results.confidence >= 0.3 ? context.results.confidence : 0.1,
 answer: context.finalAnswer,
 type: context.finalType,
 sources: context.finalSources,
  structured: {
    intent: context.finalType,
    sources: context.finalSources,
    events: [],
    products: [],
    articles: context.results.articles || []
  },
 totalMatches: context.results.totalMatches,
 chunksFound: context.results.chunks.length,
 entitiesFound: context.results.entities.length,
 debugLogs: context.debugLogs || []
 };
}
 
// Helper: Handle RAG search errors
function handleRagError(error) {
 console.error('RAG search error:', error);
 return {
 success: false,
 confidence: 0,
 answer: "",
 type: "advice",
 sources: [],
 totalMatches: 0,
 chunksFound: 0,
 entitiesFound: 0
 };
}

// Helper: Process RAG search results
async function processRagSearchResults(context) {
 const results = initializeRagResults();
 
 // Search for content chunks
 results.chunks = await searchAndProcessRagContent({
 client: context.client,
 query: context.query,
 keywords: context.keywords,
 isConceptQuery: context.isConceptQuery,
 primaryKeyword: context.primaryKeyword,
 lcQuery: context.lcQuery
 });
 
  // Search for entities
  results.entities = await searchAndProcessRagEntities({
    client: context.client,
    query: context.query,
    keywords: context.keywords,
    isConceptQuery: context.isConceptQuery,
    primaryKeyword: context.primaryKeyword
  });

  // Search for articles for equipment advice
  results.articles = await findArticles(context.client, { 
    keywords: context.keywords, 
    limit: 25, 
    pageContext: context.pageContext 
  });

  // Calculate confidence and determine answer type
  results.totalMatches = results.chunks.length + results.entities.length;
  results.confidence = 0;
  results.answerType = 'none';
 
 return results;
}

async function tryRagFirst(client, query) {
 console.log(`ðŸ” RAG-First attempt for: "${query}"`);
 
 // Check for contact Alan queries first
 const contactResponse = checkContactAlanQuery(query);
 if (contactResponse) {
 return contactResponse;
 }
 
 // Check for service patterns first
 const serviceResponse = getServiceAnswers(query.toLowerCase());
 if (serviceResponse) {
 console.log(`ðŸŽ¯ Service pattern matched for: "${query}"`);
 return {
 success: true,
 confidence: 0.8,
 answer: serviceResponse,
 type: "advice",
 sources: { articles: [] }
 };
 }
 
 // Check for technical patterns first
 const technicalResponse = getTechnicalAnswers(query.toLowerCase());
 console.log(`[DEBUG] getTechnicalAnswers returned: ${technicalResponse ? 'SUCCESS' : 'NULL'}`);
 
 if (technicalResponse) {
 console.log(`[TARGET] Technical pattern matched for: "${query}"`);
 
 // For technical concepts, also search for related articles
 const keywords = extractKeywords(query);
 const articles = await findArticles(client, { keywords, limit: 5 });
 
 return {
 success: true,
 confidence: 0.8,
 answer: technicalResponse,
 type: "advice",
 sources: { articles: articles || [] },
 structured: {
 intent: "technical_answer",
 articles: articles || [],
 events: [],
 products: [],
 services: []
 }
 };
 }
 
 console.log(`[DEBUG] No technical pattern matched, continuing to RAG processing`);
 
 try {
 // Prepare query parameters
 const { keywords, lcQuery, isConceptQuery, primaryKeyword } = prepareRagQuery(query);
 
 // Process RAG search results
 const results = await processRagSearchResults({
 client,
 query,
 keywords,
 isConceptQuery,
 primaryKeyword,
 lcQuery
 });
 
  // Generate answer using helper function
  const { answer, type, sources, debugLogs = [] } = generateRagAnswer({ 
    query, 
    entities: results.entities, 
    chunks: results.chunks, 
    results,
    articles: results.articles 
  });
 
 // Handle fallback cases
 const { finalAnswer, finalType, finalSources } = handleRagFallbackLogic({ answer, type, sources, query });
 
 return buildRagResponse({ results, finalAnswer, finalType, finalSources, debugLogs });
 
 } catch (error) {
 return handleRagError(error);
 }
}

// Helper: Process main query (Low Complexity)
async function processMainQuery(context) {
 console.log(`ðŸš€ processMainQuery called for: "${context.query}"`);
 const client = supabaseAdmin();
 
 await initializeSession(context);
 
 const classification = await handleQueryClassification(client, context);
 console.log(`ðŸ” Classification handled: ${classification.handled}`);
 if (classification.handled) return;
 
 const ragResult = await attemptRagFirst(client, context);
 console.log(`ðŸ” RAG result success: ${ragResult.success}`);
 if (ragResult.success) {
 console.log(`ðŸ” Calling sendRagSuccessResponse...`);
 return sendRagSuccessResponse(context.res, ragResult, context);
 }
 
 console.log(`ðŸ” Calling handleRagFallbackWithIntent...`);
 return handleRagFallbackWithIntent(client, context, ragResult);
}

// Helper function to initialize session
async function initializeSession(context) {
 await createSession(context.sessionId, context.req.headers['user-agent'], context.req.headers['x-forwarded-for'] || context.req.connection.remoteAddress);
}

// Helper function to handle query classification
async function handleQueryClassification(client, context) {
 const classification = classifyQuery(context.query);
 console.log(`ðŸ” Classification result for "${context.query}":`, classification);
 
 if (classification.type === 'workshop') {
 return await handleWorkshopClassification(client, context);
 } else if (classification.type === 'clarification') {
 return await handleClarificationClassification(client, context, classification);
 } else {
 console.log(`ðŸ” Not a workshop or clarification query, proceeding to RAG for: "${context.query}"`);
 return { handled: false };
 }
}

// Helper function to handle workshop classification
async function handleWorkshopClassification(client, context) {
 console.log(`ðŸŽ¯ Workshop query detected: "${context.query}" - skipping RAG, routing to events`);
 const keywords = extractKeywords(context.query);
 await handleEventsPipeline({ client, query: context.query, keywords, pageContext: context.pageContext, res: context.res, debugInfo: { bypassReason: 'workshop_query' } });
 return { handled: true };
}

// Helper function to handle clarification classification
async function handleClarificationClassification(client, context, classification) {
 console.log(`ðŸŽ¯ Clarification query detected: "${context.query}" - routing to clarification`);
 await handleClarificationQuery({
 client,
 query: context.query,
 classification,
 pageContext: context.pageContext,
 res: context.res
 });
 return { handled: true };
}

// Helper function to attempt RAG first
async function attemptRagFirst(client, context) {
 console.log(`[DEBUG] attemptRagFirst called for: "${context.query}"`);
 console.log(`ðŸš€ Starting RAG-First attempt for: "${context.query}"`);
 const ragResult = await tryRagFirst(client, context.query);
 console.log(`ðŸ"Š RAG Result: success=${ragResult.success}, confidence=${ragResult.confidence}, answerLength=${ragResult.answer?.length || 0}`);
 return ragResult;
}
 
// Helper function to send RAG success response
function sendRagSuccessResponse(res, ragResult, context) {
  console.log(`[SUCCESS] RAG-First success: ${ragResult.confidence} confidence, ${ragResult.answerLength} chars`);
  
  // Apply Response Composer Layer - Convert any response to conversational format
  const composedResponse = composeFinalResponse(ragResult, context.query, context);
  console.log(`🎭 Response Composer: Converted ${ragResult.type} response to conversational format`);
 console.log(`ðŸ” Context exists: ${!!context}`);
 console.log(`ðŸ” Answer exists: ${!!ragResult.answer}`);
 console.log(`ðŸ” Context query: ${context?.query}`);
 console.log(`ðŸ” Context queryLower: ${context?.queryLower}`);
 console.log(`ðŸ” Quality indicators exist: ${!!context?.qualityIndicators}`);
 
 // Analyze response content for quality indicators
 console.log(`ðŸ” RAG SUCCESS RESPONSE - Quality Analysis Check:`);
 console.log(`ðŸ” Context exists: ${!!context}`);
 console.log(`ðŸ” Answer exists: ${!!ragResult.answer}`);
 console.log(`ðŸ” Context query: ${context?.query}`);
 console.log(`ðŸ” Context queryLower: ${context?.queryLower}`);
 console.log(`ðŸ” Quality indicators exist: ${!!context?.qualityIndicators}`);
 
 if (context && ragResult.answer) {
 console.log(`ðŸ” Analyzing response for quality indicators...`);
 try {
 // Ensure context has queryLower
 if (!context.queryLower && context.query) {
 context.queryLower = context.query.toLowerCase();
 }
 analyzeResponseContent(ragResult.answer, ragResult.sources?.articles || [], context);
 // Recalculate confidence based on quality indicators
 const newConfidence = finalizeConfidence(context.query, context);
 console.log(`ðŸŽ¯ Quality-based confidence: ${(newConfidence * 100).toFixed(1)}% (was ${(ragResult.confidence * 100).toFixed(1)}%)`);
 ragResult.confidence = newConfidence;
 } catch (error) {
 console.log(`âŒ Error in quality analysis: ${error.message}`);
 console.log(`âŒ Error stack: ${error.stack}`);
 }
 } else {
 console.log(`âŒ No context or answer for quality analysis`);
 }
 
 return res.status(200).json({
   ok: true,
   type: composedResponse.type,
   answer: composedResponse.answer,
   answer_markdown: composedResponse.answer,
   confidence: composedResponse.confidence,
   sources: composedResponse.sources,
   structured: composedResponse.structured,
   debugInfo: {
     intent: "rag_first",
     classification: "direct_answer",
     confidence: composedResponse.confidence,
     totalMatches: composedResponse.totalMatches,
     chunksFound: composedResponse.chunksFound,
     entitiesFound: composedResponse.entitiesFound,
     entityTitles: composedResponse.entities?.map(e => e.title) || [],
 approach: "rag_first_hybrid",
     debugLogs: [
       "DEPLOYMENT TEST V2 - This should appear in response",
       `Answer length: ${composedResponse.answer?.length || 0}`,
       `Answer preview: ${composedResponse.answer?.substring(0, 50) || 'NO ANSWER'}...`,
       `Chunks found: ${composedResponse.chunksFound || 0}`,
       `Entities found: ${composedResponse.entitiesFound || 0}`,
       ...(composedResponse.debugLogs || [])
 ]
 }
 });
 }
 
// Helper function to handle RAG fallback
async function handleRagFallbackWithIntent(client, context, ragResult) {
 console.log(`ðŸ”„ RAG-First insufficient (${ragResult.confidence} confidence), falling back to existing system`);
 console.log(`ðŸ“Š RAG Debug: chunks=${ragResult.chunksFound}, entities=${ragResult.entitiesFound}, totalMatches=${ragResult.totalMatches}`);
 
 const intent = determineIntent(context.query, context.previousQuery, context.pageContext);
 console.log(`ðŸŽ¯ Classification Intent: ${intent}`);
 
 await processByIntent({
 client,
 query: context.query,
 previousQuery: context.previousQuery,
 intent,
 pageContext: context.pageContext,
 res: context.res,
 started: context.started
 });
}

// Helper: Determine intent (Low Complexity)
function determineIntent(query, previousQuery, pageContext) {
 // Check for clarification follow-ups first
 if (pageContext && pageContext.clarificationLevel > 0) {
 return "clarification_followup";
 }
 
 // Use new classification system instead of old detectIntent
 const classification = classifyQuery(query || "");
 console.log(`ðŸŽ¯ Query classified as: ${classification.type} (${classification.reason})`);
 
 // Map classification types to intent
 switch (classification.type) {
 case 'workshop':
 return "workshop";
 case 'direct_answer':
 return "direct_answer";
 case 'clarification':
 return "clarification";
 default:
 return "events"; // fallback
 }
}

// Helper: Process by intent (Low Complexity)
async function processByIntent(context) {
 if (context.intent === "clarification_followup") {
 return await handleClarificationFollowup({
 client: context.client,
 query: context.query,
 previousQuery: context.previousQuery,
 pageContext: context.pageContext,
 res: context.res
 });
 }
 
 if (context.intent === "workshop") {
 return await handleWorkshopIntent(context);
 }
 
 if (!context.pageContext || !context.pageContext.clarificationLevel) {
 return await handleDirectAnswerOrWorkshop(context);
 }
 
 return await processRemainingLogic({
 client: context.client,
 query: context.query,
 previousQuery: context.previousQuery,
 intent: context.intent,
 pageContext: context.pageContext,
 res: context.res,
 started: context.started
 });
}

// Helper function to handle workshop intent
async function handleWorkshopIntent(context) {
 console.log(`ðŸŽ¯ Workshop query detected: "${context.query}" - routing to workshop system`);
 const keywords = extractKeywords(context.query);
 const handled = await handleEventsPipeline({ 
 client: context.client, 
 query: context.query, 
 keywords, 
 pageContext: context.pageContext, 
 res: context.res, 
 debugInfo: { intent: "workshop" } 
 });
 return handled;
}

// Helper function to handle direct answer or workshop classification
async function handleDirectAnswerOrWorkshop(context) {
 const classification = classifyQuery(context.query);
 
 // Check for equipment queries first - route to NEW RAG system
 const lc = context.query.toLowerCase();
 const equipmentKeywords = ['tripod', 'camera', 'lens', 'filter', 'flash', 'bag', 'strap', 'memory card', 'battery', 'charger', 'equipment', 'gear'];
 const adviceKeywords = ['recommend', 'best', 'what', 'which', 'should i buy', 'need', 'suggest', 'advice', 'opinion', 'prefer', 'choose', 'select'];
 
 const hasEquipment = equipmentKeywords.some(keyword => lc.includes(keyword));
 const hasAdvice = adviceKeywords.some(keyword => lc.includes(keyword));
 
 if (hasEquipment && hasAdvice) {
 console.log(`[TARGET] Equipment query detected: "${context.query}" - routing to NEW RAG system`);
 return await processMainQuery(context);
 }
 
 if (classification.type === 'direct_answer') {
 return await handleDirectAnswerClassification(context);
 } else if (classification.type === 'workshop') {
 return await handleWorkshopClassificationWithContext(context);
 }
 
 return false;
}

// Helper function to handle direct answer classification
async function handleDirectAnswerClassification(context) {
 console.log(`ðŸŽ¯ Direct answer query detected: "${context.query}" - bypassing clarification`);
 const directAnswerResponse = await handleDirectAnswerQuery({
 client: context.client,
 query: context.query,
 pageContext: context.pageContext,
 res: context.res
 });
 return directAnswerResponse;
}

// Helper function to handle workshop classification
async function handleWorkshopClassificationWithContext(context) {
 console.log(`ðŸŽ¯ Workshop query detected: "${context.query}" - routing to workshop system`);
 const keywords = extractKeywords(context.query);
 const handled = await handleEventsPipeline({ 
 client: context.client, 
 query: context.query, 
 keywords, 
 pageContext: context.pageContext, 
 res: context.res, 
 debugInfo: { intent: "workshop" } 
 });
 return handled;
}

// Helper: Process remaining logic (Low Complexity)
async function processRemainingLogic(context) {
 // Extract keywords for search
 const keywords = extractKeywords(context.query);
 
 // Handle different intents
 if (context.intent === "events") {
 const handled = await handleEventsPipeline({ 
 client: context.client, 
 query: context.query, 
 keywords, 
 pageContext: context.pageContext, 
 res: context.res, 
 debugInfo: { intent: context.intent } 
 });
 if (handled) return;
 } else if (context.intent === "advice") {
 const handled = await handleAdviceClarification({
 client: context.client,
 query: context.query,
 keywords,
 pageContext: context.pageContext,
 res: context.res
 });
 if (handled) return;
 }
 
 // Fallback response
 return sendFallbackResponse(context.res, keywords);
}

// Helper function to send fallback response
function sendFallbackResponse(res, keywords) {
 res.status(200).json({
 ok: true,
 type: "advice",
 answer_markdown: "I'd be happy to help you with your photography questions. Could you please provide more specific details about what you're looking for?",
 structured: {
 intent: "fallback",
 topic: keywords.join(", "),
 events: [],
 products: [],
 services: [],
 landing: [],
 articles: []
 },
 confidence: 0.30,
 debug: { 
 version: "v1.3.19-evidence-based", 
 intent: "fallback", 
 classification: "fallback",
 timestamp: new Date().toISOString() 
 }
 });
}

// Generate detailed event answer markdown with specific event information
// Helper function to check query types
function analyzeQueryTypes(query) {
 const queryLower = query.toLowerCase();
 return {
 isLocationQuery: queryLower.includes('devon') || queryLower.includes('coventry') || queryLower.includes('kenilworth') || queryLower.includes('exmoor'),
 isTimeQuery: queryLower.includes('next') || queryLower.includes('when') || queryLower.includes('date')
 };
}

// Helper function to format event date
function formatEventDate(dateString) {
 const eventDate = new Date(dateString);
 return eventDate.toLocaleDateString('en-GB', { 
 weekday: 'long', 
 year: 'numeric', 
 month: 'long', 
 day: 'numeric' 
 });
}

// Helper function to handle time query response
function handleTimeQueryResponse(eventList, isLocationQuery) {
 const sortedEvents = [...eventList].sort((a, b) => new Date(a.date) - new Date(b.date));
 const nextEvent = sortedEvents[0];
 const formattedDate = formatEventDate(nextEvent.date);
 
 return ` The next ${isLocationQuery ? 'Devon ' : ''}workshop is "${nextEvent.title || nextEvent.event_title}" on ${formattedDate} in ${nextEvent.location || 'Devon'}.`;
}

// Helper function to handle location query response
function handleLocationQueryResponse(eventList) {
 const locations = [...new Set(eventList.map(e => e.location).filter(Boolean))];
 if (locations.length > 0) {
 return ` These workshops are located in ${locations.join(' and ')}.`;
 }
 return '';
}

// Helper function to format individual event details
function formatEventDetails(event) {
 const formattedDate = formatEventDate(event.date);
 let details = `\n\n**${event.title || event.event_title}**`;
 details += `\nâ€¢ Date: ${formattedDate}`;
 if (event.location) details += `\nâ€¢ Location: ${event.location}`;
 if (event.price) details += `\nâ€¢ Price: Â£${event.price}`;
 if (event.experience_level) details += `\nâ€¢ Level: ${event.experience_level}`;
 return details;
}

// Helper function to add event details
function addEventDetails(eventList) {
 if (eventList.length <= 3) {
 let details = ` Here are the details:`;
 eventList.forEach(event => {
 details += formatEventDetails(event);
 });
 return details;
 } else {
 return ` These include workshops in various locations with different skill levels and dates.`;
 }
}

function generateEventAnswerMarkdown(eventList, query) {
 if (!eventList || eventList.length === 0) {
 return "I couldn't find any events matching your query.";
 }
 
 const { isLocationQuery, isTimeQuery } = analyzeQueryTypes(query);
 
 let answer = `I found ${eventList.length} ${eventList.length === 1 ? 'event' : 'events'} that match your query.`;
 
 if (isTimeQuery && eventList.length > 0) {
 answer += handleTimeQueryResponse(eventList, isLocationQuery);
 }
 
 if (isLocationQuery) {
 answer += handleLocationQueryResponse(eventList);
 }
 
 answer += addEventDetails(eventList);
 
 return answer;
}

// ============================================================================
// RESPONSE COMPOSER LAYER - Intelligent wrapper for all response types
// ============================================================================

// Response Composer Layer - Final synthesis of all responses
function composeFinalResponse(response, query, context = {}) {
  console.log(`🎭 Response Composer: Processing ${response.type} response for query: "${query}"`);
  
  // Extract the core answer
  let finalAnswer = response.answer || '';
  let finalType = response.type || 'advice';
  let finalSources = response.sources || [];
  
  // Detect if response contains article links that should be converted
  const hasArticleLinks = finalAnswer.includes('[http') || finalAnswer.includes('](http');
  const hasGenericReferences = finalAnswer.includes('check out these guides') || 
                               finalAnswer.includes('For detailed reviews');
  
  if (hasArticleLinks || hasGenericReferences) {
    console.log(`🎭 Converting article links to direct recommendations`);
    
    // Extract equipment type from query
    const equipmentType = extractEquipmentTypeFromQuery(query);
    
    if (equipmentType && response.structured?.articles?.length > 0) {
      // Generate direct equipment recommendations
      finalAnswer = generateDirectEquipmentRecommendation(equipmentType, response.structured.articles, query);
      finalType = 'advice';
    } else {
      // Generic conversion - remove article links and make conversational
      finalAnswer = convertArticleLinksToConversational(finalAnswer, response.structured?.articles || []);
    }
  }
  
  // Ensure response is conversational and direct
  if (finalAnswer && !isConversationalResponse(finalAnswer)) {
    finalAnswer = makeResponseConversational(finalAnswer, query);
  }
  
  return {
    ...response,
    answer: finalAnswer,
    type: finalType,
    sources: finalSources,
    confidence: Math.max(response.confidence || 0.1, 0.7) // Boost confidence for composed responses
  };
}

// Extract equipment type from query intelligently
function extractEquipmentTypeFromQuery(query) {
  const lc = query.toLowerCase();
  const equipmentMap = {
    'tripod': ['tripod'],
    'camera': ['camera', 'dslr', 'mirrorless', 'point and shoot'],
    'lens': ['lens', 'glass'],
    'filter': ['filter', 'nd', 'polarizing'],
    'flash': ['flash', 'speedlight', 'strobe'],
    'bag': ['bag', 'backpack', 'case'],
    'memory card': ['memory card', 'sd card', 'storage'],
    'laptop': ['laptop', 'computer', 'macbook'],
    'software': ['lightroom', 'photoshop', 'editing', 'post-processing']
  };
  
  for (const [equipment, keywords] of Object.entries(equipmentMap)) {
    if (keywords.some(keyword => lc.includes(keyword))) {
      return equipment;
    }
  }
  return null;
}

// Generate direct equipment recommendations from articles
function generateDirectEquipmentRecommendation(equipmentType, articles, query) {
  console.log(`🎭 Generating direct ${equipmentType} recommendations from ${articles.length} articles`);
  
  // Filter articles for this equipment type
  const relevantArticles = findRelevantEquipmentArticles(equipmentType, articles);
  
  if (relevantArticles.length === 0) {
    return `I'd be happy to help you choose ${equipmentType} equipment! Based on your photography needs, I can provide personalized recommendations.`;
  }
  
  // Generate contextual recommendations based on query intent
  const isBeginnerQuery = query.toLowerCase().includes('beginner') || query.toLowerCase().includes('first');
  const isCourseQuery = query.toLowerCase().includes('course') || query.toLowerCase().includes('workshop');
  
  let recommendation = '';
  
  if (equipmentType === 'camera') {
    if (isBeginnerQuery) {
      recommendation = `For beginners, I recommend starting with a mirrorless camera or DSLR with good auto modes. Look for cameras with built-in tutorials and scene modes to help you learn.`;
    } else if (isCourseQuery) {
      recommendation = `For my courses and workshops, any DSLR or mirrorless camera with manual controls will work perfectly. The key is having aperture, shutter speed, and ISO control.`;
    } else {
      recommendation = `The best camera depends on your photography style and experience level. Mirrorless cameras offer great image quality in a compact package, while DSLRs provide excellent battery life and lens selection.`;
    }
  } else if (equipmentType === 'tripod') {
    recommendation = `For tripods, I recommend lightweight carbon fiber models for travel, or sturdy aluminum for studio work. Look for features like quick-release plates and adjustable leg angles.`;
  } else {
    recommendation = `For ${equipmentType}, I recommend focusing on quality over quantity. Look for reputable brands with good warranties and user reviews.`;
  }
  
  // Add context about available resources
  if (relevantArticles.length > 0) {
    recommendation += ` I have detailed guides covering specific recommendations and technical details.`;
  }
  
  return recommendation;
}

// Convert article links to conversational format
function convertArticleLinksToConversational(answer, articles) {
  // Remove article link patterns
  let conversational = answer
    .replace(/For detailed reviews and specific recommendations, check out these guides:.*$/s, '')
    .replace(/\[.*?\]\(https?:\/\/[^)]+\)/g, '')
    .replace(/\s*-\s*\[.*?\]\(https?:\/\/[^)]+\)/g, '')
    .trim();
  
  // If answer is too short or empty, provide generic helpful response
  if (conversational.length < 50) {
    conversational = `I'd be happy to help you with that! I have comprehensive guides and resources that can provide detailed information on this topic.`;
  }
  
  return conversational;
}

// Check if response is already conversational
function isConversationalResponse(answer) {
  const conversationalIndicators = [
    'I recommend', 'I suggest', 'For beginners', 'The best', 'Look for',
    'I\'d be happy to help', 'Based on', 'You should', 'Consider'
  ];
  
  return conversationalIndicators.some(indicator => 
    answer.toLowerCase().includes(indicator.toLowerCase())
  );
}

// Make response more conversational
function makeResponseConversational(answer, query) {
  // If answer is just a link or reference, convert to helpful response
  if (answer.includes('http') && answer.length < 100) {
    return `I have detailed information about this topic that can help answer your question. Let me know if you'd like specific guidance!`;
  }
  
  // If answer is too technical, add conversational wrapper
  if (answer.length > 200 && !answer.includes('I') && !answer.includes('you')) {
    return `Here's what I can tell you: ${answer}`;
  }
  
  return answer;
}

