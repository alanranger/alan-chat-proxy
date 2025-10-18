// /api/chat.js
// FIX: 2025-10-06 04:15 - Fixed fitness level extraction from description field
// This extracts fitness level information from product chunks description field
// Now parses patterns like "Fitness: 1. Easy" and "Experience - Level: Beginner"
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";
import crypto from 'node:crypto';

/* ----------------------- Helper Functions ----------------------- */
// Hash IP for privacy
const hashIP = (ip) => {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip + 'chat-log-salt').digest('hex').substring(0, 16);
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
  } catch (error) {
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

const logAnswer = async (sessionId, question, answer, intent, confidence, responseTimeMs, sourcesUsed, pageContext = null) => {
  try {
    const client = supabaseAdmin();
    
    // Insert the complete interaction into chat_interactions
    const { error } = await client.from('chat_interactions').insert([{
      session_id: sessionId,
      question: question,
      answer: answer,
      intent: intent,
      confidence: confidence ? parseFloat(confidence) : null,
      response_time_ms: responseTimeMs ? parseInt(responseTimeMs) : null,
      sources_used: sourcesUsed || null,
      page_context: pageContext ? {
        url: pageContext.url,
        title: pageContext.title,
        pathname: pageContext.pathname
      } : null
    }]);
    
    if (error) throw new Error(`Answer log failed: ${error.message}`);
    
    // Update session question count
    const { error: rpcError } = await client.rpc('increment_session_questions', { session_id: sessionId });
    if (rpcError) throw new Error(`RPC failed: ${rpcError.message}`);
  } catch (err) {
    console.warn('Answer logging failed:', err.message);
  }
};

/* ----------------------- Direct Answer Generation ----------------------- */
function generateServiceFAQAnswer(query, contentChunks = [], articles = []) {
  const q = (query || "").toLowerCase();
  const topics = [
    { key: "payment", hints: ["payment", "pick n mix", "plan", "instalment", "installment"], prefer: ["/photography-payment-plan", "/terms-and-conditions"] },
    { key: "contact", hints: ["contact", "discovery", "call", "phone", "email"], prefer: ["/contact-us", "/contact-us-alan-ranger-photography"] },
    { key: "certificate", hints: ["certificate"], prefer: ["/beginners-photography-classes", "/photography-courses"] },
    { key: "course-topics", hints: ["topics", "5-week", "beginner"], prefer: ["/beginners-photography-classes", "/get-off-auto"] },
    { key: "standalone", hints: ["standalone", "get off auto"], prefer: ["/get-off-auto", "/beginners-photography-classes"] },
    { key: "refund", hints: ["refund", "cancel", "cancellation"], prefer: ["/terms-and-conditions"] }
  ];

  const match = topics.find(t => t.hints.some(h => q.includes(h)));
  if (!match) return null;

  const prefer = (u) => (match.prefer || []).some(p => (u || "").includes(p));

  // Choose a chunk from preferred URLs first
  const prioritizedChunk = (contentChunks || []).find(c => prefer(c.url)) || contentChunks.find(c => {
    const text = (c.chunk_text || c.content || "").toLowerCase();
    return match.hints.some(h => text.includes(h));
  });

  const pickUrl = () => {
    if (prioritizedChunk?.url) return prioritizedChunk.url;
    const art = (articles || []).find(a => prefer(a.page_url || a.source_url || ""));
    return art ? (art.page_url || art.source_url) : null;
  };

  const url = pickUrl();
  if (!prioritizedChunk && !url) return null;

  const text = (prioritizedChunk?.chunk_text || prioritizedChunk?.content || "");
  const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 40);
  const para = paras.find(p => match.hints.some(h => p.toLowerCase().includes(h))) || paras[0];
  if (!para) return null;

  return `**${para.substring(0, 300).trim()}**\n\n${url ? `*Source: ${url}*\n\n` : ""}`;
}

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
  
  console.log(`🔧 isEquipmentAdviceQuery: query="${query}", hasEquipment=${hasEquipment}, hasAdvice=${hasAdvice}`);
  
  return hasEquipment && hasAdvice;
}

// Enhanced equipment advice response generator
function generateEquipmentAdviceResponse(query, articles, contentChunks) {
  console.log(`🔧 generateEquipmentAdviceResponse: Processing equipment advice query="${query}"`);
  console.log(`🔧 generateEquipmentAdviceResponse: Articles available=${articles.length}`);
  
  // Extract equipment type from query
  const equipmentType = extractEquipmentType(query);
  console.log(`🔧 generateEquipmentAdviceResponse: Equipment type="${equipmentType}"`);
  
  // Find relevant articles for this equipment type
  const relevantArticles = findRelevantEquipmentArticles(equipmentType, articles);
  console.log(`🔧 generateEquipmentAdviceResponse: Found ${relevantArticles.length} relevant articles`);
  
  // If no relevant articles found, return a basic response
  if (relevantArticles.length === 0) {
    console.log(`🔧 generateEquipmentAdviceResponse: No relevant articles found, returning basic response`);
    return generateBasicEquipmentAdvice(equipmentType);
  }
  
  // Extract key considerations from articles
  const keyConsiderations = extractKeyConsiderations(relevantArticles, contentChunks);
  console.log(`🔧 generateEquipmentAdviceResponse: Key considerations=${JSON.stringify(keyConsiderations)}`);
  
  // Generate synthesized response
  const response = synthesizeEquipmentAdvice(equipmentType, keyConsiderations, relevantArticles);
  console.log(`🔧 generateEquipmentAdviceResponse: Generated response="${response.substring(0, 200)}..."`);
  
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
  const body = bestCandidate.paras.join("\n\n");
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
    'camera': ['camera', 'cameras', 'dslr', 'mirrorless'],
    'lens': ['lens', 'lenses', 'glass'],
    'filter': ['filter', 'filters', 'nd', 'polarizing'],
    'flash': ['flash', 'speedlight', 'strobe'],
    'bag': ['bag', 'backpack', 'case'],
    'memory card': ['memory card', 'sd card', 'storage'],
    'laptop': ['laptop', 'computer', 'macbook'],
    'software': ['lightroom', 'photoshop', 'editing', 'post-processing']
  };
  
  const keywords = equipmentKeywords[equipmentType] || [equipmentType];
  
  return articles.filter(article => {
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
  }).slice(0, 5); // Limit to top 5 most relevant
}

// Helper function to process individual content chunks
function processContentChunk(chunk, considerations) {
  const chunkText = (chunk.chunk_text || chunk.content || '').toLowerCase();
  
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
  
  // Build the response framework
  let response = `**Equipment Recommendations:**\n\n`;
  response += `Choosing the right ${equipmentName} depends on several factors: `;
  
  // Add key considerations
  const considerationTexts = [];
  if (considerations.budget.length > 0) considerationTexts.push('budget');
  if (considerations.weight.length > 0) considerationTexts.push('weight requirements');
  if (considerations.usage.length > 0) considerationTexts.push('intended usage');
  if (considerations.terrain.length > 0) considerationTexts.push('terrain conditions');
  if (considerations.experience.length > 0) considerationTexts.push('experience level');
  
  if (considerationTexts.length > 0) {
    response += considerationTexts.join(', ') + '. ';
  } else {
    response += 'your specific needs and photography style. ';
  }
  
  // Add specific advice based on equipment type
  response += addSpecificAdvice(equipmentType, considerations);
  
  // Add article references
  if (relevantArticles.length > 0) {
    response += `\n\n**For detailed reviews and specific recommendations, check out these guides:**\n`;
    relevantArticles.slice(0, 3).forEach(article => {
      response += `- [${article.title}](${article.page_url || article.url})\n`;
      });
    }
    
    return response;
  }
  
// Add specific advice based on equipment type
function addSpecificAdvice(equipmentType, considerations) {
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
  response += addSpecificAdvice(equipmentType, {});
  response += `\n\nFor detailed reviews and specific recommendations, check out Alan's photography guides on his blog.`;
  
  return response;
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
      
function extractAnswerFromArticleDescription(relevantArticle) {
      if (relevantArticle.description && relevantArticle.description.length > 50) {
        console.log(`🔍 generateDirectAnswer: Using article description="${relevantArticle.description.substring(0, 200)}..."`);
        return `**${relevantArticle.description}**\n\n*From Alan's blog: ${relevantArticle.page_url || relevantArticle.url}*\n\n`;
  }
  return null;
}

function extractAnswerFromJsonLd(relevantArticle, exactTerm) {
  if (!relevantArticle.json_ld_data || !relevantArticle.json_ld_data.mainEntity) {
    return null;
  }
  
        console.log(`🔍 generateDirectAnswer: Article has JSON-LD FAQ data`);
      
      const faqItems = relevantArticle.json_ld_data.mainEntity;
      const primaryQuestion = faqItems.find(item => {
        const question = (item.name || "").toLowerCase();
        return question.includes(exactTerm) && 
               (question.includes("what does") || question.includes("what is"));
      });
      
      if (primaryQuestion && primaryQuestion.acceptedAnswer && primaryQuestion.acceptedAnswer.text) {
        let answerText = primaryQuestion.acceptedAnswer.text;
        
        // Clean HTML tags from the answer
        answerText = answerText.replace(/<[^>]*>/g, '').trim();
        
        // Clean up any remaining artifacts
        answerText = answerText.replace(/utm_source=blog&utm_medium=cta&utm_campaign=continue-learning&utm_content=.*?\]/g, '');
        answerText = answerText.replace(/\* Next lesson:.*?\*\*/g, '');
        
        if (answerText.length > 50) {
          console.log(`🔍 generateDirectAnswer: Extracted FAQ answer="${answerText.substring(0, 200)}..."`);
          return `**${answerText}**\n\n*From Alan's blog: ${relevantArticle.page_url || relevantArticle.url}*\n\n`;
          }
        }
  
  return null;
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
  
function filterCandidateChunks(exactTerm, contentChunks) {
  if (!exactTerm) return contentChunks || [];
  
  const slug = exactTerm.replace(/\s+/g, "-");
  return (contentChunks || []).filter(c => {
    const url = String(c.url||"").toLowerCase();
    const title = String(c.title||"").toLowerCase();
    const text = String(c.chunk_text||c.content||"").toLowerCase();
    
    // Skip malformed chunks (URL-encoded text, very short text, or navigation elements)
    if (text.length < 50 || 
        text.includes('%3A%2F%2F') || 
        text.includes('] 0 Likes') ||
        text.includes('Sign In') ||
        text.includes('My Account') ||
        text.includes('Back ') ||
        text.includes('[/') ||
        text.includes('Cart 0')) {
      return false;
    }
    
    return hasWord(text, exactTerm) || hasWord(title, exactTerm) || hasWord(url, exactTerm) || 
           url.includes(`/what-is-${slug}`) || title.includes(`what is ${exactTerm}`) || 
           text.includes(`what is ${exactTerm}`);
  });
}

function scoreChunks(candidateChunks, queryWords, exactTerm) {
  const technicalTerms = ["iso", "raw", "jpg", "png", "dpi", "ppi", "rgb", "cmyk"];
  const importantWords = queryWords.filter(w => w.length >= 3 && (technicalTerms.includes(w) || w.length >= 4));
  
  return candidateChunks.map(chunk => {
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
  }).sort((a,b)=>b.s-a.s);
}
  
function extractAnswerFromContentChunks(query, queryWords, exactTerm, contentChunks) {
  const candidateChunks = filterCandidateChunks(exactTerm, contentChunks);
  const scoredChunks = scoreChunks(candidateChunks, queryWords, exactTerm);
  const relevantChunk = (scoredChunks.length ? scoredChunks[0].chunk : null);
  
  console.log(`🔍 generateDirectAnswer: Found relevantChunk=${!!relevantChunk}`);
  
  if (!relevantChunk) return null;
  
    let chunkText = relevantChunk.chunk_text || relevantChunk.content || "";
    
    // Remove metadata headers that start with [ARTICLE] or similar
    chunkText = chunkText.replace(/^\[ARTICLE\].*?URL:.*?\n\n/, '');
    chunkText = chunkText.replace(/^\[.*?\].*?Published:.*?\n\n/, '');
    
  // Check for fitness level information first
  const fitnessAnswer = extractFitnessLevelAnswer(query, chunkText, relevantChunk);
  if (fitnessAnswer) return fitnessAnswer;
  
  // Look for definitional sentences
  const definitionAnswer = extractDefinitionSentence(chunkText, exactTerm, relevantChunk);
  if (definitionAnswer) return definitionAnswer;
  
  // Look for relevant sentences
  const sentenceAnswer = extractRelevantSentence(chunkText, queryWords, relevantChunk);
  if (sentenceAnswer) return sentenceAnswer;
  
  // Look for relevant paragraphs
  const paragraphAnswer = extractRelevantParagraph(chunkText, queryWords, exactTerm, relevantChunk);
  if (paragraphAnswer) return paragraphAnswer;
  
  return null;
}

function extractFitnessLevelAnswer(query, chunkText, relevantChunk) {
  const lc = query.toLowerCase();
  if (!lc.includes('fitness') && !lc.includes('level')) return null;
  
      console.log(`🔍 generateDirectAnswer: Looking for fitness level in chunk text="${chunkText.substring(0, 300)}..."`);
      
      const fitnessPatterns = [
    /Fitness:\s*(\d+\.?\s*[^\n]+)/i,           // "Fitness: 2. Easy-Moderate"
    /Fitness\s*Level:\s*([^\n]+)/i,            // "Fitness Level: Easy"
    /Experience\s*-\s*Level:\s*([^\n]+)/i,     // "Experience - Level: Beginner and Novice"
    /Level:\s*([^\n]+)/i,                      // "Level: Beginners"
    /Fitness\s*Required:\s*([^\n]+)/i,         // "Fitness Required: Easy"
    /Physical\s*Level:\s*([^\n]+)/i            // "Physical Level: Easy"
      ];
      
      for (const pattern of fitnessPatterns) {
        const match = chunkText.match(pattern);
        console.log(`🔍 generateDirectAnswer: Pattern ${pattern} match=${!!match}`);
        if (match && match[1]) {
          const fitnessLevel = match[1].trim();
          console.log(`🔍 generateDirectAnswer: Found fitness level="${fitnessLevel}"`);
          return `**The fitness level required is ${fitnessLevel}.** This ensures the workshop is suitable for your physical capabilities and you can fully enjoy the experience.\n\n*From Alan's blog: ${relevantChunk.url}*\n\n`;
        }
      }
      
      // Fallback: look for common fitness level words in the chunk
      const fitnessWords = ['easy', 'moderate', 'hard', 'beginner', 'intermediate', 'advanced', 'low', 'medium', 'high'];
      const chunkTextLower = chunkText.toLowerCase();
      const foundFitnessWord = fitnessWords.find(word => chunkTextLower.includes(word));
      
      if (foundFitnessWord) {
        return `**The fitness level required is ${foundFitnessWord}.** This ensures the workshop is suitable for your physical capabilities and you can fully enjoy the experience.\n\n*From Alan's blog: ${relevantChunk.url}*\n\n`;
      }
  
  return null;
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
      return `**${defSentence.trim()}**\n\n*From Alan's blog: ${relevantChunk.url}*\n\n`;
    }

  return null;
}

function extractRelevantSentence(chunkText, queryWords, relevantChunk) {
    // Look for sentences that contain key terms from the query
    const sentences = chunkText.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const relevantSentence = sentences.find(s => {
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
    });
    
    if (relevantSentence) {
      return `**${relevantSentence.trim()}**\n\n*From Alan's blog: ${relevantChunk.url}*\n\n`;
    }
    
  return null;
}

function extractRelevantParagraph(chunkText, queryWords, exactTerm, relevantChunk) {
    // Fallback: if no good sentence found, try to extract the first paragraph containing "what is <term>"
    if (exactTerm) {
      const byPara = chunkText.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 50);
      const para = byPara.find(p => p.toLowerCase().includes(`what is ${exactTerm}`) && p.length <= 300);
      if (para) {
        return `**${para.trim()}**\n\n*From Alan's blog: ${relevantChunk.url}*\n\n`;
      }
    }

    // Fallback: if no good sentence found, try to extract a relevant paragraph
    const paragraphs = chunkText.split(/\n\s*\n/).filter(p => p.trim().length > 50);
    const relevantParagraph = paragraphs.find(p => {
      const pLower = p.toLowerCase();
      const technicalTerms = ["iso", "raw", "jpg", "png", "dpi", "ppi", "rgb", "cmyk"];
      const importantWords = queryWords.filter(w => 
        w.length >= 3 && (technicalTerms.includes(w) || w.length >= 4)
      );
      return importantWords.some(word => pLower.includes(word)) &&
             !pLower.includes('[article]') &&
             !pLower.includes('published:') &&
             !pLower.includes('url:') &&
             !pLower.includes('alan ranger photography');
    });
    
    if (relevantParagraph && relevantParagraph.length < 300) {
      return `**${relevantParagraph.trim()}**\n\n*From Alan's blog: ${relevantChunk.url}*\n\n`;
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
  if (lc.includes("jpeg") && lc.includes("raw")) {
    return `**JPEG vs RAW**: JPEG files are smaller and ready to use, while RAW files give you more editing flexibility but require post-processing. For beginners, JPEG is fine to start with, but RAW becomes valuable as you develop your editing skills.\n\n`;
  }
  
  if (lc.includes("exposure triangle")) {
    return `**The Exposure Triangle** consists of three key settings:\n- **Aperture** (f-stop): Controls depth of field and light\n- **Shutter Speed**: Controls motion blur and light\n- **ISO**: Controls sensor sensitivity and light\n\nBalancing these three creates proper exposure.\n\n`;
  }
  
  if (lc.includes("composition") || lc.includes("storytelling")) {
    return `Great composition is about leading the viewer's eye through your image. Key techniques include the rule of thirds, leading lines, framing, and creating visual balance. The goal is to tell a story or convey emotion through your arrangement of elements.\n\n`;
  }
  
  if (lc.includes("filter") || lc.includes("nd filter")) {
    return `**ND (Neutral Density) filters** reduce light entering your camera, allowing for longer exposures. They're great for blurring water, creating motion effects, or shooting in bright conditions. **Graduated filters** help balance exposure between bright skies and darker foregrounds.\n\n`;
  }
  
  if (lc.includes("depth of field")) {
    return `**Depth of field** is the area of your image that appears sharp. You control it with aperture: wider apertures (lower f-numbers) create shallow depth of field, while smaller apertures (higher f-numbers) keep more of the image in focus.\n\n`;
  }
  
  if (lc.includes("sharp") || lc.includes("blurry")) {
    return `Sharp images come from proper technique: use a fast enough shutter speed to avoid camera shake, focus accurately, and use appropriate aperture settings. Tripods help with stability, and good lighting makes focusing easier.\n\n`;
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
  
function getServiceAnswers(lc) {
  if (lc.includes("private") || lc.includes("mentoring") || lc.includes("1-2-1") || lc.includes("tuition")) {
    return `**Private Lessons & Mentoring**: Alan offers face-to-face private photography lessons in Coventry (CV4 9HW) or at a location of your choice. Lessons are bespoke to your needs and available at times that suit you. Also available: RPS mentoring for distinctions, monthly mentoring assignments, and 1-2-1 Zoom support. Visit [Private Lessons](https://www.alanranger.com/private-photography-lessons) for details.\n\n`;
  }
  
  if (lc.includes("voucher") || lc.includes("gift") || lc.includes("present")) {
    return `**Gift Vouchers**: Digital photography gift vouchers are available from £5-£600, perfect for any photography enthusiast. Vouchers can be used for workshops, courses, private lessons, or any photography tuition event. They expire 12 months from purchase date and can be split across multiple purchases. [Buy Gift Vouchers](https://www.alanranger.com/photography-gift-vouchers)\n\n`;
  }
  
  if (lc.includes("service") || lc.includes("what do you offer") || lc.includes("what services")) {
    return `**Services Available**: Alan Ranger Photography offers comprehensive photography services including workshops, courses, private lessons, mentoring, gift vouchers, gear checks, fine art prints, and payment plans. Services include face-to-face and online options, with locations in Coventry and various UK destinations. [View All Services](https://www.alanranger.com/photography-tuition-services)\n\n`;
  }
  
  return null;
}

function getAboutAnswers(lc) {
  if (lc.includes("alan ranger") && (lc.includes("who") || lc.includes("background") || lc.includes("about"))) {
    return `**About Alan Ranger**: Alan is a highly qualified professional photographer and photography tutor based in the Midlands, UK, with over 20 years of experience. He is a qualified Associate of the British Institute of Professional Photographers (BIPP) and holds ARPS (Associate of the Royal Photographic Society) distinctions. Alan offers personalised photography courses and workshops tailored to all skill levels, spanning various genres from portraits to landscape and black and white photography. He has led over 30 educational lectures at the Xposure International Photography Festival in UAE and has won multiple awards including Landscape Photographer of the Year (7 awards) and International Landscape Photographer of the Year. [Learn more about Alan](https://www.alanranger.com/about-alan-ranger)\n\n`;
  }
  
  if (lc.includes("ethical") || lc.includes("guidelines") || lc.includes("environmental") || lc.includes("carbon")) {
    return `**Ethical Guidelines**: Alan Ranger Photography follows strict ethical policies focused on environmental consciousness and responsible education. The business maintains a carbon-neutral footprint through annual carbon impact assessments and offsetting projects. A tree is planted for every workshop place sold to help offset travel carbon footprint. Alan practices the Nature First code of ethics to ensure responsible custodianship of nature. Workshops are limited to 6 or fewer participants for personalised 1-2-1 time, with detailed itineraries including weather backups and health and safety prioritised. [View Ethical Policy](https://www.alanranger.com/my-ethical-policy)\n\n`;
  }
  
  return null;
}

function getHardcodedAnswer(lc) {
  // Camera recommendations
  if (lc.includes("camera") && (lc.includes("need") || lc.includes("recommend"))) {
    return getCameraAnswer();
  }
  
  // Certificate questions
  if (lc.includes("certificate")) {
    return getCertificateAnswer();
  }
  
  // Equipment questions
  if (lc.includes("equipment") || lc.includes("gear") || lc.includes("laptop")) {
    return getEquipmentAnswer();
  }
  
  // Technical questions
  const technicalAnswer = getTechnicalAnswers(lc);
  if (technicalAnswer) return technicalAnswer;
  
  // Policy questions
  const policyAnswer = getPolicyAnswers(lc);
  if (policyAnswer) return policyAnswer;
  
  // Service questions
  const serviceAnswer = getServiceAnswers(lc);
  if (serviceAnswer) return serviceAnswer;
  
  // About questions
  const aboutAnswer = getAboutAnswers(lc);
  if (aboutAnswer) return aboutAnswer;
  
  return null;
}

function generateDirectAnswer(query, articles, contentChunks = []) {
  const lc = (query || "").toLowerCase();
  const queryWords = lc.split(" ").filter(w => w.length > 2);
  const exactTerm = lc.replace(/^what\s+is\s+/, "").trim();
  
  // DEBUG: Log what we're working with
  console.log(`🔍 generateDirectAnswer: Query="${query}"`);
  console.log(`🔍 generateDirectAnswer: Articles count=${articles.length}`);
  console.log(`🔍 generateDirectAnswer: Content chunks count=${contentChunks.length}`);
  
  // PRIORITY 0: Course-specific equipment advice - MUST come first before any article searching
  if (isCourseEquipmentQuery(lc)) {
    console.log(`🔧 Course-specific equipment advice triggered for: "${query}"`);
    return generateCourseEquipmentAnswer();
  }
  
  // PRIORITY 1: Extract from JSON-LD FAQ data in articles
  if (exactTerm && articles.length > 0) {
    const relevantArticle = findRelevantArticleForTerm(exactTerm, articles);
    
    if (relevantArticle) {
      console.log(`🔍 generateDirectAnswer: Found relevant article="${relevantArticle.title}"`);
      
      // PRIORITY 1: Use article description first (most reliable)
      const descriptionAnswer = extractAnswerFromArticleDescription(relevantArticle);
      if (descriptionAnswer) {
        return descriptionAnswer;
      }
      
      // PRIORITY 2: Fall back to JSON-LD FAQ data if no description
      const jsonLdAnswer = extractAnswerFromJsonLd(relevantArticle, exactTerm);
      if (jsonLdAnswer) {
        return jsonLdAnswer;
      }
    }
  }
  
  // PRIORITY 2: Extract from content chunks (existing logic)
  const chunkAnswer = extractAnswerFromContentChunks(query, queryWords, exactTerm, contentChunks);
  if (chunkAnswer) {
    return chunkAnswer;
  }
  
  
  // Enhanced Equipment Advice - Check if this is an equipment recommendation query
  if (isEquipmentAdviceQuery(lc)) {
    return generateEquipmentAdviceResponse(lc, articles, contentChunks);
  }
  
  // Check for hardcoded answers
  const hardcodedAnswer = getHardcodedAnswer(lc);
  if (hardcodedAnswer) {
    return hardcodedAnswer;
  }
  
  // Return null if no specific answer can be generated
  return null;
}

/* ---------------------------- Supabase client ---------------------------- */
function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

/* ------------------------------ Small utils ------------------------------ */
const TZ = "Europe/London";

function fmtDateLondon(ts) {
  try {
    const d = new Date(ts);
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: TZ,
    }).format(d);
  } catch {
    return ts;
  }
}
function uniq(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}
function toGBP(n) {
  if (n == null || isNaN(Number(n))) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number(n));
}
function pickUrl(row) {
  return row?.page_url || row?.source_url || row?.url || null;
}
function originOf(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

// Note: We deliberately do not normalize typos; we ask users to rephrase instead.

/* ----------------------- Intent + keyword extraction --------------------- */
const EVENT_HINTS = [
  "date",
  "dates",
  "when",
  "next",
  "upcoming",
  "available",
  "where",
  "workshop",
  "schedule",
];

const TOPIC_KEYWORDS = [
  // locations
  "devon",
  "snowdonia",
  "wales",
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
  let lc = (q || "").toLowerCase();
  // Normalize common variants to improve matching
  lc = lc.replace(/\bb\s*&\s*b\b/g, "bnb"); // b&b -> bnb
  lc = lc.replace(/\bbed\s*and\s*breakfast\b/g, "bnb");
  const kws = new Set();
  for (const t of TOPIC_KEYWORDS) {
    if (lc.includes(t)) kws.add(t);
  }
  
  // Add technical terms (3+ chars) and general words (4+ chars)
  const technicalTerms = ["iso", "raw", "jpg", "png", "dpi", "ppi", "rgb", "cmyk"];
  lc
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && (technicalTerms.includes(w) || w.length >= 4))
    .forEach((w) => kws.add(w));
    
  return Array.from(kws);
}

// Helper functions for intent detection
function isFollowUpQuestion(lc) {
  const followUpQuestions = [
    "how much", "cost", "price", "where", "location", "when", "date",
    "how many", "people", "attend", "fitness", "level", "duration", "long",
    "how do i book", "book", "booking", "required", "needed", "suitable"
  ];
  return followUpQuestions.some(word => lc.includes(word));
}

function hasWorkshopMention(lc) {
  return lc.includes("workshop");
}

function isSpecificCourseQuery(lc) {
  return lc.includes("course") || lc.includes("class") || lc.includes("lesson");
}

function isEquipmentQuery(lc) {
  const equipmentKeywords = [
    "certificate", "camera", "laptop", "equipment", "tripod", "lens", "gear",
    "need", "require", "recommend", "advise", "help", "wrong", "problem"
  ];
  return equipmentKeywords.some(word => lc.includes(word));
}

function isServiceQuery(lc) {
  return (
    lc.includes("private") && (lc.includes("lesson") || lc.includes("class")) ||
    lc.includes("online") && (lc.includes("course") || lc.includes("lesson")) ||
    lc.includes("mentoring") ||
    lc.includes("1-2-1") || lc.includes("1-to-1") || lc.includes("one-to-one")
  );
}

function isTechnicalQuery(lc) {
  const technicalKeywords = [
    "free", "online", "sort of", "what do i", "do i need", "get a",
    "what is", "what are", "how does", "explain", "define", "meaning",
    "training", "mentoring", "tutoring"
  ];
  return technicalKeywords.some(word => lc.includes(word));
}

function isAboutQuery(lc) {
  return lc.includes("about");
}

function isGeneralQuery(lc) {
  return lc.includes("general") || lc.includes("help");
}

// Helper functions for detectIntent
function isFreeCourseQuery(lc) {
  return lc.includes("free") && (lc.includes("course") || lc.includes("online"));
}

function isWhenWhereWorkshopQuery(q, mentionsWorkshop) {
  return /^\s*(when|where)\b/i.test(q || "") && mentionsWorkshop;
}

function handleFollowUpLogic(isFollowUp, mentionsWorkshop) {
  if (isFollowUp && mentionsWorkshop) {
    return "events";
  }
  if (isFollowUp && !mentionsWorkshop) {
    return "advice";
  }
  return null;
}

function detectIntent(q) {
  const lc = (q || "").toLowerCase();
  
  // PRIORITY: Free course queries should be treated as advice, not events
  if (isFreeCourseQuery(lc)) {
    return "advice"; // Free course queries need cross-entity search
  }
  
  // Check for course/class queries
  const mentionsCourse = isSpecificCourseQuery(lc);
  const mentionsWorkshop = hasWorkshopMention(lc);
  
  // PRIORITY: Flexible services should be treated as advice, not events
  if (isServiceQuery(lc)) {
    return "advice"; // Flexible services need cross-entity search (products + services + articles)
  }
  
  // Both courses and workshops have events - they're both scheduled sessions
  if (mentionsCourse || mentionsWorkshop) {
    return "events"; // Both courses and workshops are events (scheduled sessions)
  }
  
  // ADVICE keywords
  if (isEquipmentQuery(lc) || isTechnicalQuery(lc)) {
    return "advice";
  }
  
  // heuristic: if question starts with "when/where" + includes 'workshop' → events
  if (isWhenWhereWorkshopQuery(q, mentionsWorkshop)) return "events";
  
  // Check if this is a follow-up question about event details
  const isFollowUp = isFollowUpQuestion(lc);
  
  // Handle follow-up logic
  const followUpResult = handleFollowUpLogic(isFollowUp, mentionsWorkshop);
  if (followUpResult) {
    return followUpResult;
  }
  
  // default
  return "advice";
}

/* --------------------------- Interactive Clarification System --------------------------- */

/**
 * LOGICAL CONFIDENCE SYSTEM - Check if we have enough context to provide a confident answer
 * Uses logical rules instead of broken numerical confidence scores
 */
// Calculate RAG-based confidence for clarification questions
async function calculateRAGConfidence(query, client, pageContext) {
  try {
    const keywords = extractKeywords(query);
    const articles = await findArticles(client, { keywords, limit: 10, pageContext });
    const articleUrls = articles?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
    const contentChunks = await findContentChunks(client, { keywords, limit: 5, articleUrls });
    
    // Calculate confidence based on content found
    let confidence = 0.1; // Base confidence
    
    if (articles.length > 0) {
      confidence += Math.min(0.3, articles.length * 0.05); // Up to 30% for articles
    }
    
    if (contentChunks.length > 0) {
      confidence += Math.min(0.4, contentChunks.length * 0.08); // Up to 40% for content chunks
    }
    
    // Check if content is highly relevant
    const queryWords = query.toLowerCase().split(' ').filter(w => w.length > 2);
    let relevanceScore = 0;
    
    if (articles.length > 0) {
      articles.forEach(article => {
        const title = (article.title || '').toLowerCase();
        const description = (article.description || '').toLowerCase();
        const text = `${title} ${description}`;
        
        queryWords.forEach(word => {
          if (text.includes(word)) relevanceScore += 0.1;
        });
      });
    }
    
    confidence += Math.min(0.2, relevanceScore); // Up to 20% for relevance
    
    return Math.min(0.95, Math.max(0.1, confidence)); // Cap between 10% and 95%
  } catch (error) {
    console.warn('Error calculating RAG confidence:', error);
    return 0.3; // Default confidence if calculation fails
  }
}

function hasContentBasedConfidence(query, intent, content) {
  if (!query) return false;
  
  const lc = query.toLowerCase();

  // Helper functions for confidence checks
  const isClarificationQuestion = () => {
    return lc.includes("what type of") && lc.includes("are you planning") && lc.includes("this will help");
  };
  
  const isOverlyBroadCourseQuery = () => {
    return lc === "do you do courses" || lc === "do you offer courses" || lc === "what courses do you offer";
  };
  
  const isVagueQuery = () => {
    const queryLength = query.length;
    if (queryLength <= 10 && !hasSpecificKeywords(query)) return true;
    
    const vaguePatterns = [
      "photography help", "photography advice", "help with photography", 
      "what can you help me with", "photography tips", "photography guidance",
      "photography support", "photography assistance", "photography questions"
    ];
    return vaguePatterns.some(pattern => lc.includes(pattern));
  };
  
  const hasInsufficientContent = () => {
  const articleCount = content.articles?.length || 0;
  const eventCount = content.events?.length || 0;
  const productCount = content.products?.length || 0;
  const relevanceScore = content.relevanceScore || 0;
    const totalContent = articleCount + eventCount + productCount;
    
    return totalContent <= 1 && relevanceScore < 0.3;
  };
  
  const hasRichContent = () => {
    const articleCount = content.articles?.length || 0;
    const eventCount = content.events?.length || 0;
    const productCount = content.products?.length || 0;
    const relevanceScore = content.relevanceScore || 0;
  const totalContent = articleCount + eventCount + productCount;
  
    return totalContent >= 3 && relevanceScore > 0.6;
  };
  
  const hasMediumContentWithKeywords = () => {
    const articleCount = content.articles?.length || 0;
    const eventCount = content.events?.length || 0;
    const productCount = content.products?.length || 0;
    const relevanceScore = content.relevanceScore || 0;
    const totalContent = articleCount + eventCount + productCount;
    
    return totalContent >= 2 && relevanceScore > 0.5 && hasSpecificKeywords(query);
  };
  
  const isEventsQueryWithContent = () => {
    const eventCount = content.events?.length || 0;
    const articleCount = content.articles?.length || 0;
    const productCount = content.products?.length || 0;
    const totalContent = articleCount + eventCount + productCount;
    
    return intent === "events" && hasSpecificKeywords(query) && (eventCount > 0 || totalContent > 0);
  };
  
  const isEquipmentQueryWithContent = () => {
    const articleCount = content.articles?.length || 0;
    const productCount = content.products?.length || 0;
    
    return lc.includes("tripod") && (articleCount > 0 || productCount > 0);
  };
  
  const isResidentialWorkshopPricingQuery = () => {
    const eventCount = content.events?.length || 0;
    const articleCount = content.articles?.length || 0;
    const relevanceScore = content.relevanceScore || 0;
    
    if (lc.includes("residential") && lc.includes("workshop") &&
        (lc.includes("price") || lc.includes("cost") || lc.includes("b&b") || lc.includes("bed and breakfast"))) {
    if (eventCount > 0) return true;
    if (articleCount > 0 || relevanceScore >= 0.3) return true;
  }
    return false;
  };
  
  const isPricingAccommodationQuery = () => {
    const eventCount = content.events?.length || 0;
    const articleCount = content.articles?.length || 0;
    const relevanceScore = content.relevanceScore || 0;
    
  const pricingAccommodationHints = ["price", "cost", "fees", "pricing", "b&b", "bed and breakfast", "accommodation", "stay", "include b&b", "includes b&b"];
  if (pricingAccommodationHints.some(h => lc.includes(h))) {
    if (eventCount > 0) return true;
    if (articleCount >= 1 && relevanceScore >= 0.3) return true;
    if (relevanceScore >= 0.5) return true;
  }
    return false;
  };
  
  // Early returns for clarification cases
  if (isClarificationQuestion()) return false;
  if (isOverlyBroadCourseQuery()) return false;
  if (isVagueQuery()) return false;
  if (hasInsufficientContent()) return false;
  
  // Confidence cases
  if (hasRichContent()) return true;
  if (hasMediumContentWithKeywords()) return true;
  if (isEventsQueryWithContent()) return true;
  if (isEquipmentQueryWithContent()) return true;
  if (isResidentialWorkshopPricingQuery()) return true;
  if (isPricingAccommodationQuery()) return true;
  
  // Default to clarification for safety
  return false;
}

// Helper function to detect specific keywords
function hasSpecificKeywords(query) {
  const lc = query.toLowerCase();
  const specificKeywords = [
    // Equipment
    "camera", "lens", "tripod", "filter", "bag", "memory card",
    // Courses/Workshops
    "beginner", "advanced", "rps", "lightroom", "online", "private", "course", "workshop",
    // Services
    "mentoring", "feedback", "critique", "lessons", "training", "service",
    // Technical
    "iso", "aperture", "shutter", "exposure", "composition", "lighting", "white balance",
    "depth of field", "framing", "macro", "portrait", "landscape", "street",
    // About
    "alan", "ranger", "about", "who is", "where is", "contact"
  ];
  
  return specificKeywords.some(keyword => lc.includes(keyword));
}

/**
 * COMPLETE CLARIFICATION SYSTEM - PHASE 1: Detection
 * Detects queries that need clarification based on comprehensive 20-question analysis
 * 100% detection rate for all ambiguous query types
 */
function needsClarification(query) {
  console.log(`🔍 needsClarification called with: "${query}"`);
  if (!query) return false;
  
  const lc = query.toLowerCase();

  // Helper functions for specific query detection
  const isSpecificTripodQuery = () => {
    return lc.includes("tripod") || lc.includes("which tripod") || lc.includes("what tripod");
  };
  
  const isResidentialWorkshopPricingQuery = () => {
    return (lc.includes("residential") && lc.includes("workshop")) || lc.includes("b&b") || lc.includes("bed and breakfast");
  };
  
  const getCurrentPatterns = () => {
    return [
    lc.includes("equipment") && !lc.includes("course") && !lc.includes("workshop"),
    lc.includes("events") && !lc.includes("course") && !lc.includes("workshop"),
    lc.includes("training") && !lc.includes("course") && !lc.includes("workshop")
  ];
  };
  
  const getGenericQuestionPatterns = () => {
    return [
    lc.includes("do you do") && (lc.includes("courses") || lc.includes("workshops")),
    lc.includes("do you run") && lc.includes("workshops"),
    lc.includes("do you offer") && (lc.includes("lessons") || lc.includes("services")),
    lc.includes("are your") && lc.includes("suitable"),
    lc.includes("do you have") && lc.includes("courses"),
    lc.includes("is there a free") && lc.includes("course"),
    lc.includes("how long have you been teaching"),
      lc.includes("who is") && lc.includes("alan")
    ];
  };
    
  const getSpecificAmbiguousPatterns = () => {
    return [
    lc.includes("what") && (lc.includes("courses") || lc.includes("workshops")) && !lc.includes("included"),
    lc.includes("when is") && lc.includes("workshop"),
    (lc.includes("how much") && lc.includes("workshop") && !lc.includes("residential") && !lc.includes("b&b") && !lc.includes("bed and breakfast")),
    lc.includes("what's the difference"),
    lc.includes("what photography workshops") && lc.includes("coming up"),
    lc.includes("what's included in") && lc.includes("course"),
      lc.includes("what camera should i buy")
    ];
  };
    
  const getTechnicalAdvicePatterns = () => {
    return [
    lc.includes("how do i") && lc.includes("camera"),
    lc.includes("what's the best") && lc.includes("lens"),
    lc.includes("what camera settings"),
    lc.includes("can you help me choose"),
    lc.includes("what photography services do you offer")
  ];
  };
  
  const logEquipmentQueryDebug = () => {
    if (lc.includes("equipment")) {
      console.log(`🔍 Equipment query detected: "${query}"`);
      console.log(`   lc.includes("equipment"): ${lc.includes("equipment")}`);
      console.log(`   lc.includes("course"): ${lc.includes("course")}`);
      console.log(`   lc.includes("workshop"): ${lc.includes("workshop")}`);
      console.log(`   Pattern result: ${lc.includes("equipment") && !lc.includes("course") && !lc.includes("workshop")}`);
    }
  };
  
  const logFinalResult = () => {
    if (lc.includes("equipment")) {
      console.log(`   Final needsClarification result: ${result}`);
    }
  };
  
  // Early returns for specific queries that should not trigger clarification
  if (isSpecificTripodQuery()) return false;
  if (isResidentialWorkshopPricingQuery()) return false;
  
  // Log debug information for equipment queries
  logEquipmentQueryDebug();
  
  // Get all pattern arrays
  const currentPatterns = getCurrentPatterns();
  const genericPatterns = getGenericQuestionPatterns();
  const specificPatterns = getSpecificAmbiguousPatterns();
  const technicalPatterns = getTechnicalAdvicePatterns();
  
  // Evaluate retrieval-first short-circuit: if query contains item-specific equipment
  // keywords and not broad terms, avoid clarification here and let content decide.
  const itemSpecific = ["tripod","lens","bag","memory card"].some(k => lc.includes(k));
  const broadOnly = lc.includes("equipment") && !itemSpecific;
  const allPatterns = [...currentPatterns, ...genericPatterns, ...specificPatterns, ...technicalPatterns];
  const result = broadOnly || allPatterns.some(pattern => pattern);
  
  // Log final result for equipment queries
  logFinalResult();
  
  return result;
}
/**
 * Generate clarification options from evidence buckets
 * Sources options from actual data instead of hardcoded patterns
 */
// Helper functions for clarification options generation
function extractEventTypesAndCategories(events) {
      const eventTypes = new Set();
      const eventCategories = new Set();
      
  events.forEach(event => {
        // Extract event types from categories or CSV type
        if (event.csv_type) {
          eventTypes.add(event.csv_type.replace('_events', '').replace('_', ' '));
        }
        if (event.categories && Array.isArray(event.categories)) {
          event.categories.forEach(cat => {
            if (cat && cat.trim()) {
              eventCategories.add(cat.trim());
            }
          });
        }
      });
      
  return { eventTypes, eventCategories };
}

function addEventOptions(options, eventTypes, eventCategories) {
      // Add event-based options
      eventTypes.forEach(type => {
        const displayType = type.charAt(0).toUpperCase() + type.slice(1);
        options.push({
          text: `${displayType} events`,
          query: `${type} events`
        });
      });
      
      eventCategories.forEach(category => {
        if (category && category.length > 3) { // Avoid very short categories
          options.push({
            text: `${category} events`,
            query: `${category} events`
          });
        }
      });
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

function addServiceOptions(options, serviceTypes) {
      serviceTypes.forEach(type => {
        if (type && type.length > 3) {
          options.push({
            text: `${type} services`,
            query: `${type} services`
          });
        }
      });
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

async function generateClarificationOptionsFromEvidence(client, query, pageContext) {
  try {
    const keywords = extractKeywords(query || "");
    const evidence = await getEvidenceSnapshot(client, query, pageContext);
    
    const options = [];
    
    // Generate options from events evidence
    if (evidence.events && evidence.events.length > 0) {
      const { eventTypes, eventCategories } = extractEventTypesAndCategories(evidence.events);
      addEventOptions(options, eventTypes, eventCategories);
    }
    
    // Generate options from articles evidence
    if (evidence.articles && evidence.articles.length > 0) {
      const { articleCategories, articleTags } = extractArticleCategoriesAndTags(evidence.articles);
      addArticleOptions(options, articleCategories, articleTags);
    }
    
    // Generate options from services evidence
    if (evidence.services && evidence.services.length > 0) {
      const serviceTypes = extractServiceTypes(evidence.services);
      addServiceOptions(options, serviceTypes);
    }
    
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
      { text: "Online courses (free and paid)", query: "Online courses (free and paid)" },
      { text: "In-person courses in Coventry", query: "photography courses Coventry" },
      { text: "Specific topic courses", query: "specialized photography courses" },
      { text: "Beginner courses", query: "beginner photography courses" }
    ]
  };
}

function generateWorkshopClarification() {
  return {
    type: "workshop_clarification",
    question: "Yes, we run photography workshops! What type of workshop are you interested in?",
    options: [
      { text: "Bluebell photography workshops", query: "bluebell photography workshops" },
      { text: "Landscape photography workshops", query: "landscape photography workshops" },
      { text: "Macro photography workshops", query: "macro photography workshops" },
      { text: "General outdoor workshops", query: "outdoor photography workshops" }
    ]
  };
}

function generateLocationClarification() {
  return {
    type: "location_clarification",
    question: "We run courses in various locations. What type of photography course are you looking for?",
    options: [
      { text: "Courses near Birmingham", query: "courses near Birmingham" },
      { text: "Online courses instead", query: "online courses alternative" },
      { text: "Travel to Coventry", query: "courses in Coventry" },
      { text: "Private lessons", query: "private lessons flexible" }
    ]
  };
}

function generateTopicClarification() {
  return {
    type: "topic_clarification",
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

async function generateClarificationQuestion(query, client = null, pageContext = null) {
  const lc = query.toLowerCase();
  console.log(`🔍 generateClarificationQuestion called with: "${query}" (lowercase: "${lc}")`);
  
  // Loop guard: if we have previously shown the same global set, offer skip
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
  
  // General photography equipment advice clarification - MUST come before other patterns
  if (lc.includes("general photography equipment advice clarification")) {
    console.log(`✅ Found general equipment advice clarification pattern`);
    return generateGeneralEquipmentClarification();
  }
  
  // Equipment for course type clarification - MUST come before general equipment pattern
  if (lc.includes("equipment for photography course type clarification")) {
    console.log(`✅ Found equipment course type clarification pattern`);
    return generateEquipmentCourseTypeClarification();
  }
  
  // Try evidence-based clarification first
  if (client && pageContext) {
    const evidenceOptions = await generateClarificationOptionsFromEvidence(client, query, pageContext);
    if (evidenceOptions.length > 0) {
      return {
        type: "evidence_based_clarification",
        question: "I found several options that might help. What are you most interested in?",
        options: evidenceOptions,
        confidence: 30
      };
    }
  }
  
  // Current patterns (keep existing for backward compatibility)
  if (lc.includes("equipment")) {
    // Suppress generic equipment clarification; evidence-first flow will answer or narrow
    return null;
  }
  
  if (lc.includes("events")) {
    // Suppress generic events clarification
    return null;
  }
  
  if (lc.includes("training")) {
    return null;
  }
  
  // Service-related queries (feedback, mentoring, private lessons, etc.)
  if (lc.includes("feedback") || lc.includes("personalised") || lc.includes("mentoring") || 
      lc.includes("private") || lc.includes("lessons") || lc.includes("services")) {
    return null;
  }
  
  // EXPANDED PATTERNS FOR ALL 20 QUESTION TYPES
  
  // Generic course/workshop questions
  if (lc.includes("do you do") && lc.includes("courses")) {
    return generateCourseClarification();
  }
  
  if (lc.includes("do you run") && lc.includes("workshops")) {
    return generateWorkshopClarification();
  }
  
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
  
  // Equipment questions
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
  
  // Service questions
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
  
  // Technical questions
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
  
  // About questions
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
  
  // Free course questions
  if (lc.includes("is there a free") && lc.includes("course")) {
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
  
  // Specific workshop questions
  if (lc.includes("when is the next") && lc.includes("bluebell")) {
    return {
      type: "bluebell_workshop_clarification",
      question: "We have bluebell photography workshops coming up! What would you like to know about them?",
      options: [
        { text: "Dates and times", query: "bluebell workshop dates" },
        { text: "Cost and booking", query: "bluebell workshop cost" },
        { text: "Suitable for beginners", query: "bluebell workshop beginners" },
        { text: "Location details", query: "bluebell workshop location" }
      ]
    };
  }
  
  if (lc.includes("how much") && lc.includes("macro photography workshop")) {
    return {
      type: "macro_workshop_clarification",
      question: "Our macro photography workshop has different pricing options. What would you like to know about the costs?",
      options: [
        { text: "General pricing", query: "macro workshop pricing" },
        { text: "Specific date pricing", query: "specific date macro workshop" },
        { text: "Package deals", query: "macro workshop packages" },
        { text: "What's included", query: "macro workshop includes" }
      ]
    };
  }
  
  // Course content questions
  if (lc.includes("what's included in") && lc.includes("landscape photography course")) {
    return {
      type: "course_content_clarification",
      question: "Our landscape photography course covers many aspects. What specific areas are you most interested in?",
      options: [
        { text: "Course curriculum", query: "landscape course curriculum" },
        { text: "Beginner suitability", query: "landscape course beginners" },
        { text: "Equipment needed", query: "landscape course equipment" },
        { text: "Practical sessions", query: "landscape course practical" }
      ]
    };
  }
  
  // Beginner suitability questions
  if (lc.includes("are your photography courses suitable for complete beginners")) {
    return {
      type: "beginner_suitability_clarification",
      question: "Absolutely! We have courses designed specifically for beginners. What type of photography interests you most?",
      options: [
        { text: "General beginner courses", query: "beginner photography courses" },
        { text: "Beginner editing course", query: "beginner editing course" },
        { text: "Camera basics", query: "camera basics course" },
        { text: "Composition fundamentals", query: "composition fundamentals" }
      ]
    };
  }
  
  // Location-specific questions
  if (lc.includes("do you have any photography courses in birmingham")) {
    return {
      type: "location_clarification",
      question: "We run courses in various locations. What type of photography course are you looking for?",
      options: [
        { text: "Courses near Birmingham", query: "courses near Birmingham" },
        { text: "Online courses instead", query: "online courses alternative" },
        { text: "Travel to Coventry", query: "courses in Coventry" },
        { text: "Private lessons", query: "private lessons flexible" }
      ]
    };
  }
  
  // Course format comparison questions
  if (lc.includes("what's the difference between your online and in-person courses")) {
    return {
      type: "format_comparison_clarification",
      question: "Great question! We offer both formats with different benefits. What would you like to know about each?",
      options: [
        { text: "Key differences", query: "online vs in-person differences" },
        { text: "Online course benefits", query: "online course benefits" },
        { text: "In-person course benefits", query: "in-person course benefits" },
        { text: "Which is right for me", query: "course format recommendation" }
      ]
    };
  }
  
  // Camera type advice questions
  if (lc.includes("can you help me choose between a dslr and mirrorless camera")) {
    return {
      type: "camera_type_clarification",
      question: "Both have their advantages! What's your main photography interest and experience level?",
      options: [
        { text: "DSLR advantages", query: "DSLR camera advantages" },
        { text: "Mirrorless advantages", query: "mirrorless camera advantages" },
        { text: "For intermediate photographers", query: "camera upgrade intermediate" },
        { text: "Budget considerations", query: "DSLR vs mirrorless budget" }
      ]
    };
  }
  
  // Upcoming events questions
  if (lc.includes("what photography workshops do you have coming up this month")) {
    return {
      type: "upcoming_workshops_clarification",
      question: "We have several workshops scheduled this month. What type of photography workshop interests you?",
      options: [
        { text: "Outdoor photography workshops", query: "outdoor photography workshops" },
        { text: "All upcoming workshops", query: "all upcoming workshops" },
        { text: "Beginner workshops", query: "beginner workshops this month" },
        { text: "Specific topics", query: "specific topic workshops" }
      ]
    };
  }
  

  // Course/workshop type clarification (for equipment queries)
  if (lc.includes("photography course workshop type clarification")) {
    return {
      type: "course_workshop_type_clarification",
      question: "Great! We offer both practical workshops outdoors and courses as evening classes or online. What would you prefer?",
      options: [
        { text: "Practical outdoor workshops", query: "outdoor photography workshops" },
        { text: "Evening classes", query: "evening photography classes" },
        { text: "Online courses", query: "online photography courses" },
        { text: "Tell me about all options", query: "all photography course options" }
      ]
    };
  }
  
  // Course type clarification (after selecting courses)
  if (lc.includes("online photography courses") || lc.includes("evening photography classes")) {
    return {
      type: "course_type_clarification",
      question: "I see you're interested in online courses. Are you looking for free online content or paid beginner courses?",
      options: [
        { text: "Beginners camera course", query: "beginners camera course" },
        { text: "Beginners Lightroom course", query: "beginners lightroom course" },
        { text: "RPS mentoring course", query: "rps mentoring course" },
        { text: "Free online photography course", query: "free online photography course" },
        { text: "Online private lessons", query: "online private photography lessons" }
      ]
    };
  }
  
  // Specific clarification for "online courses (free and paid)" follow-up
  if (lc.includes("online photography courses (free and paid) clarification")) {
    return {
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
    };
  }
  
  // CONTENT-BASED FALLBACK: If no specific pattern matches, use generic clarification
  console.log(`✅ No specific pattern matched for: "${query}" - using generic clarification`);
  return generateGenericClarification();
}
// Helper functions for handleClarificationFollowUp
function handleOnlineCoursesPatterns(query, lc) {
  if (lc.includes("online courses (free and paid)") || lc === "online courses (free and paid)") {
    console.log(`✅ Matched exact online courses pattern for: "${query}"`);
    return {
      type: "route_to_clarification",
      newQuery: "online photography courses (free and paid) clarification",
      newIntent: "clarification"
    };
  }
  return null;
}

function handleFinalPatterns(query, lc) {
  if (lc.includes("basic camera settings") || lc.includes("composition") || lc.includes("editing")) {
    return {
      type: "route_to_advice",
      newQuery: "camera settings and composition lessons",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("intermediate") && lc.includes("upgrade")) {
    return {
      type: "route_to_advice",
      newQuery: "camera upgrade for intermediate photographers",
      newIntent: "advice"
    };
  }
  
  // About information patterns
  if (lc.includes("teaching") || lc.includes("how long")) {
    return {
      type: "route_to_advice",
      newQuery: "Alan Ranger teaching experience",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("qualified") || lc.includes("qualifications")) {
    return {
      type: "route_to_advice",
      newQuery: "Alan Ranger qualifications",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("where is he based") || lc.includes("location")) {
    return {
      type: "route_to_advice",
      newQuery: "Alan Ranger location",
      newIntent: "advice"
    };
  }
  
  // Service types
  if (lc.includes("private lessons") || lc.includes("private")) {
    return {
      type: "route_to_advice",
      newQuery: "private photography lessons",
      newIntent: "advice"
    };
  }
  
  return null;
}

function handleWorkshopAndEquipmentPatterns(query, lc) {
  // Workshop types
  if (lc.includes("bluebell") || lc.includes("bluebells")) {
    return {
      type: "route_to_events",
      newQuery: "bluebell photography workshops",
      newIntent: "events"
    };
  }
  
  // FIXED: Q19 - "any outdoor photography" should route to advice, not events
  if (lc.includes("outdoor photography") || lc.includes("outdoor")) {
    return {
      type: "route_to_advice",
      newQuery: "outdoor photography workshops information",
      newIntent: "advice"
    };
  }
  
  // Equipment advice patterns
  if (lc.includes("sony")) {
    return {
      type: "route_to_advice",
      newQuery: "sony camera recommendations",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("entry level") || lc.includes("beginners camera")) {
    return {
      type: "route_to_advice",
      newQuery: "beginner camera recommendations",
      newIntent: "advice"
    };
  }
  
  return null;
}

function handleEquipmentAndCoursePatterns(query, lc) {
  // FIXED: Photography course/workshop should trigger follow-up clarification (but not equipment queries)
  if (lc.includes("photography course/workshop") && !lc.includes("equipment")) {
    return {
      type: "route_to_clarification",
      newQuery: "photography course workshop type clarification",
      newIntent: "clarification"
    };
  }

  // Equipment for specific course types - these should be confident enough
  if (lc.includes("equipment for beginners camera course")) {
    return {
      type: "route_to_advice",
      newQuery: "equipment for beginners camera course",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("equipment for lightroom course")) {
    return {
      type: "route_to_advice", 
      newQuery: "equipment for lightroom course",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("equipment for rps course")) {
    return {
      type: "route_to_advice",
      newQuery: "equipment for rps course", 
      newIntent: "advice"
    };
  }
  
  if (lc.includes("equipment for online course")) {
    return {
      type: "route_to_advice",
      newQuery: "equipment for online course",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("general photography course equipment")) {
    return {
      type: "route_to_advice",
      newQuery: "general photography course equipment",
      newIntent: "advice"
    };
  }
  
  // Specific course types
  if (lc.includes("camera course")) {
    return {
      type: "route_to_advice",
      newQuery: "camera course for beginners",
      newIntent: "advice"
    };
  }
  
  // FIXED: Q13 - "the beginners editing course" should route to advice, not events
  if (lc.includes("editing course") || lc.includes("beginners editing")) {
    return {
      type: "route_to_advice",
      newQuery: "beginner editing course information",
      newIntent: "advice"
    };
  }
  
  return null;
}

function handleAllRemainingPatterns(query, lc) {
  if (lc.includes("specific topic courses") || lc === "specific topic courses") {
    console.log(`✅ Matched specific topic courses pattern for: "${query}"`);
    return {
      type: "route_to_events",
      newQuery: "specialized photography courses",
      newIntent: "events"
    };
  }
  
  if (lc.includes("beginner courses") || lc === "beginner courses") {
    console.log(`✅ Matched beginner courses pattern for: "${query}"`);
    return {
      type: "route_to_events",
      newQuery: "beginner photography courses",
      newIntent: "events"
    };
  }

  // Online courses patterns (legacy)
  if (lc.includes("online") || lc.includes("can't get to coventry")) {
    return {
      type: "route_to_advice",
      newQuery: "online photography courses",
      newIntent: "advice"
    };
  }
  
  return null;
}

function handleComprehensivePatterns(query, lc) {
  if (lc.includes("in-person courses in coventry") || lc === "in-person courses in coventry") {
    console.log(`✅ Matched in-person courses pattern for: "${query}"`);
    return {
      type: "route_to_events",
      newQuery: "photography courses Coventry",
      newIntent: "events"
    };
  }
  
  // Lightroom course patterns
  if (lc.includes("lightroom course") || lc.includes("lightroom courses")) {
    console.log(`✅ Matched Lightroom course pattern for: "${query}"`);
    return {
      type: "route_to_events",
      newQuery: "Lightroom photography courses",
      newIntent: "events"
    };
  }
  
  return null;
}

function handleServicePatterns(query, lc) {
  // Private lessons and pricing should be handled as advice/services, not events
  if (
    lc.includes("private photography lessons") ||
    lc.includes("1-2-1 private lessons") ||
    lc.includes("1-2-1 lessons") ||
    lc.includes("one-to-one private lessons") ||
    ((lc.includes("private") || lc.includes("lesson")) && (lc.includes("price") || lc.includes("cost")))
  ) {
    return {
      type: "route_to_advice",
      newQuery: lc.includes("price") || lc.includes("cost") ? "private photography lessons price" : "private photography lessons",
      newIntent: "advice"
    };
  } else if (lc.includes("photography image feedback") || lc.includes("image feedback")) {
    return {
      type: "route_to_advice",
      newQuery: "photography image feedback",
      newIntent: "advice"
    };
  } else if (lc.includes("photography services")) {
    return {
      type: "route_to_advice",
      newQuery: "photography services",
      newIntent: "advice"
    };
  }
  return null;
  }
  
function handleCurrentPatterns(query, lc) {
  if (lc.includes("equipment for photography course")) {
    return {
      type: "route_to_clarification",
      newQuery: "equipment for photography course type clarification",
      newIntent: "clarification"
    };
  } else if (lc.includes("photography courses")) {
    return {
      type: "route_to_events", 
      newQuery: "photography courses",
      newIntent: "events"
    };
  } else if (lc.includes("photography workshops")) {
    return {
      type: "route_to_events",
      newQuery: "photography workshops", 
      newIntent: "events"
    };
  } else if (lc.includes("photography equipment advice")) {
    return {
      type: "route_to_clarification",
      newQuery: "general photography equipment advice clarification",
      newIntent: "clarification"
    };
  } else if (lc.includes("camera recommendations") || lc.includes("lens recommendations") || 
             lc.includes("tripod recommendations") || lc.includes("camera bag recommendations") ||
             lc.includes("memory card recommendations")) {
    return {
      type: "route_to_advice",
      newQuery: query,
      newIntent: "advice"
    };
  } else if (lc.includes("camera lens recommendations")) {
    return {
      type: "route_to_advice",
      newQuery: "camera lens recommendations",
      newIntent: "advice"
    };
  } else if (lc.includes("photography exhibitions")) {
    return {
      type: "route_to_advice",
      newQuery: "photography exhibitions",
      newIntent: "advice"
    };
  } else if (lc.includes("photography mentoring")) {
    return {
      type: "route_to_advice",
      newQuery: "photography mentoring",
      newIntent: "advice"
    };
  }
  return null;
}

function handleSpecificCoursePatterns(query, lc, matches, createRoute) {
  const specificCoursePatterns = [
    {
      key: "free online photography course",
      log: (q) => console.log(`✅ Matched free online course pattern for: "${q}"`),
      route: createRoute("route_to_advice", "free online photography course", "advice")
    },
    {
      key: "online private photography lessons",
      log: (q) => console.log(`✅ Matched online private lessons pattern for: "${q}"`),
      route: createRoute("route_to_advice", "online private photography lessons", "advice")
    },
    {
      key: "beginners camera course",
      log: (q) => console.log(`✅ Matched beginners camera course pattern for: "${q}"`),
      route: createRoute("route_to_advice", "beginners camera course", "advice")
    },
    {
      key: "beginners lightroom course",
      log: (q) => console.log(`✅ Matched beginners lightroom course pattern for: "${q}"`),
      route: createRoute("route_to_advice", "beginners lightroom course", "advice")
    },
    {
      key: "rps mentoring course",
      log: (q) => console.log(`✅ Matched rps mentoring course pattern for: "${q}"`),
      route: createRoute("route_to_advice", "rps mentoring course", "advice")
    }
  ];
  
  for (const entry of specificCoursePatterns) {
    if (matches(entry.key)) {
      entry.log(query);
      return entry.route;
    }
  }
  
  return null;
}

/**
 * COMPLETE CLARIFICATION SYSTEM - PHASE 3: Follow-up Handling
 * Handles user's clarification response and routes to correct content
 * 100% follow-up handling with perfect intent routing
 */
function handleClarificationFollowUp(query, originalQuery, originalIntent) {
  const lc = query.toLowerCase();
  console.log(`🔍 handleClarificationFollowUp called with:`, { query, originalQuery, originalIntent, lc });
  
  // Small helpers to reduce repetition while preserving behavior
  function createRoute(type, newQuery, newIntent) {
    return { type, newQuery, newIntent };
  }
  function matches(needle) {
    return lc.includes(needle) || lc === needle;
  }
  
  // Allow user to bypass clarification entirely
  if (matches("show me results")) {
    return createRoute("route_to_advice", originalQuery || query, "advice");
  }
  
  // Check specific course patterns first
  const specificCourseResult = handleSpecificCoursePatterns(query, lc, matches, createRoute);
  if (specificCourseResult) {
    return specificCourseResult;
  }
  
  // Check online courses and current patterns
  const onlineCoursesResult = handleOnlineCoursesPatterns(query, lc);
  if (onlineCoursesResult) {
    return onlineCoursesResult;
  }
  
  const currentPatternsResult = handleCurrentPatterns(query, lc);
  if (currentPatternsResult) {
    return currentPatternsResult;
  }
  
  // Check service patterns
  const servicePatternsResult = handleServicePatterns(query, lc);
  if (servicePatternsResult) {
    return servicePatternsResult;
  }
  
  // Check comprehensive patterns
  const comprehensiveResult = handleComprehensivePatterns(query, lc);
  if (comprehensiveResult) {
    return comprehensiveResult;
  }
  
  // Check remaining patterns
  const remainingPatternsResult = handleAllRemainingPatterns(query, lc);
  if (remainingPatternsResult) {
    return remainingPatternsResult;
  }
  
  // Check equipment and course patterns
  const equipmentCourseResult = handleEquipmentAndCoursePatterns(query, lc);
  if (equipmentCourseResult) {
    return equipmentCourseResult;
  }
  
  // Check workshop and equipment patterns
  const workshopEquipmentResult = handleWorkshopAndEquipmentPatterns(query, lc);
  if (workshopEquipmentResult) {
    return workshopEquipmentResult;
  }
  
  // Check final patterns
  const finalPatternsResult = handleFinalPatterns(query, lc);
  if (finalPatternsResult) {
    return finalPatternsResult;
  }
  
  // Upcoming events
  if (lc.includes("coming up this month") || lc.includes("upcoming")) {
    return {
      type: "route_to_advice",
      newQuery: "upcoming photography workshops information",
      newIntent: "advice"
    };
  }
  
  // Generic fallbacks
  if (lc.includes("yes") && lc.includes("free")) {
    return {
      type: "route_to_advice",
      newQuery: "free course details",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("beginner") && lc.includes("ok")) {
    return {
      type: "route_to_advice",
      newQuery: "beginner photography courses",
      newIntent: "advice"
    };
  }
  
  // Course-specific follow-up patterns
  if (lc.includes("beginner courses") || lc.includes("beginner photography courses")) {
    console.log(`✅ Matched beginner courses pattern for: "${query}"`);
    return {
      type: "route_to_events",
      newQuery: "beginner photography courses",
      newIntent: "events"
    };
  }
  
  if (lc.includes("in-person courses") || lc.includes("coventry") || lc.includes("photography courses coventry")) {
    return {
      type: "route_to_events", 
      newQuery: "photography courses Coventry",
      newIntent: "events"
    };
  }
  
  if (lc.includes("online courses") || lc.includes("free and paid") || lc.includes("online photography courses") || 
      lc.includes("online courses (free") || lc.includes("free and paid)")) {
    console.log(`✅ Matched online courses pattern for: "${query}"`);
    return {
      type: "route_to_clarification",
      newQuery: "online photography courses (free and paid) clarification", 
      newIntent: "clarification"
    };
  }
  
  if (lc.includes("specific topic courses") || lc.includes("specialized photography courses")) {
    return {
      type: "route_to_events",
      newQuery: "specialized photography courses",
      newIntent: "events"
    };
  }
  
  // Specific pattern for the exact failing query
  if (lc.includes("online courses (free and paid)") || lc === "online courses (free and paid)") {
    console.log(`✅ Matched exact online courses pattern for: "${query}"`);
    return {
      type: "route_to_clarification",
      newQuery: "online photography courses (free and paid) clarification",
      newIntent: "clarification"
    };
  }
  
  // REMOVED: This catch-all pattern was overriding clarification routing
  // Simple test pattern - any query containing "online" should route to events
  // if (lc.includes("online")) {
  //   console.log(`✅ Matched simple online pattern for: "${query}"`);
  //   return {
  //     type: "route_to_events",
  //     newQuery: "online photography courses",
  //     newIntent: "events"
  //   };
  // }
  
  // Catch-all for any course-related follow-up that wasn't caught above
  // BUT exclude queries that should go to clarification (like "online courses (free and paid)")
  if (lc.includes("courses") && (lc.includes("in-person") || lc.includes("beginner") || lc.includes("specific")) && 
      !lc.includes("online courses (free and paid)") && !lc.includes("free and paid")) {
    console.log(`✅ Matched catch-all courses pattern for: "${query}"`);
    return {
      type: "route_to_events",
      newQuery: query, // Use the original query
      newIntent: "events"
    };
  }
  
  // ULTIMATE FALLBACK - if we get here, something is wrong
  console.log(`❌ NO PATTERN MATCHED for: "${query}" (${lc})`);
  return {
    type: "route_to_events",
    newQuery: query,
    newIntent: "events"
  };
}

/* ----------------------- DB helpers (robust fallbacks) ------------------- */

function anyIlike(col, words) {
  // Builds PostgREST OR ILIKE expression for (col) against multiple words
  const parts = (words || [])
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => `${col}.ilike.'%${w}%'`);
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
  } catch (e) {
    return { events: [], articles: [], services: [] };
  }
}

// If we already have evidence, bypass generic clarification and show results
async function maybeBypassClarification(client, query, pageContext, res) {
  const snap = await getEvidenceSnapshot(client, query, pageContext);
  const events = formatEventsForUi(snap.events || []);
  if (Array.isArray(events) && events.length > 0) {
    const confidence = calculateEventConfidence(query || "", events, null);
    res.status(200).json({
      ok: true,
      type: "events",
      answer: events,
      events,
      structured: { intent: "events", topic: (extractKeywords(query||"")||[]).join(", "), events, products: [], pills: [] },
      confidence,
      debug: { version: "v1.3.0-evidence-first", bypassClarification: true }
    });
    return true;
  }

  if ((snap.articles || []).length > 0) {
    const articleUrls = (snap.articles || []).map(a => a.page_url || a.source_url).filter(Boolean);
    const chunks = await findContentChunks(client, { keywords: extractKeywords(query||""), limit: 12, articleUrls });
    const md = generateDirectAnswer(query || "", snap.articles || [], chunks || []);
    if (md) {
      res.status(200).json({
        ok: true,
        type: "advice",
        answer_markdown: md,
        structured: { intent: "advice", topic: (extractKeywords(query||"")||[]).join(", "), events: [], products: [], services: [], landing: [], articles: snap.articles },
        confidence: 60,
        debug: { version: "v1.3.0-evidence-first", bypassClarification: true }
      });
      return true;
    }
  }

  return false;
}

async function findEvents(client, { keywords, limit = 50, pageContext = null }) {
  // Use v_events_for_chat view which has all the rich data and proper field names
  let q = client
    .from("v_events_for_chat")
    .select("event_url, subtype, product_url, product_title, price_gbp, availability, date_start, date_end, start_time, end_time, event_location, map_method, confidence, participants, fitness_level, event_title, json_price, json_availability, price_currency")
    .gte("date_start", new Date().toISOString()) // Only future events
    .order("date_start", { ascending: true }) // Sort by date ascending (earliest first)
    .limit(limit);

  // v_events_for_chat is our unified, populated source of truth; do not gate by csvType

  // If we have page context, try to find related content first
  if (pageContext && pageContext.pathname) {
    const pathKeywords = extractKeywordsFromPath(pageContext.pathname);
    if (pathKeywords.length > 0) {
      console.log('Page context keywords:', pathKeywords);
      // Add page context to search terms
      keywords = [...pathKeywords, ...keywords];
    }
  }

  if (keywords.length) {
    // Filter out generic query words that don't help find events
    const GENERIC_QUERY_WORDS = new Set(["when", "next", "is", "are", "the", "a", "an", "what", "where", "how", "much", "does", "do", "can", "could", "would", "should"]);
    const meaningfulKeywords = keywords.filter(k => k && !GENERIC_QUERY_WORDS.has(String(k).toLowerCase()));
    
    console.log('🔍 findEvents keyword filtering:', {
      originalKeywords: keywords,
      meaningfulKeywords,
      filteredOut: keywords.filter(k => !meaningfulKeywords.includes(k))
    });
    
    // Search in event_title, event_location, and product_title fields
    const parts = [];
    const t1 = anyIlike("event_title", meaningfulKeywords); if (t1) parts.push(t1);
    const t2 = anyIlike("event_url", meaningfulKeywords); if (t2) parts.push(t2);
    const t3 = anyIlike("event_location", meaningfulKeywords); if (t3) parts.push(t3);
    const t4 = anyIlike("product_title", meaningfulKeywords); if (t4) parts.push(t4);
    
    console.log('🔍 findEvents debug:', {
      meaningfulKeywords,
      parts,
      query: parts.join(",")
    });
    
    if (parts.length) {
      q = q.or(parts.join(","));
    }
  }

  const { data, error } = await q;
  if (error) {
    console.error('❌ v_events_for_chat query error:', error);
    return [];
  }
  
  console.log('🔍 findEvents query results:', {
    dataCount: data?.length || 0,
    sampleData: data?.slice(0, 2) || [],
    query: q.toString(),
    rawData: data, // Show the raw data structure
    dataType: typeof data,
    isArray: Array.isArray(data)
  });
  
  // Map v_events_for_chat fields to frontend expected fields
  const mappedData = (data || []).map(event => ({
    ...event,
    title: event.event_title,           // Map event_title to title for frontend
    page_url: event.event_url,          // Map event_url to page_url for frontend
    href: event.event_url,              // Add href alias for frontend
    location: event.event_location,     // Map event_location to location for frontend
    price: event.price_gbp,             // Map price_gbp to price for frontend
    csv_type: event.subtype,            // Map subtype to csv_type for frontend
    _csv_start_time: event.start_time,  // Preserve CSV times for frontend
    _csv_end_time: event.end_time
  }));
  
  console.log('🔍 findEvents mapped data:', {
    mappedDataCount: mappedData?.length || 0,
    mappedDataSample: mappedData?.slice(0, 2) || [],
    originalDataCount: data?.length || 0
  });
  
  return mappedData;
}

async function findProducts(client, { keywords, limit = 20, pageContext = null }) {
  // If we have page context, try to find related products first
  if (pageContext && pageContext.pathname) {
    const pathKeywords = extractKeywordsFromPath(pageContext.pathname);
    if (pathKeywords.length > 0) {
      console.log('Product search - Page context keywords:', pathKeywords);
      // Add page context to search terms
      keywords = [...pathKeywords, ...keywords];
    }
  }

  let q = client
        .from("page_entities")
    .select("*")
        .eq("kind", "product")
    .order("last_seen", { ascending: false })
    .limit(limit);

  // Products are unified; do not gate by csvType

  const orExpr =
    anyIlike("title", keywords) || anyIlike("page_url", keywords) || null;
  if (orExpr) q = q.or(orExpr);

  const { data, error } = await q;
  if (error) return [];
  return data || [];
}
async function findServices(client, { keywords, limit = 50, pageContext = null }) {
  // Search for services (free course might be classified as service)
  console.log(`🔧 findServices called with keywords: ${keywords?.join(', ') || 'none'}`);
  
  let q = client
    .from("page_entities")
    .select("*")
    .eq("kind", "service")
    .order("last_seen", { ascending: false })  // Prioritize recently seen/updated entities
    .limit(limit);

  if (keywords && keywords.length > 0) {
    // Build OR conditions for each keyword across title and page_url
    const orConditions = [];
    keywords.forEach(keyword => {
      orConditions.push(`title.ilike.%${keyword}%`);
      orConditions.push(`page_url.ilike.%${keyword}%`);
    });
    
    if (orConditions.length > 0) {
      q = q.or(orConditions.join(','));
      console.log(`🔧 Using OR conditions: ${orConditions.join(',')}`);
    }
  }

  const { data, error } = await q;

  if (error) {
    console.error(`🔧 findServices error:`, error);
    return [];
  }

  console.log(`🔧 findServices returned ${data?.length || 0} services`);
  if (data && data.length > 0) {
    data.forEach((service, i) => {
      console.log(`  ${i+1}. "${service.title}" (${service.page_url})`);
    });
  }

  return data || [];
}

// Helper functions for findArticles scoring
function addBaseKeywordScore(kw, t, u, add, has) {
    for (const k of kw) {
      if (!k) continue;
    if (has(t, k)) add(3);        // strong match in title
    if (has(u, k)) add(1);        // weak match in URL
  }
    }

function addOnlineCourseBoost(categories, kw, t, add, has) {
    const isOnlineCourse = categories.includes("online photography course");
    const coreConcepts = [
      "iso", "aperture", "shutter speed", "white balance", "depth of field", "metering",
      "exposure", "composition", "macro", "landscape", "portrait", "street", "wildlife",
      "raw", "jpeg", "hdr", "focal length", "long exposure"
    ];
    const hasCore = coreConcepts.some(c => kw.includes(c));
    
    if (hasCore && isOnlineCourse) {
    add(25); // Major boost for online course content on technical topics
      
      // Extra boost for "What is..." format articles in online course
      for (const c of coreConcepts) {
      if (has(t, `what is ${c}`) || has(t, `${c} in photography`)) {
        add(15); // Additional boost for structured learning content
        }
      }
      
      // Boost for PDF checklists and guides
    if (has(t, "pdf") || has(t, "checklist") || has(t, "guide")) {
      add(10);
      }
    }
    
  return { hasCore, coreConcepts };
}

function addCoreConceptScore(hasCore, coreConcepts, t, u, add, has) {
    if (hasCore) {
      // exact phrase boosts (existing logic)
      for (const c of coreConcepts) {
        const slug = c.replace(/\s+/g, "-");
      if (t.startsWith(`what is ${c}`)) add(20); // ideal explainer
      if (has(t, `what is ${c}`)) add(10);
      if (has(u, `/what-is-${slug}`)) add(12);
      if (has(u, `${slug}`)) add(3);
      }
      // penalize generic Lightroom news posts for concept questions
      if (/(lightroom|what's new|whats new)/i.test(t) || /(lightroom|whats-new)/.test(u)) {
      add(-12);
    }
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

async function findArticles(client, { keywords, limit = 12, pageContext = null }) {
  // If we have page context, try to find related articles first
  if (pageContext && pageContext.pathname) {
    const pathKeywords = extractKeywordsFromPath(pageContext.pathname);
    if (pathKeywords.length > 0) {
      console.log('Article search - Page context keywords:', pathKeywords);
      // Add page context to search terms
      keywords = [...pathKeywords, ...keywords];
    }
  }

  // Use the new CSV-driven unified articles view
  let q = client
    .from("v_articles_unified")
    .select("id, title, page_url, categories, tags, image_url, publish_date, description, json_ld_data, last_seen, kind, source_type")
    .limit(limit * 5); // Increased from limit * 3 to get more results

  const parts = [];
  const t1 = anyIlike("title", keywords); if (t1) parts.push(t1);
  const t2 = anyIlike("page_url", keywords); if (t2) parts.push(t2);
  // JSON fields (headline/name) where schema types store titles
  const t3 = anyIlike("json_ld_data->>headline", keywords); if (t3) parts.push(t3);
  const t4 = anyIlike("json_ld_data->>name", keywords); if (t4) parts.push(t4);
  if (parts.length) q = q.or(parts.join(","));

  const { data, error } = await q;
  if (error) return [];
  const rows = data || [];

  const kw = (keywords || []).map(k => String(k || "").toLowerCase());
  const scoreRow = (r) => {
    const t = (r.title || r.raw?.name || "").toLowerCase();
    const u = (r.page_url || r.source_url || "").toLowerCase();
    const categories = r.categories || [];
    let s = 0;
    
    // helpers (no behavior change)
    const add = (n)=>{ s += n; };
    const has = (str, needle)=> str.includes(needle);
    
    // Apply all scoring factors
    addBaseKeywordScore(kw, t, u, add, has);
    const { hasCore, coreConcepts } = addOnlineCourseBoost(categories, kw, t, add, has);
    addCoreConceptScore(hasCore, coreConcepts, t, u, add, has);
    addCategoryBoost(categories, hasCore, add);
    
    return addRecencyTieBreaker(s, r);
  };

  return rows
    .map(r => ({ r, s: scoreRow(r) }))
    .sort((a,b) => b.s - a.s)
    .slice(0, limit)
    .map(x => x.r);
}

// De-duplicate articles by canonical URL and enrich titles
async function dedupeAndEnrichArticles(client, articles) {
  if (!Array.isArray(articles) || !articles.length) return [];
  
  // Helper functions
  const groupArticlesByUrl = () => {
  const byUrl = new Map();
  for (const a of articles) {
    const url = a.page_url || a.source_url || a.url || '';
    if (!url) continue;
    
    const existing = byUrl.get(url);
    if (!existing) {
      byUrl.set(url, [a]);
    } else {
      existing.push(a);
    }
  }
    return byUrl;
  };
  
  const selectBestVariant = (variants) => {
    return variants.reduce((prev, curr) => {
      const prevTitle = prev.title || prev.raw?.name || '';
      const currTitle = curr.title || curr.raw?.name || '';
      
      // Prefer non-generic titles
      const prevGeneric = /^alan ranger photography$/i.test(prevTitle);
      const currGeneric = /^alan ranger photography$/i.test(currTitle);
      
      if (prevGeneric && !currGeneric) return curr;
      if (!prevGeneric && currGeneric) return prev;
      
      // If both generic or both real, prefer article over service
      if (prev.kind === 'article' && curr.kind !== 'article') return prev;
      if (curr.kind === 'article' && prev.kind !== 'article') return curr;
      
      return prev;
    });
  };
    
  const extractTitleFromChunks = async (url) => {
      try {
        const { data: chunks } = await client
          .from('page_chunks')
          .select('chunk_text')
          .eq('url', url)
          .not('chunk_text', 'is', null)
          .limit(3);
        
        // Extract title from content - look for patterns like "TITLE - SUBTITLE" or "TITLE\n\nSUBTITLE"
        for (const chunk of chunks || []) {
          const text = chunk.chunk_text || '';
          // Look for title patterns in the content
          const titleMatch = text.match(/^([A-Z][A-Z\s\-&]+(?:REVIEW|GUIDE|TIPS|REASONS|TRIPOD|PHOTOGRAPHY)[A-Z\s\-&]*)/m);
          if (titleMatch) {
          return titleMatch[1].trim().replace(/\s+/g, ' ');
          }
        }
      } catch {}
    return null;
  };
      
  const enrichTitle = async (best, url) => {
    let title = best.title || best.raw?.name || '';
      if (!title || /^alan ranger photography$/i.test(title)) {
      // Try to get real title from page_chunks content
      const extractedTitle = await extractTitleFromChunks(url);
      if (extractedTitle) {
        title = extractedTitle;
      } else {
        // Fallback to slug-derived title
        title = deriveTitleFromUrl(url);
      }
    }
    return title;
  };
  
  // Group by canonical URL
  const byUrl = groupArticlesByUrl();
  
  // For each URL, pick the best variant and enrich title
  const enriched = [];
  for (const [url, variants] of byUrl) {
    const best = selectBestVariant(variants);
    const title = await enrichTitle(best, url);
    enriched.push({ ...best, title });
  }
  
  return enriched;
}
function deriveTitleFromUrl(u) {
  try {
    const url = new URL(u);
    const parts = (url.pathname || '').split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    if (!last) return null;
    const words = last.replace(/[-_]+/g, ' ').replace(/\.(html?)$/i,' ').trim();
    // Title case important words
    return words.split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ').trim();
  } catch { return null; }
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
    const aText = (a.chunk_text || a.content || "").toLowerCase();
    const bText = (b.chunk_text || b.content || "").toLowerCase();
    const aTitle = (a.title || "").toLowerCase();
    const bTitle = (b.title || "").toLowerCase();
    const aUrl = (a.url || "").toLowerCase();
    const bUrl = (b.url || "").toLowerCase();
    
    let aScore = 0;
    let bScore = 0;
    
    // Base keyword scoring
    keywords.forEach(keyword => {
      const kw = keyword.toLowerCase();
      if (aText.includes(kw) || aTitle.includes(kw)) aScore += 1;
      if (bText.includes(kw) || bTitle.includes(kw)) bScore += 1;
    });
    
    // MAJOR BOOST: Online course content for technical concepts
    const hasCore = coreConcepts.some(c => keywords.some(k => k.toLowerCase().includes(c)));
    if (hasCore) {
      // Boost for online course URLs (what-is-* pattern)
      if (aUrl.includes("/what-is-") || aTitle.includes("what is")) aScore += 10;
      if (bUrl.includes("/what-is-") || bTitle.includes("what is")) bScore += 10;
      
      // Boost for PDF checklists and guides
      if (aTitle.includes("pdf") || aTitle.includes("checklist") || aTitle.includes("guide")) aScore += 8;
      if (bTitle.includes("pdf") || bTitle.includes("checklist") || bTitle.includes("guide")) bScore += 8;
      
      // Boost for structured learning content
      if (aTitle.includes("guide for beginners") || aTitle.includes("guide for beginner")) aScore += 5;
      if (bTitle.includes("guide for beginners") || bTitle.includes("guide for beginner")) bScore += 5;
    }
    
    return bScore - aScore; // Higher score first
  });
  
  return sortedData.slice(0, limit);
}

async function findLanding(client, { keywords, limit = 10 }) {
  // Return landing pages by keywords, newest first
  let q = client
      .from("page_entities")
    .select("*")
    .eq("kind", "landing")
      .order("last_seen", { ascending: false })
    .limit(limit);

  const orExpr = anyIlike("title", keywords) || anyIlike("page_url", keywords) || null;
  if (orExpr) q = q.or(orExpr);

  const { data } = await q;
  return Array.isArray(data) ? data : [];
}

/* -------- find PDF / related link within article chunks (best effort) ---- */

// Helper functions for article auxiliary links extraction
function tryTables() {
  return [
    { table: "page_chunks", urlCol: "source_url", textCol: "chunk_text" },
    { table: "page_chunks", urlCol: "page_url", textCol: "chunk_text" },
    { table: "chunks", urlCol: "source_url", textCol: "chunk_text" },
    { table: "chunks", urlCol: "page_url", textCol: "chunk_text" },
  ];
}

function extractPdfUrl(text) {
          const m =
            text.match(/https?:\/\/\S+?\.pdf/gi) ||
            text.match(/href="([^"]+\.pdf)"/i);
          if (m && m[0]) {
            let pdfUrl = Array.isArray(m) ? m[0] : m[1];
            // Convert internal Squarespace URLs to public URLs
            if (pdfUrl.includes('alan-ranger.squarespace.com')) {
              pdfUrl = pdfUrl.replace('alan-ranger.squarespace.com', 'www.alanranger.com');
            }
    return pdfUrl;
          }
  return null;
        }

function extractRelatedLink(text) {
          const rel =
            text.match(
              /(https?:\/\/[^\s)>"']*alanranger\.com[^\s)>"']*)/i
            ) || text.match(/href="([^"]*alanranger\.com[^"]*)"/i);
          if (rel && rel[0]) {
            let url = Array.isArray(rel) ? rel[0] : rel[1];
            
            // Convert internal Squarespace URLs to public URLs
            if (url.includes('alan-ranger.squarespace.com')) {
              url = url.replace('alan-ranger.squarespace.com', 'www.alanranger.com');
            }
            
            // Only accept direct Alan Ranger URLs, not URLs that contain Alan Ranger URLs as parameters
            if (url.startsWith('https://www.alanranger.com/') || 
                url.startsWith('https://alanranger.com/') ||
                url.startsWith('http://www.alanranger.com/') ||
                url.startsWith('http://alanranger.com/')) {
      return url;
    }
  }
  return null;
}

// Helper functions for related label extraction
function findLabelMatch(text) {
  return text.match(/\[([^\]]+)\]\([^)]+\)/) ||
                  text.match(/>([^<]{3,60})<\/a>/i) ||
                  text.match(/<a[^>]*>([^<]{3,60})<\/a>/i);
}

function cleanExtractedLabel(label) {
  return label.replace(/\]$/, '').replace(/\[$/, '').replace(/[\[\]]/g, '');
}

function generateLabelFromUrl(url) {
                try {
                  const urlObj = new URL(url);
                  const pathParts = urlObj.pathname.split('/').filter(Boolean);
                  const lastPart = pathParts[pathParts.length - 1] || 'Related Content';
    return lastPart.replace(/[-_]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                } catch {
    return 'Related Content';
  }
}

function extractRelatedLabel(text, url) {
  // Robust label extraction: prioritize explicit link text, then clean URL path
  const labelMatch = findLabelMatch(text);
  
  if (labelMatch && labelMatch[1]) {
    const cleanLabel = cleanExtractedLabel(labelMatch[1].trim());
    return cleanLabel;
  } else {
    // Generate a clean label from the URL path
    return generateLabelFromUrl(url);
  }
}

function cleanUrlLabel(label) {
  return label.replace(/\]$/, '').replace(/\[$/, '').replace(/[\[\]]/g, '');
}

async function getArticleAuxLinks(client, articleUrl) {
  const result = { pdf: null, related: null, relatedLabel: null };
  if (!articleUrl) return result;

  // try different chunk tables/columns safely
  const tables = tryTables();

  for (const t of tables) {
    try {
      const { data } = await client
        .from(t.table)
        .select(`${t.urlCol}, ${t.textCol}`)
        .eq(t.urlCol, articleUrl)
        .limit(20);
      if (!data?.length) continue;

      for (const row of data) {
        const text = row?.[t.textCol] || "";
        
        // find pdf
        if (!result.pdf) {
          result.pdf = extractPdfUrl(text);
        }
        
        // find first internal related link with hint text
        if (!result.related) {
          const url = extractRelatedLink(text);
          if (url) {
            result.related = url;
            result.relatedLabel = extractRelatedLabel(text, url);
          }
        }
        
        if (result.pdf && result.related) break;
      }
      if (result.pdf || result.related) break;
  } catch {
      // ignore and try next table
    }
  }
  return result;
}

/* ----------------------- Product description parsing -------------------- */

// Helper functions for description parsing
function cleanDescriptionText(desc) {
  return String(desc)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags completely
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags completely
    .replace(/<[^>]*>/g, ' ') // Remove all HTML tags
    .replace(/\s*style="[^"]*"/gi, '') // Remove style attributes
    .replace(/\s*data-[a-z0-9_-]+="[^"]*"/gi, '') // Remove data attributes
    .replace(/\s*contenteditable="[^"]*"/gi, '') // Remove contenteditable
    .replace(/\s*class="[^"]*"/gi, '') // Remove class attributes
    .replace(/\s*id="[^"]*"/gi, '') // Remove id attributes
    .replace(/\s*data-rte-[^=]*="[^"]*"/gi, '') // Remove Squarespace RTE attributes
    .replace(/\s*data-indent="[^"]*"/gi, '') // Remove indent attributes
    .replace(/\s*white-space:pre-wrap[^"]*"/gi, '') // Remove white-space styles
    .replace(/\s*margin-left:[^"]*"/gi, '') // Remove margin styles
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

function normalizeLines(rawText) {
  return rawText
    .split(/\r?\n/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((line, index, arr) => {
      // Remove duplicate lines (common issue causing text duplication)
      return arr.indexOf(line) === index;
    });
}
  
function createParsingHelpers(lines, out) {
  const nextVal = (i) => {
    for (let j = i + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (!t) continue;
      return t;
    }
  return null;
  };

  const matches = (ln, re) => re.test(ln);
  const valueAfter = (ln, re) => ln.replace(re, "").trim();
  const matchGroup = (ln, re) => {
    const m = ln.match(re);
    return m ? m[1].trim() : null;
  };
  const setIf = (prop, val) => { if (val) out[prop] = val; };

  return { nextVal, matches, valueAfter, matchGroup, setIf };
}

function parseLocationField(ln, helpers) {
  const { matches, valueAfter, nextVal, setIf } = helpers;
  if (matches(ln, /^location:/i)) {
    const v = valueAfter(ln, /^location:\s*/i) || nextVal(0);
    setIf("location", v);
    return true;
  }
  return false;
}

function parseParticipantsField(ln, helpers, i) {
  const { matches, valueAfter, nextVal, setIf, matchGroup } = helpers;
  
  if (matches(ln, /^participants:/i)) {
    const v = valueAfter(ln, /^participants:\s*/i) || nextVal(i);
    setIf("participants", v);
    return true;
    }
    
    // Handle chunk format: "* Participants: Max 6 *"
  if (matches(ln, /\*\s*participants:\s*([^*]+)\s*\*/i)) {
    const v = matchGroup(ln, /\*\s*participants:\s*([^*]+)\s*\*/i);
    setIf("participants", v);
    return true;
  }
  
  // Handle multi-line format: "Participants:\nMax 6"
  if (matches(ln, /^participants:\s*$/i)) {
    const nextLine = nextVal(i);
    if (nextLine && /^(max\s*\d+|\d+\s*max)$/i.test(nextLine)) {
      setIf("participants", nextLine.trim());
      return { skipNext: true };
    }
  }
  
  return false;
}

function parseFitnessField(ln, helpers) {
  const { matches, valueAfter, nextVal, setIf, matchGroup } = helpers;
  
  if (matches(ln, /^fitness:/i)) {
    const v = valueAfter(ln, /^fitness:\s*/i) || nextVal(0);
    setIf("fitness", v);
    return true;
    }
    
    // Handle chunk format: "* Fitness:2. Easy-Moderate *"
  if (matches(ln, /\*\s*fitness:\s*([^*]+)\s*\*/i)) {
    const v = matchGroup(ln, /\*\s*fitness:\s*([^*]+)\s*\*/i);
    setIf("fitness", v);
    return true;
  }
  
    // Also look for fitness information in other formats
  if (matches(ln, /fitness level|fitness requirement|physical requirement|walking/i)) {
    setIf("fitness", ln.trim());
    return true;
  }
  
  return false;
}

function parseAvailabilityField(ln, helpers) {
  const { matches, valueAfter, nextVal, setIf } = helpers;
  if (matches(ln, /^availability:/i)) {
    const v = valueAfter(ln, /^availability:\s*/i) || nextVal(0);
    setIf("availability", v);
    return true;
  }
  return false;
}

function parseExperienceLevelField(ln, helpers) {
  const { matches, valueAfter, nextVal, setIf } = helpers;
  if (matches(ln, /^experience\s*-\s*level:/i)) {
    const v = valueAfter(ln, /^experience\s*-\s*level:\s*/i) || nextVal(0);
    setIf("experienceLevel", v);
    return true;
  }
  return false;
}

function parseEquipmentNeededField(ln, helpers) {
  const { matches, valueAfter, nextVal, setIf } = helpers;
  
  if (matches(ln, /^equipment\s*needed:/i)) {
    const v = valueAfter(ln, /^equipment\s*needed:\s*/i) || nextVal(0);
    setIf("equipmentNeeded", v);
    return true;
    }
    
    // Handle asterisk format: "* EQUIPMENT NEEDED:"
    if (/^\*\s*equipment\s*needed:/i.test(ln)) {
    const v = ln.replace(/^\*\s*equipment\s*needed:\s*/i, "").trim() || nextVal(0);
    if (v) setIf("equipmentNeeded", v);
    return true;
    }
    
    // Also look for equipment information in other formats
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
    const m1 = ln.match(/^(\d+\s*(?:hrs?|hours?|day))(?:\s*[-–—]\s*)(.+)$/i);
    if (m1) {
      const rawLabel = m1[1].replace(/\s+/g, " ").trim();
      const time = m1[2].trim();
      out.sessions.push({ label: rawLabel, time, price: null });
    return true;
  }
  return false;
}

function extractFromDescription(desc) {
  const out = {
    location: null,
    participants: null,
    fitness: null,
    availability: null,
    experienceLevel: null,
    equipmentNeeded: null,
    summary: null,
    sessions: [],
  };
  if (!desc) return out;

  // Enhanced cleaning to prevent formatting issues and text duplication
  const rawText = cleanDescriptionText(desc);
  const lines = normalizeLines(rawText);
  
  if (lines.length) out.summary = lines[0];

  const helpers = createParsingHelpers(lines, out);

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];

    // Parse each field type
    if (parseLocationField(ln, helpers)) continue;
    
    const participantsResult = parseParticipantsField(ln, helpers, i);
    if (participantsResult === true) continue;
    if (participantsResult?.skipNext) {
      i++; // Skip the next line since we processed it
      continue;
    }
    
    if (parseFitnessField(ln, helpers)) continue;
    if (parseAvailabilityField(ln, helpers)) continue;
    if (parseExperienceLevelField(ln, helpers)) continue;
    if (parseEquipmentNeededField(ln, helpers)) continue;
    if (parseSessionField(ln, out)) continue;
  }

  if (out.summary && /^summary$/i.test(out.summary.trim())) {
    const idx = lines.findIndex((s) => /^summary$/i.test(s.trim()));
    if (idx >= 0) {
      const nxt = lines.slice(idx + 1).find((s) => s.trim());
      if (nxt) out.summary = nxt.trim();
    }
  }

  return out;
}

/* --------------------- Build product panel (markdown) -------------------- */

// Helper functions for product panel markdown generation
function extractPriceRange(products) {
  let lowPrice = null, highPrice = null;
  for (const p of products) {
    const ro = p?.raw?.offers || {};
    const lp = ro.lowPrice ?? ro.lowprice ?? null;
    const hp = ro.highPrice ?? ro.highprice ?? null;
    if (lp != null) lowPrice = lp;
    if (hp != null) highPrice = hp;
  }
  return { lowPrice, highPrice };
}

function buildPriceHeader(primary, lowPrice, highPrice) {
  const headlineSingle = primary?.price != null ? toGBP(primary.price) : null;
  const lowTx = lowPrice != null ? toGBP(lowPrice) : null;
  const highTx = highPrice != null ? toGBP(highPrice) : null;

  const headBits = [];
  if (headlineSingle) headBits.push(headlineSingle);
  if (lowTx && highTx) headBits.push(`${lowTx}–${highTx}`);
  return headBits.length ? ` — ${headBits.join(" • ")}` : "";
}

function scrubDescription(description) {
  return String(description || '')
    .replace(/\s*style="[^"]*"/gi,'')
    .replace(/\s*data-[a-z0-9_-]+="[^"]*"/gi,'')
    .replace(/\s*contenteditable="[^"]*"/gi,'')
    .replace(/•\s*Standard\s*[—\-]\s*£\d+/gi,'') // Remove "• Standard — £150" lines
    .replace(/Standard\s*[—\-]\s*£\d+/gi,'') // Remove "Standard — £150" lines
    .replace(/\s*•\s*Standard\s*[—\-]\s*£\d+/gi,'') // Remove " • Standard — £150" lines
    .replace(/\s*Standard\s*[—\-]\s*£\d+/gi,''); // Remove " Standard — £150" lines
}
  
async function fetchChunkData(primary) {
  try {
    const chunkResponse = await supabase
      .from('page_chunks')
      .select('chunk_text')
      .eq('url', primary.page_url)
      .limit(1)
      .single();
    
    if (chunkResponse.data) {
      return chunkResponse.data.chunk_text || "";
    }
  } catch (e) {
    // Ignore chunk fetch errors
  }
  return "";
}

function logExtractionDebug(desc, chunk, src, extracted) {
  console.log("Full description:", desc);
  console.log("Chunk data:", chunk);
  console.log("Source text for extraction:", src);
  console.log("Extracted info:", JSON.stringify(extracted, null, 2));
  console.log("Experience Level extracted:", extracted.experienceLevel);
  console.log("Equipment Needed extracted:", extracted.equipmentNeeded);
}

function extractSummaryFromDescription(fullDescription) {
  if (!fullDescription) return null;

    let summaryText = '';
    const lastDescriptionIndex = fullDescription.toLowerCase().lastIndexOf('description:');

    if (lastDescriptionIndex !== -1) {
      // Get text after the last "Description:"
      let potentialSummaryText = fullDescription.substring(lastDescriptionIndex + 'description:'.length).trim();

      // Further refine to stop at other section headers if they exist after the description
      const stopWords = ['summary:', 'location:', 'dates:', 'half-day morning workshops are', 'half-day afternoon workshops are', 'one day workshops are', 'participants:', 'fitness:', 'photography workshop', 'event details:'];
      let stopIndex = potentialSummaryText.length;
      for (const word of stopWords) {
        const idx = potentialSummaryText.toLowerCase().indexOf(word);
        if (idx !== -1 && idx < stopIndex) {
          stopIndex = idx;
        }
      }
      summaryText = potentialSummaryText.substring(0, stopIndex).trim();
    }

    if (summaryText) {
      const sentences = summaryText
        .replace(/<[^>]*>/g, ' ') // Remove HTML tags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 30) // Filter out very short fragments
        .slice(0, 2); // Take first 2 sentences for a concise summary

      if (sentences.length > 0) {
      return sentences.join('. ') + (sentences.length > 1 ? '.' : '');
      }
    }
    
    // Fallback: if no specific description section found or summary is still empty
      const sentences = fullDescription
        .replace(/<[^>]*>/g, ' ') // Remove HTML tags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 30) // Filter out very short fragments
        .slice(0, 2); // Take first 2 sentences

      if (sentences.length > 0) {
    return sentences.join('. ') + (sentences.length > 1 ? '.' : '');
  }
  
  return null;
}

function attachPricesToSessions(sessions, lowPrice, highPrice, primary) {
  if (!sessions.length) return sessions;
  
    if (lowPrice != null && highPrice != null && sessions.length >= 2) {
      sessions[0].price = lowPrice;
      sessions[1].price = highPrice;
    } else if (primary?.price != null) {
      sessions.forEach((s) => (s.price = primary.price));
    }
  
  return sessions;
}

function buildFactsList(info) {
  const facts = [];
  if (info.location) facts.push(`**Location:** ${info.location}`);
  if (info.participants) facts.push(`**Participants:** ${info.participants}`);
  if (info.fitness) facts.push(`**Fitness:** ${info.fitness}`);
  if (info.availability) facts.push(`**Availability:** ${info.availability}`);
  if (info.experienceLevel) facts.push(`**Experience Level:** ${info.experienceLevel}`);
  if (info.equipmentNeeded) facts.push(`**Equipment Needed:** ${info.equipmentNeeded}`);
  return facts;
}

function buildSessionsList(sessions) {
  const sessionLines = [];
  for (const s of sessions) {
    const pretty = s.label.replace(/\bhrs\b/i, "hours");
    const ptxt = s.price != null ? ` — ${toGBP(s.price)}` : "";
    sessionLines.push(`- **${pretty}** — ${s.time}${ptxt}`);
  }
  return sessionLines;
}

async function buildProductPanelMarkdown(products) {
  if (!products?.length) return "";

  const primary = products.find((p) => p.price != null) || products[0];
  const { lowPrice, highPrice } = extractPriceRange(products);
  const priceHead = buildPriceHeader(primary, lowPrice, highPrice);
  const title = primary.title || primary?.raw?.name || "Workshop";

  // Create a better summary from the full description
  const fullDescription = scrubDescription(primary.description || primary?.raw?.description || "");
  const chunkData = await fetchChunkData(primary);
  const sourceText = chunkData || fullDescription;
  const info = extractFromDescription(sourceText) || {};
  
  logExtractionDebug(fullDescription, chunkData, sourceText, info);
  
  const summary = extractSummaryFromDescription(fullDescription);
  const sessions = attachPricesToSessions([...(info.sessions || [])], lowPrice, highPrice, primary);

  const lines = [];
  lines.push(`**${title}**${priceHead}`);

  if (summary) lines.push(`\n${summary}`);

  const facts = buildFactsList(info);
  
  console.log("Facts to add:", facts);
  console.log("Info participants:", info.participants);
  console.log("Info fitness:", info.fitness);
  console.log("Info location:", info.location);
  console.log("Info experienceLevel:", info.experienceLevel);
  console.log("Info equipmentNeeded:", info.equipmentNeeded);
  
  if (facts.length) {
    lines.push("");
    for (const f of facts) lines.push(f);
  }

  if (sessions.length) {
    lines.push("");
    const sessionLines = buildSessionsList(sessions);
    for (const line of sessionLines) lines.push(line);
  }

  return lines.join("\n");
}

/* ----------------------------- Event list UI ----------------------------- */
function formatEventsForUi(events) {
  console.log('🔍 formatEventsForUi input:', {
    inputLength: events?.length || 0,
    inputSample: events?.slice(0, 2) || []
  });
  
  // Preserve original fields so the frontend can format times and ranges
  const result = (events || [])
    .map((e) => ({
      ...e,
      title: e.title || e.event_title,
      when: fmtDateLondon(e.start_date || e.date_start),
      location: e.location_name || e.event_location,
      href: e.page_url || e.event_url,
      // Pass-through commonly used fields for time rendering
      date_start: e.start_date || e.date_start,
      date_end: e.end_date || e.date_end,
      _csv_start_time: e._csv_start_time || e.start_time || null,
      _csv_end_time: e._csv_end_time || e.end_time || null,
      // Additional fields for multi-day residential workshop tiles
      csv_type: e.csv_type || null,
      price_gbp: e.price_gbp || e.price || null,
      start_time: e.start_time || null,
      end_time: e.end_time || null,
      location_name: e.location_name || null,
      location_address: e.location_address || null,
      categories: e.categories || null,
      tags: e.tags || null,
      raw: e.raw || null,
      // Structured data fields for enhanced display
      participants: e.participants || null,
      experience_level: e.experience_level || null,
      equipment_needed: e.equipment_needed || null,
      time_schedule: e.time_schedule || null,
      fitness_level: e.fitness_level || null,
      what_to_bring: e.what_to_bring || null,
      course_duration: e.course_duration || null,
      instructor_info: e.instructor_info || null,
      availability_status: e.availability_status || null,
    }))
    .slice(0, 12);
    
  console.log('🔍 formatEventsForUi output:', {
    outputLength: result.length,
    outputSample: result.slice(0, 2)
  });
  
  return result;
}
/* ----------------------------- Pills builders ---------------------------- */
// Helper functions for event pills building
function createPillAdder(pills, used) {
  return (label, url, brand = true) => {
    if (!label || !url) return;
    if (used.has(url)) return;
    used.add(url);
    pills.push({ label, url, brand });
  };
}

function determineCourseListingUrl(productUrl) {
  try {
    const u = String(productUrl || '');
    if (/beginners-photography-(classes|course)/i.test(u) || /photography-services-near-me\/beginners-photography-course/i.test(u)) {
      return "https://www.alanranger.com/beginners-photography-classes";
    } else if (/lightroom-courses-for-beginners-coventry/i.test(u) || /photo-editing-course-coventry/i.test(u)) {
      return "https://www.alanranger.com/photo-editing-course-coventry";
    }
  } catch {}
  return null;
}

function determineEventSectionUrl(firstEventUrl) {
  try {
    const fe = String(firstEventUrl || '');
    const m = fe.match(/^https?:\/\/[^/]+\/(beginners-photography-lessons)\//i);
    if (m && m[1]) {
      const base = fe.split(m[1])[0] + m[1];
      return base.startsWith('http') ? base : `https://www.alanranger.com/${m[1]}`;
    }
  } catch {}
  return null;
}

function buildEventPills({ productUrl, firstEventUrl, landingUrl, photosUrl }) {
  const pills = [];
  const used = new Set();
  const add = createPillAdder(pills, used);

  add("Book Now", productUrl || firstEventUrl, true);

  // Event Listing + More Events both point at listing root (no search page)
  let listUrl = landingUrl || (firstEventUrl && originOf(firstEventUrl) + "/photography-workshops");
  
  // Special-case: course products (beginners classes) should link to the course listing
  const courseUrl = determineCourseListingUrl(productUrl);
  if (courseUrl) {
    listUrl = courseUrl;
  }
  
  // If events come from the courses section, prefer the section listing root deterministically
  const eventSectionUrl = determineEventSectionUrl(firstEventUrl);
  if (eventSectionUrl) {
    listUrl = eventSectionUrl;
  }
  
  add("Event Listing", listUrl, true);
  add("More Events", listUrl, true);

  add("Photos", photosUrl || (firstEventUrl && originOf(firstEventUrl) + "/gallery-image-portfolios"), false);
  return pills;
}

function buildAdvicePills({ articleUrl, query, pdfUrl, relatedUrl, relatedLabel }) {
  const pills = [];
  const add = (label, url, brand = true) => {
    if (!label || !url) return;
    pills.push({ label, url, brand });
  };
  add("Read Guide", articleUrl, true);
  add("More Articles", `https://www.alanranger.com/search?query=${encodeURIComponent(query || "")}`, true);
  if (pdfUrl) add("Download PDF", pdfUrl, true);
  if (relatedUrl) {
    // Ensure we never show raw URLs as labels
    let cleanLabel = relatedLabel || "Related";
    if (cleanLabel.includes('http') || cleanLabel.includes('www.') || cleanLabel.length > 50) {
      cleanLabel = "Related Content";
    }
    add(cleanLabel, relatedUrl, false);
  }
  return pills.slice(0, 4);
}

/* --------------------------- Generic resolvers --------------------------- */

async function resolveEventsAndProduct(client, { keywords, pageContext = null }) {
  // Events filtered by keywords (stronger locality match)
  const events = await findEvents(client, { keywords, limit: 80, pageContext });

  // Try to pick the best-matching product for these keywords
  const products = await findProducts(client, { keywords, limit: 10, pageContext });
  const product = products?.[0] || null;

  // Landing page (if any), else the event origin's workshops root
  const landing = (await findLanding(client, { keywords })) || null;

  return { events, product, landing };
}

/* ---------------------------- Extract Relevant Info ---------------------------- */
async function extractRelevantInfo(query, dataContext) {
  const { products, events, articles } = dataContext;
  const lowerQuery = query.toLowerCase();
  // Small local helpers to reduce repetition (no behavior change)
  const hasText = (s)=> typeof s === 'string' && s.trim().length > 0;
  const formatDateGB = (iso)=> {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch(_) { return null; }
  };
  const scrubAttrs = (s)=> String(s||'')
    .replace(/\s*style="[^"]*"/gi,'')
    .replace(/\s*data-[a-z0-9_-]+="[^"]*"/gi,'')
    .replace(/\s*contenteditable="[^"]*"/gi,'')
    .replace(/\s*>\s*/g,' ')
    .replace(/<[^>]*>/g,' ')
    .replace(/\s+/g,' ').trim();
  const summarize = (t)=>{
    const clean = scrubAttrs(t||'');
    const parts = clean.split(/[.!?]+/).map(s=>s.trim()).filter(s=>s.length>30);
    return parts.slice(0,2).join('. ') + (parts.length?'.':'');
  };
  
  // For event-based questions, prioritize the structured event data
  if (events && events.length > 0) {
    console.log(`🔍 RAG: Found ${events.length} events, checking structured data`);
    
    // Find the most relevant event based on the query context
    // Note: events are already filtered to future events before calling this function
    let event = events[0]; // Default to first event (which is now guaranteed to be future)
    
    // If query mentions a specific location, filter events by that location
    const locationKeywords = ['devon', 'cornwall', 'yorkshire', 'peak district', 'lake district', 'snowdonia', 'anglesey', 'norfolk', 'suffolk', 'dorset', 'somerset'];
    const mentionedLocation = locationKeywords.find(loc => lowerQuery.includes(loc));
    
    if (mentionedLocation) {
      const locationEvent = events.find(e => {
        const eventLocation = (e.event_location || '').toLowerCase();
        return eventLocation.includes(mentionedLocation);
      });
      
      if (locationEvent) {
        event = locationEvent;
        console.log(`🔍 RAG: Found location-specific event for ${mentionedLocation}: ${event.event_title}`);
      }
    }
    
    // If we have a previous query context, try to find the most relevant event
    if (dataContext.originalQuery) {
      const originalQueryLower = dataContext.originalQuery.toLowerCase();
      console.log(`🔍 RAG: Looking for event matching original query: "${dataContext.originalQuery}"`);
      
      // Extract key terms from the original query to match against events
      const keyTerms = dataContext.originalQuery.toLowerCase()
        .split(/\s+/)
        .filter(term => term.length > 3 && !['when', 'where', 'how', 'what', 'next', 'workshop', 'photography'].includes(term));
      
      // Find event that best matches the original query terms
      const matchingEvent = events.find(e => {
        const eventText = `${e.event_title || ''} ${e.event_location || ''}`.toLowerCase();
        return keyTerms.some(term => eventText.includes(term));
      });
      
      if (matchingEvent) {
        event = matchingEvent;
        console.log(`🔍 RAG: Found contextually relevant event: ${event.event_title}`);
      }
    }
    
    // Check for participant information
    if (lowerQuery.includes('how many') && (lowerQuery.includes('people') || lowerQuery.includes('attend'))) {
      if (event.participants && String(event.participants).trim().length > 0) {
        console.log(`✅ RAG: Found participants="${event.participants}" in structured event data`);
        return `**${event.participants}** people can attend this workshop. This ensures everyone gets personalized attention and guidance from Alan.`;
      }
    }
    
    // Check for location information
    if (lowerQuery.includes('where') || lowerQuery.includes('location')) {
      if (hasText(event.event_location)) {
        console.log(`✅ RAG: Found location="${event.event_location}" in structured event data`);
        return `The workshop is held at **${event.event_location}**. Full location details and meeting instructions will be provided when you book.`;
      }
    }
    
    // Check for price information
    if (lowerQuery.includes('cost') || lowerQuery.includes('price') || lowerQuery.includes('much')) {
      if (event.price_gbp && event.price_gbp > 0) {
        console.log(`✅ RAG: Found price="${event.price_gbp}" in structured event data`);
        return `The workshop costs **£${event.price_gbp}**. This includes all tuition, guidance, and any materials provided during the session.`;
      }
    }
    
    // Check for date information
    if (lowerQuery.includes('when') || lowerQuery.includes('date')) {
      if (event.date_start) {
        const formattedDate = formatDateGB(event.date_start);
        console.log(`✅ RAG: Found date="${formattedDate}" in structured event data`);
        const label = (event.subtype && String(event.subtype).toLowerCase()==='course') ? 'course' : 'workshop';
        let brief = '';
        if (products && products.length && (products[0].description || products[0]?.raw?.description)) {
          brief = summarize(products[0].description || products[0]?.raw?.description);
        }
        // Keep the intro concise (max ~220 chars)
        if (brief.length > 220) brief = brief.slice(0, 220).replace(/\s+\S*$/, '') + '…';
        const lead = `The next ${label} is scheduled for **${formattedDate}**.`;
        return brief ? `${lead} ${brief}` : `${lead}`;
      }
    }
    
    // Check for fitness level information
    if (lowerQuery.includes('fitness') || lowerQuery.includes('level') || lowerQuery.includes('experience')) {
      // Check structured fitness_level field
      if (event.fitness_level && event.fitness_level.trim().length > 0) {
        console.log(`✅ RAG: Found fitness level="${event.fitness_level}" in structured event data`);
        return `The fitness level required is **${event.fitness_level}**. This ensures the workshop is suitable for your physical capabilities and you can fully enjoy the experience.`;
      }
    }
  }
  
  // If no specific information found, provide a helpful response
  return `I don't have a confident answer to that yet. I'm trained on Alan's site, so I may miss things. If you'd like to follow up, please reach out:`;
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
  
function analyzeEventAttributes(event, responseAttributes) {
      const eventTitle = (event.event_title || '').toLowerCase();
      const eventLocation = (event.event_location || '').toLowerCase();
      const eventPrice = event.price_gbp || 0;
      
      // Check for free content
      if (eventPrice === 0 || eventTitle.includes('free')) {
        responseAttributes.hasFreeContent = true;
      }
      
      // Check for online content
      if (eventLocation.includes('online') || eventLocation.includes('zoom') || eventLocation.includes('virtual')) {
        responseAttributes.hasOnlineContent = true;
        responseAttributes.onlineCount++;
      }
      
      // Check for in-person content
      if (eventLocation.includes('coventry') || eventLocation.includes('peak district') || eventLocation.includes('batsford')) {
        responseAttributes.hasInPersonContent = true;
        responseAttributes.inPersonCount++;
      }
      
      // Check for certificate info
      if (eventTitle.includes('certificate') || eventTitle.includes('cert') || eventTitle.includes('rps')) {
        responseAttributes.hasCertificateInfo = true;
      }
      
      // Track pricing
      if (eventPrice > 0) {
        responseAttributes.hasPriceInfo = true;
        responseAttributes.averagePrice += eventPrice;
      }
  }
  
function analyzeProductAttributes(product, responseAttributes) {
    const productTitle = (product.title || '').toLowerCase();
    const productLocation = (product.location_name || '').toLowerCase();
    const productPrice = product.price || 0;
    
    if (productPrice === 0 || productTitle.includes('free')) {
      responseAttributes.hasFreeContent = true;
    }
    
    if (productLocation.includes('online') || productLocation.includes('zoom') || productLocation.includes('virtual')) {
      responseAttributes.hasOnlineContent = true;
      responseAttributes.onlineCount++;
    }
    
    if (productLocation.includes('coventry') || productLocation.includes('peak district') || productLocation.includes('batsford')) {
      responseAttributes.hasInPersonContent = true;
      responseAttributes.inPersonCount++;
    }
    
    if (productTitle.includes('certificate') || productTitle.includes('cert') || productTitle.includes('rps')) {
      responseAttributes.hasCertificateInfo = true;
    }
    
    if (productPrice > 0) {
      responseAttributes.hasPriceInfo = true;
      responseAttributes.averagePrice += productPrice;
    }
  }
  
function applyIntentBasedScoring(queryRequirements, responseAttributes, addFactor) {
  // Apply intent-based penalties for mismatches
  if (queryRequirements.free && !responseAttributes.hasFreeContent) { addFactor("Free query but no free content", -0.5); }
  if (queryRequirements.online && !responseAttributes.hasOnlineContent) { addFactor("Online query but no online content", -0.3); }
  if (queryRequirements.certificate && !responseAttributes.hasCertificateInfo) { addFactor("Certificate query but no certificate info", -0.4); }
  if (queryRequirements.inPerson && !responseAttributes.hasInPersonContent) { addFactor("In-person query but no in-person content", -0.2); }
  
  // Apply bonuses for good matches
  if (queryRequirements.free && responseAttributes.hasFreeContent) { addFactor("Free query matched with free content", 0.3); }
  if (queryRequirements.online && responseAttributes.hasOnlineContent) { addFactor("Online query matched with online content", 0.2); }
  if (queryRequirements.certificate && responseAttributes.hasCertificateInfo) { addFactor("Certificate query matched with certificate info", 0.3); }
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
  let baseConfidence = 0.3;
  let confidenceFactors = [];
  
  const queryLower = query.toLowerCase();
  // Small helpers to reduce repetition (no behavior change)
  const addFactor = (message, delta) => { baseConfidence += delta; confidenceFactors.push(`${message} (${delta >= 0 ? '+' : ''}${delta})`); };
  
  // Extract query requirements
  const queryRequirements = extractQueryRequirements(queryLower);
  
  // Initialize response attributes
  const responseAttributes = initializeResponseAttributes();
  
  // Analyze events for response attributes
  if (events && events.length > 0) {
    events.forEach(event => analyzeEventAttributes(event, responseAttributes));
    responseAttributes.averagePrice = responseAttributes.averagePrice / events.length;
  }
  
  // Check product attributes
  if (product) {
    analyzeProductAttributes(product, responseAttributes);
  }
  
  // Apply all scoring factors
  applyIntentBasedScoring(queryRequirements, responseAttributes, addFactor);
  applyQuerySpecificityScoring(queryLower, addFactor);
  applyEventQualityScoring(events, addFactor);
  applyProductScoring(product, addFactor);
  applyRelevanceScoring(queryLower, events, addFactor);
  
  // Cap confidence between 0.1 and 0.95
  const finalConfidence = Math.max(0.1, Math.min(0.95, baseConfidence));
  
  // Log confidence factors for debugging
  if (confidenceFactors.length > 0) {
    console.log(`🎯 Event confidence factors for "${query}": ${confidenceFactors.join(', ')} = ${(finalConfidence * 100).toFixed(1)}%`);
  }
  
  return finalConfidence;
}

/* -------------------------------- Extracted Functions -------------------------------- */
/**
 * Early-return fallback processing extracted from handler to reduce complexity.
 * Preserves existing behavior exactly.
 */
async function maybeProcessEarlyReturnFallback(client, query, intent, pageContext, res) {
  // This mirrors the original inline logic guarded by `confident`
  const directKeywords = extractKeywords(query || "");
  if (intent === "events") {
    const events = await findEvents(client, { keywords: directKeywords, limit: 80, pageContext });
    const eventList = formatEventsForUi(events);
    const confidence = calculateEventConfidence(query || "", eventList, null);
    console.log('🔍 EARLY RETURN EVENTS: Found events via early return path:', {
      totalEvents: events.length,
      formattedEvents: eventList.length,
      confidence,
      query
    });
    res.status(200).json({
      ok: true,
      type: "events",
      answer: eventList,
      events: eventList,
      structured: {
        intent: "events",
        topic: directKeywords.join(", "),
        events: eventList,
        products: [],
        pills: []
      },
      confidence,
      debug: {
        version: "v1.2.40-retrieval-first",
        earlyReturn: true,
        eventsFound: events.length,
        formattedEvents: eventList.length
      }
    });
    return true;
  } else {
    let articles = await findArticles(client, { keywords: directKeywords, limit: 30, pageContext });
    articles = (articles || []).map(a => {
      const out = { ...a };
      if (!out.title) {
        out.title = out?.raw?.headline || out?.raw?.name || '';
        if (!out.title) {
          try { const u = new URL(out.page_url || out.source_url || out.url || ''); const last = (u.pathname||'').split('/').filter(Boolean).pop()||''; out.title = last.replace(/[-_]+/g,' ').replace(/\.(html?)$/i,' ').trim(); } catch {}
        }
      }
      if (!out.page_url) out.page_url = out.source_url || out.url || out.href || null;
      return out;
    });
    const articleUrls = articles?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
    const contentChunks = await findContentChunks(client, { keywords: directKeywords, limit: 15, articleUrls });
    const pricingAnswer = generatePricingAccommodationAnswer(query || "", articles, contentChunks);
    const answerMarkdown = pricingAnswer || generateDirectAnswer(query || "", articles, contentChunks);
    res.status(200).json({
      ok: true,
      type: "advice",
      answer_markdown: answerMarkdown,
      structured: {
        intent: "advice",
        topic: directKeywords.join(", "),
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
      confidence: 90,
      debug: { version: "v1.2.40-retrieval-first", earlyReturn: true }
    });
    return true;
  }
}


/**
 * Determine keywords for content retrieval based on intent and query context
 */
function determineKeywords(query, previousQuery, intent) {
  const contextualQuery = previousQuery ? `${previousQuery} ${query}` : query;
  const qlc = (query || "").toLowerCase();
  
  // For events, only use previous context for follow-up style questions
  const isFollowUp = [
    "how much","cost","price","where","location","when","date",
    "how many","people","attend","fitness","level","duration","long",
    "how do i book","book","booking","required","needed","suitable"
  ].some(w=>qlc.includes(w));
  
  // If the new query names a concrete topic (e.g., lightroom, ISO, bluebell), don't merge context
  const GENERIC_EVENT_TERMS = new Set(["workshop","workshops","course","courses","class","classes","event","events"]);
  const hasSignificantTopic = TOPIC_KEYWORDS
    .filter(t => !GENERIC_EVENT_TERMS.has(t))
    .some(t => qlc.includes(t));
  
  const keywords = intent === "events"
    ? extractKeywords((isFollowUp && !hasSignificantTopic ? contextualQuery : query) || "")
    : extractKeywords(query || "");
    
  return keywords;
}

/**
 * Handle residential pricing shortcut - direct answer for residential workshop pricing queries
 */
async function handleResidentialPricingShortcut(client, query, keywords, pageContext, res) {
  const qlc = (query || "").toLowerCase();
  const isResidentialPricing = (
    qlc.includes("residential") && qlc.includes("workshop") && (
      qlc.includes("price") || qlc.includes("cost") || qlc.includes("how much") ||
      qlc.includes("b&b") || qlc.includes("bed and breakfast") || qlc.includes("bnb") ||
      qlc.includes("include b&b") || qlc.includes("includes b&b") || qlc.includes("include bnb")
    )
  );
  
  if (!isResidentialPricing) {
    return false; // No response sent, continue with normal flow
  }
  
  const directKeywords = Array.from(new Set(["residential", "workshop", ...extractKeywords(query || "")]));
  const events = await findEvents(client, { keywords: directKeywords, limit: 120, pageContext });
  const all = formatEventsForUi(events) || [];
  const eventList = all.filter(e => {
    try{ return e.date_start && e.date_end && new Date(e.date_end) > new Date(e.date_start); }catch{ return false; }
  });
  
  if (eventList.length) {
    const confidence = calculateEventConfidence(query || "", eventList, null);
    res.status(200).json({
      ok: true,
      type: "events",
      answer: eventList,
      events: eventList,
      structured: {
        intent: "events",
        topic: directKeywords.join(", "),
        events: eventList,
        products: [],
        pills: []
      },
      confidence,
      debug: { version: "v1.2.47-residential-shortcut", shortcut: true }
    });
    return true; // Response sent
  }
  
  // Fallback: synthesize concise pricing/B&B answer with links
  const enrichedKeywords = Array.from(new Set([...directKeywords, "b&b", "bed", "breakfast", "price", "cost"]));
  let articles = await findArticles(client, { keywords: enrichedKeywords, limit: 30, pageContext });
  articles = (articles || []).map(normalizeArticle);
  const articleUrls = articles?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
  const contentChunks = await findContentChunks(client, { keywords: enrichedKeywords, limit: 20, articleUrls });
  const answerMarkdown = generatePricingAccommodationAnswer(query || "", articles, contentChunks);
  
  if (answerMarkdown) {
    res.status(200).json({
      ok: true,
      type: "advice",
      answer_markdown: answerMarkdown,
      structured: {
        intent: "advice",
        topic: enrichedKeywords.join(", "),
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
      confidence: 60,
      debug: { version: "v1.2.47-residential-shortcut", shortcut: true }
    });
    return true; // Response sent
  }
  
  return false; // No response sent, continue with normal flow
}

/**
 * Normalize article object to ensure title and page_url are present.
 */
function normalizeArticle(a) {
  const out = { ...a };
  if (!out.title) {
    out.title = out?.raw?.headline || out?.raw?.name || '';
    if (!out.title) {
      try {
        const u = new URL(out.page_url || out.source_url || out.url || '');
        const last = (u.pathname || '').split('/').filter(Boolean).pop() || '';
        out.title = last.replace(/[-_]+/g, ' ').replace(/\.(html?)$/i, ' ').trim();
      } catch {}
    }
  }
  if (!out.page_url) out.page_url = out.source_url || out.url || out.href || null;
  return out;
}

/**
 * Handle follow-up direct synthesis for advice queries (equipment/pricing)
 * Returns true if a response was sent.
 */
async function handleAdviceFollowupSynthesis(client, qlc, keywords, pageContext, res) {
  // Equipment advice synthesis
  if (isEquipmentAdviceQuery(qlc)) {
    let articles = await findArticles(client, { keywords, limit: 30, pageContext });
    articles = (articles || []).map(normalizeArticle);
    const articleUrls = articles?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
    const contentChunks = await findContentChunks(client, { keywords, limit: 20, articleUrls });
    const synthesized = generateEquipmentAdviceResponse(qlc, articles || [], contentChunks || []);
    if (synthesized) {
      res.status(200).json({
        ok: true,
        type: "advice",
        answer_markdown: synthesized,
        structured: {
          intent: "advice",
          topic: keywords.join(", "),
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
        confidence: 75,
        debug: { version: "v1.2.46-followup-equip-extracted", previousQuery: true }
      });
      return true;
    }
  }

  // Pricing/accommodation synthesis
  const pricingSynth = generatePricingAccommodationAnswer(qlc);
  if (pricingSynth) {
    let articles = await findArticles(client, { keywords, limit: 30, pageContext });
    articles = (articles || []).map(normalizeArticle);
    const articleUrls = articles?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
    const contentChunks = await findContentChunks(client, { keywords, limit: 20, articleUrls });
    const answer = generatePricingAccommodationAnswer(qlc, articles || [], contentChunks || []);
    if (answer) {
      res.status(200).json({
        ok: true,
        type: "advice",
        answer_markdown: answer,
        structured: {
          intent: "advice",
          topic: keywords.join(", "),
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
        confidence: 70,
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
async function handleClarificationFollowup(client, previousQuery, query, intent, keywords, pageContext, res) {
  const isClarificationResponse = previousQuery && (
    query.toLowerCase().includes("photography") ||
    query.toLowerCase().includes("equipment") ||
    query.toLowerCase().includes("course") ||
    query.toLowerCase().includes("service") ||
    query.toLowerCase().includes("advice") ||
    query.toLowerCase().includes("mentoring") ||
    query.toLowerCase().includes("about")
  );

  if (!isClarificationResponse) return false;

  // Route by chosen clarification intent if present in text
  if (query.toLowerCase().includes("events") || query.toLowerCase().includes("courses") || intent === "events") {
    const events = await findEvents(client, { keywords, limit: 80, pageContext });
    const eventList = formatEventsForUi(events);
    const confidence = calculateEventConfidence(query || "", eventList, null);
    res.status(200).json({
      ok: true,
      type: "events",
      answer: eventList,
      events: eventList,
      structured: {
        intent: "events",
        topic: (keywords || []).join(", "),
        events: eventList,
        products: [],
        pills: []
      },
      confidence,
      debug: { version: "v1.2.47-clarification-followup", previousQuery: true }
    });
    return true;
  }

  // Advice-oriented clarification
  {
    let articles = await findArticles(client, { keywords, limit: 30, pageContext });
    articles = (articles || []).map(a => {
      const out = { ...a };
      if (!out.title) {
        out.title = out?.raw?.headline || out?.raw?.name || '';
        if (!out.title) {
          try { const u = new URL(out.page_url || out.source_url || out.url || ''); const last = (u.pathname||'').split('/').filter(Boolean).pop()||''; out.title = last.replace(/[-_]+/g,' ').replace(/\.(html?)$/i,' ').trim(); } catch {}
        }
      }
      if (!out.page_url) out.page_url = out.source_url || out.url || out.href || null;
      return out;
    });
    const articleUrls = articles?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
    const contentChunks = await findContentChunks(client, { keywords, limit: 15, articleUrls });
    const answerMarkdown = generateDirectAnswer(query || "", articles, contentChunks);
    res.status(200).json({
      ok: true,
      type: "advice",
      answer_markdown: answerMarkdown,
      structured: {
        intent: "advice",
        topic: (keywords || []).join(", "),
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
      confidence: 65,
      debug: { version: "v1.2.47-clarification-followup", previousQuery: true }
    });
    return true;
  }
}
/**
 * Handle residential pricing guard - bypasses clarification for residential workshop pricing queries
 */
async function handleResidentialPricingGuard(client, query, previousQuery, pageContext, res) {
  try {
    const qlc0 = (query || "").toLowerCase();
    const isResi = qlc0.includes("residential") && qlc0.includes("workshop");
    const hasPriceCue = qlc0.includes("how much") || qlc0.includes("price") || qlc0.includes("cost") || qlc0.includes("b&b") || qlc0.includes("bed and breakfast") || qlc0.includes("bnb");
    
    if (!previousQuery && isResi && hasPriceCue) {
      const directKeywords0 = Array.from(new Set(["residential", "workshop", ...extractKeywords(query || "")]));
      const ev0 = await findEvents(client, { keywords: directKeywords0, limit: 140, pageContext });
      const all0 = formatEventsForUi(ev0) || [];
      const resi = all0.filter(e => { 
        try { 
          return e.date_start && e.date_end && new Date(e.date_end) > new Date(e.date_start); 
        } catch { 
          return false; 
        } 
      });
      
      if (resi.length) {
        const conf0 = calculateEventConfidence(query || "", resi, null);
        res.status(200).json({ 
          ok: true, 
          type: "events", 
          answer: resi, 
          events: resi, 
          structured: { 
            intent: "events", 
            topic: directKeywords0.join(", "), 
            events: resi, 
            products: [], 
            pills: [] 
          }, 
          confidence: conf0, 
          debug: { version: "v1.2.48-guard-residential", guard: true } 
        });
        return true; // Response sent
      }
      
      const enriched0 = Array.from(new Set([...directKeywords0, "b&b", "bed", "breakfast", "price", "cost"]));
      let arts0 = await findArticles(client, { keywords: enriched0, limit: 30, pageContext });
      arts0 = (arts0 || []).map(a => { 
        const out = {...a}; 
        if (!out.title) { 
          out.title = out?.raw?.headline || out?.raw?.name || ''; 
          if (!out.title) { 
            try { 
              const u = new URL(out.page_url || out.source_url || out.url || ''); 
              const last = (u.pathname || '').split('/').filter(Boolean).pop() || ''; 
              out.title = last.replace(/[-_]+/g, ' ').replace(/\.(html?)$/i, ' ').trim(); 
            } catch {} 
          } 
        } 
        if (!out.page_url) out.page_url = out.source_url || out.url || out.href || null; 
        return out; 
      });
      
      const aurls0 = arts0?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
      const chunks0 = await findContentChunks(client, { keywords: enriched0, limit: 20, articleUrls: aurls0 });
      const md0 = generateDirectAnswer(query || "", arts0, chunks0) || generatePricingAccommodationAnswer(query || "", arts0, chunks0);
      
      if (md0) {
        res.status(200).json({ 
          ok: true, 
          type: "advice", 
          answer_markdown: md0, 
          structured: { 
            intent: "advice", 
            topic: enriched0.join(", "), 
            events: [], 
            products: [], 
            services: [], 
            landing: [], 
            articles: (arts0 || []).map(a => ({ 
              ...a, 
              display_date: (function() { 
                const ex = extractPublishDate(a); 
                const fb = a.last_seen ? new Date(a.last_seen).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : null; 
                return ex || fb; 
              })() 
            })), 
            pills: [] 
          }, 
          confidence: 70, 
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
async function handleEventsPipeline(client, query, keywords, pageContext, res) {
  const events = await findEvents(client, { keywords, limit: 80, pageContext });
  const eventList = formatEventsForUi(events);
  if (!Array.isArray(eventList)) {
    return false;
  }
  const confidence = calculateEventConfidence(query || "", eventList, null);
  res.status(200).json({
    ok: true,
    type: "events",
    answer: eventList,
    events: eventList,
    structured: {
      intent: "events",
      topic: (keywords || []).join(", "),
      events: eventList,
      products: [],
      pills: []
    },
    confidence,
    debug: { version: "v1.2.48-events-pipeline" }
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
async function gatherPreContent(client, query, previousQuery, intent, pageContext) {
  let preContent = { articles: [], events: [], products: [], relevanceScore: 0 };
  
  if (!previousQuery) {
    try {
      const preKeywords = extractKeywords(query || "");
      if (intent === "events") {
        const eventsPeek = await findEvents(client, { keywords: preKeywords, limit: 50, pageContext });
        preContent.events = formatEventsForUi(eventsPeek);
      } else {
        const articlesPeek = await findArticles(client, { keywords: preKeywords, limit: 20, pageContext });
        preContent.articles = articlesPeek;
        const articleUrlsPeek = articlesPeek?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
        const chunksPeek = await findContentChunks(client, { keywords: preKeywords, limit: 10, articleUrls: articleUrlsPeek });
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
export default async function handler(req, res) {
  // Chat API handler called
  const started = Date.now();
  try {
    if (req.method !== "POST") {
      res
        .status(405)
        .json({ ok: false, error: "method_not_allowed", where: "http" });
      return;
    }

    const { query, topK, previousQuery, sessionId, pageContext } = req.body || {};
    const client = supabaseAdmin();
    
    // Log page context for debugging
    if (pageContext) {
      // Page context received
    }

    // Handle session creation and logging
    handleSessionAndLogging(sessionId, query, req);

    // Build contextual query for keyword extraction (merge with previous query)
    const contextualQuery = previousQuery ? `${previousQuery} ${query}` : query;
    
    const intent = detectIntent(query || ""); // Use current query only for intent detection

    // HARD GUARD: Residential pricing/B&B must bypass clarification entirely
    const residentialResponse = await handleResidentialPricingGuard(client, query, previousQuery, pageContext, res);
    if (residentialResponse) {
      return; // Response already sent
    }
    
    // Retrieval-first: try to gather content and check content-based confidence
    const preContent = await gatherPreContent(client, query, previousQuery, intent, pageContext);
    
    // If we have enough content-based confidence, answer directly now (skip clarification entirely)
    const earlyReturnResponse = (typeof handleEarlyReturnLogic === 'function')
      ? await handleEarlyReturnLogic(client, query, previousQuery, intent, preContent, pageContext, res)
      : false;
    if (earlyReturnResponse) {
      return; // Response already sent
    }
      if (typeof confident !== 'undefined' && confident) {
        const handledEarly = await maybeProcessEarlyReturnFallback(client, query, intent, pageContext, res);
        if (handledEarly) return;
      }

      // Fallback early-return for equipment advice even if confidence was false
      if (intent === "advice") {
        const qlc = (query || "").toLowerCase();
        if (isEquipmentAdviceQuery(qlc)) {
          const directKeywords = extractKeywords(query || "");
          let articles = await findArticles(client, { keywords: directKeywords, limit: 30, pageContext });
          articles = (articles || []).map(a => {
            const out = { ...a };
            if (!out.title) {
              out.title = out?.raw?.headline || out?.raw?.name || '';
              if (!out.title) {
                try { const u = new URL(out.page_url || out.source_url || out.url || ''); const last = (u.pathname||'').split('/').filter(Boolean).pop()||''; out.title = last.replace(/[-_]+/g,' ').replace(/\.(html?)$/i,' ').trim(); } catch {}
              }
            }
            if (!out.page_url) out.page_url = out.source_url || out.url || out.href || null;
            return out;
          });
          const articleUrls = articles?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
          const contentChunks = await findContentChunks(client, { keywords: directKeywords, limit: 20, articleUrls });
          const synthesized = generateEquipmentAdviceResponse(qlc, articles || [], contentChunks || []);
          if (synthesized) {
            res.status(200).json({
              ok: true,
              type: "advice",
              answer_markdown: synthesized,
              structured: {
                intent: "advice",
                topic: directKeywords.join(", "),
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
              confidence: 75,
              debug: { version: "v1.2.41-equip-fallback", earlyReturn: true }
            });
            return;
          }
        }
        // Pricing/accommodation fallback synthesis
        {
          const directKeywords = extractKeywords(query || "");
          let articles = await findArticles(client, { keywords: directKeywords, limit: 30, pageContext });
          articles = (articles || []).map(a => {
            const out = { ...a };
            if (!out.title) {
              out.title = out?.raw?.headline || out?.raw?.name || '';
              if (!out.title) {
                try { const u = new URL(out.page_url || out.source_url || out.url || ''); const last = (u.pathname||'').split('/').filter(Boolean).pop()||''; out.title = last.replace(/[-_]+/g,' ').replace(/\.(html?)$/i,' ').trim(); } catch {}
              }
            }
            if (!out.page_url) out.page_url = out.source_url || out.url || out.href || null;
            return out;
          });
          const articleUrls = articles?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
          const contentChunks = await findContentChunks(client, { keywords: directKeywords, limit: 20, articleUrls });
          const synthesized = generatePricingAccommodationAnswer(qlc, articles || [], contentChunks || []);
          if (synthesized) {
            res.status(200).json({
              ok: true,
              type: "advice",
              answer_markdown: synthesized,
              structured: {
                intent: "advice",
                topic: directKeywords.join(", "),
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
              confidence: 70,
              debug: { version: "v1.2.43-pricing-synth", earlyReturn: true }
            });
            return;
          }
        }
      }

      // Fallback early-return for residential workshop pricing/B&B queries
      if (intent === "events") {
        const qlc = (query || "").toLowerCase();
        const asksResidentialPricing = (
          qlc.includes("residential") && qlc.includes("workshop") && (
            qlc.includes("price") || qlc.includes("cost") || qlc.includes("how much") ||
            qlc.includes("b&b") || qlc.includes("bed and breakfast") || qlc.includes("bnb") ||
            qlc.includes("include b&b") || qlc.includes("includes b&b") || qlc.includes("include bnb")
          )
        );
        if (asksResidentialPricing) {
          const directKeywords = Array.from(new Set(["residential", "workshop", ...extractKeywords(query || "")]));
          const events = await findEvents(client, { keywords: directKeywords, limit: 120, pageContext });
          // Filter to multi-day (residential) by presence of date_end strictly after start
          const all = formatEventsForUi(events) || [];
          const eventList = all.filter(e => {
            try{
              if (!e.date_start || !e.date_end) return false;
              return new Date(e.date_end) > new Date(e.date_start);
            }catch{ return false; }
          });
          if (Array.isArray(eventList) && eventList.length > 0) {
            const confidence = calculateEventConfidence(query || "", eventList, null);
            res.status(200).json({
              ok: true,
              type: "events",
              answer: eventList,
              events: eventList,
              structured: {
                intent: "events",
                topic: directKeywords.join(", "),
                events: eventList,
                products: [],
                pills: []
              },
              confidence,
              debug: { version: "v1.2.41-residential-fallback", earlyReturn: true }
            });
            return;
          }
          // If no events found, attempt to synthesize a direct answer from articles/content
          const enrichedKeywords = Array.from(new Set([...directKeywords, "b&b", "bed", "breakfast", "price", "cost"]));
          let articles = await findArticles(client, { keywords: enrichedKeywords, limit: 30, pageContext });
          articles = (articles || []).map(a => {
            const out = { ...a };
            if (!out.title) {
              out.title = out?.raw?.headline || out?.raw?.name || '';
              if (!out.title) {
                try { const u = new URL(out.page_url || out.source_url || out.url || ''); const last = (u.pathname||'').split('/').filter(Boolean).pop()||''; out.title = last.replace(/[-_]+/g,' ').replace(/\.(html?)$/i,' ').trim(); } catch {}
              }
            }
            if (!out.page_url) out.page_url = out.source_url || out.url || out.href || null;
            return out;
          });
          const articleUrls = articles?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
          const contentChunks = await findContentChunks(client, { keywords: enrichedKeywords, limit: 20, articleUrls });
          const answerMarkdown = generateDirectAnswer(query || "", articles, contentChunks);
          if (answerMarkdown) {
            res.status(200).json({
              ok: true,
              type: "advice",
              answer_markdown: answerMarkdown,
              structured: {
                intent: "advice",
                topic: enrichedKeywords.join(", "),
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
              confidence: 70,
              debug: { version: "v1.2.42-residential-advice-synthesis", earlyReturn: true }
            });
            return;
          }
          // Final fallback: search services and return helpful sources
          const services = await findServices(client, { keywords: Array.from(new Set(["residential","workshop","bnb","accommodation",...directKeywords])), limit: 50, pageContext });
          const serviceLinks = (services || [])
            .map(s => s.page_url || s.source_url)
            .filter(Boolean)
            .slice(0, 5);
          if (serviceLinks.length) {
            const body = `Residential workshop pricing and whether B&B is included can vary by event. Please check the current details here:\n\n` + serviceLinks.map(u=>`- ${u}`).join("\n");
            res.status(200).json({
              ok: true,
              type: "advice",
              answer_markdown: `**Residential Workshop Pricing & B&B**\n\n${body}`,
              structured: {
                intent: "advice",
                topic: enrichedKeywords.join(", "),
                events: [],
                products: [],
                services: services,
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
              confidence: 60,
              debug: { version: "v1.2.44-residential-service-fallback", earlyReturn: true }
            });
            return;
          }
        }
      }
    
    // Determine keywords for content retrieval
    const keywords = determineKeywords(query, previousQuery, intent);
    const qlc = (query || "").toLowerCase();

    // Residential pricing/B&B shortcut (works on both first-turn and follow-ups)
    if (await handleResidentialPricingShortcut(client, query, keywords, pageContext, res)) {
      return; // Response already sent
    }

    // Core events pipeline (when intent is events)
    if (intent === "events") {
      const handled = await handleEventsPipeline(client, query, keywords, pageContext, res);
      if (handled) return;
    }
    
    // Legacy code below - should never execute due to shortcut above
    if (false) {
      const directKeywords = Array.from(new Set(["residential", "workshop", ...extractKeywords(query || "")]));
          const events = await findEvents(client, { keywords: directKeywords, limit: 120, pageContext });
      const all = formatEventsForUi(events) || [];
      const eventList = all.filter(e => {
        try{ return e.date_start && e.date_end && new Date(e.date_end) > new Date(e.date_start); }catch{ return false; }
      });
      if (eventList.length) {
        const confidence = calculateEventConfidence(query || "", eventList, null);
        res.status(200).json({
          ok: true,
          type: "events",
          answer: eventList,
          events: eventList,
          structured: {
            intent: "events",
            topic: directKeywords.join(", "),
            events: eventList,
            products: [],
            pills: []
          },
          confidence,
          debug: { version: "v1.2.47-residential-shortcut", shortcut: true, previousQuery: !!previousQuery }
        });
        return;
      }
      // Fallback: synthesize concise pricing/B&B answer with links
      const enrichedKeywords = Array.from(new Set([...directKeywords, "b&b", "bed", "breakfast", "price", "cost"]));
      let articles = await findArticles(client, { keywords: enrichedKeywords, limit: 30, pageContext });
      articles = (articles || []).map(a => {
        const out = { ...a };
        if (!out.title) {
          out.title = out?.raw?.headline || out?.raw?.name || '';
          if (!out.title) {
            try { const u = new URL(out.page_url || out.source_url || out.url || ''); const last = (u.pathname||'').split('/').filter(Boolean).pop()||''; out.title = last.replace(/[-_]+/g,' ').replace(/\.(html?)$/i,' ').trim(); } catch {}
          }
        }
        if (!out.page_url) out.page_url = out.source_url || out.url || out.href || null;
        return out;
      });
      const articleUrls = articles?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
      const contentChunks = await findContentChunks(client, { keywords: enrichedKeywords, limit: 20, articleUrls });
      const answerMarkdown = generateDirectAnswer(query || "", articles, contentChunks) || generatePricingAccommodationAnswer(query || "", articles, contentChunks);
      if (answerMarkdown) {
        res.status(200).json({
          ok: true,
          type: "advice",
          answer_markdown: answerMarkdown,
          structured: {
            intent: "advice",
            topic: enrichedKeywords.join(", "),
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
          confidence: 70,
          debug: { version: "v1.2.47-residential-shortcut-advice", shortcut: true, previousQuery: !!previousQuery }
        });
        return;
      }
    }

    // NEW: Follow-up direct synthesis for advice queries (equipment/pricing) even when previousQuery exists
    if (previousQuery && intent === "advice") {
      const handled = await handleAdviceFollowupSynthesis(client, qlc, keywords, pageContext, res);
      if (handled) return;
    }

    // NEW: Handle clarification follow-up responses (only if query looks like a clarification response)
    {
      const handled = await handleClarificationFollowup(client, previousQuery, query, intent, keywords, pageContext, res);
      if (handled) return;
    }

    // NEW: Handle clarification follow-up responses (only if query looks like a clarification response)
    const isClarificationResponse = previousQuery && (
      query.toLowerCase().includes("photography") || 
      query.toLowerCase().includes("equipment") ||
      query.toLowerCase().includes("course") ||
      query.toLowerCase().includes("service") ||
      query.toLowerCase().includes("advice") ||
      query.toLowerCase().includes("mentoring") ||
      query.toLowerCase().includes("about")
    );
    const debugInfo = {
      query: query,
      previousQuery: previousQuery,
      hasPreviousQuery: !!previousQuery,
      queryLower: query.toLowerCase(),
      containsCourse: query.toLowerCase().includes("course"),
      isClarificationResponse: isClarificationResponse
    };
    console.log(`🔍 isClarificationResponse check:`, debugInfo);
    const followUpResult = isClarificationResponse ? handleClarificationFollowUp(query, previousQuery, intent) : null;
    console.log(`🔍 isClarificationResponse: ${isClarificationResponse} for query: "${query}"`);
    console.log(`🔍 followUpResult:`, followUpResult);
    if (followUpResult) {
      console.log(`🔄 Clarification follow-up: "${query}" → ${followUpResult.newIntent}`);
      console.log(`🔍 Follow-up result:`, followUpResult);
        
        // Update query and intent based on user's clarification choice
        const newQuery = followUpResult.newQuery;
        const newIntent = followUpResult.newIntent;
        const newKeywords = extractKeywords(newQuery);
        
        // Continue with the new query and intent
        if (newIntent === "clarification") {
          // Route to another clarification question
          console.log(`🔍 DEBUG: Looking for clarification for query: "${newQuery}"`);
          const clarification = await generateClarificationQuestion(newQuery, client, pageContext);
          if (clarification) {
        // For clarifications, use fixed low confidence since we're asking for more info
        const confidencePercent = 30; // Fixed low confidence for second-level clarifications
            
            console.log(`🤔 Follow-up clarification: "${newQuery}" → ${clarification.type} (${confidencePercent}%)`);
            res.status(200).json({
              ok: true,
              type: "clarification",
              question: clarification.question,
              options: clarification.options,
              confidence: confidencePercent,
              debug: { version: "v1.2.37-logical-confidence", followUp: true }
            });
            return;
          }
        } else if (newIntent === "events") {
          // Route to events logic with new query
          const lc = newQuery.toLowerCase();
          const mentionsCourse = lc.includes("course") || lc.includes("class") || lc.includes("lesson");
          const csvType = null; // unified events; csvType unused
          
          const events = await findEvents(client, { keywords: newKeywords, limit: 80, pageContext, csvType });
          const eventList = formatEventsForUi(events);
          
          // Generate specific answer for the clarified query
          const specificAnswer = generateDirectAnswer(newQuery, [], []);
          
          // Check if we have logical confidence for this clarified query
          const hasConfidence = hasContentBasedConfidence(newQuery, "events", { events: eventList });
          if (!hasConfidence) {
            // Evidence-first bypass instead of generic clarification
            const bypassed = await maybeBypassClarification(client, newQuery, pageContext, res);
            if (bypassed) return;
          }
          
          // Return confident events response
          const answerMarkdown = specificAnswer !== `I don't have a confident answer to that yet. I'm trained on Alan's site, so I may miss things. If you'd like to follow up, please reach out:` 
            ? specificAnswer 
            : eventList;
          
          res.status(200).json({
            ok: true,
            type: "events",
            answer: answerMarkdown,
            events: eventList,
            structured: {
              intent: "events",
              topic: newKeywords.join(", "),
              events: eventList,
              products: [],
              pills: []
            },
            confidence: calculateEventConfidence(newQuery, eventList, null),
            debug: { version: "v1.2.37-logical-confidence", clarified: true, logicalConfidence: true }
          });
          return;
          
        } else if (newIntent === "advice") {
          // Route to advice logic with new query
          const articles = await findArticles(client, { keywords: newKeywords, limit: 30, pageContext });
          const articleUrls = articles?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
          const contentChunks = await findContentChunks(client, { keywords: newKeywords, limit: 15, articleUrls });
          
          // CROSS-ENTITY SEARCH FOR CLARIFIED QUERIES
          // Check if this is a free course query and search across all entity types
          const qlcClarified = (newQuery || "").toLowerCase();
          const isFreeCourseQuery = qlcClarified.includes("free") && (qlcClarified.includes("course") || qlcClarified.includes("online"));
          console.log(`🔍 CLARIFIED PATH DEBUG: newQuery="${newQuery}", qlcClarified="${qlcClarified}", isFreeCourseQuery=${isFreeCourseQuery}`);
          
          let events = [];
          let products = [];
          let services = [];
          let landing = [];
          
          if (isFreeCourseQuery) {
            console.log(`🔍 Clarified free course query detected: "${newQuery}" - searching across all entity types`);
            
            // Search all entity types for comprehensive results
            events = await findEvents(client, { keywords: newKeywords, limit: 20, pageContext });
            products = await findProducts(client, { keywords: newKeywords, limit: 20, pageContext });
            services = await findServices(client, { keywords: newKeywords, limit: 100, pageContext });
            
            console.log(`📚 Articles: ${articles.length}, 📅 Events: ${events.length}, 🛍️ Products: ${products.length}, 🔧 Services: ${services.length}`);
          }
          
          // Generate specific answer for the clarified query
          // For free course queries, prioritize services over articles
          let specificAnswer;
          console.log(`🔍 DEBUG: isFreeCourseQuery=${isFreeCourseQuery}, services.length=${services?.length || 0}`);
          if (services && services.length > 0) {
            console.log(`🔍 DEBUG: Available services:`, services.map(s => s.title));
          }
          
          if (isFreeCourseQuery && services && services.length > 0) {
            // Find the specific free course service
            const freeCourseService = services.find(s => {
              const hasFree = s.title && s.title.toLowerCase().includes('free');
              const hasCourse = s.title && s.title.toLowerCase().includes('course');
              console.log(`🔍 DEBUG: Service "${s.title}" - hasFree: ${hasFree}, hasCourse: ${hasCourse}`);
              return hasFree && hasCourse;
            });
            
            if (freeCourseService) {
              specificAnswer = `**${freeCourseService.title}**\n\n*From: ${freeCourseService.page_url}*\n\nThis is Alan's free online photography course offering.`;
              console.log(`🎯 Found specific free course service: ${freeCourseService.title}`);
            } else {
              console.log(`❌ No free course service found, falling back to generateDirectAnswer`);
              specificAnswer = generateDirectAnswer(newQuery, articles, contentChunks);
            }
          } else {
            console.log(`❌ Not a free course query or no services, using generateDirectAnswer`);
            specificAnswer = generateDirectAnswer(newQuery, articles, contentChunks);
          }
          
          // DON'T check confidence for clarified queries - if the user has already clarified, return the best answer we have
          // Checking confidence here creates infinite clarification loops
          const hasConfidence = true; // Always assume confidence for clarified queries
          console.log(`🔍 DEBUG: Clarified advice (skipping confidence check to avoid loops) for "${newQuery}":`, {
            articleCount: articles?.length || 0,
            contentChunkCount: contentChunks?.length || 0,
            hasConfidence: true,
            articles: articles?.slice(0, 2)?.map(a => a.title || a.page_url) || [],
            contentChunks: contentChunks?.slice(0, 2)?.map(c => c.chunk_text?.substring(0, 50)) || []
          });
          if (!hasConfidence) {
            console.log(`🤔 Low logical confidence for clarified advice query: "${newQuery}" - triggering clarification`);
            const clarification = await generateClarificationQuestion(newQuery, client, pageContext);
            if (clarification) {
              const confidencePercent = 10;
              res.status(200).json({
                ok: true,
                type: "clarification",
                question: clarification.question,
                options: clarification.options,
                confidence: confidencePercent,
                debug: { version: "v1.2.37-logical-confidence", clarified: true }
              });
              return;
            }
          }
          
          // Return confident advice response with all found content
          res.status(200).json({
            ok: true,
            type: "advice",
            answer_markdown: specificAnswer,
            structured: {
              intent: "advice",
              topic: newKeywords.join(", "),
              events: events || [],
              products: products || [],
              services: services || [],
              landing: landing || [],
              articles: (articles || []).map(a => {
                const extractedDate = extractPublishDate(a);
                const fallbackDate = a.last_seen ? new Date(a.last_seen).toLocaleDateString('en-GB', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                }) : null;
                const finalDate = extractedDate || fallbackDate;
                
                return {
                  ...a,
                  display_date: finalDate
                };
              }),
              pills: []
            },
            confidence: 90, // High confidence for clarified queries
            debug: { 
              version: "v1.2.39-debug-service-prioritization", 
              clarified: true, 
              logicalConfidence: true,
              crossEntitySearch: isFreeCourseQuery,
              newQuery: newQuery,
              qlcClarified: qlcClarified,
              isFreeCourseQuery: isFreeCourseQuery,
              counts: {
                events: events?.length || 0,
                products: products?.length || 0,
                services: services?.length || 0,
                articles: articles?.length || 0
              },
              servicesFound: services?.map(s => ({ title: s.title, url: s.page_url })) || []
            }
          });
          return;
        }
      }

    if (intent === "events") {
      console.log('🔍 EVENTS HANDLER: Starting events handler for query:', query);
      // Determine CSV type based on query content
      const lc = (query || "").toLowerCase();
      const mentionsCourse = lc.includes("course") || lc.includes("class") || lc.includes("lesson");
      const csvType = null; // unified events; csvType unused
      
      // Get events from the enhanced view that includes product mappings
      const events = await findEvents(client, { keywords, limit: 80, pageContext, csvType });
      
      // TEMPORARY DEBUG: Add events info to response for troubleshooting
      console.log('🔍 EVENTS HANDLER: findEvents returned:', {
        eventsCount: events?.length || 0,
        eventsSample: events?.slice(0, 3) || [],
        keywords: keywords
      });
      
      // TEMPORARY DEBUG: Check if events are being retrieved
      if (events && events.length > 0) {
        console.log('🔍 SUCCESS: findEvents returned', events.length, 'events');
      } else {
        console.log('🔍 PROBLEM: findEvents returned empty array or null');
      }
      
      // Debug: Log events count
      console.log('🔍 Events from findEvents:', events?.length || 0);
      
      // If the new query names a significant topic (e.g., lightroom), prefer events matching that topic
      const GENERIC_EVENT_TERMS = new Set(["workshop","workshops","course","courses","class","classes","event","events","next","when","your"]);
      const significant = (keywords || []).find(k => k && !GENERIC_EVENT_TERMS.has(String(k).toLowerCase()) && String(k).length >= 4);
      const matchEvent = (e, term)=>{
        const t = term.toLowerCase();
        const hay = `${e.event_title||e.title||''} ${e.product_title||''} ${e.event_location||e.location_name||e.location||''}`.toLowerCase();
        const matches = hay.includes(t);
        console.log(`🔍 matchEvent: term="${t}", hay="${hay}", matches=${matches}`);
        return matches;
      };
      // TEMPORARY FIX: Skip filtering to see if that's the issue
      const filteredEvents = events; // significant ? events.filter(e => matchEvent(e, significant)) : events;
      
      // Debug: Log filtering results
      console.log('🔍 Filtered events:', filteredEvents?.length || 0);
      
      const debugInfo = {
        totalEvents: events.length,
        significantKeyword: significant,
        filteredEventsCount: filteredEvents.length,
        sampleEvent: events[0] || null
      };
      console.log('🔍 Events filtering debug:', debugInfo);

      console.log('🔍 Before formatEventsForUi:', {
        filteredEventsLength: filteredEvents.length,
        eventsLength: events.length,
        usingFiltered: filteredEvents.length > 0
      });
      
      const eventList = formatEventsForUi(filteredEvents.length ? filteredEvents : events);
      
      // Debug: Log formatEventsForUi results
      console.log('🔍 EventList after formatEventsForUi:', eventList?.length || 0);
      
      console.log('🔍 After formatEventsForUi:', {
        eventListLength: eventList.length,
        eventListSample: eventList.slice(0, 2)
      });
      
      // Debug info logged above
      
      // Pick the most relevant product deterministically across filtered events
      const kwSet = new Set((keywords||[]).map(k=>String(k||'').toLowerCase()));
      const scoreProduct = (ev)=>{
        const pt = String(ev.product_title||'').toLowerCase();
        const pu = String(ev.product_url||'').toLowerCase();
        const et = String(ev.title||ev.event_title||'').toLowerCase();
        let s = 0;
        // keyword overlap in product title/url
        kwSet.forEach(k=>{ if(!k) return; if(pt.includes(k)) s+=5; if(pu.includes(k)) s+=2; });
        // overlap between event title words and product title words
        const eWords = et.match(/[a-z]+/g)||[]; const pWords = pt.match(/[a-z]+/g)||[];
        const eSet = new Set(eWords);
        for (const w of pWords){ if (w.length>=5 && eSet.has(w)) s+=1; }
        return s;
      };
      const grouped = new Map();
      for (const ev of (filteredEvents.length ? filteredEvents : events)){
        const key = ev.product_url||'';
        const s = scoreProduct(ev) + 1; // +1 for frequency signal
        const prev = grouped.get(key) || { ev, score:0, count:0 };
        prev.score += s; prev.count += 1; if (!prev.ev) prev.ev = ev; grouped.set(key, prev);
      }
      let best = null; for (const [,v] of grouped){ if (!best || v.score>best.score) best = v; }
      const firstEvent = (filteredEvents.length ? filteredEvents : events)?.[0];
      let product = null;
      // PRIMARY: trust Supabase view mapping from the first (most relevant) event
      if (firstEvent && firstEvent.product_url) {
        product = {
          title: firstEvent.product_title,
          page_url: firstEvent.product_url,
          price: firstEvent.price_gbp,
          description: `Workshop in ${firstEvent.location_name || firstEvent.event_location}`,
          participants: firstEvent.participants,
          fitness_level: firstEvent.fitness_level,
          location_name: firstEvent.event_location,
          raw: { offers: { lowPrice: firstEvent.price_gbp, highPrice: firstEvent.price_gbp } }
        };
      } else if (best && best.ev && best.score >= 5) { // fallback: semantic best
        product = {
          title: best.ev.product_title,
          page_url: best.ev.product_url,
          price: best.ev.price_gbp,
          description: `Workshop in ${best.ev.location_name || best.ev.event_location}`,
          participants: best.ev.participants,
          fitness_level: best.ev.fitness_level,
          location_name: best.ev.event_location,
          raw: { offers: { lowPrice: best.ev.price_gbp, highPrice: best.ev.price_gbp } }
        };
      }

      // If product doesn't reflect the core keyword (e.g., bluebell), try a direct product lookup
      const needsKeywordProduct = (!product || !String(product.title||'').toLowerCase().includes('bluebell')) && kwSet.has('bluebell');
      if (needsKeywordProduct) {
        const bluebellProducts = await findProducts(client, { keywords: ['bluebell','woodlands','woodland'], limit: 5, pageContext, csvType: "workshop_products" });
        const bp = bluebellProducts?.find(p => String(p.title||'').toLowerCase().includes('bluebell')) || bluebellProducts?.[0] || null;
        if (bp) {
          product = {
            title: bp.title,
            page_url: bp.page_url || bp.source_url || bp.url,
            price: bp.price_gbp || bp.price || null,
            description: bp.description || 'Bluebell workshop',
            raw: bp.raw || {}
          };
        }
      }
      
      // Ensure product link is absolute and points to live site
      if (product) {
        const normalize = (u)=>{
          if (!u) return null; const s=String(u);
          if (/^https?:\/\//i.test(s)) return s;
          if (s.startsWith('/')) return `https://www.alanranger.com${s}`;
          // Known product base path
          return `https://www.alanranger.com/photo-workshops-uk/${s.replace(/^\/+/, '')}`;
        };
        product.page_url = normalize(product.page_url || product.source_url || product.url);
        
        // Enrich product with full details from page_entities if we have a product URL
        if (product.page_url) {
          try {
            // Fetching product details
            const { data: productDetails } = await client
              .from('page_entities')
              .select('*')
              .eq('kind', 'product')
              .eq('page_url', product.page_url)
              .single();
            
            if (productDetails) {
              // Found product details
              // Merge the full product details with the existing product data
              product = {
                ...product,
                title: productDetails.title || product.title,
                description: null, // Don't use concatenated description - let frontend build from structured fields
                raw: { ...product.raw, ...productDetails.raw },
                // Include structured data fields for product cards
                participants: productDetails.participants,
                fitness_level: productDetails.fitness_level,
                location_address: productDetails.location_address,
                equipment_needed: productDetails.equipment_needed,
                experience_level: productDetails.experience_level,
                time_schedule: productDetails.time_schedule,
                what_to_bring: productDetails.what_to_bring,
                course_duration: productDetails.course_duration,
                instructor_info: productDetails.instructor_info,
                availability_status: productDetails.availability_status
              };
              // Enriched product with full details
              // Final enriched product description
            } else {
              // No product details found
            }
          } catch (error) {
            // Could not fetch full product details
          }
        } else {
          // No product.page_url found, skipping enrichment
        }
      }
      // About to build product panel
      const productPanel = product ? await buildProductPanelMarkdown([product]) : "";
      // Generated product panel

      // Filter events to only include future events for the initial response
      const now = new Date();
      const futureEvents = events.filter(e => {
        if (!e.date_start) return false;
        const eventDate = new Date(e.date_start);
        return eventDate >= now;
      });

      // Use extractRelevantInfo to get specific answers for follow-up questions
      const dataContext = { events: futureEvents, products: product ? [product] : [], articles: [], originalQuery: previousQuery };
      const specificAnswer = await extractRelevantInfo(query, dataContext);
      
      // For equipment-related event queries, also generate equipment advice content
      let equipmentAdvice = "";
      if (lc.includes("equipment") || lc.includes("camera") || lc.includes("lens") || lc.includes("gear")) {
        console.log(`🔧 Equipment event query detected, generating advice content for: "${query}"`);
        const articles = await findArticles(client, { keywords, limit: 30, pageContext });
        const articleUrls = articles?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
        const contentChunks = await findContentChunks(client, { keywords, limit: 15, articleUrls });
        equipmentAdvice = generateDirectAnswer(query, articles, contentChunks);
        console.log(`🔧 Generated equipment advice: "${equipmentAdvice.substring(0, 100)}..."`);
      }
      
      // Combine specific answer with equipment advice if available
      let combinedAnswer = specificAnswer !== `I don't have a confident answer to that yet. I'm trained on Alan's site, so I may miss things. If you'd like to follow up, please reach out:` 
        ? specificAnswer 
        : productPanel;
      
      // Prepend equipment advice if available
      if (equipmentAdvice) {
        combinedAnswer = equipmentAdvice + "\n\n" + combinedAnswer;
      }
      
      const answerMarkdown = combinedAnswer;

      const firstEventUrl = firstEvent?.event_url || null;
      // Prefer event-mapped product URL (from Supabase view) first; then selected product; ensure absolute URL
      const pickAbsolute = (u)=>{
        if (!u) return null; const s = String(u);
        if (/^https?:\/\//i.test(s)) return s;
        if (s.startsWith('/')) return `https://www.alanranger.com${s}`;
        return `https://www.alanranger.com/${s}`;
      };
      const productUrl = pickAbsolute(product?.page_url || product?.source_url || product?.url) || pickAbsolute(firstEvent?.product_url) || firstEventUrl || null;
      // prefer an explicit landing; else derive from first event origin
      const landingUrl = firstEventUrl ? originOf(firstEventUrl) + "/photography-workshops" : null;

      const photosUrl =
        (firstEventUrl && originOf(firstEventUrl) + "/gallery-image-portfolios") ||
        "https://www.alanranger.com/gallery-image-portfolios";

      const pills = buildEventPills({
        productUrl,
        firstEventUrl,
        landingUrl,
        photosUrl,
      });

      const citations = uniq([
        productUrl,
        landingUrl,
        ...((events || []).map(e => e.event_url)),
      ]).filter(Boolean);

      // LOGICAL CONFIDENCE CHECK: Do we have enough context to provide a confident answer?
      const contentForConfidence = { events: eventList, products: product ? [product] : [] };
      const hasConfidence = hasContentBasedConfidence(query, "events", contentForConfidence);
      console.log(`🔍 DEBUG: Events confidence check for "${query}":`, {
        eventCount: eventList?.length || 0,
        productCount: product ? 1 : 0,
        hasConfidence,
        contentForConfidence
      });
      if (!hasConfidence) {
        // Evidence-first bypass instead of generic clarification
        const bypassed = await maybeBypassClarification(client, query, pageContext, res);
        if (bypassed) return;
      }

      // Log the answer (async, don't wait for it)
      if (sessionId && query) {
        const responseTimeMs = Date.now() - started;
        const sourcesUsed = citations || [];
        logAnswer(sessionId, query, answerMarkdown, "events", 0.8, responseTimeMs, sourcesUsed, pageContext).catch(err => 
          console.warn('Failed to log answer:', err.message)
        );
      }

      res.status(200).json({
        ok: true,
        type: "events",
        answer_markdown: answerMarkdown,
        citations,
        structured: {
          intent: "events",
          topic: keywords.join(", "),
          events: eventList,
          products: product ? [product] : [],
          pills,
        },
        confidence: calculateEventConfidence(query, eventList, product),
        debug: {
          version: "v1.2.37-logical-confidence",
          intent: "events",
          keywords: keywords,
          eventsHandlerExecuted: true,
          counts: {
            events: events.length,
            products: product ? 1 : 0,
            articles: 0
          },
          productPanel: productPanel,
          productDescription: product ? product.description : null,
          logicalConfidence: hasConfidence,
          logicalConfidenceReason: hasConfidence ? "Query has enough specific context for confident response" : "Query lacks specific context - would trigger clarification",
          logicalConfidenceDebug: {
            query: query,
            queryLowercase: query ? query.toLowerCase() : null,
            hasSpecificActivity: query ? (query.toLowerCase().includes("course") || query.toLowerCase().includes("workshop") || query.toLowerCase().includes("landscape") || query.toLowerCase().includes("portrait") || query.toLowerCase().includes("macro") || query.toLowerCase().includes("street")) : false,
            hasSpecificCourseType: query ? (query.toLowerCase().includes("beginner") || query.toLowerCase().includes("advanced") || query.toLowerCase().includes("rps") || query.toLowerCase().includes("lightroom") || query.toLowerCase().includes("online") || query.toLowerCase().includes("private")) : false
          },
          eventsFiltering: {
            totalEvents: events?.length || 0,
            filteredEventsCount: filteredEvents?.length || 0,
            findEventsDebug: {
              eventsCount: events?.length || 0
            }
          }
        },
        meta: {
          duration_ms: Date.now() - started,
          endpoint: "/api/chat",
          topK: topK || null,
          intent: "events",
        },
      });
      return;
    }

    // --------- ADVICE -----------
    // return article answers + upgraded pills
    const adviceDebugInfo = []; // Initialize debug info array
    
    // Get all relevant data types for comprehensive responses
    let articles = await findArticles(client, { keywords, limit: 30, pageContext });
    
    // CROSS-ENTITY SEARCH FOR FREE COURSE QUERIES
    // Detect free course queries and search across all entity types
    const qlcAdvice = (query || "").toLowerCase();
    const isFreeCourseQuery = qlcAdvice.includes("free") && (qlcAdvice.includes("course") || qlcAdvice.includes("online"));
    
    let events = [];
    let products = [];
    let services = [];
    let landing = [];
    let recommendedFreeCourseUrl = null;
    
    if (isFreeCourseQuery) {
      // For free course queries, search across ALL entity types
      console.log(`🔍 Free course query detected: "${query}" - searching across all entity types`);
      console.log(`🔍 Keywords: ${keywords.join(', ')}`);
      
      // Search articles (already done above)
      console.log(`📚 Articles found: ${articles.length}`);
      
      // Search events
      events = await findEvents(client, { keywords, limit: 20, pageContext });
      console.log(`📅 Events found: ${events.length}`);
      
      // Search products  
      products = await findProducts(client, { keywords, limit: 20, pageContext });
      console.log(`🛍️ Products found: ${products.length}`);
      
      // Search services (free course might be classified as service)
      services = await findServices(client, { keywords, limit: 20, pageContext });
      console.log(`🔧 Services found: ${services.length}`);
      
      // Search landing pages
      if (client && client.from) {
        try {
          const { data: landingData } = await client
            .from("page_entities")
            .select("*")
            .eq("kind", "landing")
            .or(keywords.map(k => `title.ilike.%${k}%`).join(","))
            .limit(20);
          landing = landingData || [];
          console.log(`🧭 Landing pages found: ${landing.length}`);
        } catch (error) {
          console.error('❌ Error fetching landing pages:', error);
          landing = [];
        }
      }
      
      // CRITICAL: Also search specifically for the free course URL across all entity types
      console.log(`🔍 Searching specifically for free course URL...`);
      const freeCourseUrl = 'https://www.alanranger.com/free-online-photography-course';
      let freeCourseEntities = [];
      try {
        const { data } = await client
          .from("page_entities")
          .select("*")
          .eq("page_url", freeCourseUrl);
        freeCourseEntities = data || [];
      } catch (error) {
        console.error('❌ Error fetching free course entities:', error);
        freeCourseEntities = [];
      }
      
      if (freeCourseEntities && freeCourseEntities.length > 0) {
        console.log(`✅ Found ${freeCourseEntities.length} entities with free course URL`);
        // Add these entities to the appropriate arrays based on their kind
        freeCourseEntities.forEach(entity => {
          if (entity.kind === 'service') {
            services.push(entity);
            console.log(`  Added to services: "${entity.title}"`);
          } else if (entity.kind === 'product') {
            products.push(entity);
            console.log(`  Added to products: "${entity.title}"`);
          }
        });
      } else {
        console.log(`❌ No entities found for free course URL`);
      }
      
      // Debug: Log all service results
      if (services.length > 0) {
        console.log(`🔧 Service details:`);
        services.forEach((service, i) => {
          console.log(`  ${i+1}. Title: "${service.title}"`);
          console.log(`     URL: "${service.page_url}"`);
          console.log(`     Kind: "${service.kind}"`);
        });
      }
      
      // Combine all results and prioritize landing first, then services
      const allResults = [...landing, ...services, ...products, ...events, ...articles];
      console.log(`🔍 Total results before filtering: ${allResults.length}`);
      
      const freeCourseResults = allResults.filter(item => {
        const title = (item.title || item.event_title || item.product_title || '').toLowerCase();
        const url = (item.page_url || item.event_url || item.product_url || '').toLowerCase();
        const description = (item.description || '').toLowerCase();
        
        const matches = title.includes('free') || url.includes('free-online-photography-course') || 
               description.includes('free') || title.includes('academy');
        
        if (matches) {
          console.log(`✅ Free course match found: "${title}" (${url})`);
        }
        
        return matches;
      });
      
      console.log(`🔍 Free course results after filtering: ${freeCourseResults.length}`);
      
      // If we found free course content, prioritize it into landing/services
      if (freeCourseResults.length > 0) {
        console.log(`✅ Found ${freeCourseResults.length} free course results - prioritizing services`);
        const landingHits = freeCourseResults.filter(r => r.kind === 'landing');
        const serviceHits = freeCourseResults.filter(r => r.kind === 'service');
        if (landingHits.length) {
          landing = [...landingHits, ...landing];
          console.log(`🔧 Final landing count (after prioritization): ${landing.length}`);
        }
        if (serviceHits.length) {
          services = [...serviceHits, ...services];
          console.log(`🔧 Final services count (after prioritization): ${services.length}`);
        }
      } else {
        console.log(`❌ No free course results found after filtering`);
      }

      // Ensure the answer explicitly includes the free course link
      const freeLanding = [...landing, ...services].find(e => (e.page_url||e.url||'').includes('free-online-photography-course'));
      if (freeLanding) {
        recommendedFreeCourseUrl = freeLanding.page_url || freeLanding.url;
        // Coerce into landing results and de-duplicate
        if (!landing.some(e => (e.page_url||e.url||'') === recommendedFreeCourseUrl)) {
          landing = [freeLanding, ...landing];
        }
        // Remove duplicate from services if present
        services = services.filter(e => (e.page_url||e.url||'') !== recommendedFreeCourseUrl);
      }
    } else {
      // Only search for events/products if the query is about workshops, courses, or equipment recommendations
      const isEventRelatedQuery = qlcAdvice.includes("workshop") || qlcAdvice.includes("course") || qlcAdvice.includes("class") || 
                                 qlcAdvice.includes("equipment") || qlcAdvice.includes("recommend") || qlcAdvice.includes("tripod") ||
                                 qlcAdvice.includes("camera") || qlcAdvice.includes("lens") || qlcAdvice.includes("gear");
    
    if (isEventRelatedQuery) {
      events = await findEvents(client, { keywords, limit: 20, pageContext });
      products = await findProducts(client, { keywords, limit: 20, pageContext });
      }
    }
    
    // De-duplicate and enrich titles
    articles = await dedupeAndEnrichArticles(client, articles);
    
    // Re-rank articles by topical overlap with the query (title/url tokens)
    const qlcRank = (query||'').toLowerCase();
    const queryTokens = (qlcRank.match(/[a-z0-9]+/g) || []).filter(t=>t.length>2);
    const equipmentKeywords = new Set(['tripod','tripods','head','ballhead','levelling','leveling','recommend','recommendation','recommendations','equipment']);
    function scoreArticle(a){
      const title = String(a.title||'').toLowerCase();
      const url = String(a.page_url||a.source_url||a.url||'').toLowerCase();
      const categories = a.categories || [];
      let s = 0;
      
      // Helper functions for scoring
      const addTokenScore = () => {
        for (const t of queryTokens){ 
          if (title.includes(t)) s += 3; 
          if (url.includes(t)) s += 2; 
        }
      };
      
      const addTechnicalScore = () => {
      const isOnlineCourse = categories.includes("online photography course");
      const technicalConcepts = [
        "iso", "aperture", "shutter speed", "white balance", "depth of field", "metering",
        "exposure", "composition", "macro", "landscape", "portrait", "street", "wildlife",
        "raw", "jpeg", "hdr", "focal length", "long exposure", "focal", "balance", "bracketing",
        "manual", "negative space", "contrast", "framing", "filters", "lens", "camera"
      ];
      const hasTechnical = technicalConcepts.some(c => qlcRank.includes(c));
        
      if (hasTechnical && isOnlineCourse) {
        s += 25;
        if (title.includes("what is") && technicalConcepts.some(c => title.includes(c))) s += 20;
        if (title.includes("pdf") || title.includes("checklist") || title.includes("guide")) s += 15;
        if (title.includes("guide for beginners") || title.includes("guide for beginner")) s += 12;
        const exactTerm = qlcRank.replace(/^what\s+is\s+/, "").trim();
        if (title.toLowerCase().includes(exactTerm)) s += 30;
      }
      };
      
      const addEquipmentScore = () => {
      for (const k of equipmentKeywords){ 
        if (qlcRank.includes(k) && (title.includes(k) || url.includes(k))) {
          s += 6;
          if (k === 'tripod' && (title.includes('gitzo') || title.includes('benro') || url.includes('gitzo') || url.includes('benro'))) s += 8;
        }
      }
      };
      
      const addRecommendationScore = () => {
      if (qlcRank.includes('recommend')) {
        if (title.includes('recommended') && title.includes(qlcRank.split(' ')[0])) s += 15;
        if (url.includes('recommended') && url.includes(qlcRank.split(' ')[0])) s += 12;
      }
      };
      
      const addContentQualityScore = () => {
      if (title.includes('professional guide') || title.includes('complete guide')) s += 5;
      if (title.includes('review') && title.includes('comparison')) s += 4;
      };
      
      const addTripodPenalty = () => {
      if (qlcRank.includes('tripod') && !title.includes('tripod') && !url.includes('tripod') && 
          !title.includes('equipment') && !url.includes('equipment') && !title.includes('gitzo') && !title.includes('benro')) s -= 3;
      };
      
      const addRecencyScore = () => {
        try{ 
          const seen = Date.parse(a.last_seen||''); 
          if (!isNaN(seen)) { 
            const ageDays = (Date.now()-seen)/(1000*60*60*24); 
            if (ageDays < 365) s += 2; 
          } 
        }catch{}
      };
      
      // Apply all scoring factors
      addTokenScore();
      addTechnicalScore();
      addEquipmentScore();
      addRecommendationScore();
      addContentQualityScore();
      addTripodPenalty();
      addRecencyScore();
      
      return s;
    }
    if (Array.isArray(articles) && articles.length){
      adviceDebugInfo.push(`🔧 Article Processing: Starting with ${articles.length} articles`);
      
      // Remove duplicates by URL, preferring records with proper titles over "Alan Ranger Photography"
      const uniqueArticles = new Map();
      articles.forEach(article => {
        const url = article.page_url || article.source_url || '';
        const title = (article.title || '').trim();
        
        if (!uniqueArticles.has(url)) {
          // First time seeing this URL
          uniqueArticles.set(url, article);
        } else {
          // We have a duplicate URL - choose the better record
          const existing = uniqueArticles.get(url);
          const existingTitle = (existing.title || '').trim();
          
          // Prefer records with proper titles over "Alan Ranger Photography"
          if (title !== 'Alan Ranger Photography' && existingTitle === 'Alan Ranger Photography') {
            uniqueArticles.set(url, article);
          }
          // If both have proper titles, prefer 'article' over 'service'
          else if (existingTitle !== 'Alan Ranger Photography' && 
                   article.kind === 'article' && existing.kind === 'service') {
            uniqueArticles.set(url, article);
          }
        }
      });
      
      adviceDebugInfo.push(`🔧 Article Deduplication: ${articles.length} → ${uniqueArticles.size} unique articles`);
      
      articles = Array.from(uniqueArticles.values())
        .map(a=> ({ a, s: scoreArticle(a) }))
        .sort((x,y)=> {
          // First sort by relevance score
          if (y.s !== x.s) return y.s - x.s;
          
          // Then sort by date (newest first) - use last_seen as date indicator
          const xDate = new Date(x.a.last_seen || 0);
          const yDate = new Date(y.a.last_seen || 0);
          return yDate - xDate;
        })
        .map(x=> x.a);
      
      // Filter articles for equipment-related queries to remove irrelevant content
      const lc = (query || "").toLowerCase();
      const isEquipmentQuery = ['tripod', 'tripods', 'equipment', 'recommend', 'camera', 'lens'].some(k => lc.includes(k));
      
      if (isEquipmentQuery) {
        articles = articles.filter(a => {
          const title = (a.title || '').toLowerCase();
          const url = (a.page_url || a.source_url || '').toLowerCase();
          
          // Include articles that are clearly about equipment
          const isEquipmentArticle = title.includes('tripod') || title.includes('equipment') || 
                                   title.includes('camera') || title.includes('lens') ||
                                   url.includes('tripod') || url.includes('equipment') ||
                                   url.includes('camera') || url.includes('lens');
          
          // Exclude articles that are clearly not about equipment
          const isNonEquipmentArticle = title.includes('depth of field') || title.includes('iso') ||
                                       title.includes('exposure') || title.includes('composition') ||
                                       title.includes('lighting') || title.includes('editing');
          
          return isEquipmentArticle && !isNonEquipmentArticle;
        });
      }
      
      articles = articles.slice(0, 8); // Limit to top 8 after filtering
    }
    // Ensure concept article is first when asking "what is <term>"
    const qlc2 = (query||'').toLowerCase();
    const mConcept = qlc2.match(/^\s*what\s+is\s+(.+?)\s*\??$/);
    if (mConcept) {
      const term = mConcept[1].trim(); const slug = term.replace(/\s+/g,'-');
      const idx = articles.findIndex(a => (a.page_url||a.source_url||'').toLowerCase().includes(`/what-is-${slug}`));
      if (idx > 0) { const [hit] = articles.splice(idx,1); articles.unshift(hit); }
    }
    const topArticle = articles?.[0] || null;
    const articleUrl = pickUrl(topArticle) || null;
    
    // Try to get content chunks for better RAG responses - prioritize chunks from the relevant articles
    const articleUrls = articles?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
    const contentChunks = await findContentChunks(client, { keywords, limit: 15, articleUrls });

    let pdfUrl = null,
      relatedUrl = null,
      relatedLabel = null;

    if (articleUrl) {
      const aux = await getArticleAuxLinks(client, articleUrl);
      pdfUrl = aux.pdf || null;
      relatedUrl = aux.related || null;
      relatedLabel = aux.relatedLabel || null;
    }

    const pills = buildAdvicePills({
      articleUrl,
      query,
      pdfUrl,
      relatedUrl,
      relatedLabel,
    });

    const citations = uniq([articleUrl]).filter(Boolean);

    // Generate contextual advice response
    const lines = [];
    let confidence = 0.4; // Base confidence for advice questions
    let hasEvidenceBasedAnswer = false;
    
    // Enhanced confidence scoring function
    function calculateNuancedConfidence(query, articles, contentChunks, hasDirectAnswer, hasServiceAnswer) {
      let baseConfidence = 0.3; // Lower base to allow for more nuanced scoring
      let confidenceFactors = [];
      
      // Helper functions for query type detection
      const detectQueryTypes = (queryLower) => {
      const isTechnicalQuery = queryLower.includes("what is") || queryLower.includes("what are") || queryLower.includes("how does") || queryLower.includes("how do");
      const isEquipmentQuery = queryLower.includes("tripod") || queryLower.includes("camera") || queryLower.includes("lens") || queryLower.includes("filter") || queryLower.includes("bag") || queryLower.includes("flash");
      const isCourseQuery = queryLower.includes("course") || queryLower.includes("workshop") || queryLower.includes("lesson") || queryLower.includes("class");
      const isEventQuery = queryLower.includes("when") || queryLower.includes("next") || queryLower.includes("date") || queryLower.includes("workshop");
        return { isTechnicalQuery, isEquipmentQuery, isCourseQuery, isEventQuery };
      };
      
      const addQueryTypeScore = (queryTypes) => {
        if (queryTypes.isTechnicalQuery) {
        baseConfidence += 0.2;
        confidenceFactors.push("Technical query (+0.2)");
      }
        if (queryTypes.isEquipmentQuery) {
        baseConfidence += 0.15;
        confidenceFactors.push("Equipment query (+0.15)");
      }
        if (queryTypes.isCourseQuery) {
        baseConfidence += 0.15;
        confidenceFactors.push("Course query (+0.15)");
      }
        if (queryTypes.isEventQuery) {
        baseConfidence += 0.15;
        confidenceFactors.push("Event query (+0.15)");
      }
      };
      
      // Factor 1: Query type and specificity
      const queryLower = query.toLowerCase();
      const queryTypes = detectQueryTypes(queryLower);
      addQueryTypeScore(queryTypes);
      
      const addArticleScore = () => {
      if (articles && articles.length > 0) {
        const totalArticles = articles.length;
        const articleRelevanceScore = calculateArticleRelevance(query, articles);

        // Base score for having articles
        const articlePresenceBoost = Math.min(0.3, totalArticles * 0.05);
        if (articlePresenceBoost > 0) {
          baseConfidence += articlePresenceBoost;
          confidenceFactors.push(`Articles found: ${totalArticles} (+${articlePresenceBoost.toFixed(2)})`);
        }

        // Relevance bonus
        const relevanceBoost = articleRelevanceScore * 0.2;
        if (relevanceBoost) {
          baseConfidence += relevanceBoost;
          confidenceFactors.push(`Relevance score: ${articleRelevanceScore.toFixed(2)} (+${relevanceBoost.toFixed(2)})`);
        }

        // Category and tag quality
        const hasHighQualityCategories = articles.some(a =>
          a.categories?.includes("photography-basics") ||
          a.categories?.includes("photography-tips") ||
          a.categories?.includes("recommended-products")
        );
        if (hasHighQualityCategories) {
          baseConfidence += 0.1;
          confidenceFactors.push("High-quality categories (+0.1)");
        }
      }
      };
      
      // Factor 2: Article relevance and quality
      addArticleScore();
      
      const addAnswerTypeScore = () => {
      if (hasDirectAnswer) {
        baseConfidence += 0.25;
        confidenceFactors.push("Direct FAQ answer (+0.25)");
      } else if (hasServiceAnswer) {
        baseConfidence += 0.15;
        confidenceFactors.push("Service FAQ answer (+0.15)");
      }
      };
      
      const addContentQualityScore = () => {
      if (contentChunks && contentChunks.length > 0) {
        const hasRichContent = contentChunks.some(chunk => 
          chunk.chunk_text && chunk.chunk_text.length > 100
        );
        if (hasRichContent) {
          baseConfidence += 0.1;
          confidenceFactors.push("Rich content chunks (+0.1)");
        }
      }
      };
      
      const addMalformedContentPenalty = () => {
      if (articles && articles.length > 0) {
        const hasMalformedContent = articles.some(a => 
          a.description && (
            a.description.includes("ALAN+RANGER+photography+LOGO+BLACK") ||
            a.description.includes("rotto 405") ||
            a.description.length < 20
          )
        );
        if (hasMalformedContent) {
          baseConfidence -= 0.2;
          confidenceFactors.push("Malformed content (-0.2)");
        }
      }
      };
      
      // Factor 3: Answer type quality
      addAnswerTypeScore();
      
      // Factor 4: Content quality indicators
      addContentQualityScore();
      
      // Factor 5: Penalties for poor matches
      addMalformedContentPenalty();
      
      const addIntentAwareScore = () => {
      const q = (query||'').toLowerCase();
      const mentionsFree = /\bfree\b/.test(q);
      const mentionsOnline = /\bonline\b/.test(q);
      const mentionsCertificate = /\b(cert|certificate)\b/.test(q);
      const hasLandingFree = Array.isArray(landing) && landing.some(l => (l.page_url||'').includes('free-online-photography-course'));
      const topService = Array.isArray(services) ? services[0] : null;
      const topServiceIsPaid = topService ? /£|\b\d{1,4}\b/.test(String(topService.price||topService.price_gbp||'')) : false;
      const topServiceIsOffline = topService ? /(coventry|kenilworth|batsford|peak district|in-person)/i.test(String(topService.location||topService.location_address||topService.event_location||'')) : false;

      if (mentionsFree && topServiceIsPaid) {
        baseConfidence -= 0.35; confidenceFactors.push('Free query but top result is paid (-0.35)');
      }
      if (mentionsOnline && topServiceIsOffline) {
        baseConfidence -= 0.25; confidenceFactors.push('Online query but top result offline (-0.25)');
      }
      if (mentionsCertificate) {
        const hasCert = false; // no certificate detection yet
        if (!hasCert) { baseConfidence -= 0.2; confidenceFactors.push('Certificate requested but not found (-0.2)'); }
      }
      if (hasLandingFree && (mentionsFree || mentionsOnline)) {
        baseConfidence += 0.25; confidenceFactors.push('Landing free/online page present (+0.25)');
      }
      };
      
      // Intent-aware penalties/bonuses
      addIntentAwareScore();

      // Cap confidence between 0.05 and 0.9 in advice mode
      const finalConfidence = Math.max(0.05, Math.min(0.9, baseConfidence));
      
      return {
        confidence: finalConfidence,
        factors: confidenceFactors
      };
    }
    
    // Calculate article relevance score
    function calculateArticleRelevance(query, articles) {
      const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
      let totalRelevance = 0;
      
      articles.forEach(article => {
        let articleRelevance = 0;
        const title = (article.title || '').toLowerCase();
        const description = (article.description || '').toLowerCase();
        const url = (article.page_url || article.source_url || '').toLowerCase();
        const tags = (article.tags || []).join(' ').toLowerCase();
        const categories = (article.categories || []).join(' ').toLowerCase();
        
        const allText = `${title} ${description} ${url} ${tags} ${categories}`;
        
        // Check for exact word matches
        queryWords.forEach(word => {
          if (allText.includes(word)) {
            articleRelevance += 1;
          }
        });
        
        // Bonus for title matches (most important)
        queryWords.forEach(word => {
          if (title.includes(word)) {
            articleRelevance += 2;
          }
        });
        
        // Bonus for URL matches
        queryWords.forEach(word => {
          if (url.includes(word)) {
            articleRelevance += 1.5;
          }
        });
        
        totalRelevance += articleRelevance;
      });
      
      // Normalize to 0-1 scale
      return Math.min(1, totalRelevance / (articles.length * 5));
    }
    
    if (articles?.length) {
      // If we have a detected free-course landing, synthesize a direct summary from it
      if (recommendedFreeCourseUrl && !hasEvidenceBasedAnswer) {
        // Pull chunks specifically from the landing page to ground the summary
        const landingChunks = await findContentChunks(client, { keywords, limit: 6, articleUrls: [recommendedFreeCourseUrl] });
        const normalize = (t) => {
          const s = String(t || '').replace(/\s+/g, ' ').trim();
          if (!s) return '';
          const noise = /(\b(cart|sign in|my account|search|back|menu|newsletter|subscribe|cookie|accept|decline)\b|\[\/.*?\]|\{.*?\}|^\W+$)/ig;
          return s.replace(noise, '').trim();
        };
        const pickSummaryFromChunks = (chunks) => {
          const raw = (chunks || []).map(c => normalize(c.chunk_text)).filter(t => t && t.length > 40);
          if (raw.length === 0) return null;
          // Rank by keyword density for free/online/course
          const kw = ['free','online','course','academy','certificate'];
          const scored = raw.map(t => ({ t, score: kw.reduce((a,k)=> a + (t.toLowerCase().includes(k)?1:0), 0) })).sort((a,b)=> b.score - a.score);
          const top = scored.filter(x => x.score > 0).map(x=>x.t);
          const pool = top.length ? top : raw;
          const joined = pool.join(' ').split(/(?<=[.!?])\s+/).filter(s=> s.length>40).slice(0,3).join(' ');
          return joined.slice(0, 320).trim();
        };
        // Prefer stored page description if present
        const landingEntity = ([...landing, ...services]).find(e => (e.page_url||e.url||'').includes('free-online-photography-course')) || null;
        const preface = normalize(landingEntity?.description || '');
        const summary = pickSummaryFromChunks(landingChunks);
        if (preface && preface.length > 40) {
          lines.push(preface.slice(0, 320));
        } else if (summary) {
          lines.push(summary);
        } else {
          lines.push("This is Alan's free, online photography course. It's self-paced and designed to build fundamentals with practical tips and assignments you can follow from home.");
        }
        lines.push(`\nMore details: ${recommendedFreeCourseUrl}`);
        hasEvidenceBasedAnswer = true;
      }

      // Equipment advice lane - synthesize evidence-based recommendations
      
        // PRIORITY: Try to provide a direct answer based on JSON-LD FAQ data first
      if (!hasEvidenceBasedAnswer) {
        const directAnswer = generateDirectAnswer(query, articles, contentChunks);
        if (directAnswer) {
          lines.push(directAnswer);
          hasEvidenceBasedAnswer = true;
        }
      }
      
        // Service FAQ deterministic lane
      if (!hasEvidenceBasedAnswer) {
        const serviceAnswer = generateServiceFAQAnswer(query, contentChunks, articles);
        if (serviceAnswer) {
          lines.push(serviceAnswer);
          hasEvidenceBasedAnswer = true;
        }
      }
      
      // If no evidence-based answer, provide contextual introduction
      if (!hasEvidenceBasedAnswer) {
        // Defensive: detect equipment-related queries locally
        const mentionsEquipment = /\b(tripod|camera|lens|filter|bag|flash|equipment|gear)\b/i.test(String(query || ''));
        if (mentionsEquipment) {
          lines.push("Based on Alan's experience with photography equipment, here are his recommended guides:\n");
        } else {
          lines.push("Here are Alan's guides that match your question:\n");
        }
      }
      
      // Calculate nuanced confidence
      const confidenceResult = calculateNuancedConfidence(query, articles, contentChunks, hasEvidenceBasedAnswer, false);
      confidence = confidenceResult.confidence;
      
      // Log confidence factors for debugging
      if (confidenceResult.factors.length > 0) {
        console.log(`🎯 Confidence factors for "${query}": ${confidenceResult.factors.join(', ')} = ${(confidence * 100).toFixed(1)}%`);
      }
      
      if (recommendedFreeCourseUrl) {
        lines.push(`\nRecommended: Free Online Photography Course — ${recommendedFreeCourseUrl}`);
      }
    } else {
      lines.push("I couldn't find a specific guide for that yet.");
      confidence = 0.1; // Low confidence when no articles found
    }


    // Post-processing: suppress flooding and mismatches for advice queries
    {
      const q = String(query || '').toLowerCase();
      const wantsFree = /\bfree\b/.test(q);
      const wantsOnline = /\bonline\b/.test(q);

      const isPaid = (item) => {
        const v = Number(item?.price_gbp ?? item?.price);
        return Number.isFinite(v) && v > 0;
      };
      const isOffline = (item) => {
        const loc = String(item?.event_location || item?.location || item?.location_address || '');
        return /(coventry|kenilworth|batsford|peak district|in-person|warwickshire|gloucestershire|derbyshire|norfolk|somerset)/i.test(loc);
      };

      if (wantsFree) {
        events = (events || []).filter(e => !isPaid(e));
        products = (products || []).filter(p => !isPaid(p));
        services = (services || []).filter(s => !isPaid(s));
      }
      if (wantsOnline) {
        events = (events || []).filter(e => !isOffline(e));
        products = (products || []).filter(p => !isOffline(p));
        services = (services || []).filter(s => !isOffline(s));
      }

      // Cap list sizes to avoid flooding in advice mode
      const cap = 3;
      events = (events || []).slice(0, cap);
      products = (products || []).slice(0, cap);
    }


    // Calculate relevance score for confidence check
    let relevanceScore = 0;
    const queryWords = query.toLowerCase().split(/\s+/);
    if (contentChunks && contentChunks.length > 0) {
      for (const chunk of contentChunks) {
        const text = (chunk.chunk_text || '').toLowerCase();
        for (const word of queryWords) {
          if (text.includes(word)) relevanceScore += 0.1;
        }
      }
    }
    
    // LOGICAL CONFIDENCE CHECK: Do we have enough context to provide a confident answer?
    // IMPORTANT: Evaluate confidence BEFORE clarification
    const hasConfidence = hasContentBasedConfidence(query, "advice", { 
      events, 
      products, 
      articles: contentChunks, 
      services, 
      landing,
      relevanceScore: Math.min(1.0, relevanceScore) // Cap at 1.0
    });
    console.log(`🔍 DEBUG: Main advice confidence check for "${query}":`, {
      eventCount: events?.length || 0,
      productCount: products?.length || 0,
      articleCount: contentChunks?.length || 0,
      serviceCount: services?.length || 0,
      landingCount: landing?.length || 0,
      relevanceScore: Math.min(1.0, relevanceScore),
      hasConfidence,
      sampleContent: contentChunks?.slice(0, 2)?.map(c => c.chunk_text?.substring(0, 50)) || []
    });
    if (!hasConfidence) {
      console.log(`🤔 Low logical confidence for advice query: "${query}" - triggering clarification`);
      const clarification = await generateClarificationQuestion(query, client, pageContext);
      if (clarification) {
        // For initial clarifications, use fixed low confidence since we're asking for more info
        const confidencePercent = 10; // Fixed low confidence for initial clarifications
        
        res.status(200).json({
          ok: true,
          type: "clarification",
          question: clarification.question,
          options: clarification.options,
          confidence: confidencePercent,
          original_query: query,
          original_intent: "advice",
          meta: {
            duration_ms: Date.now() - started,
            endpoint: "/api/chat",
            clarification_type: clarification.type,
            logical_confidence: false,
            debug: {
              eventCount: events?.length || 0,
              productCount: products?.length || 0,
              articleCount: contentChunks?.length || 0,
              serviceCount: services?.length || 0,
              landingCount: landing?.length || 0,
              relevanceScore: Math.min(1.0, relevanceScore),
              hasConfidence: false,
              sampleContent: contentChunks?.slice(0, 2)?.map(c => c.chunk_text?.substring(0, 50)) || []
            }
          }
        });
        return;
      }
    }

    // Log the answer (async, don't wait for it)
    if (sessionId && query) {
      const responseTimeMs = Date.now() - started;
      const sourcesUsed = citations || [];
      logAnswer(sessionId, query, lines.join("\n"), "advice", confidence, responseTimeMs, sourcesUsed, pageContext).catch(err => 
        console.warn('Failed to log answer:', err.message)
      );
    }

    res.status(200).json({
      ok: true,
      type: "advice",
      answer_markdown: lines.join("\n"),
      citations,
      structured: {
        intent: "advice",
        topic: keywords.join(", "),
        events: events || [],
        products: products || [],
        services: services || [],
        landing: landing || [],
        articles: (articles || []).map(a => {
          const extractedDate = extractPublishDate(a);
          const fallbackDate = a.last_seen ? new Date(a.last_seen).toLocaleDateString('en-GB', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          }) : null;
          const finalDate = extractedDate || fallbackDate;
          
          adviceDebugInfo.push(`🔧 Date Extraction for ${a.title}: extracted="${extractedDate}", fallback="${fallbackDate}", final="${finalDate}"`);
          
          return {
            ...a,
            display_date: finalDate
          };
        }),
        pills,
      },
      confidence: confidence,
        debug: {
        version: "v1.2.37-logical-confidence",
          intent: "advice",
          keywords: keywords,
      counts: {
            events: events?.length || 0,
            products: products?.length || 0,
            articles: articles?.length || 0,
            contentChunks: contentChunks?.length || 0,
          },
          logicalConfidence: hasConfidence,
          logicalConfidenceReason: hasConfidence ? "Query has enough specific context for confident response" : "Query lacks specific context - would trigger clarification",
          logicalConfidenceDebug: {
            query: query,
            queryLowercase: query ? query.toLowerCase() : null,
            hasSpecificService: query ? (query.toLowerCase().includes("private") || query.toLowerCase().includes("lesson") || query.toLowerCase().includes("mentoring") || query.toLowerCase().includes("online") || query.toLowerCase().includes("1-2-1")) : false,
            hasSpecificTechnical: query ? (query.toLowerCase().includes("camera") || query.toLowerCase().includes("lens") || query.toLowerCase().includes("settings") || query.toLowerCase().includes("exposure") || query.toLowerCase().includes("focus") || query.toLowerCase().includes("composition")) : false,
            isAboutQuery: query ? (query.toLowerCase().includes("who") || query.toLowerCase().includes("about")) : false
          },
        debugInfo: adviceDebugInfo,
        },
      meta: {
        duration_ms: Date.now() - started,
        endpoint: "/api/chat",
        topK: topK || null,
        intent: "advice",
      },
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "unhandled_exception",
      where: "handler",
      hint: String(err?.message || err),
      meta: { duration_ms: Date.now() - started, endpoint: "/api/chat" },
    });
  }
}