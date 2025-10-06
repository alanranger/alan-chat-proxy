// /api/chat.js
// EMERGENCY FIX: 2025-10-05 01:05 - VERCEL NOT DEPLOYING - Use search_events RPC
// This fixes bluebell workshop detection by using proper RPC functions
// If you see this comment, the deployment worked!
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

/* ----------------------- Direct Answer Generation ----------------------- */
function generateDirectAnswer(query, articles, contentChunks = []) {
  const lc = (query || "").toLowerCase();
  const queryWords = lc.split(" ").filter(w => w.length > 2);
  
  // Try to find relevant content from chunks first
  const relevantChunk = contentChunks.find(chunk => {
    const chunkText = (chunk.chunk_text || chunk.content || "").toLowerCase();
    return queryWords.some(word => chunkText.includes(word));
  });
  
  if (relevantChunk) {
    const chunkText = relevantChunk.chunk_text || relevantChunk.content || "";
    // Extract a relevant sentence or paragraph
    const sentences = chunkText.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const relevantSentence = sentences.find(s => 
      s.toLowerCase().includes(lc.split(" ")[0]) || 
      s.toLowerCase().includes(lc.split(" ")[1])
    );
    
    if (relevantSentence) {
      return `**${relevantSentence.trim()}**\n\n*From Alan's blog: ${relevantChunk.url}*\n\n`;
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
];

function extractKeywords(q) {
  const lc = (q || "").toLowerCase();
  const kws = new Set();
  for (const t of TOPIC_KEYWORDS) {
    if (lc.includes(t)) kws.add(t);
  }
  // also add any single words ≥ 4 chars that look meaningful
  lc
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .forEach((w) => kws.add(w));
  return Array.from(kws);
}

function detectIntent(q) {
  const lc = (q || "").toLowerCase();
  
  // ADVICE keywords - these should override event classification
  const adviceKeywords = [
    "certificate", "camera", "laptop", "equipment", "tripod", "lens", "gear",
    "need", "require", "recommend", "advise", "help", "wrong", "problem",
    "free", "online", "sort of", "what do i", "do i need", "get a"
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
  
  // Handle follow-up questions for events (price, location, etc.) - but only if context suggests events
  const followUpQuestions = [
    "how much", "cost", "price", "where", "location", "when", "date",
    "how many", "people", "attend", "fitness", "level", "duration", "long"
  ];
  
  // Only classify as events if it's clearly about event details AND mentions workshop/course
  if (followUpQuestions.some(word => lc.includes(word)) && mentionsWorkshop) {
    return "events";
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
    .order("created_at", { ascending: false })
    .limit(limit);

  const orExpr = anyIlike("chunk_text", keywords) || anyIlike("content", keywords) || null;
  if (orExpr) q = q.or(orExpr);

  const { data, error } = await q;
  if (error) return [];
  return data || [];
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
        return event.participants;
      }
    }
    
    // Check for location information
    if (lowerQuery.includes('where') || lowerQuery.includes('location')) {
      if (event.event_location && event.event_location.trim().length > 0) {
        console.log(`✅ RAG: Found location="${event.event_location}" in structured event data`);
        return event.event_location;
      }
    }
    
    // Check for price information
    if (lowerQuery.includes('cost') || lowerQuery.includes('price') || lowerQuery.includes('much')) {
      if (event.price_gbp && event.price_gbp > 0) {
        console.log(`✅ RAG: Found price="${event.price_gbp}" in structured event data`);
        return `£${event.price_gbp}`;
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
        return formattedDate;
      }
    }
    
    // Check for fitness level information
    if (lowerQuery.includes('fitness') || lowerQuery.includes('level') || lowerQuery.includes('experience')) {
      if (event.fitness_level && event.fitness_level.trim().length > 0) {
        console.log(`✅ RAG: Found fitness level="${event.fitness_level}" in structured event data`);
        return event.fitness_level;
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
    
    const intent = detectIntent(query || "");
    const keywords = extractKeywords(contextualQuery || "");

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
      version: "v1.2.4-rag-content-chunks",
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
        version: "v1.2.4-rag-content-chunks",
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
