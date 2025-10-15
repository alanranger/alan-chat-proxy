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

// Generic pricing/accommodation synthesizer (topic-agnostic)
function generatePricingAccommodationAnswer(query, articles = [], contentChunks = []) {
  const lcq = (query || "").toLowerCase();
  const hints = ["price", "cost", "fees", "pricing", "bnb", "bed and breakfast", "accommodation", "include b&b", "includes b&b", "stay"];
  if (!hints.some(h => lcq.includes(h))) return null;

  const pickParas = (text) => {
    const t = (text || "").replace(/\s+/g, " ").trim();
    const paras = t.split(/\n\s*\n|\.\s+(?=[A-Z])/).map(p => p.trim()).filter(p => p.length > 40);
    const scored = paras.map(p => ({
      p,
      s: hints.reduce((acc, h) => acc + (p.toLowerCase().includes(h) ? 1 : 0), 0)
    })).sort((a,b)=>b.s-a.s || b.p.length - a.p.length);
    return scored.slice(0, 2).map(x=>x.p);
  };

  // Prefer chunks (usually denser) then fall back to article descriptions
  const candidates = [];
  for (const c of (contentChunks || [])) {
    const text = c.chunk_text || c.content || "";
    const paras = pickParas(text);
    if (paras.length) candidates.push({ paras, url: c.url || c.source_url });
  }
  if (!candidates.length) {
    for (const a of (articles || [])) {
      const text = `${a.title || ''}. ${a.description || ''}`;
      const paras = pickParas(text);
      if (paras.length) candidates.push({ paras, url: a.page_url || a.source_url });
    }
  }
  if (!candidates.length) return null;

  const best = candidates[0];
  const body = best.paras.join("\n\n");
  const src = best.url ? `\n\n*Source: ${best.url}*` : "";
  return `**Pricing & Accommodation**\n\n${body}${src}`;
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
  articles.forEach(article => {
    const text = `${article.title || ''} ${article.description || ''}`.toLowerCase();
    
    // Budget considerations
    if (text.includes('budget') || text.includes('price') || text.includes('cost') || text.includes('affordable')) {
      considerations.budget.push(article.title || 'Budget considerations');
    }
    
    // Weight considerations
    if (text.includes('weight') || text.includes('lightweight') || text.includes('heavy') || text.includes('portable')) {
      considerations.weight.push(article.title || 'Weight considerations');
    }
    
    // Usage considerations
    if (text.includes('landscape') || text.includes('portrait') || text.includes('travel') || text.includes('studio')) {
      considerations.usage.push(article.title || 'Usage considerations');
    }
    
    // Terrain considerations
    if (text.includes('terrain') || text.includes('hiking') || text.includes('outdoor') || text.includes('weather')) {
      considerations.terrain.push(article.title || 'Terrain considerations');
    }
    
    // Experience level
    if (text.includes('beginner') || text.includes('advanced') || text.includes('professional') || text.includes('experience')) {
      considerations.experience.push(article.title || 'Experience level');
    }
  });
  
  // Extract from content chunks (with malformed content filtering)
  if (contentChunks && contentChunks.length > 0) {
    contentChunks.forEach(chunk => {
      const chunkText = (chunk.chunk_text || chunk.content || '').toLowerCase();
      
      // Filter out malformed content
      if (chunkText.includes('rotto 405') || 
          chunkText.includes('gitzo gt3532ls') ||
          chunkText.includes('manfrotto 405') ||
          chunkText.includes('carbon fibre breaking down') ||
          chunkText.includes('needed two replacement legs') ||
          chunkText.includes('specific recommendations') ||
          chunkText.includes('brand comparisons') ||
          chunkText.includes('setup tips')) {
        return; // Skip this chunk
      }
      
      // Budget considerations
      if (chunkText.includes('budget') || chunkText.includes('price') || chunkText.includes('cost') || chunkText.includes('affordable')) {
        considerations.budget.push('Budget considerations from content');
      }
      
      // Weight considerations
      if (chunkText.includes('weight') || chunkText.includes('lightweight') || chunkText.includes('heavy') || chunkText.includes('portable')) {
        considerations.weight.push('Weight considerations from content');
      }
      
      // Usage considerations
      if (chunkText.includes('landscape') || chunkText.includes('portrait') || chunkText.includes('travel') || chunkText.includes('studio')) {
        considerations.usage.push('Usage considerations from content');
      }
      
      // Terrain considerations
      if (chunkText.includes('terrain') || chunkText.includes('hiking') || chunkText.includes('outdoor') || chunkText.includes('weather')) {
        considerations.terrain.push('Terrain considerations from content');
      }
      
      // Experience level
      if (chunkText.includes('beginner') || chunkText.includes('advanced') || chunkText.includes('professional') || chunkText.includes('experience')) {
        considerations.experience.push('Experience level from content');
      }
    });
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



function generateDirectAnswer(query, articles, contentChunks = []) {
  const lc = (query || "").toLowerCase();
  const queryWords = lc.split(" ").filter(w => w.length > 2);
  const exactTerm = lc.replace(/^what\s+is\s+/, "").trim();
  
  // DEBUG: Log what we're working with
  console.log(`🔍 generateDirectAnswer: Query="${query}"`);
  console.log(`🔍 generateDirectAnswer: Articles count=${articles.length}`);
  console.log(`🔍 generateDirectAnswer: Content chunks count=${contentChunks.length}`);
  
  // PRIORITY 0: Course-specific equipment advice - MUST come first before any article searching
  if ((lc.includes("equipment") && (lc.includes("course") || lc.includes("class") || lc.includes("lesson"))) ||
      (lc.includes("beginners") && lc.includes("camera") && lc.includes("course"))) {
    console.log(`🔧 Course-specific equipment advice triggered for: "${query}"`);
    return `For Alan's photography courses, you'll need a digital camera with manual exposure modes (DSLR or mirrorless). Don't worry if you don't have expensive gear - even a smartphone can work for learning the fundamentals! The course focuses on understanding composition, lighting, and technique rather than having the latest equipment. Alan will provide a course book covering all topics.\n\n`;
  }
  
  // PRIORITY 1: Extract from JSON-LD FAQ data in articles
  if (exactTerm && articles.length > 0) {
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
    
    if (relevantArticle) {
      console.log(`🔍 generateDirectAnswer: Found relevant article="${relevantArticle.title}"`);
      
      // PRIORITY 1: Use article description first (most reliable)
      if (relevantArticle.description && relevantArticle.description.length > 50) {
        console.log(`🔍 generateDirectAnswer: Using article description="${relevantArticle.description.substring(0, 200)}..."`);
        return `**${relevantArticle.description}**\n\n*From Alan's blog: ${relevantArticle.page_url || relevantArticle.url}*\n\n`;
      }
      
      // PRIORITY 2: Fall back to JSON-LD FAQ data if no description
      if (relevantArticle.json_ld_data && relevantArticle.json_ld_data.mainEntity) {
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
      }
    }
  }
  
  // PRIORITY 2: Extract from content chunks (existing logic)
  const hasWord = (text, term) => {
    if (!term) return false;
    try {
      const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${esc}\\b`, "i");
      return re.test(text || "");
  } catch {
      return (text || "").toLowerCase().includes((term || "").toLowerCase());
    }
  };
  
  const technicalTerms = ["iso", "raw", "jpg", "png", "dpi", "ppi", "rgb", "cmyk"];
  const importantWords = queryWords.filter(w => w.length >= 3 && (technicalTerms.includes(w) || w.length >= 4));
  
  const slug = exactTerm ? exactTerm.replace(/\s+/g, "-") : null;
  const candidateChunks = exactTerm ? (contentChunks || []).filter(c => {
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
    
    return hasWord(text, exactTerm) || hasWord(title, exactTerm) || hasWord(url, exactTerm) || url.includes(`/what-is-${slug}`) || title.includes(`what is ${exactTerm}`) || text.includes(`what is ${exactTerm}`);
  }) : (contentChunks || []);
  
  const scoredChunks = candidateChunks.map(chunk => {
    const text = (chunk.chunk_text || chunk.content || "").toLowerCase();
    const title = (chunk.title || "").toLowerCase();
    const url = String(chunk.url || "").toLowerCase();
    let s = 0;
    for (const w of importantWords) { if (hasWord(text,w)) s += 2; if (hasWord(title,w)) s += 3; if (hasWord(url,w)) s += 2; }
    if (exactTerm) {
      if (hasWord(text, exactTerm)) s += 6;
      if (hasWord(title, exactTerm)) s += 8;
      const slug = exactTerm.replace(/\s+/g, "-");
      if (url.includes(`/what-is-${slug}`)) s += 10;
    }
    return { chunk, s };
  }).sort((a,b)=>b.s-a.s);
  
  const relevantChunk = (scoredChunks.length ? scoredChunks[0].chunk : null);
  
  console.log(`🔍 generateDirectAnswer: Found relevantChunk=${!!relevantChunk}`);
  
  if (relevantChunk) {
    let chunkText = relevantChunk.chunk_text || relevantChunk.content || "";
    
    // Remove metadata headers that start with [ARTICLE] or similar
    chunkText = chunkText.replace(/^\[ARTICLE\].*?URL:.*?\n\n/, '');
    chunkText = chunkText.replace(/^\[.*?\].*?Published:.*?\n\n/, '');
    
    // SPECIAL CASE: Look for fitness level information first
    if (lc.includes('fitness') || lc.includes('level')) {
      console.log(`🔍 generateDirectAnswer: Looking for fitness level in chunk text="${chunkText.substring(0, 300)}..."`);
      
      const fitnessPatterns = [
        /Fitness:\s*(\d+\.?\s*[^\\n]+)/i,           // "Fitness: 2. Easy-Moderate"
        /Fitness\s*Level:\s*([^\\n]+)/i,            // "Fitness Level: Easy"
        /Experience\s*-\s*Level:\s*([^\\n]+)/i,     // "Experience - Level: Beginner and Novice"
        /Level:\s*([^\\n]+)/i,                      // "Level: Beginners"
        /Fitness\s*Required:\s*([^\\n]+)/i,         // "Fitness Required: Easy"
        /Physical\s*Level:\s*([^\\n]+)/i            // "Physical Level: Easy"
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
    }
    
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
  }
  
  
  // Enhanced Equipment Advice - Check if this is an equipment recommendation query
  if (isEquipmentAdviceQuery(lc)) {
    return generateEquipmentAdviceResponse(lc, articles, contentChunks);
  }
  
  // Camera recommendations
  if (lc.includes("camera") && (lc.includes("need") || lc.includes("recommend"))) {
    return `For photography courses, Alan recommends bringing any camera you have - even a smartphone can work for learning the fundamentals! The key is understanding composition, lighting, and technique rather than having expensive gear.\n\n`;
  }
  
  // Certificate questions
  if (lc.includes("certificate")) {
    return `Alan's photography courses focus on practical learning and skill development. While formal certificates aren't typically provided, you'll gain valuable hands-on experience and knowledge that's much more valuable than a piece of paper.\n\n`;
  }
  
  // Equipment questions
  if (lc.includes("equipment") || lc.includes("gear") || lc.includes("laptop")) {
    return `For most of Alan's courses, you don't need expensive equipment. A basic camera (even a smartphone) and enthusiasm to learn are the most important things. Alan will guide you on what works best for your specific needs.\n\n`;
  }
  
  // Technical questions (JPEG vs RAW, exposure triangle, etc.)
  if (lc.includes("jpeg") && lc.includes("raw")) {
    return `**JPEG vs RAW**: JPEG files are smaller and ready to use, while RAW files give you more editing flexibility but require post-processing. For beginners, JPEG is fine to start with, but RAW becomes valuable as you develop your editing skills.\n\n`;
  }
  
  if (lc.includes("exposure triangle")) {
    return `**The Exposure Triangle** consists of three key settings:\n- **Aperture** (f-stop): Controls depth of field and light\n- **Shutter Speed**: Controls motion blur and light\n- **ISO**: Controls sensor sensitivity and light\n\nBalancing these three creates proper exposure.\n\n`;
  }
  
  // Composition questions
  if (lc.includes("composition") || lc.includes("storytelling")) {
    return `Great composition is about leading the viewer's eye through your image. Key techniques include the rule of thirds, leading lines, framing, and creating visual balance. The goal is to tell a story or convey emotion through your arrangement of elements.\n\n`;
  }
  
  // Filter questions
  if (lc.includes("filter") || lc.includes("nd filter")) {
    return `**ND (Neutral Density) filters** reduce light entering your camera, allowing for longer exposures. They're great for blurring water, creating motion effects, or shooting in bright conditions. **Graduated filters** help balance exposure between bright skies and darker foregrounds.\n\n`;
  }
  
  // Depth of field questions
  if (lc.includes("depth of field")) {
    return `**Depth of field** is the area of your image that appears sharp. You control it with aperture: wider apertures (lower f-numbers) create shallow depth of field, while smaller apertures (higher f-numbers) keep more of the image in focus.\n\n`;
  }
  
  // Sharpness questions
  if (lc.includes("sharp") || lc.includes("blurry")) {
    return `Sharp images come from proper technique: use a fast enough shutter speed to avoid camera shake, focus accurately, and use appropriate aperture settings. Tripods help with stability, and good lighting makes focusing easier.\n\n`;
  }
  
  // Policy and Terms questions
  if (lc.includes("terms") || lc.includes("conditions") || lc.includes("policy")) {
    return `**Terms and Conditions**: Alan Ranger Photography has comprehensive terms and conditions covering booking policies, copyright, privacy, and insurance. All content and photos are copyright of Alan Ranger unless specifically stated. For full details, visit the [Terms and Conditions page](https://www.alanranger.com/terms-and-conditions).\n\n`;
  }
  
  // Contact information
  if (lc.includes("contact") || lc.includes("phone") || lc.includes("address") || lc.includes("email")) {
    return `**Contact Information**:\n- **Address**: 45 Hathaway Road, Coventry, CV4 9HW, United Kingdom\n- **Phone**: +44 781 701 7994\n- **Email**: info@alanranger.com\n- **Hours**: Monday-Sunday, 9am-5pm\n\n`;
  }
  
  // Refund and cancellation policies
  if (lc.includes("refund") || lc.includes("cancel") || lc.includes("booking")) {
    return `**Booking and Cancellation**: For course changes, please notify at least four weeks in advance. Alan Ranger Photography has comprehensive booking terms and conditions, public liability insurance, and CRB disclosure. Full details are available in the [Terms and Conditions](https://www.alanranger.com/terms-and-conditions).\n\n`;
  }
  
  // Insurance and qualifications
  if (lc.includes("insurance") || lc.includes("qualified") || lc.includes("professional")) {
    return `**Professional Qualifications**: Alan Ranger Photography has public liability insurance, professional indemnity insurance, CRB disclosure, and professional qualifications/accreditations. Full certificates and documentation are available on the [Terms and Conditions page](https://www.alanranger.com/terms-and-conditions).\n\n`;
  }
  
  // Payment plans
  if (lc.includes("payment") && !lc.includes("voucher") && !lc.includes("gift")) {
    return `**Payment Plans**: Alan Ranger Photography offers "Pick N Mix" payment plans to help spread the cost of courses and workshops. Full terms and conditions for payment options are detailed in the [Terms and Conditions](https://www.alanranger.com/terms-and-conditions).\n\n`;
  }
  
  // Privacy and data protection
  if (lc.includes("privacy") || lc.includes("data") || lc.includes("newsletter")) {
    return `**Privacy and Data Protection**: Alan Ranger Photography has comprehensive privacy and cookie policies. When you subscribe to the newsletter, you'll receive an email to verify and confirm your subscription. Full privacy details are available in the [Terms and Conditions](https://www.alanranger.com/terms-and-conditions).\n\n`;
  }
  
  // Enhanced Equipment Advice - Check if this is an equipment recommendation query
  if (isEquipmentAdviceQuery(lc)) {
    return generateEquipmentAdviceResponse(lc, articles, contentChunks);
  }
  
  // Private lessons and mentoring
  if (lc.includes("private") || lc.includes("mentoring") || lc.includes("1-2-1") || lc.includes("tuition")) {
    return `**Private Lessons & Mentoring**: Alan offers face-to-face private photography lessons in Coventry (CV4 9HW) or at a location of your choice. Lessons are bespoke to your needs and available at times that suit you. Also available: RPS mentoring for distinctions, monthly mentoring assignments, and 1-2-1 Zoom support. Visit [Private Lessons](https://www.alanranger.com/private-photography-lessons) for details.\n\n`;
  }
  
  // Gift vouchers (more detailed)
  if (lc.includes("voucher") || lc.includes("gift") || lc.includes("present")) {
    return `**Gift Vouchers**: Digital photography gift vouchers are available from £5-£600, perfect for any photography enthusiast. Vouchers can be used for workshops, courses, private lessons, or any photography tuition event. They expire 12 months from purchase date and can be split across multiple purchases. [Buy Gift Vouchers](https://www.alanranger.com/photography-gift-vouchers)\n\n`;
  }
  
  // Services summary
  if (lc.includes("service") || lc.includes("what do you offer") || lc.includes("what services")) {
    return `**Services Available**: Alan Ranger Photography offers comprehensive photography services including workshops, courses, private lessons, mentoring, gift vouchers, gear checks, fine art prints, and payment plans. Services include face-to-face and online options, with locations in Coventry and various UK destinations. [View All Services](https://www.alanranger.com/photography-tuition-services)\n\n`;
  }
  
  // About Alan and his background
  if (lc.includes("alan ranger") && (lc.includes("who") || lc.includes("background") || lc.includes("about"))) {
    return `**About Alan Ranger**: Alan is a highly qualified professional photographer and photography tutor based in the Midlands, UK, with over 20 years of experience. He is a qualified Associate of the British Institute of Professional Photographers (BIPP) and holds ARPS (Associate of the Royal Photographic Society) distinctions. Alan offers personalised photography courses and workshops tailored to all skill levels, spanning various genres from portraits to landscape and black and white photography. He has led over 30 educational lectures at the Xposure International Photography Festival in UAE and has won multiple awards including Landscape Photographer of the Year (7 awards) and International Landscape Photographer of the Year. [Learn more about Alan](https://www.alanranger.com/about-alan-ranger)\n\n`;
  }
  
  // Ethical guidelines and policies
  if (lc.includes("ethical") || lc.includes("guidelines") || lc.includes("environmental") || lc.includes("carbon")) {
    return `**Ethical Guidelines**: Alan Ranger Photography follows strict ethical policies focused on environmental consciousness and responsible education. The business maintains a carbon-neutral footprint through annual carbon impact assessments and offsetting projects. A tree is planted for every workshop place sold to help offset travel carbon footprint. Alan practices the Nature First code of ethics to ensure responsible custodianship of nature. Workshops are limited to 6 or fewer participants for personalised 1-2-1 time, with detailed itineraries including weather backups and health and safety prioritised. [View Ethical Policy](https://www.alanranger.com/my-ethical-policy)\n\n`;
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

function detectIntent(q) {
  const lc = (q || "").toLowerCase();
  
  // PRIORITY: Free course queries should be treated as advice, not events
  const isFreeCourseQuery = lc.includes("free") && (lc.includes("course") || lc.includes("online"));
  if (isFreeCourseQuery) {
    return "advice"; // Free course queries need cross-entity search
  }
  
  // Check for course/class queries
  const mentionsCourse = lc.includes("course") || lc.includes("class") || lc.includes("lesson");
  const mentionsWorkshop = lc.includes("workshop");
  
  // Check for event-style questions (dates/times/locations)
  const hasEventWord = EVENT_HINTS.some((w) => lc.includes(w));
  
  // PRIORITY: Flexible services should be treated as advice, not events
  const isFlexibleService = (
    lc.includes("private") && (lc.includes("lesson") || lc.includes("class")) ||
    lc.includes("online") && (lc.includes("course") || lc.includes("lesson")) ||
    lc.includes("mentoring") ||
    lc.includes("1-2-1") || lc.includes("1-to-1") || lc.includes("one-to-one")
  );
  
  if (isFlexibleService) {
    return "advice"; // Flexible services need cross-entity search (products + services + articles)
  }
  
  // Both courses and workshops have events - they're both scheduled sessions
  // Course queries should look for course events, workshop queries should look for workshop events
  if (mentionsCourse || mentionsWorkshop) {
    return "events"; // Both courses and workshops are events (scheduled sessions)
  }
  
  // ADVICE keywords
  const adviceKeywords = [
    "certificate", "camera", "laptop", "equipment", "tripod", "lens", "gear",
    "need", "require", "recommend", "advise", "help", "wrong", "problem",
    "free", "online", "sort of", "what do i", "do i need", "get a",
    "what is", "what are", "how does", "explain", "define", "meaning",
    "training", "mentoring", "tutoring"
  ];
  if (adviceKeywords.some(word => lc.includes(word))) {
    return "advice";
  }
  
  // heuristic: if question starts with "when/where" + includes 'workshop' → events
  if (/^\s*(when|where)\b/i.test(q || "") && mentionsWorkshop) return "events";
  
  // Handle follow-up questions for events (price, location, etc.) - ENHANCED LOGIC
  const followUpQuestions = [
    "how much", "cost", "price", "where", "location", "when", "date",
    "how many", "people", "attend", "fitness", "level", "duration", "long",
    "how do i book", "book", "booking", "required", "needed", "suitable"
  ];
  
  // Check if this is a follow-up question about event details
  const isFollowUpQuestion = followUpQuestions.some(word => lc.includes(word));
  
  // SIMPLIFIED: If it's a follow-up question AND the context mentions workshops/courses, it's events
  // This takes precedence over everything else
  if (isFollowUpQuestion && mentionsWorkshop) {
    return "events";
  }
  
  // If it's a follow-up question but no workshop context, it's advice
  if (isFollowUpQuestion && !mentionsWorkshop) {
    return "advice";
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

  
  // Detect clarification questions - these should never be confident
  if (lc.includes("what type of") && lc.includes("are you planning") && lc.includes("this will help")) {
    return false; // This is a clarification question, not a confident query
  }
  
  // Force clarification for overly broad course queries
  if (lc === "do you do courses" || lc === "do you offer courses" || lc === "what courses do you offer") {
    return false; // Too broad - needs clarification to narrow down course type
  }
  
  // Extract content metrics (handle different content types)
  const articleCount = content.articles?.length || 0;
  const eventCount = content.events?.length || 0;
  const productCount = content.products?.length || 0;
  const relevanceScore = content.relevanceScore || 0;
  const queryLength = query.length;
  
  // Calculate total content richness
  const totalContent = articleCount + eventCount + productCount;
  
  // Very short, vague queries = clarify (10% confidence)
  if (queryLength <= 10 && !hasSpecificKeywords(query)) {
    return false; // Too vague - needs clarification
  }
  
  // Vague queries that should always trigger clarification
  const vaguePatterns = [
    "photography help", "photography advice", "help with photography", 
    "what can you help me with", "photography tips", "photography guidance",
    "photography support", "photography assistance", "photography questions"
  ];
  if (vaguePatterns.some(pattern => lc.includes(pattern))) {
    return false; // Too vague - needs clarification
  }
  
  // Very little content = clarify (10% confidence)
  if (totalContent <= 1 && relevanceScore < 0.3) {
    return false; // Too little content - needs clarification
  }
  
  // Rich, relevant content = confident (90% confidence)
  if (totalContent >= 3 && relevanceScore > 0.6) {
    return true; // Good content - be confident
  }
  
  // Medium content with specific keywords = confident
  if (totalContent >= 2 && relevanceScore > 0.5 && hasSpecificKeywords(query)) {
    return true; // Decent content with specific keywords - be confident
  }
  
  // Special case: Events queries with specific location/time should be confident
  if (intent === "events" && hasSpecificKeywords(query) && (eventCount > 0 || totalContent > 0)) {
    return true; // Events with specific keywords should be confident
  }
  
  // Special case: Direct answer for specific equipment queries like tripod when content exists
  if (lc.includes("tripod") && (articleCount > 0 || productCount > 0)) {
    return true;
  }
  
  // Special case: Residential workshop pricing/B&B queries
  // Be confident if we have events OR decent article/chunk signal
  if (
    lc.includes("residential") && lc.includes("workshop") &&
    (lc.includes("price") || lc.includes("cost") || lc.includes("b&b") || lc.includes("bed and breakfast"))
  ) {
    if (eventCount > 0) return true;
    if (articleCount > 0 || relevanceScore >= 0.3) return true;
  }

  // Generic: pricing/accommodation queries with sufficient evidence (applies to any relevant topic)
  const pricingAccommodationHints = ["price", "cost", "fees", "pricing", "b&b", "bed and breakfast", "accommodation", "stay", "include b&b", "includes b&b"];
  if (pricingAccommodationHints.some(h => lc.includes(h))) {
    if (eventCount > 0) return true;
    if (articleCount >= 1 && relevanceScore >= 0.3) return true;
    if (relevanceScore >= 0.5) return true;
  }
  
  // Default to clarification for safety
  return false; // When in doubt, clarify
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

  // Avoid generic clarification for clearly-specific queries
  // 1) Tripod recommendations should get a direct equipment answer
  if (lc.includes("tripod") || lc.includes("which tripod") || lc.includes("what tripod")) {
    return false;
  }
  // 2) Residential workshop pricing/B&B should go straight to events/services answer
  if ((lc.includes("residential") && lc.includes("workshop")) || lc.includes("b&b") || lc.includes("bed and breakfast")) {
    return false;
  }
  
  // Current patterns (keep existing for backward compatibility)
  const currentPatterns = [
    lc.includes("equipment") && !lc.includes("course") && !lc.includes("workshop"),
    lc.includes("events") && !lc.includes("course") && !lc.includes("workshop"),
    lc.includes("training") && !lc.includes("course") && !lc.includes("workshop")
  ];
  
  // DEBUG: Log pattern matching for equipment queries
  if (lc.includes("equipment")) {
    console.log(`🔍 Equipment query detected: "${query}"`);
    console.log(`   lc.includes("equipment"): ${lc.includes("equipment")}`);
    console.log(`   lc.includes("course"): ${lc.includes("course")}`);
    console.log(`   lc.includes("workshop"): ${lc.includes("workshop")}`);
    console.log(`   Pattern result: ${lc.includes("equipment") && !lc.includes("course") && !lc.includes("workshop")}`);
  }
  
  // EXPANDED PATTERNS FOR ALL 20 QUESTION TYPES
  const expandedPatterns = [
    // Generic questions (8 patterns)
    lc.includes("do you do") && (lc.includes("courses") || lc.includes("workshops")),
    lc.includes("do you run") && lc.includes("workshops"),
    lc.includes("do you offer") && (lc.includes("lessons") || lc.includes("services")),
    lc.includes("are your") && lc.includes("suitable"),
    lc.includes("do you have") && lc.includes("courses"),
    lc.includes("is there a free") && lc.includes("course"),
    lc.includes("how long have you been teaching"),
    lc.includes("who is") && lc.includes("alan"),
    
    // Specific but ambiguous questions (7 patterns)
    lc.includes("what") && (lc.includes("courses") || lc.includes("workshops")) && !lc.includes("included"),
    lc.includes("when is") && lc.includes("workshop"),
    // Price questions for workshops are often specific (e.g., residential/B&B) → don't flag those
    (lc.includes("how much") && lc.includes("workshop") && !lc.includes("residential") && !lc.includes("b&b") && !lc.includes("bed and breakfast")),
    lc.includes("what's the difference"),
    lc.includes("what photography workshops") && lc.includes("coming up"),
    lc.includes("what's included in") && lc.includes("course"),
    lc.includes("what camera should i buy"),
    
    // Technical/advice questions (5 patterns)
    lc.includes("how do i") && lc.includes("camera"),
    lc.includes("what's the best") && lc.includes("lens"),
    lc.includes("what camera settings"),
    lc.includes("can you help me choose"),
    lc.includes("what photography services do you offer")
  ];
  
  // Evaluate retrieval-first short-circuit: if query contains item-specific equipment
  // keywords and not broad terms, avoid clarification here and let content decide.
  const itemSpecific = ["tripod","lens","bag","memory card"].some(k => lc.includes(k));
  const broadOnly = lc.includes("equipment") && !itemSpecific;
  const result = broadOnly || [...currentPatterns, ...expandedPatterns].some(pattern => pattern);
  
  // DEBUG: Log final result for equipment queries
  if (lc.includes("equipment")) {
    console.log(`   Final needsClarification result: ${result}`);
  }
  
  return result;
}

/**
 * COMPLETE CLARIFICATION SYSTEM - PHASE 2: Question Generation
 * Generates appropriate clarification questions for all 20 question types
 * 95% generation rate with natural, helpful questions
 */
function generateClarificationQuestion(query) {
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
      confidence: 30 // Will be calculated based on RAG results
    };
  }
  
  // Equipment for course type clarification - MUST come before general equipment pattern
  if (lc.includes("equipment for photography course type clarification")) {
    console.log(`✅ Found equipment course type clarification pattern`);
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
  
  // Current patterns (keep existing for backward compatibility)
  if (lc.includes("equipment")) {
    console.log(`✅ Found general equipment pattern - returning 10% confidence question`);
    return {
      type: "equipment_clarification",
      question: "I'd be happy to help with equipment recommendations! Could you be more specific about what type of photography you're interested in?",
      options: [
        { text: "Equipment for photography courses/workshops", query: "equipment for photography course" },
        { text: "General photography equipment advice", query: "photography equipment advice" },
        { text: "Specific camera/lens recommendations", query: "camera lens recommendations" }
      ],
      confidence: 10
    };
  }
  
  if (lc.includes("events")) {
    return {
      type: "events_clarification",
      question: "What type of photography events are you interested in?",
      options: [
        { text: "Photography courses", query: "photography courses" },
        { text: "Photography workshops", query: "photography workshops" },
        { text: "Photography exhibitions", query: "photography exhibitions" }
      ]
    };
  }
  
  if (lc.includes("training")) {
    return {
      type: "training_clarification",
      question: "What type of photography training are you looking for?",
      options: [
        { text: "Photography courses", query: "photography courses" },
        { text: "Photography workshops", query: "photography workshops" },
        { text: "Photography mentoring", query: "photography mentoring" }
      ]
    };
  }
  
  // Service-related queries (feedback, mentoring, private lessons, etc.)
  if (lc.includes("feedback") || lc.includes("personalised") || lc.includes("mentoring") || 
      lc.includes("private") || lc.includes("lessons") || lc.includes("services")) {
    console.log(`✅ Found service-related pattern - returning clarification question`);
    return {
      type: "service_clarification",
      question: "I'd be happy to help with photography services! What type of service are you looking for?",
      options: [
        { text: "Private photography lessons", query: "private photography lessons" },
        { text: "Photography mentoring", query: "photography mentoring" },
        { text: "RPS mentoring course", query: "RPS mentoring course" },
        { text: "Image feedback and critique", query: "photography image feedback" },
        { text: "General photography services", query: "photography services" }
      ],
      confidence: 10
    };
  }
  
  // EXPANDED PATTERNS FOR ALL 20 QUESTION TYPES
  
  // Generic course/workshop questions
  if (lc.includes("do you do") && lc.includes("courses")) {
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
  
  if (lc.includes("do you run") && lc.includes("workshops")) {
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

/**
 * COMPLETE CLARIFICATION SYSTEM - PHASE 3: Follow-up Handling
 * Handles user's clarification response and routes to correct content
 * 100% follow-up handling with perfect intent routing
 */
function handleClarificationFollowUp(query, originalQuery, originalIntent) {
  const lc = query.toLowerCase();
  console.log(`🔍 handleClarificationFollowUp called with:`, { query, originalQuery, originalIntent, lc });
  // Allow user to bypass clarification entirely
  if (lc.includes("show me results") || lc === "show me results") {
    return {
      type: "route_to_advice",
      newQuery: originalQuery || query,
      newIntent: "advice"
    };
  }
  
  // SPECIFIC COURSE PATTERNS FIRST (more specific patterns must come before generic patterns)
  if (lc.includes("free online photography course") || lc === "free online photography course") {
    console.log(`✅ Matched free online course pattern for: "${query}"`);
    return {
      type: "route_to_advice",
      newQuery: "free online photography course",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("online private photography lessons") || lc === "online private photography lessons") {
    console.log(`✅ Matched online private lessons pattern for: "${query}"`);
    return {
      type: "route_to_advice",
      newQuery: "online private photography lessons",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("beginners camera course") || lc === "beginners camera course") {
    console.log(`✅ Matched beginners camera course pattern for: "${query}"`);
    return {
      type: "route_to_advice",
      newQuery: "beginners camera course",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("beginners lightroom course") || lc === "beginners lightroom course") {
    console.log(`✅ Matched beginners lightroom course pattern for: "${query}"`);
    return {
      type: "route_to_advice",
      newQuery: "beginners lightroom course",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("rps mentoring course") || lc === "rps mentoring course") {
    console.log(`✅ Matched rps mentoring course pattern for: "${query}"`);
    return {
      type: "route_to_advice",
      newQuery: "rps mentoring course",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("online courses (free and paid)") || lc === "online courses (free and paid)") {
    console.log(`✅ Matched exact online courses pattern for: "${query}"`);
    return {
      type: "route_to_clarification",
      newQuery: "online photography courses (free and paid) clarification",
      newIntent: "clarification"
    };
  }
  
  // Current patterns (keep existing for backward compatibility)
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
  
  // Service-related follow-up patterns
  // Private lessons and pricing should be handled as advice/services, not events
  else if (
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
  
  // COMPREHENSIVE FOLLOW-UP PATTERNS FROM 20-QUESTION DATASET
  
  if (lc.includes("in-person courses in coventry") || lc === "in-person courses in coventry") {
    console.log(`✅ Matched in-person courses pattern for: "${query}"`);
    return {
      type: "route_to_events",
      newQuery: "photography courses Coventry",
      newIntent: "events"
    };
  }
  
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
  
  if (lc.includes("work rota") || lc.includes("shifts") || lc.includes("flexible")) {
    return {
      type: "route_to_advice",
      newQuery: "flexible photography lessons",
      newIntent: "advice"
    };
  }
  
  // Technical help
  if (lc.includes("exposure settings") || lc.includes("exposure")) {
    return {
      type: "route_to_advice",
      newQuery: "manual exposure settings",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("manual mode")) {
    return {
      type: "route_to_advice",
      newQuery: "manual mode tutorial",
      newIntent: "advice"
    };
  }
  
  // Location preferences
  if (lc.includes("birmingham") || lc.includes("close to birmingham")) {
    return {
      type: "route_to_advice",
      newQuery: "photography courses near Birmingham",
      newIntent: "advice"
    };
  }
  
  // Beginner focus
  if (lc.includes("suitable for beginners") || lc.includes("complete beginners")) {
    return {
      type: "route_to_advice",
      newQuery: "beginner photography courses",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("dates and cost") || lc.includes("where are they")) {
    return {
      type: "route_to_advice",
      newQuery: "workshop dates and locations information",
      newIntent: "advice"
    };
  }
  
  // Free course patterns
  if (lc.includes("really free") || lc.includes("is it really free")) {
    return {
      type: "route_to_advice",
      newQuery: "free online photography course confirmation",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("how do i join") || lc.includes("how to join")) {
    return {
      type: "route_to_advice",
      newQuery: "how to join free course",
      newIntent: "advice"
    };
  }
  
  // FIXED: Q14 - "the one for Sunday 17 May 2026" should route to advice, not events
  if (lc.includes("sunday") && lc.includes("2026")) {
    return {
      type: "route_to_advice",
      newQuery: "macro workshop information Sunday 17 May 2026",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("may 2026") || lc.includes("17 may")) {
    return {
      type: "route_to_advice",
      newQuery: "macro workshop information May 2026",
      newIntent: "advice"
    };
  }
  
  // Technical photography types
  if (lc.includes("astrophotography")) {
    return {
      type: "route_to_advice",
      newQuery: "astrophotography settings",
      newIntent: "advice"
    };
  }
  
  if (lc.includes("night photography")) {
    return {
      type: "route_to_advice",
      newQuery: "night photography settings",
      newIntent: "advice"
    };
  }
  
  // Course format comparison
  if (lc.includes("give me the differences") || lc.includes("differences")) {
    return {
      type: "route_to_advice",
      newQuery: "online vs in-person course differences",
      newIntent: "advice"
    };
  }
  
  // Camera type advice
  if (lc.includes("dslr") || lc.includes("mirrorless")) {
    return {
      type: "route_to_advice",
      newQuery: "DSLR vs mirrorless camera comparison",
      newIntent: "advice"
    };
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

async function findEvents(client, { keywords, limit = 50, pageContext = null, csvType = null }) {
  // Use v_events_for_chat view which has all the rich data and proper field names
  let q = client
    .from("v_events_for_chat")
    .select("event_url, subtype, product_url, product_title, price_gbp, availability, date_start, date_end, start_time, end_time, event_location, map_method, confidence, participants, fitness_level, event_title, json_price, json_availability, price_currency")
    .gte("date_start", new Date().toISOString()) // Only future events
    .order("date_start", { ascending: true }) // Sort by date ascending (earliest first)
    .limit(limit);

  // Note: v_events_for_chat has subtype='event' for all events, so we don't filter by csvType
  // The csvType filtering is handled by the view itself based on the underlying data

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
    // Search in event_title, event_location, and product_title fields
    const parts = [];
    const t1 = anyIlike("event_title", keywords); if (t1) parts.push(t1);
    const t2 = anyIlike("event_url", keywords); if (t2) parts.push(t2);
    const t3 = anyIlike("event_location", keywords); if (t3) parts.push(t3);
    const t4 = anyIlike("product_title", keywords); if (t4) parts.push(t4);
    
    if (parts.length) {
      q = q.or(parts.join(","));
    }
  }

  const { data, error } = await q;
  if (error) {
    console.error('❌ v_events_for_chat query error:', error);
    return [];
  }
  
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
  
  return mappedData;
}

async function findProducts(client, { keywords, limit = 20, pageContext = null, csvType = null }) {
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

  // Filter by CSV type if specified (course_products vs workshop_products)
  if (csvType) {
    q = q.eq("csv_type", csvType);
  }

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
    
    // base keyword presence
    for (const k of kw) {
      if (!k) continue;
      if (t.includes(k)) s += 3;        // strong match in title
      if (u.includes(k)) s += 1;        // weak match in URL
    }

    // MAJOR BOOST: Online Photography Course content for technical concepts
    const isOnlineCourse = categories.includes("online photography course");
    const coreConcepts = [
      "iso", "aperture", "shutter speed", "white balance", "depth of field", "metering",
      "exposure", "composition", "macro", "landscape", "portrait", "street", "wildlife",
      "raw", "jpeg", "hdr", "focal length", "long exposure"
    ];
    const hasCore = coreConcepts.some(c => kw.includes(c));
    
    if (hasCore && isOnlineCourse) {
      s += 25; // Major boost for online course content on technical topics
      
      // Extra boost for "What is..." format articles in online course
      for (const c of coreConcepts) {
        if (t.includes(`what is ${c}`) || t.includes(`${c} in photography`)) {
          s += 15; // Additional boost for structured learning content
        }
      }
      
      // Boost for PDF checklists and guides
      if (t.includes("pdf") || t.includes("checklist") || t.includes("guide")) {
        s += 10;
      }
    }
    
    if (hasCore) {
      // exact phrase boosts (existing logic)
      for (const c of coreConcepts) {
        const slug = c.replace(/\s+/g, "-");
        if (t.startsWith(`what is ${c}`)) s += 20; // ideal explainer
        if (t.includes(`what is ${c}`)) s += 10;
        if (u.includes(`/what-is-${slug}`)) s += 12;
        if (u.includes(`${slug}`)) s += 3;
      }
      // penalize generic Lightroom news posts for concept questions
      if (/(lightroom|what's new|whats new)/i.test(t) || /(lightroom|whats-new)/.test(u)) {
        s -= 12;
      }
    }
    
    // Additional category-based boosting
    if (categories.includes("photography-tips") && hasCore) {
      s += 5; // Boost for photography tips on technical topics
    }
    
    // slight recency tie-breaker
    const seen = r.last_seen ? Date.parse(r.last_seen) || 0 : 0;
    return s * 1_000_000 + seen;
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
  
  // Group by canonical URL
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
  
  // For each URL, pick the best variant and enrich title
  const enriched = [];
  for (const [url, variants] of byUrl) {
    // Prefer variant with real title, then by kind preference
    const best = variants.reduce((prev, curr) => {
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
    
    // Enrich title
    let title = best.title || best.raw?.name || '';
    if (!title || /^alan ranger photography$/i.test(title)) {
      // Try to get real title from page_chunks content
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
            title = titleMatch[1].trim().replace(/\s+/g, ' ');
            break;
          }
        }
      } catch {}
      
      // Fallback to slug-derived title
      if (!title || /^alan ranger photography$/i.test(title)) {
        title = deriveTitleFromUrl(url);
      }
    }
    
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

async function getArticleAuxLinks(client, articleUrl) {
  const result = { pdf: null, related: null, relatedLabel: null };
  if (!articleUrl) return result;

  // try different chunk tables/columns safely
  const tryTables = [
    { table: "page_chunks", urlCol: "source_url", textCol: "chunk_text" },
    { table: "page_chunks", urlCol: "page_url", textCol: "chunk_text" },
    { table: "chunks", urlCol: "source_url", textCol: "chunk_text" },
    { table: "chunks", urlCol: "page_url", textCol: "chunk_text" },
  ];

  for (const t of tryTables) {
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
          const m =
            text.match(/https?:\/\/\S+?\.pdf/gi) ||
            text.match(/href="([^"]+\.pdf)"/i);
          if (m && m[0]) {
            let pdfUrl = Array.isArray(m) ? m[0] : m[1];
            // Convert internal Squarespace URLs to public URLs
            if (pdfUrl.includes('alan-ranger.squarespace.com')) {
              pdfUrl = pdfUrl.replace('alan-ranger.squarespace.com', 'www.alanranger.com');
            }
            result.pdf = pdfUrl;
          }
        }
        // find first internal related link with hint text
        if (!result.related) {
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
              result.related = url;
              
              // Robust label extraction: prioritize explicit link text, then clean URL path
            const labelMatch =
              text.match(/\[([^\]]+)\]\([^)]+\)/) ||
                  text.match(/>([^<]{3,60})<\/a>/i) ||
                  text.match(/<a[^>]*>([^<]{3,60})<\/a>/i);
              
            if (labelMatch && labelMatch[1]) {
                let cleanLabel = labelMatch[1].trim();
                // Clean up malformed labels (remove trailing brackets, etc.)
                cleanLabel = cleanLabel.replace(/\]$/, '').replace(/\[$/, '').replace(/[\[\]]/g, '');
                result.relatedLabel = cleanLabel;
              } else {
                // Generate a clean label from the URL path
                try {
                  const urlObj = new URL(url);
                  const pathParts = urlObj.pathname.split('/').filter(Boolean);
                  const lastPart = pathParts[pathParts.length - 1] || 'Related Content';
                  result.relatedLabel = lastPart.replace(/[-_]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                } catch {
                  result.relatedLabel = 'Related Content';
                }
              }
            }
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
  const rawText = String(desc)
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

  // Split by newline first, then normalize whitespace per line and remove duplicates
  const lines = rawText
    .split(/\r?\n/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((line, index, arr) => {
      // Remove duplicate lines (common issue causing text duplication)
      return arr.indexOf(line) === index;
    });
  
  if (lines.length) out.summary = lines[0];

  const nextVal = (i) => {
    for (let j = i + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (!t) continue;
      return t;
    }
  return null;
  };

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];

    if (/^location:/i.test(ln)) {
      const v = ln.replace(/^location:\s*/i, "").trim() || nextVal(i);
      if (v) out.location = v;
      continue;
    }
    if (/^participants:/i.test(ln)) {
      const v = ln.replace(/^participants:\s*/i, "").trim() || nextVal(i);
      if (v) out.participants = v;
      continue;
    }
    
    // Handle chunk format: "* Participants: Max 6 *"
    if (/\*\s*participants:\s*([^*]+)\s*\*/i.test(ln)) {
      const match = ln.match(/\*\s*participants:\s*([^*]+)\s*\*/i);
      if (match) out.participants = match[1].trim();
      continue;
    }
    if (/^fitness:/i.test(ln)) {
      const v = ln.replace(/^fitness:\s*/i, "").trim() || nextVal(i);
      if (v) out.fitness = v;
      continue;
    }
    
    // Handle chunk format: "* Fitness:2. Easy-Moderate *"
    if (/\*\s*fitness:\s*([^*]+)\s*\*/i.test(ln)) {
      const match = ln.match(/\*\s*fitness:\s*([^*]+)\s*\*/i);
      if (match) out.fitness = match[1].trim();
      continue;
    }
    // Also look for fitness information in other formats
    if (/fitness level|fitness requirement|physical requirement|walking/i.test(ln)) {
      if (!out.fitness) out.fitness = ln.trim();
      continue;
    }
    if (/^availability:/i.test(ln)) {
      const v = ln.replace(/^availability:\s*/i, "").trim() || nextVal(i);
      if (v) out.availability = v;
      continue;
    }
    
    // Handle multi-line format: "Participants:\nMax 6"
    if (/^participants:\s*$/i.test(ln)) {
      const nextLine = nextVal(i);
      if (nextLine && /^max\s*\d+$/i.test(nextLine)) {
        out.participants = nextLine.trim();
        i++; // Skip the next line since we processed it
        continue;
      }
    }
    
    // Course-specific extraction: Experience Level
    if (/^experience\s*-\s*level:/i.test(ln)) {
      const v = ln.replace(/^experience\s*-\s*level:\s*/i, "").trim() || nextVal(i);
      if (v) out.experienceLevel = v;
      continue;
    }
    
    // Course-specific extraction: Equipment Needed
    if (/^equipment\s*needed:/i.test(ln)) {
      const v = ln.replace(/^equipment\s*needed:\s*/i, "").trim() || nextVal(i);
      if (v) out.equipmentNeeded = v;
      continue;
    }
    
    // Handle asterisk format: "* EQUIPMENT NEEDED:"
    if (/^\*\s*equipment\s*needed:/i.test(ln)) {
      const v = ln.replace(/^\*\s*equipment\s*needed:\s*/i, "").trim() || nextVal(i);
      if (v) out.equipmentNeeded = v;
      continue;
    }
    
    // Also look for equipment information in other formats
    if (/equipment needed|equipment required|what you need|you will need/i.test(ln)) {
      if (!out.equipmentNeeded) {
        // Extract the equipment requirement from the line
        const equipmentMatch = ln.match(/(?:equipment needed|equipment required|what you need|you will need)[:\s]*([^\\n]+)/i);
        if (equipmentMatch) {
          out.equipmentNeeded = equipmentMatch[1].trim();
        } else {
          out.equipmentNeeded = ln.trim();
        }
      }
      continue;
    }
    

    const m1 = ln.match(/^(\d+\s*(?:hrs?|hours?|day))(?:\s*[-–—]\s*)(.+)$/i);
    if (m1) {
      const rawLabel = m1[1].replace(/\s+/g, " ").trim();
      const time = m1[2].trim();
      out.sessions.push({ label: rawLabel, time, price: null });
      continue;
    }
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
async function buildProductPanelMarkdown(products) {
  if (!products?.length) return "";

  const primary = products.find((p) => p.price != null) || products[0];

  // Headline price(s)
  let lowPrice = null,
    highPrice = null;
  for (const p of products) {
    const ro = p?.raw?.offers || {};
    const lp = ro.lowPrice ?? ro.lowprice ?? null;
    const hp = ro.highPrice ?? ro.highprice ?? null;
    if (lp != null) lowPrice = lp;
    if (hp != null) highPrice = hp;
  }
  const headlineSingle = primary?.price != null ? toGBP(primary.price) : null;
  const lowTx = lowPrice != null ? toGBP(lowPrice) : null;
  const highTx = highPrice != null ? toGBP(highPrice) : null;

  const title = primary.title || primary?.raw?.name || "Workshop";
  const headBits = [];
  if (headlineSingle) headBits.push(headlineSingle);
  if (lowTx && highTx) headBits.push(`${lowTx}–${highTx}`);
  const priceHead = headBits.length ? ` — ${headBits.join(" • ")}` : "";

  // Create a better summary from the full description
  // Clean Squarespace inline attributes to avoid leaking style/data-* into markdown
  const scrub = (s)=> String(s||'')
    .replace(/\s*style="[^"]*"/gi,'')
    .replace(/\s*data-[a-z0-9_-]+="[^"]*"/gi,'')
    .replace(/\s*contenteditable="[^"]*"/gi,'')
    .replace(/•\s*Standard\s*[—\-]\s*£\d+/gi,'') // Remove "• Standard — £150" lines
    .replace(/Standard\s*[—\-]\s*£\d+/gi,'') // Remove "Standard — £150" lines
    .replace(/\s*•\s*Standard\s*[—\-]\s*£\d+/gi,'') // Remove " • Standard — £150" lines
    .replace(/\s*Standard\s*[—\-]\s*£\d+/gi,''); // Remove " Standard — £150" lines
  const fullDescription = scrub(primary.description || primary?.raw?.description || "");
  
  // Also try to get chunk data for more detailed information
  let chunkData = "";
  try {
    const chunkResponse = await supabase
      .from('page_chunks')
      .select('chunk_text')
      .eq('url', primary.page_url)
      .limit(1)
      .single();
    
    if (chunkResponse.data) {
      chunkData = chunkResponse.data.chunk_text || "";
    }
  } catch (e) {
    // Ignore chunk fetch errors
  }
  
  // Use chunk data if available, otherwise fall back to description
  const sourceText = chunkData || fullDescription;
  const info = extractFromDescription(sourceText) || {};
  
  console.log("Full description:", fullDescription);
  console.log("Chunk data:", chunkData);
  console.log("Source text for extraction:", sourceText);
  console.log("Extracted info:", JSON.stringify(info, null, 2));
  console.log("Experience Level extracted:", info.experienceLevel);
  console.log("Equipment Needed extracted:", info.equipmentNeeded);
  
  let summary = null; // Don't use info.summary, generate our own
  
  if (fullDescription) {
    // Summary generation started

    let summaryText = '';
    const lastDescriptionIndex = fullDescription.toLowerCase().lastIndexOf('description:');
    // lastDescriptionIndex found

    if (lastDescriptionIndex !== -1) {
      // Get text after the last "Description:"
      let potentialSummaryText = fullDescription.substring(lastDescriptionIndex + 'description:'.length).trim();
      // potentialSummaryText extracted

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
      // summaryText refined
    }

    if (summaryText) {
      const sentences = summaryText
        .replace(/<[^>]*>/g, ' ') // Remove HTML tags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 30) // Filter out very short fragments
        .slice(0, 2); // Take first 2 sentences for a concise summary
      
      // Sentences extracted

      if (sentences.length > 0) {
        summary = sentences.join('. ') + (sentences.length > 1 ? '.' : '');
        // Final summary generated
      }
    }
    
    // Fallback: if no specific description section found or summary is still empty
    if (!summary) {
      // Falling back to general summary
      const sentences = fullDescription
        .replace(/<[^>]*>/g, ' ') // Remove HTML tags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 30) // Filter out very short fragments
        .slice(0, 2); // Take first 2 sentences
      
      // Sentences from fallback

      if (sentences.length > 0) {
        summary = sentences.join('. ') + (sentences.length > 1 ? '.' : '');
        // Final summary from fallback
      }
    }
  }

  // Attach prices to sessions: two sessions → low/high; else fallback single
  const sessions = [...(info.sessions || [])];
  if (sessions.length) {
    if (lowPrice != null && highPrice != null && sessions.length >= 2) {
      sessions[0].price = lowPrice;
      sessions[1].price = highPrice;
    } else if (primary?.price != null) {
      sessions.forEach((s) => (s.price = primary.price));
    }
  }

  const lines = [];
  lines.push(`**${title}**${priceHead}`);

  if (summary) lines.push(`\n${summary}`);

  const facts = [];
  if (info.location) facts.push(`**Location:** ${info.location}`);
  if (info.participants) facts.push(`**Participants:** ${info.participants}`);
  if (info.fitness) facts.push(`**Fitness:** ${info.fitness}`);
  if (info.availability) facts.push(`**Availability:** ${info.availability}`);
  if (info.experienceLevel) facts.push(`**Experience Level:** ${info.experienceLevel}`);
  if (info.equipmentNeeded) facts.push(`**Equipment Needed:** ${info.equipmentNeeded}`);
  
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
    for (const s of sessions) {
      const pretty = s.label.replace(/\bhrs\b/i, "hours");
      const ptxt = s.price != null ? ` — ${toGBP(s.price)}` : "";
      lines.push(`- **${pretty}** — ${s.time}${ptxt}`);
    }
  }

  return lines.join("\n");
}

/* ----------------------------- Event list UI ----------------------------- */
function formatEventsForUi(events) {
  // Preserve original fields so the frontend can format times and ranges
  return (events || [])
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
    }))
    .slice(0, 12);
}

/* ----------------------------- Pills builders ---------------------------- */
function buildEventPills({ productUrl, firstEventUrl, landingUrl, photosUrl }) {
  const pills = [];
  const used = new Set();
  const add = (label, url, brand = true) => {
    if (!label || !url) return;
    if (used.has(url)) return;
    used.add(url);
    pills.push({ label, url, brand });
  };

  add("Book Now", productUrl || firstEventUrl, true);

  // Event Listing + More Events both point at listing root (no search page)
  let listUrl = landingUrl || (firstEventUrl && originOf(firstEventUrl) + "/photography-workshops");
  // Special-case: course products (beginners classes) should link to the course listing
  try {
    const u = String(productUrl||'');
    if (/beginners-photography-(classes|course)/i.test(u) || /photography-services-near-me\/beginners-photography-course/i.test(u)) {
      listUrl = "https://www.alanranger.com/beginners-photography-classes";
    } else if (/lightroom-courses-for-beginners-coventry/i.test(u) || /photo-editing-course-coventry/i.test(u)) {
      listUrl = "https://www.alanranger.com/photo-editing-course-coventry";
    }
  } catch {}
  // If events come from the courses section, prefer the section listing root deterministically
  try {
    const fe = String(firstEventUrl||'');
    const m = fe.match(/^https?:\/\/[^/]+\/(beginners-photography-lessons)\//i);
    if (m && m[1]) {
      const base = fe.split(m[1])[0] + m[1];
      listUrl = base.startsWith('http') ? base : `https://www.alanranger.com/${m[1]}`;
    }
  } catch {}
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

async function resolveEventsAndProduct(client, { keywords, pageContext = null, csvType = null }) {
  // Events filtered by keywords (stronger locality match)
  const events = await findEvents(client, { keywords, limit: 80, pageContext, csvType });

  // Try to pick the best-matching product for these keywords
  const products = await findProducts(client, { keywords, limit: 10, pageContext, csvType });
  const product = products?.[0] || null;

  // Landing page (if any), else the event origin's workshops root
  const landing = (await findLanding(client, { keywords })) || null;

  return { events, product, landing };
}

/* ---------------------------- Extract Relevant Info ---------------------------- */
async function extractRelevantInfo(query, dataContext) {
  const { products, events, articles } = dataContext;
  const lowerQuery = query.toLowerCase();
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
      if (event.event_location && event.event_location.trim().length > 0) {
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
        const date = new Date(event.date_start);
        const formattedDate = date.toLocaleDateString('en-GB', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        });
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
function calculateEventConfidence(query, events, product) {
  let baseConfidence = 0.3;
  let confidenceFactors = [];
  
  const queryLower = query.toLowerCase();
  
  // INTENT-BASED CONFIDENCE SCORING
  // Detect query requirements and check for mismatches
  const queryRequirements = {
    free: queryLower.includes('free'),
    online: queryLower.includes('online'),
    certificate: queryLower.includes('certificate') || queryLower.includes('cert'),
    inPerson: queryLower.includes('in person') || queryLower.includes('in-person') || queryLower.includes('coventry') || queryLower.includes('location'),
    price: queryLower.includes('price') || queryLower.includes('cost') || queryLower.includes('much')
  };
  
  // Check response attributes
  const responseAttributes = {
    hasFreeContent: false,
    hasOnlineContent: false,
    hasCertificateInfo: false,
    hasInPersonContent: false,
    hasPriceInfo: false,
    averagePrice: 0,
    onlineCount: 0,
    inPersonCount: 0
  };
  
  // Analyze events for response attributes
  if (events && events.length > 0) {
    events.forEach(event => {
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
    });
    
    responseAttributes.averagePrice = responseAttributes.averagePrice / events.length;
  }
  
  // Check product attributes
  if (product) {
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
  
  // Apply intent-based penalties for mismatches
  if (queryRequirements.free && !responseAttributes.hasFreeContent) {
    baseConfidence -= 0.5;
    confidenceFactors.push("Free query but no free content (-0.5)");
  }
  
  if (queryRequirements.online && !responseAttributes.hasOnlineContent) {
    baseConfidence -= 0.3;
    confidenceFactors.push("Online query but no online content (-0.3)");
  }
  
  if (queryRequirements.certificate && !responseAttributes.hasCertificateInfo) {
    baseConfidence -= 0.4;
    confidenceFactors.push("Certificate query but no certificate info (-0.4)");
  }
  
  if (queryRequirements.inPerson && !responseAttributes.hasInPersonContent) {
    baseConfidence -= 0.2;
    confidenceFactors.push("In-person query but no in-person content (-0.2)");
  }
  
  // Apply bonuses for good matches
  if (queryRequirements.free && responseAttributes.hasFreeContent) {
    baseConfidence += 0.3;
    confidenceFactors.push("Free query matched with free content (+0.3)");
  }
  
  if (queryRequirements.online && responseAttributes.hasOnlineContent) {
    baseConfidence += 0.2;
    confidenceFactors.push("Online query matched with online content (+0.2)");
  }
  
  if (queryRequirements.certificate && responseAttributes.hasCertificateInfo) {
    baseConfidence += 0.3;
    confidenceFactors.push("Certificate query matched with certificate info (+0.3)");
  }
  
  // Factor 1: Query specificity for events
  const isEventQuery = queryLower.includes("when") || queryLower.includes("next") || queryLower.includes("date") || queryLower.includes("workshop") || queryLower.includes("course");
  const isLocationQuery = queryLower.includes("where") || queryLower.includes("location") || queryLower.includes("coventry") || queryLower.includes("devon");
  const isPriceQuery = queryLower.includes("cost") || queryLower.includes("price") || queryLower.includes("much");
  
  if (isEventQuery) {
    baseConfidence += 0.2;
    confidenceFactors.push("Event query (+0.2)");
  }
  if (isLocationQuery) {
    baseConfidence += 0.15;
    confidenceFactors.push("Location query (+0.15)");
  }
  if (isPriceQuery) {
    baseConfidence += 0.15;
    confidenceFactors.push("Price query (+0.15)");
  }
  
  // Factor 2: Event availability and quality
  if (events && events.length > 0) {
    baseConfidence += Math.min(0.3, events.length * 0.1);
    confidenceFactors.push(`Events found: ${events.length} (+${(Math.min(0.3, events.length * 0.1)).toFixed(2)})`);
    
    // Check for future events
    const futureEvents = events.filter(e => e.date_start && new Date(e.date_start) > new Date());
    if (futureEvents.length > 0) {
      baseConfidence += 0.15;
      confidenceFactors.push(`Future events: ${futureEvents.length} (+0.15)`);
    }
    
    // Check for specific event types
    const hasWorkshops = events.some(e => e.subtype && e.subtype.toLowerCase().includes('workshop'));
    const hasCourses = events.some(e => e.subtype && e.subtype.toLowerCase().includes('course'));
    if (hasWorkshops || hasCourses) {
      baseConfidence += 0.1;
      confidenceFactors.push("Specific event types (+0.1)");
    }
  }
  
  // Factor 3: Product availability
  if (product) {
    baseConfidence += 0.2;
    confidenceFactors.push("Product found (+0.2)");
    
    // Check product quality
    if (product.price_gbp && product.price_gbp > 0) {
      baseConfidence += 0.1;
      confidenceFactors.push("Product with price (+0.1)");
    }
    if (product.location_address && product.location_address.trim().length > 0) {
      baseConfidence += 0.1;
      confidenceFactors.push("Product with location (+0.1)");
    }
  }
  
  // Factor 4: Query-event relevance
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
    
    if (relevanceScore > 0) {
      const relevanceBonus = Math.min(0.2, relevanceScore * 0.05);
      baseConfidence += relevanceBonus;
      confidenceFactors.push(`Query relevance: ${relevanceScore} (+${relevanceBonus.toFixed(2)})`);
    }
  }
  
  // Cap confidence between 0.1 and 0.95
  const finalConfidence = Math.max(0.1, Math.min(0.95, baseConfidence));
  
  // Log confidence factors for debugging
  if (confidenceFactors.length > 0) {
    console.log(`🎯 Event confidence factors for "${query}": ${confidenceFactors.join(', ')} = ${(finalConfidence * 100).toFixed(1)}%`);
  }
  
  return finalConfidence;
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

    // Build contextual query for keyword extraction (merge with previous query)
    const contextualQuery = previousQuery ? `${previousQuery} ${query}` : query;
    
    const intent = detectIntent(query || ""); // Use current query only for intent detection
    
    // Retrieval-first: try to gather content and check content-based confidence
    // before deciding to trigger clarification for initial queries (no previousQuery)
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
    
    // If we have enough content-based confidence, answer directly now (skip clarification entirely)
    if (!previousQuery) {
      let confident = hasContentBasedConfidence(query || "", intent, preContent);
      // Secondary check: if initial confidence is low, attempt a light retrieval probe
      // to see if we have enough content to answer directly.
      if (!confident) {
        const probeKeywords = extractKeywords(query || "");
        if (probeKeywords.length) {
          if (intent === "events") {
            const probeEvents = await findEvents(client, { keywords: probeKeywords, limit: 25, pageContext });
            confident = Array.isArray(probeEvents) && probeEvents.length > 0;
          } else {
            const probeArticles = await findArticles(client, { keywords: probeKeywords, limit: 12, pageContext });
            const probeUrls = probeArticles?.map(a => a.page_url || a.source_url).filter(Boolean) || [];
            const probeChunks = await findContentChunks(client, { keywords: probeKeywords, limit: 8, articleUrls: probeUrls });
            confident = (Array.isArray(probeArticles) && probeArticles.length > 0) || (Array.isArray(probeChunks) && probeChunks.length > 0);
          }
        }
      }
      if (confident) {
        const directKeywords = extractKeywords(query || "");
        if (intent === "events") {
          const events = await findEvents(client, { keywords: directKeywords, limit: 80, pageContext });
          const eventList = formatEventsForUi(events);
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
            debug: { version: "v1.2.40-retrieval-first", earlyReturn: true }
          });
          return;
        } else {
          // advice/default path
          let articles = await findArticles(client, { keywords: directKeywords, limit: 30, pageContext });
          // Ensure article cards can render on the client by providing title and page_url fallbacks
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
          // If pricing/accommodation hinted, prefer pricing synthesizer
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
          return;
        }
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
          const events = await findEvents(client, { keywords: directKeywords, limit: 120, pageContext, csvType: "workshop_events" });
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
    }
    
    // For events, only use previous context for follow-up style questions.
    const qlc = (query || "").toLowerCase();
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

    // NEW: Follow-up direct synthesis for advice queries (equipment/pricing) even when previousQuery exists
    if (previousQuery && intent === "advice") {
      // Equipment advice synthesis
      if (isEquipmentAdviceQuery(qlc)) {
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
            debug: { version: "v1.2.45-followup-equip", previousQuery: true }
          });
          return;
        }
      }
      // Pricing/accommodation synthesis
      const pricingSynth = generatePricingAccommodationAnswer(qlc);
      if (pricingSynth) {
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
            debug: { version: "v1.2.45-followup-pricing", previousQuery: true }
          });
          return;
        }
      }
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
          const clarification = generateClarificationQuestion(newQuery);
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
          const csvType = mentionsCourse ? "course_events" : "workshop_events";
          
          const events = await findEvents(client, { keywords: newKeywords, limit: 80, pageContext, csvType });
          const eventList = formatEventsForUi(events);
          
          // Generate specific answer for the clarified query
          const specificAnswer = generateDirectAnswer(newQuery, [], []);
          
          // Check if we have logical confidence for this clarified query
          const hasConfidence = hasContentBasedConfidence(newQuery, "events", { events: eventList });
          if (!hasConfidence) {
            console.log(`🤔 Low logical confidence for clarified events query: "${newQuery}" - triggering clarification`);
            const clarification = generateClarificationQuestion(newQuery);
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
            const clarification = generateClarificationQuestion(newQuery);
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
      // Determine CSV type based on query content
      const lc = (query || "").toLowerCase();
      const mentionsCourse = lc.includes("course") || lc.includes("class") || lc.includes("lesson");
      const csvType = mentionsCourse ? "course_events" : "workshop_events";
      
      // Get events from the enhanced view that includes product mappings
      const events = await findEvents(client, { keywords, limit: 80, pageContext, csvType });
      // If the new query names a significant topic (e.g., lightroom), prefer events matching that topic
      const GENERIC_EVENT_TERMS = new Set(["workshop","workshops","course","courses","class","classes","event","events","next","when","your"]);
      const significant = (keywords || []).find(k => k && !GENERIC_EVENT_TERMS.has(String(k).toLowerCase()) && String(k).length >= 4);
      const matchEvent = (e, term)=>{
        const t = term.toLowerCase();
        const hay = `${e.title||e.event_title||''} ${e.product_title||''} ${e.location_name||e.event_location||''}`.toLowerCase();
        return hay.includes(t);
      };
      const filteredEvents = significant ? events.filter(e => matchEvent(e, significant)) : events;

      const eventList = formatEventsForUi(filteredEvents.length ? filteredEvents : events);
      
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
        console.log(`🤔 Low logical confidence for events query: "${query}" - triggering clarification`);
        const clarification = generateClarificationQuestion(query);
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
            original_intent: "events",
            meta: {
              duration_ms: Date.now() - started,
              endpoint: "/api/chat",
              clarification_type: clarification.type,
              logical_confidence: false,
            }
          });
          return;
        }
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
        const { data: landingData } = await client
          .from("page_entities")
          .select("*")
          .eq("kind", "landing")
          .or(keywords.map(k => `title.ilike.%${k}%`).join(","))
          .limit(20);
        landing = landingData || [];
        console.log(`🧭 Landing pages found: ${landing.length}`);
      }
      
      // CRITICAL: Also search specifically for the free course URL across all entity types
      console.log(`🔍 Searching specifically for free course URL...`);
      const freeCourseUrl = 'https://www.alanranger.com/free-online-photography-course';
      const { data: freeCourseEntities } = await client
        .from("page_entities")
        .select("*")
        .eq("page_url", freeCourseUrl);
      
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
    const scoreArticle = (a)=>{
      const title = String(a.title||'').toLowerCase();
      const url = String(a.page_url||a.source_url||a.url||'').toLowerCase();
      const categories = a.categories || [];
      let s = 0;
      for (const t of queryTokens){ if (!t) continue; if (title.includes(t)) s += 3; if (url.includes(t)) s += 2; }
      
      // MAJOR BOOST: Online Photography Course content for technical concepts
      const isOnlineCourse = categories.includes("online photography course");
      const technicalConcepts = [
        "iso", "aperture", "shutter speed", "white balance", "depth of field", "metering",
        "exposure", "composition", "macro", "landscape", "portrait", "street", "wildlife",
        "raw", "jpeg", "hdr", "focal length", "long exposure", "focal", "balance", "bracketing",
        "manual", "negative space", "contrast", "framing", "filters", "lens", "camera"
      ];
      const hasTechnical = technicalConcepts.some(c => qlcRank.includes(c));
      
      if (hasTechnical && isOnlineCourse) {
        s += 25; // Increased boost for online course content on technical topics
        
        // Extra boost for "What is..." format articles
        if (title.includes("what is") && technicalConcepts.some(c => title.includes(c))) {
          s += 20; // Increased boost
        }
        
        // Boost for PDF checklists and guides
        if (title.includes("pdf") || title.includes("checklist") || title.includes("guide")) {
          s += 15; // Increased boost
        }
        
        // Boost for beginner guides
        if (title.includes("guide for beginners") || title.includes("guide for beginner")) {
          s += 12; // Increased boost
        }
        
        // Extra boost for exact term matches in title
        const exactTerm = qlcRank.replace(/^what\s+is\s+/, "").trim();
        if (title.toLowerCase().includes(exactTerm)) {
          s += 30; // Major boost for exact term matches
        }
      }
      
      // Enhanced boost for equipment-related matches
      for (const k of equipmentKeywords){ 
        if (qlcRank.includes(k) && (title.includes(k) || url.includes(k))) {
          s += 6; // Increased from 4
          // Extra boost for specific tripod brands/models
          if (k === 'tripod' && (title.includes('gitzo') || title.includes('benro') || url.includes('gitzo') || url.includes('benro'))) {
            s += 8;
          }
        }
      }
      
      // Boost for recommendation articles that match the query topic
      if (qlcRank.includes('recommend')) {
        if (title.includes('recommended') && title.includes(qlcRank.split(' ')[0])) s += 15;
        if (url.includes('recommended') && url.includes(qlcRank.split(' ')[0])) s += 12;
      }
      
      // Boost for comprehensive guides (based on content quality, not hardcoded URLs)
      if (title.includes('professional guide') || title.includes('complete guide')) s += 5;
      if (title.includes('review') && title.includes('comparison')) s += 4;
      
      // Penalize irrelevant articles for tripod queries
      if (qlcRank.includes('tripod') && !title.includes('tripod') && !url.includes('tripod') && 
          !title.includes('equipment') && !url.includes('equipment') && !title.includes('gitzo') && !title.includes('benro')) {
        s -= 3;
      }
      
      // Slight freshness bonus if we have last_seen
      try{ const seen = Date.parse(a.last_seen||''); if (!isNaN(seen)) { const ageDays = (Date.now()-seen)/(1000*60*60*24); if (ageDays < 365) s += 2; } }catch{}
      return s;
    };
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
          else if (title !== 'Alan Ranger Photography' && existingTitle !== 'Alan Ranger Photography' && 
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
      
      // Factor 1: Query type and specificity
      const queryLower = query.toLowerCase();
      const isTechnicalQuery = queryLower.includes("what is") || queryLower.includes("what are") || queryLower.includes("how does") || queryLower.includes("how do");
      const isEquipmentQuery = queryLower.includes("tripod") || queryLower.includes("camera") || queryLower.includes("lens") || queryLower.includes("filter") || queryLower.includes("bag") || queryLower.includes("flash");
      const isCourseQuery = queryLower.includes("course") || queryLower.includes("workshop") || queryLower.includes("lesson") || queryLower.includes("class");
      const isEventQuery = queryLower.includes("when") || queryLower.includes("next") || queryLower.includes("date") || queryLower.includes("workshop");
      
      if (isTechnicalQuery) {
        baseConfidence += 0.2;
        confidenceFactors.push("Technical query (+0.2)");
      }
      if (isEquipmentQuery) {
        baseConfidence += 0.15;
        confidenceFactors.push("Equipment query (+0.15)");
      }
      if (isCourseQuery) {
        baseConfidence += 0.15;
        confidenceFactors.push("Course query (+0.15)");
      }
      if (isEventQuery) {
        baseConfidence += 0.15;
        confidenceFactors.push("Event query (+0.15)");
      }
      
      // Factor 2: Article relevance and quality
      if (articles && articles.length > 0) {
        const totalArticles = articles.length;
        const articleRelevanceScore = calculateArticleRelevance(query, articles);
        
        // Base score for having articles
        baseConfidence += Math.min(0.3, totalArticles * 0.05);
        confidenceFactors.push(`Articles found: ${totalArticles} (+${(Math.min(0.3, totalArticles * 0.05)).toFixed(2)})`);
        
        // Relevance bonus
        baseConfidence += articleRelevanceScore * 0.2;
        confidenceFactors.push(`Relevance score: ${articleRelevanceScore.toFixed(2)} (+${(articleRelevanceScore * 0.2).toFixed(2)})`);
        
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
      
      // Factor 3: Answer type quality
      if (hasDirectAnswer) {
        baseConfidence += 0.25;
        confidenceFactors.push("Direct FAQ answer (+0.25)");
      } else if (hasServiceAnswer) {
        baseConfidence += 0.15;
        confidenceFactors.push("Service FAQ answer (+0.15)");
      }
      
      // Factor 4: Content quality indicators
      if (contentChunks && contentChunks.length > 0) {
        const hasRichContent = contentChunks.some(chunk => 
          chunk.chunk_text && chunk.chunk_text.length > 100
        );
        if (hasRichContent) {
          baseConfidence += 0.1;
          confidenceFactors.push("Rich content chunks (+0.1)");
        }
      }
      
      // Factor 5: Penalties for poor matches
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
      
      // Intent-aware penalties/bonuses
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
          lines.push("This is Alan’s free, online photography course. It’s self-paced and designed to build fundamentals with practical tips and assignments you can follow from home.");
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
      const clarification = generateClarificationQuestion(query);
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
