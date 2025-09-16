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

/* ----------------------- Topic detection (simple) ------------------------ */
function getTopicFromQuery(query) {
  const q = (query || "").toLowerCase();
  if (q.includes("bluebell")) return "bluebell";
  return null;
}

/* ---------------- Canonical resolver (Option A: tolerant) ---------------- */
async function resolveCanonicalsOptionA(client, topic) {
  const out = { product: null, landing: null, debug: {} };

  const { data: prodA2, error: prodErr } = await client
    .from("page_entities")
    .select("*")
    .eq("kind", "product")
    .eq("raw->>canonical", "true")
    .eq("raw->>topic", topic)
    .eq("raw->>role", "product")
    .order("last_seen", { ascending: false })
    .limit(1);

  const { data: landA2, error: landErr } = await client
    .from("page_entities")
    .select("*")
    .in("kind", ["article", "page"])
    .eq("raw->>canonical", "true")
    .eq("raw->>topic", topic)
    .eq("raw->>role", "landing")
    .order("last_seen", { ascending: false })
    .limit(1);

  out.product = prodA2?.[0] || null;
  out.landing = landA2?.[0] || null;
  out.debug.explicitErrors = { prodErr, landErr };
  out.debug.selected = {
    product: out.product?.id || null,
    landing: out.landing?.id || null,
  };
  return out;
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

    // Generic session rows:
    // "4hrs - 5:45 am to 9:45 am or 10:30 am to 2:30 pm"
    // "OR 1 day - 5:45 am to 2:30 pm"
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
    highPrice = null,
    priceCurrency = "GBP";
  for (const p of products) {
    const ro = p?.raw?.offers || {};
    const lp = ro.lowPrice ?? ro.lowprice ?? null;
    const hp = ro.highPrice ?? ro.highprice ?? null;
    if (lp != null) lowPrice = lp;
    if (hp != null) highPrice = hp;
    if (ro.priceCurrency) priceCurrency = ro.priceCurrency;
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

  // No raw "Book Now" link; pills handle it.
  return lines.join("\n");
}

/* --------------------- Backend pills (Book/Event/More/Photos) -------------------- */

/** Derive a "More Workshops" index URL from a product/event URL (same-origin, no hard-coding). */
function deriveWorkshopsIndex(productUrl, eventUrl) {
  const u = urlSafe(productUrl) ?? urlSafe(eventUrl);
  if (!u) return null;
  const segs = u.pathname.split('/').filter(Boolean);
  const idx = segs.findIndex((s) => /workshop/i.test(s));
  if (idx >= 0) {
    const path = '/' + segs.slice(0, idx + 1).join('/') + '/';
    return u.origin + path;
  }
  const base = u.pathname.endsWith('/') ? u.pathname.slice(0, -1) : u.pathname;
  const parent = base.substring(0, base.lastIndexOf('/') + 1);
  return u.origin + (parent || '/');
}

/** Helper to pull strings from Supabase selects */
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

/** Find best gallery landing URL on same origin, fallback to /search?query=gallery */
async function findPhotosUrl(client, productUrl, eventUrl) {
  const origin = (urlSafe(productUrl) ?? urlSafe(eventUrl))?.origin || null;

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
function scoreGallery(u) {
  const s = String(u).toLowerCase();
  if (s.includes("gallery-image-portfolios")) return 0; // your hub page
  if (/\/gallery(\/|$)/.test(s)) return 1;              // clean /gallery root
  return 2;                                              // other gallery paths
}

/** Main pill builder */
async function buildPills({ client, product, firstEvent }) {
  const productUrl = product?.url || product?.page_url || product?.source_url || null;
  const eventUrl   = firstEvent?.page_url || firstEvent?.source_url || null;

  const pills = [];
  if (productUrl) pills.push({ label: "Book Now", url: productUrl, brand: true });
  if (eventUrl)   pills.push({ label: "Event Listing", url: eventUrl, brand: true });

  const more = deriveWorkshopsIndex(productUrl, eventUrl);
  if (more) pills.push({ label: "More Workshops", url: more });

  const photos = await findPhotosUrl(client, productUrl, eventUrl);
  if (photos) pills.push({ label: "Photos", url: photos });

  // de-dup
  const seen = new Set();
  return pills.filter(p => (p.url && !seen.has(p.url) && seen.add(p.url))).slice(0, 4);
}

/* -------------------------------- Bluebell -------------------------------- */
async function answerBluebell({ client }) {
  const nowIso = new Date().toISOString();

  const canon = await resolveCanonicalsOptionA(client, "bluebell");

  // Future events
  const { data: events } = await client
    .from("page_entities")
    .select("id, title, page_url, source_url, date_start, date_end, location, raw")
    .eq("kind", "event")
    .or("title.ilike.%bluebell%,page_url.ilike.%bluebell%")
    .gte("date_start", nowIso)
    .order("date_start", { ascending: true })
    .limit(100);

  // Products
  const { data: products } = await client
    .from("page_entities")
    .select("*")
    .eq("kind", "product")
    .or("title.ilike.%bluebell%,page_url.ilike.%bluebell%")
    .order("last_seen", { ascending: false })
    .limit(50);

  // Product panel only (no events mixed in)
  const productPanel = buildProductPanelMarkdown(products || []);

  // Event list for structure/citations
  const eventList = (events || [])
    .map((e) => ({ ...e, when: fmtDateLondon(e.date_start) }))
    .slice(0, 12);

  // Representative product & first event (for pills)
  const product =
    (products || []).find((p) => p && pickUrl(p)) ||
    (products || [])[0] || null;
  const firstEvent =
    (events || [])
      .filter((e) => e && e.date_start)
      .sort((a, b) => new Date(a.date_start) - new Date(b.date_start))[0] || null;

  // Backend pills
  const pills = await buildPills({ client, product, firstEvent });

  // Citations
  const citations = uniq([
    pickUrl(canon.product),
    pickUrl(canon.landing),
    ...((events || []).map(pickUrl)),
    pickUrl(products?.[0]),
  ]).filter(Boolean);

  // Structure
  const structured = {
    topic: "bluebell",
    events: eventList,
    products: products || [],
    canonicals: {
      product: canon.product || null,
      landing: canon.landing || null,
      debug: canon.debug,
    },
    // New: backend-provided pills for the UI
    pills,
    // Mirror as 'chips' for any older frontends still expecting this field
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

    const topic = getTopicFromQuery(query);
    if (topic === "bluebell") {
      const result = await answerBluebell({ client });
      res.status(200).json({
        ...result,
        meta: {
          duration_ms: Date.now() - started,
          endpoint: "/api/chat",
          topK: topK || null,
        },
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
      meta: {
        duration_ms: Date.now() - started,
        endpoint: "/api/chat",
        topK: topK || null,
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
