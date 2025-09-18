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
function slugWords(s) {
  return (s || "").toLowerCase().match(/[a-z0-9]+/g) || [];
}
function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}
function pickUrl(e) {
  return e?.page_url || e?.source_url || e?.url || null;
}
function fmtDateLondon(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Europe/London",
    });
  } catch {
    return String(iso || "");
  }
}

/* ----------------------------- Intent hints ------------------------------ */
const EVENT_HINTS = [
  "date",
  "dates",
  "when",
  "next",
  "upcoming",
  "available",
  "where",
  "schedule",
];

const CLASS_HINTS = ["workshop","course","class","tuition","lesson","masterclass","photowalk","walk"];

// Generic topic hints
const TOPIC_KEYWORDS = [
  "devon",
  "snowdonia",
  "wales",
  "lake district",
  "warwickshire",
  "coventry",
  "dorset",
  "bluebell",
  "autumn",
  "astrophotography",
  "beginners",
  "lightroom",
  "long exposure",
  "filters",
  "woodland",
  "tripod",
  "bag",
  "lens",
  "landscape",
  "composition",
  "printing",
];

/* ----------------------------- Intent detect ----------------------------- */
function detectIntent(q) {
  const s = String(q || "").toLowerCase();
  const eventish = /(\\bwhen\\b|\\bwhere\\b|\\bdates?\\b|\\bnext\\b|\\bupcoming\\b|\\bavailability\\b|\\bavailable\\b|\\bschedule\\b|\\bbook(ing)?\\b)/;
  const classish = /(\\bworkshop\\b|\\bcourse\\b|\\bclass\\b|\\btuition\\b|\\blesson\\b|\\bmasterclass\\b|\\bphotowalk\\b|\\bwalk\\b)/;
  return (eventish.test(s) && classish.test(s)) ? "events" : "advice";
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
    .select(
      "id, title, page_url, source_url, date_start, date_end, location, raw"
    )
    .eq("kind", "event")
    .gte("date_start", nowIso)
    .order("date_start", { ascending: true })
    .limit(limit);

  if (keywords?.length) {
    const orExpr =
      anyIlike("title", keywords) ||
      anyIlike("page_url", keywords) ||
      anyIlike("location", keywords);
    q = q.or(orExpr || "title.ilike.%_NOPE_%");
  }

  const { data, error } = await q;
  if (error) return [];
  return data || [];
}

async function findProducts(client, { keywords, limit = 6 }) {
  let q = client
    .from("page_entities")
    .select("id, title, page_url, source_url, location, description, price, raw")
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
    .select("id, title, page_url, source_url, raw")
    .in("kind", ["article", "page"])
    .eq("raw->>canonical", "true")
    .eq("raw->>role", "landing")
    .limit(1);

  if (keywords?.length) {
    const orExpr =
      anyIlike("title", keywords) || anyIlike("page_url", keywords);
    q = q.or(orExpr || "title.ilike.%_NOPE_%");
  }

  const { data, error } = await q;
  if (error) return null;
  return (data && data[0]) || null;
}

/* ------------------------ Keywords / topic extraction -------------------- */
function extractKeywords(q) {
  const raw = (q || "").toLowerCase();
  const toks = Array.from(new Set(raw.match(/[a-z0-9]+/g) || []));
  const long = toks.filter((t) => t.length >= 4);
  const extras = TOPIC_KEYWORDS.filter((t) => raw.includes(t));
  const out = uniq([...long, ...extras]);
  return out;
}

/* ------------------------------ Rank & confidence ------------------------ */
function scoreEntity(entity, keywords) {
  const words = new Set(
    slugWords(
      (entity?.title || "") +
        " " +
        (pickUrl(entity) || "") +
        " " +
        (entity?.location || "")
    )
  );
  let score = 0;
  for (const k of keywords) {
    const parts = slugWords(k);
    for (const p of parts) if (words.has(p)) score += 1;
  }
  // bonus for exact keyword in title
  const title = (entity?.title || "").toLowerCase();
  for (const k of keywords) if (title.includes(k.toLowerCase())) score += 1;
  return score;
}

function confidenceFrom(scores) {
  const vals = (scores || []).filter((s) => typeof s === "number");
  if (!vals.length) return 0.25;
  const max = Math.max(...vals);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const conf = Math.max(0.2, Math.min(0.95, (0.5 * max + 0.5 * mean) / 5));
  return conf;
}

/* ----------------------------- UI builders ------------------------------- */
function buildProductPanelMarkdown(prod) {
  const lines = [];
  const title =
    prod?.title || prod?.raw?.name || "Photography Workshop or Tuition";
  let priceHead = "";
  const low = prod?.raw?.offers?.lowPrice;
  const high = prod?.raw?.offers?.highPrice;
  const price = prod?.price ?? prod?.raw?.offers?.price;
  const ccy = prod?.raw?.offers?.priceCurrency || "GBP";
  if (low != null && high != null) {
    priceHead = ` — £${low}–£${high}`;
  } else if (price != null) {
    priceHead = ` — £${price}`;
  }
  const desc =
    prod?.meta_description ||
    prod?.raw?.metaDescription ||
    prod?.description ||
    "";

  lines.push(`**${title}**${priceHead}`);
  if (desc) lines.push(`\n${desc}`);

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
  add("Event Listing", landingUrl, false);
  add("Photos", photosUrl, false);

  return pills;
}

function buildAdvicePills({ articleUrl }) {
  const pills = [];
  const used = new Set();
  const add = (label, url, brand = true) => {
    if (!label || !url) return;
    if (used.has(url)) return;
    used.add(url);
    pills.push({ label, url, brand });
  };

  if (articleUrl) add("Read Guide", articleUrl, true);
  return pills;
}

/* --------------------------------- API ----------------------------------- */
export default async function handler(req, res) {
  const started = Date.now();
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  const { query, topK = 8 } = req.body || {};
  const client = supabaseAdmin();

  const intent = detectIntent(query || "");
  const keywords = extractKeywords(query || "");

  try {
    if (intent === "events") {
      const [events, products, landing] = await Promise.all([
        findEvents(client, { keywords, limit: 120 }),
        findProducts(client, { keywords, limit: 6 }),
        findLanding(client, { keywords }),
      ]);

      const product = (products && products[0]) || null;
      const productPanel = product ? buildProductPanelMarkdown(product) : "";

      const eventList = formatEventsForUi(events || []);
      const productUrl = pickUrl(product);
      const firstEventUrl = pickUrl(eventList?.[0]);
      const landingUrl = pickUrl(landing);
      const photosUrl =
        (pickUrl(landing) &&
          (pickUrl(landing).replace(/\\/$/, "") + "/gallery-image-portfolios")) ||
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
        ...(events || []).map(pickUrl),
      ]).filter(Boolean);

      const articles = await findArticles(client, { keywords, limit: 12 });

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
          articles: articles || [],
        },
        confidence: 0.8,
        confidence_pct: 80,
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
    const articles = await findArticles(client, { keywords, limit: 12 });

    const articleScores = (articles || []).map((a) => ({
      a,
      s: scoreEntity(a, keywords),
    }));
    articleScores.sort(
      (x, y) =>
        y.s - x.s ||
        new Date(y.a.last_seen).getTime() - new Date(x.a.last_seen).getTime()
    );

    const anyPositive = articleScores.some((x) => x.s > 0);
    const ranked = (anyPositive
      ? articleScores.filter((x) => x.s > 0)
      : articleScores
    ).map((x) => x.a);

    const topArticle = ranked[0] || null;
    const articleUrl = pickUrl(topArticle) || null;

    const conf = confidenceFrom(articleScores.map((x) => x.s));

    const pills = buildAdvicePills({ articleUrl });

    const citations = uniq([articleUrl]).filter(Boolean);

    const lines = [];
    if (ranked?.length) {
      lines.push("Here are Alan’s guides that match your question:\n");
      // LIMIT TO 5 ARTICLES IN THE VISIBLE ANSWER
      for (const a of ranked.slice(0, 5)) {
        const t = a.title || a.raw?.name || "Read more";
        const u = pickUrl(a);
        lines.push(`- ${t} — ${u ? `[Link](${u})` : ""}`.trim());
      }
    } else {
      lines.push(
        "I couldn’t find a specific guide for that yet. If you need an exact recommendation, please use the Contact form or WhatsApp buttons above to reach Alan directly."
      );
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
        articles: ranked || [],
        pills,
      },
      confidence: conf,
      confidence_pct: Math.round(conf * 100),
      meta: {
        duration_ms: Date.now() - started,
        endpoint: "/api/chat",
        topK: topK || null,
        intent: "advice",
      },
    });
  } catch (e) {
    res.status(200).json({
      ok: true,
      answer_markdown:
        "Something went wrong fetching the content just now. Please try again, or reach Alan via the Contact or WhatsApp buttons above.",
      citations: [],
      structured: {
        intent,
        topic: keywords.join(", "),
        events: [],
        products: [],
        articles: [],
        pills: [],
      },
      confidence: 0.5,
      confidence_pct: 50,
      meta: {
        duration_ms: Date.now() - started,
        endpoint: "/api/chat",
        topK: topK || null,
        intent,
        error: String(e),
      },
    });
  }
}
