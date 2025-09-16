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
  return row?.source_url || row?.page_url || row?.url || null;
}
function urlSafe(u) {
  try { return u ? new URL(u) : null; } catch { return null; }
}

/* ---------------------- Query tokenisation / intent ---------------------- */
function normaliseQuery(q) {
  return String(q || "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function tokensFromQuery(q) {
  const stop = new Set([
    "the","a","an","of","on","to","in","for","with","and","or",
    "when","is","are","what","which","who","do","you","your","my","me",
    "next","dates","date","please","thanks","thank",
    "workshop","workshops","course","courses","class","classes","tuition"
  ]);
  return normaliseQuery(q)
    .toLowerCase()
    .split(" ")
    .filter(t => t && !stop.has(t))
    .slice(0, 8);
}
function detectIntent(q) {
  const s = normaliseQuery(q).toLowerCase();
  const has = (...words) => words.some(w => s.includes(w));
  const gear = ["tripod","filter","filters","nd","polariser","lens","lenses","camera","bag","backpack","ballhead","head","legs","kit","gear"];
  const how  = ["recommend","which","best","how to","settings","technique","setup","guide","review"];
  const eventish = ["when","date","next","available","availability","book","booking"];
  const eventWords = ["batsford","dartmoor","devon","exmoor","sidmouth","workshop","course","class","event","tuition"];

  if (has(...gear) || has(...how)) return "advice";
  if (has(...eventish) || has(...eventWords)) return "events";
  // default: events only if strong location word otherwise advice
  return "advice";
}
function buildIlikeOr(parts, cols) {
  const terms = [];
  for (const p of (parts && parts.length ? parts : [""])) {
    const pat = `%${p}%`;
    for (const c of cols) terms.push(`${c}.ilike.${pat}`);
  }
  return terms.join(",");
}
function scoreTextByTokens(text, toks) {
  if (!toks?.length || !text) return 0;
  const s = text.toLowerCase();
  let score = 0;
  for (const t of toks) {
    if (!t) continue;
    if (s.includes(t)) score += 1;
  }
  return score;
}

/* ----------------------- Product description parsing -------------------- */
function normalizeAvailabilityToken(a) {
  if (!a) return null;
  const s = String(a).toLowerCase();
  if (s.includes("instock") || s.includes("in stock")) return "In Stock";
  if (s.includes("outofstock") || s.includes("out of stock")) return "Out of Stock";
  return null;
}

function extractFromDescription(desc, productRawOffers) {
  const out = {
    location: null,
    participants: null,
    fitness: null,
    availability: null,
    summary: null,
    sessions: [],
  };
  if (!desc) {
    out.availability = normalizeAvailabilityToken(productRawOffers?.availability) ||
                       normalizeAvailabilityToken(productRawOffers?.Availability);
    return out;
  }

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

    // Labels: colon optional, value may be on same or next line
    const mLoc = ln.match(/^\s*location\s*:?\s*(.*)$/i);
    if (mLoc) { out.location = mLoc[1].trim() || nextVal(i); continue; }

    const mPart = ln.match(/^\s*participants?\s*:?\s*(.*)$/i);
    if (mPart) { out.participants = mPart[1].trim() || nextVal(i); continue; }

    const mFit = ln.match(/^\s*fitness\s*:?\s*(.*)$/i);
    if (mFit) { out.fitness = mFit[1].trim() || nextVal(i); continue; }

    const mAvail = ln.match(/^\s*availability\s*:?\s*(.*)$/i);
    if (mAvail) { out.availability = mAvail[1].trim() || nextVal(i); continue; }

    // Participants fallback like "Max 6"
    const mMax = ln.match(/\bmax\s*(\d{1,2})\b/i);
    if (mMax && !out.participants) out.participants = `Max ${mMax[1]}`;

    // Session lines
    const m1 = ln.match(/^(\d+\s*(?:hrs?|hours?|day))(?:\s*[-–—]\s*)(.+)$/i);
    if (m1) {
      const rawLabel = m1[1].replace(/\s+/g, " ").trim();
      const time = m1[2].trim();
      out.sessions.push({ label: rawLabel, time, price: null });
      continue;
    }
  }

  if (!out.availability && productRawOffers) {
    out.availability =
      normalizeAvailabilityToken(productRawOffers.availability) ||
      normalizeAvailabilityToken(productRawOffers.Availability) ||
      null;
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
      primary.description || primary?.raw?.description || "",
      primary?.raw?.offers
    ) || {};

  // Attach prices to sessions
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

/* --------------------- Backend pills (context-aware) --------------------- */
function deriveWorkshopsIndex(productUrl, eventUrl, articleUrl) {
  const u = urlSafe(productUrl) ?? urlSafe(eventUrl) ?? urlSafe(articleUrl);
  if (!u) return null;
  const segs = u.pathname.split('/').filter(Boolean);
  const idx = segs.findIndex((s) => /workshop|event|course/i.test(s));
  if (idx >= 0) {
    const path = '/' + segs.slice(0, idx + 1).join('/') + '/';
    return u.origin + path;
  }
  const base = u.pathname.endsWith('/') ? u.pathname.slice(0, -1) : u.pathname;
  const parent = base.substring(0, base.lastIndexOf('/') + 1);
  return u.origin + (parent || '/');
}
async function pickUrlsFromSelect(q) {
  const { data, error } = await q;
  if (error) return [];
  const out = [];
  for (const row of data || []) {
    for (const k of Object.keys(row)) {
      const v = row[k];
      if (typeof v === "string" && v) out.push(v);
    }
  }
  return out;
}
function scoreGallery(u) {
  const s = String(u).toLowerCase();
  if (s.includes("gallery-image-portfolios")) return 0;
  if (/\/gallery(\/|$)/.test(s)) return 1;
  return 2;
}
async function findPhotosUrl(client, ...candidates) {
  const origin = (candidates.map(urlSafe).find(Boolean))?.origin || null;

  const buckets = await Promise.all([
    pickUrlsFromSelect(client.from("page_entities").select("url, page_url, source_url").ilike("url", "%/gallery%")),
    pickUrlsFromSelect(client.from("page_entities_clean").select("url, page_url, source_url").ilike("url", "%/gallery%")),
    pickUrlsFromSelect(client.from("page_entities_backup_utc").select("url, page_url, source_url").ilike("url", "%/gallery%")),
    pickUrlsFromSelect(client.from("page_chunks").select("url").ilike("url", "%/gallery%")),
    pickUrlsFromSelect(client.from("chunks").select("url, source_url").or("url.ilike.%/gallery%,source_url.ilike.%/gallery%")),
    pickUrlsFromSelect(client.from("events_enriched").select("url, page_url, source_url").or("url.ilike.%/gallery%,page_url.ilike.%/gallery%,source_url.ilike.%/gallery%")),
  ]);

  const all = [...new Set(buckets.flat().filter(Boolean))];

  const sameOrigin = all.filter(u => !origin || urlSafe(u)?.origin === origin);
  sameOrigin.sort((a, b) => {
    const sa = scoreGallery(a), sb = scoreGallery(b);
    return sa - sb || a.length - b.length;
  });

  if (sameOrigin.length) return sameOrigin[0];
  if (origin) return `${origin}/search?query=gallery`;
  return "https://www.alanranger.com/search?query=gallery";
}
async function buildEventPills({ client, product, firstEvent }) {
  const productUrl = product?.url || product?.page_url || product?.source_url || null;
  const eventUrl   = firstEvent?.page_url || firstEvent?.source_url || null;

  const pills = [];
  if (productUrl) pills.push({ label: "Book Now", url: productUrl, brand: true });
  if (eventUrl)   pills.push({ label: "Event Listing", url: eventUrl, brand: true });

  const more = deriveWorkshopsIndex(productUrl, eventUrl);
  if (more) pills.push({ label: "More Events", url: more });

  const photos = await findPhotosUrl(client, productUrl, eventUrl);
  if (photos) pills.push({ label: "Photos", url: photos });

  const seen = new Set();
  return pills.filter(p => (p.url && !seen.has(p.url) && seen.add(p.url))).slice(0, 4);
}
async function buildAdvicePills({ client, topArticle, query, productUrl, eventUrl }) {
  const articleUrl = pickUrl(topArticle);
  const origin = (urlSafe(articleUrl) ?? urlSafe(productUrl) ?? urlSafe(eventUrl))?.origin || "https://www.alanranger.com";
  const searchUrl = `${origin}/search?query=${encodeURIComponent(normaliseQuery(query))}`;

  const pills = [];
  if (articleUrl) pills.push({ label: "Read Guide", url: articleUrl, brand: true });
  pills.push({ label: "More Articles", url: searchUrl, brand: true });

  const moreEvents = deriveWorkshopsIndex(productUrl, eventUrl, articleUrl) || `${origin}/search?query=workshop`;
  pills.push({ label: "Events", url: moreEvents });

  const photos = await findPhotosUrl(client, articleUrl, productUrl, eventUrl);
  if (photos) pills.push({ label: "Photos", url: photos });

  const seen = new Set();
  return pills.filter(p => (p.url && !seen.has(p.url) && seen.add(p.url))).slice(0, 4);
}

/* ----------------------- Relevance scoring & filtering ------------------- */
function scoreEventRelevance(e, toks) {
  if (!toks?.length) return 0;
  const title = e?.title || "";
  const loc = e?.location || "";
  const urls = `${e?.page_url || ""} ${e?.source_url || ""}`;
  return scoreTextByTokens(loc, toks) * 2 +
         scoreTextByTokens(title, toks) +
         Math.min(1, scoreTextByTokens(urls, toks));
}
function scoreProductRelevance(p, toks) {
  if (!toks?.length) return 0;
  const title = p?.title || "";
  const desc = p?.description || p?.raw?.description || "";
  const urls = `${p?.page_url || ""} ${p?.source_url || ""}`;
  return scoreTextByTokens(title, toks) * 2 +
         scoreTextByTokens(desc, toks) +
         Math.min(1, scoreTextByTokens(urls, toks));
}
function scoreArticleRelevance(a, toks) {
  if (!toks?.length) return 0;
  const title = a?.title || "";
  const desc = a?.description || a?.raw?.description || "";
  const url  = a?.url || a?.page_url || a?.source_url || "";
  // prefer advice/blog paths
  const urlBoost = /\/advice|\/blog|\/guides/i.test(url) ? 1 : 0;
  return scoreTextByTokens(title, toks) * 2 +
         scoreTextByTokens(desc, toks) +
         scoreTextByTokens(url, toks) + urlBoost;
}
function filterAndOrderByRelevance(items, scorer, toks, { emptyFallback = false } = {}) {
  if (!Array.isArray(items) || !items.length) return [];
  const scored = items.map(it => ({ it, s: scorer(it, toks) }));
  const maxS = scored.reduce((m, r) => Math.max(m, r.s), 0);
  if (maxS <= 0) {
    return emptyFallback ? items : []; // <-- no unrelated fallbacks
  }
  const filtered = scored.filter(r => r.s >= 1);
  filtered.sort((a, b) => {
    if (b.s !== a.s) return b.s - a.s;
    const da = a.it.date_start ? new Date(a.it.date_start).getTime() : Infinity;
    const db = b.it.date_start ? new Date(b.it.date_start).getTime() : Infinity;
    return da - db;
  });
  return filtered.map(r => r.it);
}

/* --------------------------- Advice (articles) --------------------------- */
async function answerAdvice({ client, query }) {
  const toks = tokensFromQuery(query);
  const orClause = buildIlikeOr(toks, ["title", "page_url", "source_url", "url", "description"]);

  const { data: articlesRaw } = await client
    .from("page_entities")
    .select("*")
    .in("kind", ["article", "page"])
    .or(orClause)
    .order("last_seen", { ascending: false })
    .limit(60);

  const articles = filterAndOrderByRelevance(articlesRaw || [], scoreArticleRelevance, toks, { emptyFallback: false })
    .slice(0, 12);

  // Build a concise markdown answer with top articles
  const bullets = (articles || []).slice(0, 6).map(a => {
    const u = pickUrl(a) || "#";
    const t = a.title || a.raw?.name || u;
    const desc = (a.description || a.raw?.description || "").replace(/\s+/g, " ").trim();
    const mini = desc ? ` — ${desc.slice(0, 120)}${desc.length>120?'…':''}` : "";
    return `- [${t}](${u})${mini}`;
  });
  const preface = bullets.length
    ? `Here are Alan’s guides that match your question:\n\n${bullets.join("\n")}`
    : `I couldn't find a specific guide for that yet. Try searching the advice blog on the site.`;

  // Pills (context-aware for advice)
  const pills = await buildAdvicePills({
    client,
    topArticle: articles?.[0] || null,
    query,
    productUrl: null,
    eventUrl: null
  });

  const structured = {
    topic: null,
    events: [],
    products: [],
    articles: (articles || []).map(a => ({ title: a.title, url: pickUrl(a) })),
    pills,
    chips: pills,
  };

  const citations = uniq((articles || []).map(pickUrl)).filter(Boolean);

  return { ok: true, answer_markdown: preface, citations, structured };
}

/* ------------------------------ Events path ------------------------------ */
async function answerEvents({ client, query }) {
  const nowIso = new Date().toISOString();
  const toks = tokensFromQuery(query);
  const orClause = buildIlikeOr(toks.length ? toks : [normaliseQuery(query)], [
    "title",
    "page_url",
    "source_url",
    "url",
  ]);

  // Future events (broad fetch, then relevance-filter)
  const { data: eventsRaw } = await client
    .from("page_entities")
    .select("id, title, page_url, source_url, date_start, date_end, location, raw")
    .eq("kind", "event")
    .gte("date_start", nowIso)
    .or(orClause)
    .order("date_start", { ascending: true })
    .limit(200);

  // Products that match the query tokens
  const { data: productsRaw } = await client
    .from("page_entities")
    .select("*")
    .eq("kind", "product")
    .or(orClause)
    .order("last_seen", { ascending: false })
    .limit(100);

  // Relevance filtering (no unrelated fallbacks)
  const events = filterAndOrderByRelevance(eventsRaw || [], scoreEventRelevance, toks, { emptyFallback: false }).slice(0, 50);
  const products = filterAndOrderByRelevance(productsRaw || [], scoreProductRelevance, toks, { emptyFallback: false });

  const productPanel = buildProductPanelMarkdown(products || "");

  const eventList = (events || [])
    .map((e) => ({ ...e, when: fmtDateLondon(e.date_start) }))
    .slice(0, 12);

  const product =
    (products || []).find((p) => p && pickUrl(p)) ||
    (products || [])[0] || null;

  const firstEvent =
    (events || [])
      .filter((e) => e && e.date_start)
      .sort((a, b) => new Date(a.date_start) - new Date(b.date_start))[0] || null;

  const pills = await buildEventPills({ client, product, firstEvent });

  const citations = uniq([
    ...((events || []).map(pickUrl)),
    pickUrl(products?.[0]),
  ]).filter(Boolean);

  const structured = {
    topic: null,
    events: eventList,
    products: products || [],
    pills,
    chips: pills,
  };

  return { ok: true, answer_markdown: productPanel, citations, structured };
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

    const intent = detectIntent(query);
    const result = intent === "events"
      ? await answerEvents({ client, query })
      : await answerAdvice({ client, query });

    res.status(200).json({
      ...result,
      meta: {
        duration_ms: Date.now() - started,
        endpoint: "/api/chat",
        topK: topK || null,
        intent
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
