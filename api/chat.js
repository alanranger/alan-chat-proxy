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

/* ================= Intent & Keywords ================= */
function detectIntent(q) {
  const s = String(q || "").toLowerCase();
  const eventish =
    /\b(when|date|dates|where|location|next|upcoming|availability|available|schedule|book|booking)\b/;
  const classish =
    /\b(workshop|course|class|tuition|lesson|photowalk|walk|masterclass)\b/;
  return eventish.test(s) && classish.test(s) ? "events" : "advice";
}

// ⬇︎ Added pronouns/helpers so they don't become useless filters
const STOPWORDS = new Set([
  "the","and","or","what","whats","when","whens","where","is","are","was","were",
  "next","cost","workshop","workshops","photography","photo","near","me","uk",
  "warks","warwickshire","devonshire","class","classes","course","courses",
  "upcoming","available","availability","book","booking","to","for","with","on",
  "your","you","yours","my","mine","our","ours","i","im","we","us","it","its"
]);

function extractKeywords(q) {
  const src = String(q || "").toLowerCase();
  const tokens = src.match(/[a-z0-9]+/g) || [];
  const kept = tokens.filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return Array.from(new Set(kept));
}

function topicFromKeywords(kws) {
  return Array.from(new Set(kws)).join(", ");
}

/* ================= Scoring ================= */
function tokenize(s) {
  return (s || "").toLowerCase().match(/[a-z0-9]+/g) || [];
}
function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}
function scoreEntity(ent, qTokens) {
  const hayTitle = (ent?.title || ent?.raw?.name || "").toLowerCase();
  const hayUrl = (pickUrl(ent) || "").toLowerCase();
  const hayLoc = (ent?.location || "").toLowerCase();
  const tTokens = tokenize(hayTitle + " " + hayUrl + " " + hayLoc);
  if (!tTokens.length || !qTokens.length) return 0;
  let score = jaccard(new Set(qTokens), new Set(tTokens));
  if (qTokens.some((t) => t.length >= 3 && hayTitle.includes(t))) score += 0.2;
  return Math.min(1, score);
}

function confidenceFrom(scores) {
  if (!scores?.length) return 25;
  const top = Math.max(...scores);
  const meanTop3 = scores.slice().sort((a,b)=>b-a).slice(0,3)
    .reduce((s,x,i,arr)=>s+x/arr.length,0);
  const pct = 20 + top*60 + meanTop3*15;
  return clamp(Math.round(pct), 20, 95);
}

/* ================= Supabase queries ================= */
const SELECT_COLS =
  "id, kind, title, page_url, source_url, last_seen, location, date_start, date_end, price, description, raw";

async function findEvents(client, { keywords = [], topK = 12 } = {}) {
  let q = client.from("page_entities").select(SELECT_COLS).eq("kind", "event");
  // Upcoming only
  q = q.gte("date_start", new Date().toISOString());

  // Only apply filters if we actually have meaningful keywords
  if (keywords.length) {
    const ors = [
      ...keywords.map((k) => `title.ilike.%${k}%`),
      ...keywords.map((k) => `page_url.ilike.%${k}%`),
      ...keywords.map((k) => `location.ilike.%${k}%`),
    ].join(",");
    q = q.or(ors);
  }

  q = q.order("date_start", { ascending: true }).limit(topK);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function findProducts(client, { keywords = [], topK = 6 } = {}) {
  let q = client.from("page_entities").select(SELECT_COLS).eq("kind", "product");
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

/* ================= Answer composition ================= */
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
  const price =
    prod?.price ??
    prod?.raw?.offers?.price ??
    prod?.raw?.offers?.lowPrice ??
    null;
  const priceCcy = prod?.raw?.offers?.priceCurrency || "GBP";
  const priceStr =
    price != null
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: priceCcy,
          maximumFractionDigits: 0,
        }).format(Number(price))
      : null;
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
    url: `https://www.alanranger.com/search?query=${encodeURIComponent(
      String(originalQuery || "")
    )}`,
    brand: "secondary",
  });
  return pills;
}

function buildEventPills(product, landing) {
  const pills = [];
  const bookUrl = pickUrl(product);
  if (bookUrl) pills.push({ label: "Book Now", url: bookUrl, brand: "primary" });
  const landingUrl = pickUrl(landing?.[0]);
  if (landingUrl) pills.push({ label: "Event Listing", url: landingUrl, brand: "secondary" });
  pills.push({
    label: "Photos",
    url: "https://www.alanranger.com/photography-portfolio",
    brand: "secondary",
  });
  return pills;
}

/* ================= Handler ================= */
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
      // First pass WITH keywords (if any survived stopwords)
      [events, products, landing] = await Promise.all([
        findEvents(client, { keywords, topK: Math.max(8, topK) }),
        findProducts(client, { keywords, topK: 2 }),
        findLanding(client, { keywords }),
      ]);

      // ⬇︎ Fallback: if no events matched the terms, show the next upcoming dates unfiltered
      if (!events.length) {
        events = await findEvents(client, { keywords: [], topK: Math.max(12, topK) });
      }

      // Also fetch articles for helpful tips (guarded & generic)
      try {
        articles = await findArticles(client, { keywords, topK: 12 });
      } catch {
        articles = [];
      }
    } else {
      [articles, products] = await Promise.all([
        findArticles(client, { keywords, topK: Math.max(12, topK) }),
        findProducts(client, { keywords, topK: 2 }),
      ]);
    }

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
    const rankedProducts = scoreWrap(products);

    const scoresForConfidence = [
      ...(rankedArticles[0]?._score ? [rankedArticles[0]._score] : []),
      ...(rankedEvents[0]?._score ? [rankedEvents[0]._score] : []),
      ...(rankedProducts[0]?._score ? [rankedProducts[0]._score] : []),
    ].map((x) => x / 100);

    const confidence_pct = confidenceFrom(scoresForConfidence);

    let answer_markdown = "";
    if (intent === "advice") {
      answer_markdown = buildAdviceMarkdown(rankedArticles);
    } else {
      if (rankedProducts?.length) {
        answer_markdown = buildProductPanelMarkdown(rankedProducts[0]);
      } else if (rankedArticles?.length) {
        answer_markdown = buildAdviceMarkdown(rankedArticles);
      } else {
        answer_markdown = "Upcoming workshops and related info below.";
      }
    }

    const citations = uniq([
      ...rankedArticles.slice(0, 3).map(pickUrl),
      ...rankedProducts.slice(0, 1).map(pickUrl),
      ...rankedEvents.slice(0, 1).map(pickUrl),
    ]);

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
      products: rankedProducts.map((p) => ({
        id: p.id,
        title: p.title,
        page_url: p.page_url,
        source_url: p.source_url,
        description: p.description,
        price: p.price,
        location: p.location,
        raw: p.raw,
        _score: p._score,
      })),
      articles: rankedArticles.map((a) => ({
        id: a.id,
        title: a.title,
        page_url: a.page_url,
        source_url: a.source_url,
        raw: a.raw,
        last_seen: a.last_seen,
      })),
      pills:
        intent === "events"
          ? buildEventPills(rankedProducts[0], landing)
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
