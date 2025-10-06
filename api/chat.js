// /api/chat.js
// FIX: 2025-10-06 04:15 - Fixed fitness level extraction from description field
// This extracts fitness level information from product chunks description field
// Now parses patterns like "Fitness: 1. Easy" and "Experience - Level: Beginner"
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

/* ----------------------- Direct Answer Generation ----------------------- */
function generateDirectAnswer(query, articles, contentChunks = []) {
  const lc = (query || "").toLowerCase();
  const queryWords = lc.split(" ").filter(w => w.length > 2);
  
  // DEBUG: Log what we're working with
  console.log(`🔍 generateDirectAnswer: Query="${query}"`);
  console.log(`🔍 generateDirectAnswer: Content chunks count=${contentChunks.length}`);
  if (contentChunks.length > 0) {
    console.log(`🔍 generateDirectAnswer: First chunk preview="${(contentChunks[0].chunk_text || contentChunks[0].content || "").substring(0, 200)}..."`);
  }
  
  // SPECIAL CASE: Direct ISO summary if asked (works even if chunks ranking misses)
  if (lc.includes(" iso" ) || lc.startsWith("iso") || /\biso\b/i.test(lc)) {
    const isoChunk = (contentChunks || []).find(c => (c.url || "").includes("what-is-iso-in-photography"));
    const isoArticle = (articles || []).find(a => (a.page_url || a.source_url || "").includes("what-is-iso-in-photography"));
    const isoUrl = (isoChunk && isoChunk.url) || (isoArticle && (isoArticle.page_url || isoArticle.source_url)) || null;
    const summary = "**ISO controls your camera sensor's sensitivity to light.** Raise ISO to keep shutter speeds safe or freeze motion in low light, but expect more image noise. Use the lowest ISO that still gives you your desired shutter speed and aperture.";
    return `${summary}\n\n${isoUrl ? `*From Alan's blog: ${isoUrl}*\n\n` : ""}`;
  }

  // Try to find relevant content from chunks first
  const relevantChunk = contentChunks.find(chunk => {
    const chunkText = (chunk.chunk_text || chunk.content || "").toLowerCase();
    const chunkTitle = (chunk.title || "").toLowerCase();
    
    // Prioritize chunks that contain the full query or key terms
    const hasFullQuery = chunkText.includes(lc);
    
    // Include technical terms (3+ chars) and general words (4+ chars)
    const technicalTerms = ["iso", "raw", "jpg", "png", "dpi", "ppi", "rgb", "cmyk"];
    const importantWords = queryWords.filter(w => 
      w.length >= 3 && (technicalTerms.includes(w) || w.length >= 4)
    );
    
    const hasKeyTerms = importantWords.every(word => 
      chunkText.includes(word) || chunkTitle.includes(word)
    );
    
    console.log(`🔍 generateDirectAnswer: Chunk check - hasFullQuery=${hasFullQuery}, hasKeyTerms=${hasKeyTerms}, importantWords=${importantWords.join(',')}`);
    
    return hasFullQuery || hasKeyTerms;
  });
  
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
             !sLower.includes('alan ranger photography'); // Skip navigation
    });
    
    if (relevantSentence) {
      return `**${relevantSentence.trim()}**\n\n*From Alan's blog: ${relevantChunk.url}*\n\n`;
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
  
  // Tripod recommendations
  if (lc.includes("tripod") && lc.includes("recommend")) {
    const tripodArticles = articles.filter(a => 
      a.title?.toLowerCase().includes("tripod") || 
      a.raw?.name?.toLowerCase().includes("tripod")
    );
    
    if (tripodArticles.length > 0) {
      const topTripod = tripodArticles[0];
      const title = topTripod.title || topTripod.raw?.name || "tripod guide";
      return `Based on Alan's experience, I'd recommend checking out his **${title}**. He has detailed reviews and recommendations for different types of photography and budgets.\n\n`;
    }
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
  
  // Equipment recommendations
  if (lc.includes("tripod") || lc.includes("equipment") || lc.includes("camera") || lc.includes("lens") || lc.includes("gear")) {
    return `**Equipment Recommendations**: Alan Ranger Photography provides professional equipment recommendations including lightweight tripods, cameras, and lenses. For detailed equipment guides and Amazon affiliate links, visit the [Equipment Recommendations page](https://www.alanranger.com/photography-equipment-recommendations).\n\n`;
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
  "course",
  "class",
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
];

function extractKeywords(q) {
  const lc = (q || "").toLowerCase();
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
  
  // ADVICE keywords - these should override event classification
  const adviceKeywords = [
    "certificate", "camera", "laptop", "equipment", "tripod", "lens", "gear",
    "need", "require", "recommend", "advise", "help", "wrong", "problem",
    "free", "online", "sort of", "what do i", "do i need", "get a",
    "what is", "what are", "how does", "explain", "define", "meaning"
  ];
  
  // If it contains advice keywords, it's likely advice
  if (adviceKeywords.some(word => lc.includes(word))) {
    return "advice";
  }
  
  const hasEventWord = EVENT_HINTS.some((w) => lc.includes(w));
  const mentionsWorkshop =
    lc.includes("workshop") || lc.includes("course") || lc.includes("class");
  
  // Only classify as events if it has both event words AND workshop mentions
  if (hasEventWord && mentionsWorkshop) return "events";
  
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

/* ----------------------- DB helpers (robust fallbacks) ------------------- */

function anyIlike(col, words) {
  // Builds PostgREST OR ILIKE expression for (col) against multiple words
  const parts = (words || [])
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => `${col}.ilike.%${w}%`);
  return parts.length ? parts.join(",") : null;
}

async function findEvents(client, { keywords, limit = 50 }) {
  // Use v_event_product_mappings view for events, courses and workshops
  let q = client
    .from("v_event_product_mappings")
    .select("event_url, event_title, product_url, product_title, date_start, date_end, event_location, price_gbp, participants, fitness_level, availability, map_method, confidence, subtype")
    .gte("date_start", new Date().toISOString())
    .order("date_start", { ascending: true })
    .limit(limit);

  if (keywords.length) {
    // Prioritize specific keywords like "bluebell" over generic ones like "workshop"
    const specificKeywords = keywords.filter(k => !['workshop', 'when', 'next', 'photography'].includes(k.toLowerCase()));
    const genericKeywords = keywords.filter(k => ['workshop', 'when', 'next', 'photography'].includes(k.toLowerCase()));
    
    const orParts = [];
    
    // First, try to match specific keywords (like "bluebell")
    for (const keyword of specificKeywords) {
      orParts.push(`event_title.ilike.%${keyword}%`);
      orParts.push(`product_title.ilike.%${keyword}%`);
      orParts.push(`event_location.ilike.%${keyword}%`);
    }
    
    // If no specific keywords, fall back to generic ones
    if (orParts.length === 0) {
      for (const keyword of genericKeywords) {
        orParts.push(`event_title.ilike.%${keyword}%`);
        orParts.push(`product_title.ilike.%${keyword}%`);
        orParts.push(`event_location.ilike.%${keyword}%`);
      }
    }
    
    if (orParts.length) {
      q = q.or(orParts.join(","));
    }
  }

  const { data, error } = await q;
  if (error) {
    console.error('❌ v_event_product_mappings query error:', error);
    return [];
  }
  
  return data || [];
}

async function findProducts(client, { keywords, limit = 20 }) {
  let q = client
        .from("page_entities")
    .select("*")
        .eq("kind", "product")
    .order("last_seen", { ascending: false })
    .limit(limit);

  const orExpr =
    anyIlike("title", keywords) || anyIlike("page_url", keywords) || null;
  if (orExpr) q = q.or(orExpr);

  const { data, error } = await q;
  if (error) return [];
  return data || [];
}

async function findArticles(client, { keywords, limit = 12 }) {
  let q = client
    .from("page_entities")
    .select("id, title, page_url, source_url, raw, last_seen")
    .in("kind", ["article", "blog", "page"])
    .order("last_seen", { ascending: false })
    .limit(limit);

  const orExpr =
    anyIlike("title", keywords) || anyIlike("page_url", keywords) || null;
  if (orExpr) q = q.or(orExpr);

  const { data, error } = await q;
  if (error) return [];
  return data || [];
}

async function findContentChunks(client, { keywords, limit = 5 }) {
  let q = client
    .from("page_chunks")
    .select("title, chunk_text, url, content")
    .limit(limit * 2); // Get more results to filter

  const orExpr = anyIlike("chunk_text", keywords) || anyIlike("content", keywords) || null;
  if (orExpr) q = q.or(orExpr);

  const { data, error } = await q;
  if (error) return [];
  
  // Sort by relevance: prioritize chunks that contain the full query or key terms
  const sortedData = (data || []).sort((a, b) => {
    const aText = (a.chunk_text || a.content || "").toLowerCase();
    const bText = (b.chunk_text || b.content || "").toLowerCase();
    const aTitle = (a.title || "").toLowerCase();
    const bTitle = (b.title || "").toLowerCase();
    
    // Score based on how many keywords are found
    const aScore = keywords.reduce((score, keyword) => {
      if (aText.includes(keyword.toLowerCase()) || aTitle.includes(keyword.toLowerCase())) {
        return score + 1;
      }
      return score;
    }, 0);
    
    const bScore = keywords.reduce((score, keyword) => {
      if (bText.includes(keyword.toLowerCase()) || bTitle.includes(keyword.toLowerCase())) {
        return score + 1;
      }
      return score;
    }, 0);
    
    return bScore - aScore; // Higher score first
  });
  
  return sortedData.slice(0, limit);
}

async function findLanding(client, { keywords }) {
  // best effort: a canonical "landing" page if marked, else a generic workshops page
  let q = client
      .from("page_entities")
    .select("*")
    .in("kind", ["article", "page"])
    .eq("raw->>canonical", "true")
    .eq("raw->>role", "landing")
      .order("last_seen", { ascending: false })
      .limit(1);

  const orExpr =
    anyIlike("title", keywords) || anyIlike("page_url", keywords) || null;
  if (orExpr) q = q.or(orExpr);

  const { data } = await q;
  return data?.[0] || null;
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
          if (m && m[0]) result.pdf = Array.isArray(m) ? m[0] : m[1];
        }
        // find first internal related link with hint text
        if (!result.related) {
          const rel =
            text.match(
              /(https?:\/\/[^\s)>"']*alanranger\.com[^\s)>"']+)/i
            ) || text.match(/href="([^"]*alanranger\.com[^"]+)"/i);
          if (rel && rel[0]) {
            result.related = Array.isArray(rel) ? rel[0] : rel[1];
            // crude label guess: look for preceding words like link text
            const labelMatch =
              text.match(/\[([^\]]+)\]\([^)]+\)/) ||
              text.match(/>([^<]{3,60})<\/a>/i);
            if (labelMatch && labelMatch[1]) {
              result.relatedLabel = labelMatch[1].trim();
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
    summary: null,
    sessions: [],
  };
  if (!desc) return out;

  const lines = desc.split(/\r?\n/).map((s) => s.trim());
  const nonEmpty = lines.filter(Boolean);
  if (nonEmpty.length) out.summary = nonEmpty[0];

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
    if (/^fitness:/i.test(ln)) {
      const v = ln.replace(/^fitness:\s*/i, "").trim() || nextVal(i);
      if (v) out.fitness = v;
      continue;
    }
    if (/^availability:/i.test(ln)) {
      const v = ln.replace(/^availability:\s*/i, "").trim() || nextVal(i);
      if (v) out.availability = v;
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
function buildProductPanelMarkdown(products) {
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

  const info =
    extractFromDescription(
      primary.description || primary?.raw?.description || ""
    ) || {};

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

  if (info.summary) lines.push(`\n${info.summary}`);

  const facts = [];
  if (info.location) facts.push(`**Location:** ${info.location}`);
  if (info.participants) facts.push(`**Participants:** ${info.participants}`);
  if (info.fitness) facts.push(`**Fitness:** ${info.fitness}`);
  if (info.availability) facts.push(`**Availability:** ${info.availability}`);
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
  return (events || [])
    .map((e) => ({
      ...e,
      title: e.event_title,
      when: fmtDateLondon(e.date_start),
      location: e.event_location,
      href: e.event_url,
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
  const listUrl = landingUrl || (firstEventUrl && originOf(firstEventUrl) + "/photography-workshops");
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
  if (relatedUrl) add(relatedLabel || "Related", relatedUrl, false);
  return pills.slice(0, 4);
}

/* --------------------------- Generic resolvers --------------------------- */

async function resolveEventsAndProduct(client, { keywords }) {
  // Events filtered by keywords (stronger locality match)
  const events = await findEvents(client, { keywords, limit: 80 });

  // Try to pick the best-matching product for these keywords
  const products = await findProducts(client, { keywords, limit: 10 });
  const product = products?.[0] || null;

  // Landing page (if any), else the event origin's workshops root
  const landing = (await findLanding(client, { keywords })) || null;

  return { events, product, landing };
}

/* ---------------------------- Extract Relevant Info ---------------------------- */
async function extractRelevantInfo(query, dataContext) {
  const { products, events, articles } = dataContext;
  const lowerQuery = query.toLowerCase();
  
  // For event-based questions, prioritize the structured event data
  if (events && events.length > 0) {
    console.log(`🔍 RAG: Found ${events.length} events, checking structured data`);
    
    // Find the most relevant event based on the query context
    let event = events[0]; // Default to first event
    
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
        return `The next workshop is scheduled for **${formattedDate}**. This gives you plenty of time to prepare and book your place.`;
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

/* -------------------------------- Handler -------------------------------- */
export default async function handler(req, res) {
  const started = Date.now();
  try {
  if (req.method !== "POST") {
      res
        .status(405)
        .json({ ok: false, error: "method_not_allowed", where: "http" });
      return;
    }

    const { query, topK, previousQuery } = req.body || {};
    const client = supabaseAdmin();

    // Build contextual query for keyword extraction (merge with previous query)
    const contextualQuery = previousQuery ? `${previousQuery} ${query}` : query;
    
    const intent = detectIntent(query || ""); // Use current query only for intent detection
    
    // Use contextual query for events (to maintain context), but current query for advice
    const keywords = intent === "events" 
      ? extractKeywords(contextualQuery || "") 
      : extractKeywords(query || "");

    if (intent === "events") {
      // Get events from the enhanced view that includes product mappings
      const events = await findEvents(client, { keywords, limit: 80 });

      const eventList = formatEventsForUi(events);
      
      // Extract product info from the first event (since the view includes product data)
      const firstEvent = events?.[0];
      const product = firstEvent ? {
        title: firstEvent.product_title,
        page_url: firstEvent.product_url,
        price: firstEvent.price_gbp,
        description: `Workshop in ${firstEvent.event_location}`,
        raw: {
          offers: {
            lowPrice: firstEvent.price_gbp,
            highPrice: firstEvent.price_gbp
          }
        }
      } : null;
      
      const productPanel = product ? buildProductPanelMarkdown([product]) : "";

      // Use extractRelevantInfo to get specific answers for follow-up questions
      const dataContext = { events, products: product ? [product] : [], articles: [], originalQuery: previousQuery };
      const specificAnswer = await extractRelevantInfo(query, dataContext);
      
      // If we got a specific answer, use it; otherwise use the product panel
      const answerMarkdown = specificAnswer !== `I don't have a confident answer to that yet. I'm trained on Alan's site, so I may miss things. If you'd like to follow up, please reach out:` 
        ? specificAnswer 
        : productPanel;

      const firstEventUrl = firstEvent?.event_url || null;
      const productUrl = firstEvent?.product_url || firstEventUrl || null;
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

      res.status(200).json({
        ok: true,
        answer_markdown: answerMarkdown,
        citations,
        structured: {
          intent: "events",
          topic: keywords.join(", "),
          events: eventList,
          products: product ? [product] : [],
          pills,
        },
        confidence: events.length > 0 ? 0.8 : 0.2,
    debug: {
          version: "v1.2.27-no-typo-normalize",
          intent: "events",
          keywords: keywords,
          counts: {
            events: events.length,
            products: product ? 1 : 0,
            articles: 0
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
    const articles = await findArticles(client, { keywords, limit: 12 });
    const topArticle = articles?.[0] || null;
    const articleUrl = pickUrl(topArticle) || null;
    
    // Try to get content chunks for better RAG responses
    const contentChunks = await findContentChunks(client, { keywords, limit: 5 });

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
    let confidence = 0.3; // Base confidence for advice questions
    
      if (articles?.length) {
        // Try to provide a direct answer based on the question type and content chunks
        const directAnswer = generateDirectAnswer(query, articles, contentChunks);
        
        if (directAnswer) {
          lines.push(directAnswer);
          confidence = 0.8; // Higher confidence for RAG-based direct answers
        } else {
          // Fall back to article list with better formatting
          lines.push("Here are Alan's guides that match your question:\n");
          confidence = 0.5; // Medium confidence for article lists
        }
      
      // Add relevant articles
      for (const a of articles.slice(0, 6)) {
        const t = a.title || a.raw?.name || "Read more";
        const u = pickUrl(a);
        lines.push(`- ${t} — ${u ? `[Link](${u})` : ""}`.trim());
      }
    } else {
      lines.push("I couldn't find a specific guide for that yet.");
      confidence = 0.1; // Low confidence when no articles found
    }

    res.status(200).json({
      ok: true,
      answer_markdown: lines.join("\n"),
      citations,
      structured: {
        intent: "advice",
        topic: keywords.join(", "),
        events: [],
        products: [],
        articles: articles || [],
        pills,
      },
      confidence: confidence,
        debug: {
          version: "v1.2.27-no-typo-normalize",
          intent: "advice",
          keywords: keywords,
      counts: {
            events: 0,
            products: 0,
            articles: articles?.length || 0,
            contentChunks: contentChunks?.length || 0,
          },
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
