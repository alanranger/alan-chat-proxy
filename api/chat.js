// /api/chat.js
// Site-wide AI chat endpoint (Product panel via markdown, events via structured)
// Runtime: NodeJS (Vercel)
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

/* ---------------------------- Supabase client ---------------------------- */
function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_*_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

/* ------------------------------ Small utils ------------------------------ */
const TZ = "Europe/London";
const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

const toGBP = (n) => (n == null || isNaN(Number(n)) ? null : GBP.format(Number(n)));
const pickUrl = (row) => row?.source_url || row?.page_url || row?.url || null;
const uniq = (arr) => [...new Set((arr || []).filter(Boolean))];

function fmtDateLondon(ts) {
  try {
    const d = new Date(ts);
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: TZ,
    }).format(d);
  } catch { return ts; }
}

/* ----------------------- Topic detection (simple) ------------------------ */
function getTopicFromQuery(query) {
  const q = (query || "").toLowerCase();
  if (q.includes("bluebell")) return "bluebell";
  return null;
}

/* --------- Canonical resolver (tolerant; no tags JSON dependence) -------- */
async function resolveCanonicalsOptionA(client, topic) {
  const out = { product: null, landing: null, debug: {} };

  const { data: prodA2, error: prodErr } = await client
    .from("page_entities").select("*")
    .eq("kind", "product")
    .eq("raw->>canonical", "true")
    .eq("raw->>topic", topic)
    .eq("raw->>role", "product")
    .order("last_seen", { ascending: false }).limit(1);

  const { data: landA2, error: landErr } = await client
    .from("page_entities").select("*")
    .in("kind", ["article", "page"])
    .eq("raw->>canonical", "true")
    .eq("raw->>topic", topic)
    .eq("raw->>role", "landing")
    .order("last_seen", { ascending: false }).limit(1);

  out.product = prodA2?.[0] || null;
  out.landing = landA2?.[0] || null;
  out.debug.explicitErrors = { prodErr, landErr };
  out.debug.selected = { product: out.product?.id || null, landing: out.landing?.id || null };
  return out;
}

/* ------------------------- Product field extraction ---------------------- */
function get(obj, path, def = null) {
  try {
    return path.split(".").reduce((a, k) => (a?.[k]), obj) ?? def;
  } catch { return def; }
}

// Read location/participants/fitness + time options out of description text.
function extractFromDescription(desc) {
  if (!desc) return {};
  const lines = desc.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  let location = null, participants = null, fitness = null, availability = null;
  const options = []; // [{label, timeText}]
  for (const ln of lines) {
    const lc = ln.toLowerCase();

    if (/^location:\s*/i.test(ln)) location = ln.replace(/^location:\s*/i, "").trim();
    if (/^participants:\s*/i.test(ln)) participants = ln.replace(/^participants:\s*/i, "").trim();
    if (/^fitness:\s*/i.test(ln)) fitness = ln.replace(/^fitness:\s*/i, "").trim();
    if (/^availability:\s*/i.test(ln)) availability = ln.replace(/^availability:\s*/i, "").trim();

    // Time options – tolerate variants ("4hrs", "4 hours", "OR 1 day", "1 day")
    let m;
    if ((m = ln.match(/^(?:4\s*hrs?|4\s*hours?)\s*[-–]\s*(.+)$/i))) {
      options.push({ key: "short", label: "4 hours", timeText: m[1].trim() });
    } else if ((m = ln.match(/^(?:or\s*)?1\s*day\s*[-–]\s*(.+)$/i))) {
      options.push({ key: "long", label: "1 day", timeText: m[1].trim() });
    }
  }
  return { location, participants, fitness, availability, options };
}

// Merge two product rows (e.g., one with Offer price 125, another with AggregateOffer 99–150).
function mergeProducts(rows) {
  if (!rows?.length) return null;
  // Prefer the row with non-null price as "base".
  const byRecency = [...rows].sort((a, b) =>
    new Date(b.last_seen || 0) - new Date(a.last_seen || 0)
  );
  const withOffer = byRecency.find(r => get(r, "raw.offers.@type") === "Offer") || null;
  const withAgg   = byRecency.find(r => /AggregateOffer/i.test(get(r, "raw.offers.@type") || "")) || null;
  const base = withOffer || byRecency[0];

  const title = base.title || get(base, "raw.name") || "Workshop";
  const description = base.description || get(base, "raw.description") || "";

  // Pull availability directly from any row (prefer explicit schema URL, else plain "InStock")
  const availability =
    get(base, "availability") ||
    get(base, "raw.offers.availability") ||
    get(withAgg, "raw.offers.availability") ||
    null;

  // Prices
  const singlePrice = base.price != null ? Number(base.price) : (get(withOffer, "raw.offers.price") ?? null);
  const low  = get(withAgg, "raw.offers.lowPrice");
  const high = get(withAgg, "raw.offers.highPrice");

  // Build per-option mapping
  const { location, participants, fitness, availability: availText, options } = extractFromDescription(description);

  // Decide prices for options
  let priceShort = null, priceLong = null, headerPrice = null, headerRange = null;
  if (low != null && high != null) {
    // Use range for header; map short to low, long to high
    headerRange = { low: Number(low), high: Number(high) };
    priceShort = Number(low);
    priceLong  = Number(high);
  } else if (singlePrice != null) {
    headerPrice = Number(singlePrice);
    // Apply same price to any options we display
    priceShort = headerPrice;
    priceLong  = headerPrice;
  }

  return {
    title,
    url: pickUrl(base),
    description,
    location,
    participants,
    fitness,
    availability: availText || (availability?.includes("schema.org") ? "In Stock" : availability) || null,
    options,
    pricing: { headerPrice, headerRange, priceShort, priceLong }
  };
}

/* -------------------------- Product panel markdown ----------------------- */
function buildProductPanelMarkdown(prodMerged) {
  if (!prodMerged) return "";

  const {
    title, url, description, location, participants, fitness, availability, options, pricing
  } = prodMerged;

  const headerRight =
    pricing.headerPrice != null
      ? toGBP(pricing.headerPrice)
      : (pricing.headerRange ? `${toGBP(pricing.headerRange.low)}–${toGBP(pricing.headerRange.high)}` : "");

  const lines = [];
  lines.push(`**${title}**${headerRight ? ` — ${headerRight}` : ""}`);
  if (description) lines.push(``);
  if (description) lines.push(description.replace(/\n{2,}/g, "\n").split("\n").slice(0, 1)[0]); // first line/summary

  const infoBullets = [];
  if (availability) infoBullets.push(`**Availability:** ${availability}`);
  if (location)     infoBullets.push(`**Location:** ${location}`);
  if (participants) infoBullets.push(`**Participants:** ${participants}`);
  if (fitness)      infoBullets.push(`**Fitness:** ${fitness}`);
  if (infoBullets.length) {
    lines.push("");
    lines.push(infoBullets.map(b => `- ${b}`).join("\n"));
  }

  // Options with per-session prices
  const optLines = [];
  const short = options.find(o => o.key === "short");
  const longer = options.find(o => o.key === "long");
  if (short)  optLines.push(`- **${short.label}** — ${short.timeText}${pricing.priceShort != null ? ` — ${toGBP(pricing.priceShort)}` : ""}`);
  if (longer) optLines.push(`- **${longer.label}** — ${longer.timeText}${pricing.priceLong  != null ? ` — ${toGBP(pricing.priceLong)}`  : ""}`);
  if (optLines.length) {
    lines.push("");
    lines.push(optLines.join("\n"));
  }

  // Booking link (compact)
  if (url) {
    lines.push("");
    lines.push(`[Book Now](${url})`);
  }

  return lines.join("\n");
}

/* ------------------------------- Chips ----------------------------------- */
function buildChips({ productUrl, landingUrl, firstEventUrl }) {
  const chips = [];
  const add = (label, url, brand = true) => (url && chips.push({ label, url, brand }));
  add("Book Now", productUrl, true);
  add("Prices", productUrl ? productUrl + "#prices" : productUrl, true);
  add("Upcoming dates", firstEventUrl || productUrl, true);
  if (landingUrl) add("Info", landingUrl, true);
  // de-dupe by url
  const seen = new Set();
  return chips.filter(c => !seen.has(c.url) && seen.add(c.url)).slice(0, 4);
}

/* -------------------------------- Bluebell ------------------------------- */
async function answerBluebell({ client }) {
  const nowIso = new Date().toISOString();

  // Canonicals (tolerant)
  const canon = await resolveCanonicalsOptionA(client, "bluebell");

  // Future events (topic by title/page_url)
  const { data: events, error: evErr } = await client
    .from("page_entities")
    .select("id, title, page_url, source_url, date_start, date_end, location, raw")
    .eq("kind", "event")
    .or("title.ilike.%bluebell%,page_url.ilike.%bluebell%")
    .gte("date_start", nowIso)
    .order("date_start", { ascending: true })
    .limit(100);

  if (evErr) {
    return { ok: false, error: "event_query_failed", where: "events", hint: evErr.message };
  }

  // Products (topic by title/page_url)
  const { data: products, error: prodErr } = await client
    .from("page_entities")
    .select("*")
    .eq("kind", "product")
    .or("title.ilike.%bluebell%,page_url.ilike.%bluebell%")
    .order("last_seen", { ascending: false })
    .limit(50);

  if (prodErr) {
    return { ok: false, error: "product_query_failed", where: "products", hint: prodErr.message };
  }

  // Merge products and build product-only markdown (no events here)
  const merged = mergeProducts(products || []);
  const answer_markdown = buildProductPanelMarkdown(merged);

  // Chips
  const eventList = (events || []).slice(0, 10);
  const chips = buildChips({
    productUrl: merged?.url || pickUrl(products?.[0]),
    landingUrl: pickUrl(canon.landing),
    firstEventUrl: pickUrl(eventList[0]),
  });

  // Citations (product + first few events + canon)
  const citations = uniq([
    merged?.url,
    pickUrl(canon.landing),
    pickUrl(canon.product),
    ...eventList.map(pickUrl),
  ]);

  // Structured (leave events here; UI renders them once with its own styling)
  const structured = {
    topic: "bluebell",
    events: eventList,
    products: products || [],
    canonicals: { product: canon.product || null, landing: canon.landing || null, debug: canon.debug },
    chips,
  };

  return { ok: true, answer_markdown, citations, structured };
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

    const topic = getTopicFromQuery(query);

    if (topic === "bluebell") {
      const result = await answerBluebell({ client });
      res.status(result.ok ? 200 : 500).json({
        ...result,
        meta: { duration_ms: Date.now() - started, endpoint: "/api/chat", topK: topK || null },
      });
      return;
    }

    // Generic fallback
    res.status(200).json({
      ok: true,
      answer_markdown:
        "I don’t have a specific answer for that yet. Try asking about workshops, tuition, kit, or locations — for example, “When are the next Bluebell dates?”",
      citations: [],
      structured: { topic: null },
      meta: { duration_ms: Date.now() - started, endpoint: "/api/chat", topK: topK || null },
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
