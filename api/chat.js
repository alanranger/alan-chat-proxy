// /api/chat.js
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
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

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
function slugWords(s = "") {
  return (s.toLowerCase()
    .replace(/https?:\/\/[^/]+/,"")
    .replace(/[^\p{L}\p{N}]+/gu," ")
    .trim()
    .split(/\s+/)).filter(Boolean);
}

/* ----------------------- Intent + keyword extraction --------------------- */
const EVENT_HINTS = ["date","dates","when","next","upcoming","available","where","workshop","course","class","schedule"];

const TOPIC_KEYWORDS = [
  // locations
  "devon","snowdonia","wales","lake district","warwickshire","coventry","dorset",
  // themes
  "bluebell","autumn","astrophotography","beginners","lightroom","long exposure","landscape","woodlands","arboretum","batsford"
];

// simple stopwords (kept tiny; only the frequent junk we saw in logs)
const STOP = new Set([
  "what","which","that","those","these","this","please","recommend","suggest",
  "me","my","i","you","your","do","does","is","are","a","an","the","for","with",
  "to","of","on","in","about","and","or","any","some","good","best","buy"
]);

function extractKeywords(q) {
  const lc = (q || "").toLowerCase();
  const kws = new Set();
  for (const t of TOPIC_KEYWORDS) if (lc.includes(t)) kws.add(t);
  lc.replace(/[^\p{L}\p{N}\s-]/gu," ")
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP.has(w))
    .forEach(w => kws.add(w));
  return Array.from(kws);
}

function detectIntent(q) {
  const lc = (q || "").toLowerCase();
  const hasEventWord = EVENT_HINTS.some((w) => lc.includes(w));
  const mentionsWorkshop = /workshop|course|class/i.test(lc);
  if (hasEventWord && mentionsWorkshop) return "events";
  if (/^\s*(when|where)\b/i.test(q || "") && mentionsWorkshop) return "events";
  return "advice";
}

/* ----------------------- DB helpers (robust fallbacks) ------------------- */
function anyIlike(col, words) {
  const parts = (words || [])
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => `${col}.ilike.%${w}%`);
  return parts.length ? parts.join(",") : null;
}

async function findEvents(client, { keywords, limit = 120 }) {
  const nowIso = new Date().toISOString();
  let q = client
    .from("page_entities")
    .select("id, title, page_url, source_url, date_start, date_end, location, raw")
    .eq("kind", "event")
    .gte("date_start", nowIso)
    .order("date_start", { ascending: true })
    .limit(limit);

  const orExpr =
    anyIlike("title", keywords) ||
    anyIlike("page_url", keywords) ||
    anyIlike("location", keywords);
  if (keywords?.length) q = q.or(orExpr || "title.ilike.%_NOPE_%");

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

  if (keywords?.length) {
    const orExpr =
      anyIlike("title", keywords) || anyIlike("page_url", keywords);
    q = q.or(orExpr || "title.ilike.%_NOPE_%");
  }

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

  if (keywords?.length) {
    const orExpr =
      anyIlike("title", keywords) || anyIlike("page_url", keywords);
    q = q.or(orExpr || "title.ilike.%_NOPE_%");
  }

  const { data, error } = await q;
  if (error) return [];
  return data || [];
}

async function findLanding(client, { keywords }) {
  let q = client
    .from("page_entities")
    .select("*")
    .in("kind", ["article", "page"])
    .eq("raw->>canonical", "true")
    .eq("raw->>role", "landing")
    .order("last_seen", { ascending: false })
    .limit(1);

  if (keywords?.length) {
    const orExpr =
      anyIlike("title", keywords) || anyIlike("page_url", keywords);
    q = q.or(orExpr || "title.ilike.%_NOPE_%");
  }

  const { data } = await q;
  return data?.[0] || null;
}

/* --------------------------- Relevance + confidence ---------------------- */
function scoreEntity(entity, keywords) {
  const words = new Set(slugWords((entity?.title || "") + " " + (pickUrl(entity) || "") + " " + (entity?.location || "")));
  let score = 0;
  for (const k of keywords) {
    const parts = slugWords(k);
    for (const p of parts) if (words.has(p)) score += 1;
  }
  const tlc = (entity?.title || "").toLowerCase();
  for (const k of keywords) if (k && tlc.includes(k.toLowerCase())) score += 2;
  return score;
}

function confidenceFrom(scores = []) {
  if (!scores.length) return 0.15;
  const max = Math.max(...scores);
  const sum = scores.reduce((a,b)=>a+b,0) || 1;
  const pct = clamp((max / (sum / scores.length)) / 3, 0.2, 0.95);
  return pct;
}

/* ----------------------- Product description parsing -------------------- */
function extractFromDescription(desc) {
  const out = { location:null, participants:null, fitness:null, availability:null, summary:null, sessions:[] };
  if (!desc) return out;
  const lines = desc.split(/\r?\n/).map((s)=>s.trim());
  const nonEmpty = lines.filter(Boolean);
  if (nonEmpty.length) out.summary = nonEmpty[0];

  const nextVal = (i) => {
    for (let j=i+1;j<lines.length;j++) { const t = lines[j].trim(); if (t) return t; }
    return null;
  };

  for (let i=0;i<lines.length;i++) {
    const ln = lines[i];
    if (/^location:/i.test(ln)) { out.location = ln.replace(/^location:\s*/i,"").trim() || nextVal(i); continue; }
    if (/^participants:/i.test(ln)) { out.participants = ln.replace(/^participants:\s*/i,"").trim() || nextVal(i); continue; }
    if (/^fitness:/i.test(ln)) { out.fitness = ln.replace(/^fitness:\s*/i,"").trim() || nextVal(i); continue; }
    if (/^availability:/i.test(ln)) { out.availability = ln.replace(/^availability:\s*/i,"").trim() || nextVal(i); continue; }
    const m1 = ln.match(/^(\d+\s*(?:hrs?|hours?|day))(?:\s*[-–—]\s*)(.+)$/i);
    if (m1) { const rawLabel = m1[1].replace(/\s+/g," ").trim(); const time = m1[2].trim(); out.sessions.push({ label: rawLabel, time, price: null }); }
  }
  if (out.summary && /^summary$/i.test(out.summary.trim())) {
    const idx = lines.findIndex((s)=>/^summary$/i.test(s.trim()));
    if (idx >= 0) { const nxt = lines.slice(idx+1).find((s)=>s.trim()); if (nxt) out.summary = nxt.trim(); }
  }
  return out;
}

/* --------------------- Build product panel (markdown) -------------------- */
function buildProductPanelMarkdown(products) {
  if (!products?.length) return "";

  const primary = products.find((p) => p.price != null) || products[0];

  let lowPrice = null, highPrice = null;
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
  if (lowTx && highTx) headBits.push(`${lowTx}–${highTx}`);
  else if (headlineSingle) headBits.push(headlineSingle);
  const priceHead = headBits.length ? ` — ${headBits.join(" • ")}` : "";

  const info = extractFromDescription(primary.description || primary?.raw?.description || "");

  const sessions = [...(info.sessions || [])];
  if (sessions.length) {
    if (lowPrice != null && highPrice != null && sessions.length >= 2) {
      sessions[0].price = lowPrice; sessions[1].price = highPrice;
    } else if (primary?.price != null) {
      sessions.forEach((s)=> (s.price = primary.price));
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
  if (facts.length) { lines.push(""); for (const f of facts) lines.push(f); }

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
  return (events || []).map((e) => ({
    ...e,
    when: fmtDateLondon(e.date_start),
    href: pickUrl(e),
  }));
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
  const listUrl =
    landingUrl ||
    (firstEventUrl && originOf(firstEventUrl) + "/photography-workshops");
  add("Event Listing", listUrl, true);
  add("Photos", photosUrl || (firstEventUrl && originOf(firstEventUrl) + "/gallery-image-portfolios"), false);
  return pills;
}

function buildAdvicePills({ articleUrl }) {
  const pills = [];
  const add = (label, url, brand = true) => { if (label && url) pills.push({ label, url, brand }); };
  add("Read Guide", articleUrl, true);
  return pills.slice(0, 2);
}

/* --------------------------- Generic resolvers --------------------------- */
function filterByTopicFamily(rows, keywords) {
  if (!keywords?.length) return rows;
  const strong = keywords.filter(k => /bluebell|arboretum|autumn|woodland|long exposure|lightroom|beginners|landscape/i.test(k));
  if (!strong.length) return rows;
  const hasStrong = (s="") => strong.some(k => (s||"").toLowerCase().includes(k.toLowerCase()));
  return rows.filter(r => hasStrong(r?.title) || hasStrong(pickUrl(r)) || hasStrong(r?.location));
}

async function resolveEventsAndProduct(client, { keywords }) {
  const allEvents = await findEvents(client, { keywords, limit: 200 });
  const allProducts = await findProducts(client, { keywords, limit: 30 });

  const events = filterByTopicFamily(allEvents, keywords);
  const products = filterByTopicFamily(allProducts, keywords);

  const productScores = products.map(p => ({ p, s: scoreEntity(p, keywords) }));
  productScores.sort((a,b)=>b.s-a.s);
  const product = productScores[0]?.p || null;

  const eventScores = events.map(e => ({ e, s: scoreEntity(e, keywords) }));
  eventScores.sort((a,b)=> (b.s - a.s) || (new Date(a.e.date_start) - new Date(b.e.date_start)));
  const sortedEvents = eventScores.map(x => ({...x.e, _score:x.s}));

  const conf = confidenceFrom([
    ...(productScores.length ? [productScores[0].s] : []),
    ...eventScores.slice(0,5).map(x=>x.s)
  ]);

  const landing = (await findLanding(client, { keywords })) || null;

  return { events: sortedEvents, product, landing, confidence: conf };
}

/* -------------------------------- Handler -------------------------------- */
export default async function handler(req, res) {
  const started = Date.now();
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed", where: "http" });
      return;
    }

    const { query, topK } = req.body || {};
    const client = supabaseAdmin();

    const intent = detectIntent(query || "");
    const keywords = extractKeywords(query || "");

    if (intent === "events") {
      const { events, product, landing, confidence } = await resolveEventsAndProduct(client, { keywords });

      const eventList = formatEventsForUi(events);
      const productPanel = product ? buildProductPanelMarkdown([product]) : "";

      const firstEventUrl = pickUrl(events?.[0]) || null;
      const productUrl = pickUrl(product) || firstEventUrl || null;
      const landingUrl =
        pickUrl(landing) ||
        (firstEventUrl ? originOf(firstEventUrl) + "/photography-workshops" : null);

      const photosUrl =
        (firstEventUrl && originOf(firstEventUrl) + "/gallery-image-portfolios") ||
        "https://www.alanranger.com/gallery-image-portfolios";

      const pills = buildEventPills({ productUrl, firstEventUrl, landingUrl, photosUrl });

      const citations = uniq([
        pickUrl(product),
        pickUrl(landing),
        ...((events || []).map(pickUrl)),
      ]).filter(Boolean);

      res.status(200).json({
        ok: true,
        answer_markdown: productPanel,
        citations,
        structured: {
          intent: "events",
          topic: keywords.join(", "),
          events: eventList,
          products: product ? [product] : [],
          pills,
        },
        confidence,
        confidence_pct: Math.round(confidence * 100),
        meta: {
          duration_ms: Date.now() - started,
          endpoint: "/api/chat",
          topK: topK || null,
          intent: "events",
          build: "chat-adv-5items"
        },
      });
      return;
    }

    // --------- ADVICE ----------- (top 5 items only)
    const articles = await findArticles(client, { keywords, limit: 12 });

    // score + re-rank so tripod-y things bubble first
    const scored = (articles || []).map(a => ({ a, s: scoreEntity(a, keywords) }));
    scored.sort((x, y) => (y.s - x.s) || (new Date(y.a.last_seen || 0) - new Date(x.a.last_seen || 0)));
    const ranked = scored.map(x => x.a);

    const topN = ranked.slice(0, 5);
    const topArticle = topN[0] || null;
    const articleUrl = pickUrl(topArticle) || null;

    const confidence = confidenceFrom(scored.map(x => x.s));

    const pills = buildAdvicePills({ articleUrl });

    const citations = uniq([articleUrl]).filter(Boolean);

    const lines = [];
    if (topN.length) {
      lines.push("Here are Alan’s guides that match your question:\n");
      for (const a of topN) {
        const t = a.title || a.raw?.name || "Read more";
        const u = pickUrl(a);
        lines.push(`- ${t} — ${u ? `[Link](${u})` : ""}`.trim());
      }
    } else {
      lines.push("I couldn’t find a specific guide for that yet. If you need an exact recommendation, please use the Contact form or WhatsApp buttons above to reach Alan directly.");
    }

    res.status(200).json({
      ok: true,
      answer_markdown: lines.join("\n"),
      citations,
      structured: {
        intent: "advice",
        topic: (keywords || []).join(", "),
        events: [],
        products: [],
        articles: ranked,            // full ranked list for the UI/debug
        pills,
      },
      confidence,
      confidence_pct: Math.round(confidence * 100),
      meta: {
        duration_ms: Date.now() - started,
        endpoint: "/api/chat",
        topK: topK || null,
        intent: "advice",
        build: "chat-adv-5items"
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
