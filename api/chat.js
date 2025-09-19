// /api/chat.js — full file (events + product matching, price extraction, safe pills)

export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

/* =============== Supabase =============== */
function supabaseAdmin() {
  // Allow hard-coded keys if user insists, but prefer env
  const url = process.env.SUPABASE_URL || "https://igzvwbvgvmzvvzoclufx.supabase.co";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    // user-provided override (last-resort)
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M";
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key, { auth: { persistSession: false } });
}

/* =============== Utils =============== */
const STOPWORDS = new Set([
  "the","and","or","what","whats","when","whens","where","is","are","was","were",
  "next","cost","workshop","workshops","photography","photo","near","me","uk",
  "warks","warwickshire","devonshire","class","classes","course","courses",
  "upcoming","available","availability","book","booking","to","for","with","on",
  "your","you","yours","my","mine","our","ours","i","im","we","us","it","its"
]);

const NUM = (x) => (typeof x === "number" && !isNaN(x) ? x : null);

function pickUrl(e) {
  return e?.page_url || e?.source_url || e?.url || null;
}
function tokenize(s) {
  return (s || "").toLowerCase().match(/[a-z0-9]+/g) || [];
}
function tokensMinusStops(s) {
  return tokenize(s).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}
function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
function jaccardTokens(a, b) {
  const A = new Set(a), B = new Set(b);
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}
function extractKeywords(q) {
  return Array.from(new Set(tokensMinusStops(String(q || ""))));
}
function topicFromKeywords(kws) {
  return Array.from(new Set(kws)).join(", ");
}
function detectIntent(q) {
  const s = String(q || "").toLowerCase();
  const eventish = /\b(when|date|dates|where|location|next|upcoming|availability|available|schedule|book|booking)\b/;
  const classish = /\b(workshop|course|class|tuition|lesson|photowalk|walk|masterclass)\b/;
  return eventish.test(s) && classish.test(s) ? "events" : "advice";
}

/* =============== Price extraction =============== */
function parsePriceFromText(s) {
  if (!s) return null;
  // find £123 or 123 GBP
  const m1 = s.match(/£\s*([0-9]+(?:\.[0-9]{1,2})?)/);
  if (m1) return NUM(Number(m1[1]));
  const m2 = s.match(/\b([0-9]+(?:\.[0-9]{1,2})?)\s*(GBP|gbp|pounds?)\b/);
  if (m2) return NUM(Number(m2[1]));
  return null;
}
function extractDisplayPrice(prod) {
  if (!prod) return { amount: null, currency: "GBP" };
  const raw = prod.raw || {};
  const offers = raw.offers || {};
  const meta = raw.meta || {};

  const direct = NUM(prod.price);
  const oPrice = NUM(offers.price);
  const oLow = NUM(offers.lowPrice);
  const mPrice = NUM(meta.price);
  const mPricesArr = Array.isArray(meta.prices) ? meta.prices : [];
  const arrFirst = NUM(mPricesArr?.[0]?.amount);

  const fromText =
    parsePriceFromText(raw.metaDescription) ||
    parsePriceFromText(prod.description) ||
    parsePriceFromText(raw.description);

  const amount =
    direct ?? oPrice ?? oLow ?? mPrice ?? arrFirst ?? fromText ?? null;

  const currency =
    offers.priceCurrency || meta.currency || raw.currency || "GBP";

  return { amount, currency };
}
function fmtPrice(amount, currency) {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "GBP",
      maximumFractionDigits: 0,
    }).format(Number(amount));
  } catch {
    return `£${Math.round(Number(amount))}`;
  }
}

/* =============== Scoring =============== */
function scoreEntity(ent, qTokens) {
  const title = (ent?.title || ent?.raw?.name || "");
  const url = pickUrl(ent) || "";
  const loc = ent?.location || "";
  const tTokens = tokensMinusStops(`${title} ${url} ${loc}`);
  if (!tTokens.length || !qTokens.length) return 0;
  let score = jaccardTokens(new Set(qTokens), new Set(tTokens));
  if (qTokens.some((t) => t.length >= 4 && title.toLowerCase().includes(t))) score += 0.2;
  return Math.min(1, score);
}
function scoreProductForEvent(product, event) {
  // Build rich token bags for event & product
  const evTitle = event?.title || "";
  const evLoc = event?.location || "";
  const evUrl = pickUrl(event) || "";
  const prTitle = product?.title || "";
  const prUrl = pickUrl(product) || "";
  const evTokens = tokensMinusStops(`${evTitle} ${evLoc} ${evUrl}`);
  const prTokens = tokensMinusStops(`${prTitle} ${prUrl} ${(product?.raw?.meta?.keywords || []).join(" ")}`);

  let s = jaccardTokens(evTokens, prTokens); // base similarity

  // Boost if location overlaps (e.g., "Kenilworth")
  const evLocTokens = tokensMinusStops(evLoc);
  if (evLocTokens.length && evLocTokens.some((t) => prTokens.includes(t))) s += 0.35;

  // Boost if any distinctive event words are in product title (>=5 letters)
  const evDistinct = evTokens.filter((t) => t.length >= 5);
  if (evDistinct.some((t) => prTitle.toLowerCase().includes(t))) s += 0.2;

  // Penalize if product URL path clearly contradicts event location token
  if (evLocTokens.length) {
    const prPath = prUrl.toLowerCase();
    const evHasLoc = evLocTokens.some((t) => prPath.includes(t));
    const differentGeo =
      /northumberland|yorkshire|dartmoor|devon|wales|cornwall|cotswolds|kenilworth|coventry|warwick|warwickshire/
        .test(prPath) &&
      !evHasLoc;
    if (differentGeo) s -= 0.35;
  }

  return Math.max(0, Math.min(1, s));
}
function confidenceFrom(scores) {
  if (!scores?.length) return 25;
  const top = Math.max(...scores);
  const meanTop3 = scores.slice().sort((a,b)=>b-a).slice(0,3)
    .reduce((s,x,i,arr)=>s+x/arr.length,0);
  const pct = 20 + top*60 + meanTop3*15;
  return clamp(Math.round(pct), 20, 95);
}

/* =============== Supabase queries =============== */
const SELECT_COLS =
  "id, kind, title, page_url, source_url, last_seen, location, date_start, date_end, price, description, raw";

async function findEvents(client, { keywords = [], topK = 12 } = {}) {
  let q = client.from("page_entities").select(SELECT_COLS).eq("kind", "event");
  q = q.gte("date_start", new Date().toISOString()); // upcoming only
  if (keywords.length) {
    const ors = [
      ...keywords.map((k) => `title.ilike.%${k}%`),
      ...keywords.map((k) => `page_url.ilike.%${k}%`),
      ...keywords.map((k) => `location.ilike.%${k}%`),
    ].join(",");
    q = q.or(ors);
  }
  q = q.order("date_start", { ascending: true }).limit(Math.max(12, topK));
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function findProducts(client, { keywords = [], topK = 10 } = {}) {
  let q = client.from("page_entities").select(SELECT_COLS).eq("kind", "product");
  if (keywords.length) {
    const ors = [
      ...keywords.map((k) => `title.ilike.%${k}%`),
      ...keywords.map((k) => `page_url.ilike.%${k}%`),
    ].join(",");
    q = q.or(ors);
  }
  q = q.order("last_seen", { ascending: false }).limit(Math.max(10, topK));
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
    const ors = [
      ...keywords.map((k) => `title.ilike.%${k}%`),
      ...keywords.map((k) => `page_url.ilike.%${k}%`),
    ].join(",");
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
    const ors = [
      ...keywords.map((k) => `title.ilike.%${k}%`),
      ...keywords.map((k) => `page_url.ilike.%${k}%`),
    ].join(",");
    q = q.or(ors);
  }
  q = q.order("last_seen", { ascending: false }).limit(3);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/* =============== Answer builders =============== */
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
  const { amount, currency } = extractDisplayPrice(prod);
  const priceStr = fmtPrice(amount, currency);

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

function buildEventPanelMarkdown(evt) {
  const title = evt?.title || "Upcoming workshop";
  const d = evt?.date_start ? new Date(evt.date_start).toLocaleDateString() : "";
  const loc = evt?.location ? ` — ${evt.location}` : "";
  const url = pickUrl(evt);
  const head = `**${title}**${loc}${d ? ` (${d})` : ""}`;
  return head + (url ? `\n\n[Open](${url})` : "");
}

function buildAdvicePills(articles, originalQuery) {
  const pills = [];
  const top = articles?.[0] ? pickUrl(articles[0]) : null;
  if (top) pills.push({ label: "Read Guide", url: top, brand: "primary" });
  pills.push({
    label: "More Articles",
    url: `https://www.alanranger.com/search?query=${encodeURIComponent(
      String(originalQuery || "")
    )}`,
    brand: "secondary",
  });
  return pills;
}

function buildEventPills(productOrNull, eventOrNull, landing) {
  const pills = [];
  const bookUrl = productOrNull ? pickUrl(productOrNull) : null;
  if (bookUrl) {
    pills.push({ label: "Book Now", url: bookUrl, brand: "primary" });
  } else if (eventOrNull) {
    const eurl = pickUrl(eventOrNull);
    if (eurl) pills.push({ label: "Book Now", url: eurl, brand: "primary" });
  }
  const landingUrl = pickUrl(landing?.[0]);
  if (landingUrl) pills.push({ label: "Event Listing", url: landingUrl, brand: "secondary" });
  pills.push({
    label: "Photos",
    url: "https://www.alanranger.com/photography-portfolio",
    brand: "secondary",
  });
  return pills;
}

/* =============== Handler =============== */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const started = Date.now();
  try {
    const { query, topK = 8 } = req.body || {};
    const q = String(query || "").trim();
    const client = supabaseAdmin();

    const intent = detectIntent(q);
    const keywords = extractKeywords(q);
    const topic = topicFromKeywords(keywords);

    let events = [];
    let products = [];
    let articles = [];
    let landing = [];

    if (intent === "events") {
      [events, products, landing] = await Promise.all([
        findEvents(client, { keywords, topK: Math.max(8, topK) }),
        // fetch more products so we have good candidates to match
        findProducts(client, { keywords: [], topK: 20 }),
        findLanding(client, { keywords }),
      ]);
      if (!events.length) {
        events = await findEvents(client, { keywords: [], topK: Math.max(12, topK) });
      }
      try {
        articles = await findArticles(client, { keywords, topK: 12 });
      } catch {
        articles = [];
      }
    } else {
      [articles, products] = await Promise.all([
        findArticles(client, { keywords, topK: Math.max(12, topK) }),
        findProducts(client, { keywords, topK: 10 }),
      ]);
    }

    // Rank by query (for general ordering)
    const qTokens = extractKeywords(q);
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

    const rankedArticles = scoreWrap(articles).slice(0, 12);
    const rankedEvents = scoreWrap(events);
    const rankedProductsAll = scoreWrap(products);

    // === Product ↔ Event matching ===
    let bestEvent = rankedEvents[0] || null;
    let matchedProduct = null;

    if (bestEvent && rankedProductsAll.length) {
      // score each product specifically against the event
      const withEventScore = rankedProductsAll
        .map((p) => ({ p, es: scoreProductForEvent(p, bestEvent) }))
        .sort((a, b) => b.es - a.es);

      const topCand = withEventScore[0];
      if (topCand && topCand.es >= 0.25) {
        matchedProduct = topCand.p;
      }
    }

    // If we still don't have a match, try a conservative filter:
    // keep only products whose title shares >=2 non-stop tokens with event title.
    if (!matchedProduct && bestEvent) {
      const evTokens = tokensMinusStops(`${bestEvent.title} ${bestEvent.location}`);
      const filtered = rankedProductsAll.filter((p) => {
        const pt = tokensMinusStops(`${p.title} ${pickUrl(p)}`);
        let inter = 0;
        for (const t of new Set(evTokens)) if (pt.includes(t)) inter++;
        return inter >= 2;
      });
      if (filtered.length) matchedProduct = filtered[0];
    }

    // Build product list for output (top few by general ranking)
    const rankedProducts = rankedProductsAll.slice(0, 8);

    // Confidence
    const scoresForConfidence = [
      ...(rankedArticles[0]?._score ? [rankedArticles[0]._score] : []),
      ...(rankedEvents[0]?._score ? [rankedEvents[0]._score] : []),
      ...(rankedProducts[0]?._score ? [rankedProducts[0]._score] : []),
    ].map((x) => x / 100);
    const confidence_pct = confidenceFrom(scoresForConfidence);

    // === Answer markdown ===
    let answer_markdown = "";
    if (intent === "advice") {
      answer_markdown = buildAdviceMarkdown(rankedArticles);
    } else {
      if (matchedProduct) {
        answer_markdown = buildProductPanelMarkdown(matchedProduct);
      } else if (bestEvent) {
        answer_markdown = buildEventPanelMarkdown(bestEvent);
      } else if (rankedArticles?.length) {
        answer_markdown = buildAdviceMarkdown(rankedArticles);
      } else {
        answer_markdown = "Upcoming workshops and related info below.";
      }
    }

    // === Citations ===
    const citations = uniq([
      ...(matchedProduct ? [pickUrl(matchedProduct)] : []),
      ...rankedEvents.slice(0, 1).map(pickUrl),
      ...rankedArticles.slice(0, 3).map(pickUrl),
    ]);

    // === Structured payload ===
    const structured = {
      intent,
      topic,
      events: rankedEvents.map((e) => ({
        id: e.id,
        title: e.title,
        page_url: e.page_url,
        source_url: e.source_url,
        date_start: e.date_start,
        date_end: e.date_end,
        location: e.location,
        raw: e.raw,
        when: e.date_start ? new Date(e.date_start).toUTCString() : null,
        href: pickUrl(e),
        _score: e._score,
      })),
      products: rankedProducts.map((p) => {
        const { amount, currency } = extractDisplayPrice(p);
        return {
          id: p.id,
          title: p.title,
          page_url: p.page_url,
          source_url: p.source_url,
          description:
            p?.raw?.metaDescription ||
            p?.raw?.meta?.description ||
            p?.description,
          price: p.price ?? amount ?? null,
          price_gbp: currency?.toUpperCase() === "GBP" ? amount : null,
          display_price: amount ?? null,
          location: p.location || null,
          raw: p.raw,
          _score: p._score,
        };
      }),
      articles: rankedArticles.map((a) => ({
        id: a.id,
        title: a.title,
        page_url: a.page_url,
        source_url: a.source_url,
        raw: a.raw,
        last_seen: a.last_seen,
      })),
      pills: intent === "events"
        ? buildEventPills(matchedProduct, bestEvent, landing)
        : buildAdvicePills(rankedArticles, q),
    };

    const payload = {
      ok: true,
      answer_markdown,
      citations,
      structured,
      confidence: confidence_pct / 100,
      confidence_pct,
      meta: {
        duration_ms: Date.now() - started,
        endpoint: "/api/chat",
        topK,
        intent,
      },
      debug: {
        version: "v1.0.0-eventProductMatch",
        intent,
        keywords,
        event: bestEvent
          ? { id: bestEvent.id, title: bestEvent.title, url: pickUrl(bestEvent), date_start: bestEvent.date_start }
          : null,
        product_match: matchedProduct
          ? {
              id: matchedProduct.id,
              title: matchedProduct.title,
              url: pickUrl(matchedProduct),
              price: extractDisplayPrice(matchedProduct),
              score_ev: scoreProductForEvent(matchedProduct, bestEvent),
            }
          : null,
        counts: {
          events: rankedEvents.length,
          products: rankedProductsAll.length,
          articles: rankedArticles.length,
        },
      },
    };

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(payload);
  } catch (err) {
    const msg = (err && (err.message || err.toString())) || "Unknown server error";
    const body = { ok: false, error: msg };
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(body);
  }
}
