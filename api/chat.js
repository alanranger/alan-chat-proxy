// /api/chat.js
// Node runtime on Vercel. Generic, data-driven, no hard-coded query terms.

export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

/* ================= Supabase ================= */
function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

/* ================= Utilities ================= */
function pickUrl(e) {
  return e?.page_url || e?.source_url || e?.url || null;
}
function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
function tokenize(s) {
  return (s || "").toLowerCase().match(/[a-z0-9]+/g) || [];
}
function redactRaw(raw) {
  if (!raw) return raw;
  const { offers, image, images, ...rest } = raw || {};
  return {
    ...rest,
    offers: offers ? "[redacted]" : undefined,
    image: image ? "[redacted]" : undefined,
    images: images ? "[redacted]" : undefined,
  };
}

/* ================= Intent & Keywords ================= */
// Strict AND logic: events only when query has an event-ish AND a class-ish term
function detectIntent(q) {
  const s = String(q || "").toLowerCase();
  const eventish =
    /\b(when|date|dates|where|location|next|upcoming|availability|available|schedule|book|booking|time)\b/;
  const classish =
    /\b(workshop|course|class|tuition|lesson|lessons|photowalk|walk|masterclass)\b/;
  return eventish.test(s) && classish.test(s) ? "events" : "advice";
}
function detectEventSubtype(q) {
  const s = String(q || "").toLowerCase();
  if (/\b(course|courses|class|classes|tuition|lesson|lessons)\b/.test(s))
    return "course";
  if (/\b(workshop|workshops)\b/.test(s)) return "workshop";
  return null;
}

const STOPWORDS = new Set([
  "the","and","or","what","whats","when","whens","next","cost",
  "workshop","workshops","photography","photo","near","me","uk",
  "warks","warwickshire","devonshire","class","classes","course","courses",
  "where","location","dates","date","upcoming","available","availability",
  "book","booking"
]);

function extractKeywords(q, intent, subtype) {
  const tokens = tokenize(String(q || ""));
  const kept = tokens.filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  if (kept.length === 0) {
    if (intent === "events") return [subtype === "course" ? "course" : "workshop"];
    return ["photography"];
  }
  return uniq(kept);
}
function topicFromKeywords(kws) {
  return uniq(kws).join(", ");
}

/* ================= Scoring ================= */
function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}
function scoreEntity(ent, qTokens) {
  const hayTitle = (ent?.title || ent?.raw?.name || "").toLowerCase();
  const hayUrl = (pickUrl(ent) || "").toLowerCase();
  const hayLoc = (ent?.location || "").toLowerCase();
  const hayDesc =
    (ent?.description ||
      ent?.raw?.metaDescription ||
      ent?.raw?.meta?.description ||
      "")?.toLowerCase();
  const tTokens = tokenize(hayTitle + " " + hayUrl + " " + hayLoc + " " + hayDesc);
  if (!tTokens.length || !qTokens.length) return 0;
  let score = jaccard(new Set(qTokens), new Set(tTokens));
  if (qTokens.some((t) => t.length >= 3 && hayTitle.includes(t))) score += 0.2;
  return Math.min(1, score);
}
function confidenceFrom(scores) {
  if (!scores?.length) return 25;
  const top = Math.max(...scores);
  const meanTop3 = scores.slice().sort((a,b)=>b-a).slice(0,3)
    .reduce((s,x,_,arr)=>s + x/arr.length, 0);
  const pct = 20 + top * 60 + meanTop3 * 15;
  return clamp(Math.round(pct), 20, 95);
}

/* ================= Supabase queries ================= */
const SELECT_COLS =
  "id, kind, title, page_url, source_url, last_seen, location, date_start, date_end, price, description, raw";

function buildOrIlike(keys, keywords) {
  const clauses = [];
  for (const k of keywords) for (const col of keys) clauses.push(`${col}.ilike.%${k}%`);
  return clauses.join(",");
}

async function findEvents(client, { keywords = [], topK = 12 } = {}) {
  let q = client.from("page_entities").select(SELECT_COLS).eq("kind", "event");
  // Upcoming only
  q = q.gte("date_start", new Date().toISOString());
  if (keywords.length) {
    const ors = buildOrIlike(
      ["title", "page_url", "location", "description", "raw->>metaDescription", "raw->meta->>description"],
      keywords
    );
    q = q.or(ors);
  }
  // Most important: chronological
  q = q.order("date_start", { ascending: true }).limit(topK);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function findProducts(client, { keywords = [], topK = 6 } = {}) {
  let q = client.from("page_entities").select(SELECT_COLS).eq("kind", "product");
  if (keywords.length) {
    const ors = buildOrIlike(
      ["title", "page_url", "description", "raw->>metaDescription", "raw->meta->>description"],
      keywords
    );
    q = q.or(ors);
  }
  q = q.order("last_seen", { ascending: false }).limit(topK);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function findArticles(client, { keywords = [], topK = 12 } = {}) {
  let q = client
    .from("page_entities")
    .select(SELECT_COLS)
    .in("kind", ["article", "blog", "page"]);
  if (keywords.length) {
    const ors = buildOrIlike(
      ["title", "page_url", "description", "raw->>metaDescription", "raw->meta->>description"],
      keywords
    );
    q = q.or(ors);
  }
  q = q.order("last_seen", { ascending: false }).limit(topK);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function findLanding(client, { keywords = [] } = {}) {
  let q = client
    .from("page_entities")
    .select(SELECT_COLS)
    .in("kind", ["article", "page"])
    .eq("raw->>canonical", "true")
    .eq("raw->>role", "landing");
  if (keywords.length) {
    const ors = buildOrIlike(
      ["title", "page_url", "description", "raw->>metaDescription", "raw->meta->>description"],
      keywords
    );
    q = q.or(ors);
  }
  q = q.order("last_seen", { ascending: false }).limit(3);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/* ================= Matching helpers ================= */
const GENERIC = new Set([
  "alan","ranger","photography","photo","workshop","workshops","course","courses",
  "class","classes","tuition","lesson","lessons","uk","england","blog","near","me",
  "photographic","landscape","seascape","monthly","day","days","1","one","two","2"
]);
function titleTokens(x) {
  return tokenize((x?.title || x?.raw?.name || "").toLowerCase()).filter(t=>!GENERIC.has(t));
}
function urlTokens(x) {
  const u = (pickUrl(x) || "").toLowerCase();
  return tokenize(u.replace(/^https?:\/\//, "").replace(/[\/_-]+/g, " ")).filter(t=>!GENERIC.has(t));
}
function sameHost(a, b) {
  try {
    const ha = new URL(pickUrl(a)).host;
    const hb = new URL(pickUrl(b)).host;
    return ha && hb && ha === hb;
  } catch { return false; }
}
function isWorkshopEvent(e) {
  const u = (pickUrl(e) || "").toLowerCase();
  const t = (e?.title || e?.raw?.name || "").toLowerCase();
  const hasWorkshop = /workshop/.test(u) || /workshop/.test(t) || /photo-workshops-uk|photographic-workshops/.test(u);
  const looksCourse = /(lesson|lessons|tuition|course|courses|class|classes)/.test(u + " " + t);
  return hasWorkshop && !looksCourse;
}
function isCourseEvent(e) {
  const u = (pickUrl(e) || "").toLowerCase();
  const t = (e?.title || e?.raw?.name || "").toLowerCase();
  const hasCourse = /(lesson|lessons|tuition|course|courses|class|classes)/.test(u + " " + t);
  const looksWorkshop = /workshop/.test(u + " " + t);
  return hasCourse && !looksWorkshop;
}

function matchProductToEvent(products, ev) {
  if (!ev || !products?.length) return null;
  const eTokens = new Set([...titleTokens(ev), ...urlTokens(ev)]);
  let best = null;
  let bestScore = 0;
  for (const p of products) {
    const pTokens = new Set([...titleTokens(p), ...urlTokens(p)]);
    let inter = 0;
    for (const tk of eTokens) if (pTokens.has(tk)) inter++;
    const union = eTokens.size + pTokens.size - inter || 1;
    let score = inter / union;
    if (sameHost(p, ev)) score += 0.15;
    const tAll = (p.title || "").toLowerCase() + " " + (ev.title || "").toLowerCase();
    if (/(workshop|course|tuition|lesson)/.test(tAll)) score += 0.05;
    if (score > bestScore) { best = p; bestScore = score; }
  }
  return best && bestScore >= 0.45 ? best : null;
}

/* ================= Clean price lookup (safe) ================= */
function overlapScore(refTokens, candUrl, candTitle) {
  const candTokens = new Set([
    ...tokenize(String(candUrl || "").replace(/^https?:\/\//, "").replace(/[\/_-]+/g, " ")),
    ...tokenize(String(candTitle || "")),
  ].filter(t => t.length >= 4 && !GENERIC.has(t)));
  let inter = 0;
  for (const t of refTokens) if (candTokens.has(t)) inter++;
  const union = refTokens.size + candTokens.size - inter || 1;
  return { inter, score: inter / union };
}

/**
 * Look up a canonical product/price in ai_products_clean by:
 *  - fetching a small candidate set (OR ILIKE)
 *  - ranking by token overlap with the reference (AND-ish)
 *  - accepting matches with modest overlap (slug-ish behaviour via URL tokens)
 *  - returning the MIN price for the best URL
 */
async function lookupCleanPrice(client, { url, title, extraTokens = [] }) {
  const baseTokens = [
    ...tokenize(String(url || "").replace(/^https?:\/\//, "").replace(/[\/_-]+/g, " ")),
    ...tokenize(String(title || "")),
    ...extraTokens
  ].filter(t => t.length >= 4 && !GENERIC.has(t));

  const refTokens = new Set(baseTokens);
  if (refTokens.size === 0) return null;

  const orParts = Array.from(refTokens)
    .slice(0, 10)
    .flatMap(t => [`url.ilike.%${t}%`, `title.ilike.%${t}%`]);
  const ors = orParts.join(",");

  const { data, error } = await client
    .from("ai_products_clean")
    .select("title,url,price_gbp")
    .or(ors)
    .limit(48);

  if (error) throw error;
  if (!data?.length) return null;

  // Group by URL and keep the lowest price per URL
  const byUrl = new Map();
  for (const row of data) {
    const u = row.url;
    const p = Number(row.price_gbp);
    if (!u || !(p > 0)) continue;
    const prev = byUrl.get(u);
    if (!prev || p < prev.price_gbp) byUrl.set(u, { ...row, price_gbp: p });
  }
  if (byUrl.size === 0) return null;

  // Rank candidates by overlap
  let best = null;
  let bestScore = -1;
  let bestInter = 0;
  for (const cand of byUrl.values()) {
    const { inter, score } = overlapScore(refTokens, cand.url, cand.title);
    // Acceptance: slightly relaxed to ensure practical matches surface
    const ok = (inter >= 2 && score >= 0.22) || (inter >= 1 && score >= 0.15 && cand.url);
    if (ok && score > bestScore) {
      best = cand; bestScore = score; bestInter = inter;
    }
  }

  if (!best) return null;
  return { ...best, _diagnostic: { inter: bestInter, score: bestScore, tokens_used: Array.from(refTokens).slice(0, 12) } };
}

/* ================= Answer composition ================= */
// STRICT price precedence: price_gbp > price; never show 0, never event raw.offers
function selectDisplayPriceNumber(prod) {
  const pg = prod?.price_gbp != null ? Number(prod.price_gbp) : null;
  const pn = prod?.price != null ? Number(prod.price) : null;
  const candidate = (pg && pg > 0) ? pg : (pn && pn > 0 ? pn : null);
  return candidate && candidate > 0 ? candidate : null;
}
function formatDisplayPriceGBP(n) {
  if (n == null) return null;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number(n));
}
function buildAdviceMarkdown(articles) {
  const lines = ["**Guides**"];
  for (const a of (articles || []).slice(0, 5)) {
    const t = a.title || a.raw?.name || "Read more";
    const u = pickUrl(a);
    lines.push(`- ${t} — ${u ? `[Link](${u})` : ""}`.trim());
  }
  return lines.join("\n");
}
function buildProductPanelMarkdown(prod) {
  const title = prod?.title || prod?.raw?.name || "Workshop";
  const priceNum = selectDisplayPriceNumber(prod); // strict precedence
  const priceStr = formatDisplayPriceGBP(priceNum);
  const desc =
    prod?.raw?.metaDescription ||
    prod?.raw?.meta?.description ||
    prod?.description ||
    "";
  const url = pickUrl(prod);
  const head = `**${title}**${priceStr ? ` — ${priceStr}` : ""}`;
  const body = desc ? `\n\n${desc}` : "";
  return head + body + (url ? `\n\n[Open](${url})` : "");
}
function buildAdvicePills(articles, originalQuery) {
  const pills = [];
  const top = articles?.[0] ? pickUrl(articles[0]) : null;
  if (top) pills.push({ label: "Read Guide", url: top, brand: "primary" });
  pills.push({
    label: "More Articles",
    url: `https://www.alanranger.com/search?query=${encodeURIComponent(String(originalQuery || ""))}`,
    brand: "secondary",
  });
  return pills;
}
// Prefer product (booking) URL when present; fallback to event
function buildEventPills(firstEvent, productOrNull) {
  const pills = [];
  const eventUrl = pickUrl(firstEvent);
  const productUrl = pickUrl(productOrNull);
  const bookUrl = productUrl || eventUrl;
  if (bookUrl) pills.push({ label: "Book Now", url: bookUrl, brand: "primary" });
  if (eventUrl) pills.push({ label: "View event", url: eventUrl, brand: "secondary" });
  pills.push({ label: "Photos", url: "https://www.alanranger.com/photography-portfolio", brand: "secondary" });
  return pills;
}

/* ================= Handler ================= */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const started = Date.now();
  const t0 = Date.now();
  try {
    const { query, topK = 8, debug_level = "basic", include_raw = false } = req.body || {};
    const q = String(query || "").trim();
    const client = supabaseAdmin();

    const intent = detectIntent(q);
    const subtype = detectEventSubtype(q); // "workshop" | "course" | null
    const keywords = extractKeywords(q, intent, subtype);
    const topic = topicFromKeywords(keywords);

    let t_supabase = 0, t_rank = 0, t_comp = 0;

    const s1 = Date.now();
    let events = [];
    let products = [];
    let articles = [];
    let landing = [];

    if (intent === "events") {
      [events, products, landing] = await Promise.all([
        findEvents(client, { keywords, topK: Math.max(8, topK) }),
        findProducts(client, { keywords, topK: 6 }),
        findLanding(client, { keywords }),
      ]);
      if (subtype === "workshop") events = events.filter(isWorkshopEvent);
      else if (subtype === "course") events = events.filter(isCourseEvent);

      try { articles = await findArticles(client, { keywords, topK: 12 }); }
      catch { articles = []; }
    } else {
      [articles, products] = await Promise.all([
        findArticles(client, { keywords, topK: Math.max(12, topK) }),
        findProducts(client, { keywords, topK: 6 }),
      ]);
    }
    t_supabase += Date.now() - s1;

    const s2 = Date.now();
    const qTokens = keywords;

    // === Ranking: products & articles may use score; EVENTS must stay chronological ===
    const scoreWrap = (arr) =>
      (arr || [])
        .map((e) => ({ e, s: scoreEntity(e, qTokens) }))
        .sort((a, b) => {
          if (b.s !== a.s) return b.s - a.s;
          const by = Date.parse(b.e?.last_seen || "") || 0;
          const ax = Date.parse(a.e?.last_seen || "") || 0;
          return by - ax;
        })
        .map((x) => Object.assign({ _score: Math.round(x.s * 100) / 100 }, x.e));

    // keep chronological order from DB (date_start asc); just annotate with score
    const rankedEvents = (events || [])
      .slice()
      .sort((a, b) => (Date.parse(a.date_start || 0) || 0) - (Date.parse(b.date_start || 0) || 0))
      .map((e) => ({ ...e, _score: Math.round(scoreEntity(e, qTokens) * 100) / 100 }));

    let rankedProducts = scoreWrap(products);
    const rankedArticles = scoreWrap(articles).slice(0, 12);

    // === Choose the first upcoming event (chronological) ===
    const firstEvent = rankedEvents[0] || null;
    const eventUrl = firstEvent ? pickUrl(firstEvent) : null;
    t_rank += Date.now() - s2;

    // === Helper to enrich a product-like object with a clean price and product URL if applicable ===
    const maybeEnrichPrice = async (prodLike) => {
      if (!prodLike) return { prod: prodLike, tip: null };
      const alreadyHasPrice =
        (prodLike.price != null && Number(prodLike.price) > 0) ||
        (prodLike.price_gbp != null && Number(prodLike.price_gbp) > 0);

      if (alreadyHasPrice) return { prod: prodLike, tip: null };

      const tip = await lookupCleanPrice(client, {
        url: pickUrl(prodLike),
        title: prodLike.title,
        extraTokens: keywords
      });

      if (tip?.price_gbp > 0) {
        const enriched = { ...prodLike, price_gbp: Number(tip.price_gbp) };
        // If this object was synthesized from an event, promote the URL to the product for booking
        if (prodLike?.raw?._syntheticFromEvent && tip.url) {
          enriched.page_url = tip.url;
          enriched.source_url = tip.url;
        }
        return { prod: enriched, tip };
      }
      return { prod: prodLike, tip };
    };

    // === Build featured product card FROM the first event ===
    let featuredProduct = null;
    let matchedProduct = null;
    let cleanTip = null;
    let decisionPath = null;

    const s3 = Date.now();
    if (firstEvent) {
      const matched = matchProductToEvent(rankedProducts, firstEvent);

      if (matched) {
        matchedProduct = matched;
        decisionPath = "matched_product";
        const { prod, tip } = await maybeEnrichPrice({
          ...matched,
          title: firstEvent.title || matched.title,
          raw: { ...(matched.raw || {}), _linkedEventId: firstEvent.id },
        });
        featuredProduct = prod;
        cleanTip = tip;
        // Dedup matched
        rankedProducts = [featuredProduct, ...rankedProducts.filter((p) => p.id !== matched.id)];
      } else {
        decisionPath = "synthetic_from_event";
        const synthetic = {
          id: `evt-${firstEvent.id || "next"}`,
          title: firstEvent.title || "Upcoming Workshop",
          page_url: eventUrl,
          source_url: eventUrl,
          description:
            firstEvent.description ||
            firstEvent.raw?.metaDescription ||
            firstEvent.raw?.description ||
            "",
          price: null, // never trust event price
          location: firstEvent.location || null,
          raw: { ...(firstEvent.raw || {}), _syntheticFromEvent: true },
          _score: 1,
        };
        const { prod, tip } = await maybeEnrichPrice(synthetic);
        featuredProduct = prod;
        cleanTip = tip;
        rankedProducts = [featuredProduct, ...rankedProducts];
      }
    }
    t_comp += Date.now() - s3;

    // Confidence
    const scoresForConfidence = [
      ...(rankedArticles[0]?._score ? [rankedArticles[0]._score] : []),
      ...(rankedEvents[0]?._score ? [rankedEvents[0]._score] : []),
      ...(rankedProducts[0]?._score ? [rankedProducts[0]._score] : []),
    ].map((x) => x / 100);
    const confidence_pct = confidenceFrom(scoresForConfidence);

    // Compose answer_markdown
    const s4 = Date.now();
    let answer_markdown = "";
    if (intent === "advice") {
      answer_markdown = buildAdviceMarkdown(rankedArticles);
    } else {
      const preferred = rankedProducts[0] || featuredProduct || null;
      if (preferred) {
        answer_markdown = buildProductPanelMarkdown(preferred);
      } else if (rankedArticles?.length) {
        answer_markdown = buildAdviceMarkdown(rankedArticles);
      } else {
        answer_markdown = "Upcoming workshops and related info below.";
      }
    }
    t_comp += Date.now() - s4;

    // Citations: de-dupe (include first event + featured product)
    const citations = uniq([
      ...rankedArticles.slice(0, 3).map(pickUrl),
      ...(firstEvent ? [pickUrl(firstEvent)] : []),
      ...(rankedProducts[0] ? [pickUrl(rankedProducts[0])] : []),
    ]);

    // —— Structured ——
    const selectedEventRaw = include_raw && firstEvent ? redactRaw(firstEvent.raw) : undefined;
    const selectedProductRaw = include_raw && rankedProducts[0] ? redactRaw(rankedProducts[0].raw) : undefined;

    const structured = {
      intent,
      topic,
      event_subtype: subtype,
      events: (events || []).length ? rankedEvents.map((e, idx) => ({
        id: e.id,
        title: e.title,
        page_url: e.page_url,
        source_url: e.source_url,
        date_start: e.date_start,
        date_end: e.date_end,
        location: e.location,
        when: e.date_start ? new Date(e.date_start).toUTCString() : null,
        href: pickUrl(e),
        _score: e._score,
        ...(include_raw && idx === 0 ? { raw: selectedEventRaw } : {}),
      })) : [],
      products: (rankedProducts || []).map((p, idx) => ({
        id: p.id,
        title: p.title,
        page_url: p.page_url,
        source_url: p.source_url,
        description: p.description,
        price: p.price ?? null,
        price_gbp: p.price_gbp ?? null,
        location: p.location,
        _score: p._score,
        display_price: selectDisplayPriceNumber(p),
        ...(include_raw && idx === 0 ? { raw: selectedProductRaw } : {}),
      })),
      articles: (rankedArticles || []).map((a) => ({
        id: a.id,
        title: a.title,
        page_url: a.page_url,
        source_url: a.source_url,
        last_seen: a.last_seen,
        // no raw unless explicitly required (we default to trimmed)
      })),
      pills:
        intent === "events"
          ? buildEventPills(firstEvent, rankedProducts[0] || null)
          : buildAdvicePills(rankedArticles, q),
    };

    // —— Debug (compact) ——
    const thresholds = {
      product_match: 0.45,
      clean_accept_noslug: { inter: 2, score: 0.22 },
      clean_accept_slugish: { inter: 1, score: 0.15 }
    };

    const baseDebug = {
      version: "v0.9.28-debug-trim",
      path: decisionPath,
      intent,
      keywords,
      thresholds,
      event: firstEvent ? {
        id: firstEvent.id,
        title: firstEvent.title,
        url: pickUrl(firstEvent),
        date_start: firstEvent.date_start
      } : null,
      product: rankedProducts[0] ? {
        id: rankedProducts[0].id,
        title: rankedProducts[0].title,
        url: pickUrl(rankedProducts[0]),
        price_gbp: rankedProducts[0].price_gbp ?? null,
        display_price: selectDisplayPriceNumber(rankedProducts[0]),
        source: decisionPath === "matched_product" ? (cleanTip ? "matched+clean_enriched" : "matched") : (cleanTip ? "synthetic+clean_enriched" : "synthetic")
      } : null,
      clean_lookup: cleanTip ? {
        hit: true,
        url: cleanTip.url,
        price_gbp: cleanTip.price_gbp,
        inter: cleanTip._diagnostic?.inter ?? null,
        score: cleanTip._diagnostic?.score ?? null,
        tokens_used: cleanTip._diagnostic?.tokens_used ?? null
      } : { hit: false },
      pills: {
        book_now: (structured.pills?.[0]?.url) || null,
        event_url: pickUrl(firstEvent) || null,
        product_url: pickUrl(rankedProducts[0]) || null
      },
      counts: {
        events: rankedEvents.length,
        products: rankedProducts.length,
        articles: rankedArticles.length
      },
      timings_ms: {
        total: Date.now() - started,
        supabase: t_supabase,
        rank: t_rank,
        compose: t_comp
      }
    };

    let debug = null;
    if (debug_level === "basic") {
      debug = baseDebug;
    } else if (debug_level === "verbose") {
      debug = {
        ...baseDebug,
        trace: [
          `intent=${intent} subtype=${subtype || "n/a"}`,
          `events_found=${events.length} products_found=${products.length} articles_found=${articles.length}`,
          `decision=${decisionPath}`,
          `book_now=${(structured.pills?.[0]?.url) || "n/a"}`
        ]
      };
    } // if "off": leave as null

    // —— Payload ——
    let payload = {
      ok: true,
      answer_markdown,
      citations,
      structured,
      confidence: confidence_pct / 100,
      confidence_pct,
      debug,
      meta: {
        duration_ms: Date.now() - t0,
        endpoint: "/api/chat",
        topK,
        intent,
      },
    };

    // —— Size guard: keep payload pasteable ——
    const approxSize = Buffer.byteLength(JSON.stringify(payload), "utf8");
    if (approxSize > 40000) {
      // Downgrade debug and strip any leftover raw
      payload.debug = debug_level === "off" ? null : {
        version: baseDebug.version,
        note: "debug trimmed due to payload size",
        path: baseDebug.path,
        intent: baseDebug.intent,
        event: baseDebug.event && { id: baseDebug.event.id, url: baseDebug.event.url, date_start: baseDebug.event.date_start },
        product: baseDebug.product && { id: baseDebug.product.id, url: baseDebug.product.url, display_price: baseDebug.product.display_price },
        counts: baseDebug.counts,
        timings_ms: baseDebug.timings_ms
      };
      // Ensure no raw in arrays
      if (payload.structured?.events) payload.structured.events = payload.structured.events.map(({ raw, ...rest }) => rest);
      if (payload.structured?.products) payload.structured.products = payload.structured.products.map(({ raw, ...rest }) => rest);
      if (payload.structured?.articles) payload.structured.articles = payload.structured.articles.map(({ raw, ...rest }) => rest);
      payload.meta.trimmed = true;
      payload.meta.size_before = approxSize;
      payload.meta.size_after = Buffer.byteLength(JSON.stringify(payload), "utf8");
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(payload);
  } catch (err) {
    const msg = (err && (err.message || err.toString())) || "Unknown server error";
    const body = { ok: false, error: msg };
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(body);
  }
}
