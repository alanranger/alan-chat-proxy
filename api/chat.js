// /api/chat.js
// Force deployment: 2025-10-05 00:35 - Vercel cache issue
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

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
  const hasEventWord = EVENT_HINTS.some((w) => lc.includes(w));
  const mentionsWorkshop =
    lc.includes("workshop") || lc.includes("course") || lc.includes("class");
  if (hasEventWord && mentionsWorkshop) return "events";
  // heuristic: if question starts with "when/where" + includes 'workshop' → events
  if (/^\s*(when|where)\b/i.test(q || "") && mentionsWorkshop) return "events";
  
  // Handle follow-up questions for events (price, location, etc.)
  const followUpQuestions = [
    "how much", "cost", "price", "where", "location", "when", "date",
    "how many", "people", "attend", "fitness", "level", "duration", "long"
  ];
  if (followUpQuestions.some(word => lc.includes(word))) {
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
  const nowIso = new Date().toISOString();
  let q = client
    .from("v_events_for_chat")
    .select("*")
    .gte("date_start", nowIso)
    .order("date_start", { ascending: true })
    .limit(limit);

  const orExpr =
    anyIlike("event_title", keywords) ||
    anyIlike("event_url", keywords) ||
    anyIlike("event_location", keywords);
  if (orExpr) q = q.or(orExpr);

  const { data, error } = await q;
  if (error) return [];
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
      when: fmtDateLondon(e.date_start),
      href: pickUrl(e),
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
    const event = events[0]; // Use the first (most relevant) event
    
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

    const { query, topK } = req.body || {};
    const client = supabaseAdmin();

    const intent = detectIntent(query || "");
    const keywords = extractKeywords(query || "");

    if (intent === "events") {
      const { events, product, landing } = await resolveEventsAndProduct(
        client,
        { keywords }
      );

      const eventList = formatEventsForUi(events);
      const productPanel = product ? buildProductPanelMarkdown([product]) : "";

      // Use extractRelevantInfo to get specific answers for follow-up questions
      const dataContext = { events, products: product ? [product] : [], articles: [] };
      const specificAnswer = await extractRelevantInfo(query, dataContext);
      
      // If we got a specific answer, use it; otherwise use the product panel
      const answerMarkdown = specificAnswer !== `I don't have a confident answer to that yet. I'm trained on Alan's site, so I may miss things. If you'd like to follow up, please reach out:` 
        ? specificAnswer 
        : productPanel;

      const firstEventUrl = pickUrl(events?.[0]) || null;
      const productUrl = pickUrl(product) || firstEventUrl || null;
      // prefer an explicit landing; else derive from first event origin
      const landingUrl =
        pickUrl(landing) ||
        (firstEventUrl ? originOf(firstEventUrl) + "/photography-workshops" : null);

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
        pickUrl(product),
        pickUrl(landing),
        ...((events || []).map(pickUrl)),
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

    // If we have multiple articles, render a neat bullet list (title — Link)
    const lines = [];
    if (articles?.length) {
      lines.push("Here are Alan’s guides that match your question:\n");
      for (const a of articles.slice(0, 8)) {
        const t = a.title || a.raw?.name || "Read more";
        const u = pickUrl(a);
        lines.push(`- ${t} — ${u ? `[Link](${u})` : ""}`.trim());
      }
    } else {
      lines.push("I couldn’t find a specific guide for that yet.");
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
