// /api/chat.js
// Node runtime on Vercel. Data-driven. No hard-coded query terms.
// Restores prior logic and fixes Product block matching + Book Now pill.

export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

/* ================= Supabase (robust) ================= */
const FALLBACK_URL = "https://igzvwvbvgvmzvvzoclufx.supabase.co";
const SUPABASE_URL = process.env.SUPABASE_URL || FALLBACK_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M";

function supabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: { fetch },
  });
}

/* ================= Utilities ================= */
const pickUrl = (e) => e?.page_url || e?.source_url || e?.url || null;
const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n)); // ← fixed extra parenthesis
const tokenize = (s) => (String(s || "").toLowerCase().match(/[a-z0-9]+/g) || []);
const normaliseToken = (t) => String(t || "").replace(/\d+$/, ""); // kenilworth1 → kenilworth

const GENERIC = new Set([
  "alan","ranger","photography","photo","workshop","workshops","course","courses",
  "class","classes","tuition","lesson","lessons","uk","england","blog","near","me",
  "photographic","landscape","seascape","monthly","day","days","one","two","1","2"
]);

const nonGenericTokens = (str) =>
  (tokenize(str) || [])
    .map(normaliseToken)
    .filter((t) => t.length >= 4 && !GENERIC.has(t));

const titleTokens = (x) =>
  (tokenize(x?.title || x?.raw?.name || "") || [])
    .map(normaliseToken)
    .filter((t) => t.length >= 4 && !GENERIC.has(t));

const urlTokens = (x) => {
  const u = (pickUrl(x) || "").toLowerCase();
  return (tokenize(u.replace(/^https?:\/\//, "").replace(/[\/_-]+/g, " ")) || [])
    .map(normaliseToken)
    .filter((t) => t.length >= 4 && !GENERIC.has(t));
};

const sameHost = (a, b) => {
  try {
    const ha = new URL(pickUrl(a)).host;
    const hb = new URL(pickUrl(b)).host;
    return ha && hb && ha === hb;
  } catch { return false; }
};

/* ================= Intent & keywords ================= */
function detectIntent(q) {
  const s = String(q || "").toLowerCase();
  const eventish = /\b(when|date|dates|where|location|next|upcoming|availability|available|schedule|book|booking|time)\b/;
  const classish = /\b(workshop|course|class|tuition|lesson|lessons|photowalk|walk|masterclass)\b/;
  return eventish.test(s) && classish.test(s) ? "events" : "advice";
}
function detectEventSubtype(q) {
  const s = String(q || "").toLowerCase();
  if (/\b(course|courses|class|classes|tuition|lesson|lessons)\b/.test(s)) return "course";
  if (/\b(workshop|workshops|photowalk|walk|masterclass)\b/.test(s)) return "workshop";
  return null;
}

const STOPWORDS = new Set([
  "the","and","or","what","whats","when","whens","next","cost","where","location",
  "workshop","workshops","photography","photo","near","me","uk","warks","warwickshire",
  "devonshire","class","classes","course","courses","dates","date","upcoming",
  "available","availability","book","booking"
]);

function extractKeywords(q, intent, subtype) {
  const tokens = tokenize(String(q || ""));
  const kept = tokens.map(normaliseToken).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  if (kept.length) return uniq(kept);
  // sensible default so queries like “when’s the next workshop” still work
  return [intent === "events" ? (subtype === "course" ? "course" : "workshop") : "photography"];
}
const topicFromKeywords = (kws) => uniq(kws).join(", ");

/* ================= Scoring ================= */
const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
};
function scoreEntity(ent, qTokens) {
  const hayTitle = (ent?.title || ent?.raw?.name || "").toLowerCase();
  const hayUrl = (pickUrl(ent) || "").toLowerCase();
  const hayLoc = (ent?.location || "").toLowerCase();
  const hayDesc = (ent?.description || ent?.raw?.metaDescription || ent?.raw?.meta?.description || "")?.toLowerCase();
  const tTokens = tokenize(hayTitle + " " + hayUrl + " " + hayLoc + " " + hayDesc);
  if (!tTokens.length || !qTokens.length) return 0;
  let score = jaccard(new Set(qTokens), new Set(tTokens));
  if (qTokens.some((t) => t.length >= 3 && hayTitle.includes(t))) score += 0.2;
  return Math.min(1, score);
}
function confidenceFrom(scores) {
  if (!scores?.length) return 25;
  const top = Math.max(...scores);
  const meanTop3 = scores.slice().sort((a,b)=>b-a).slice(0,3).reduce((s,x,_,arr)=>s + x/arr.length, 0);
  const pct = 20 + top * 60 + meanTop3 * 15;
  return clamp(Math.round(pct), 20, 95);
}

/* ================= Supabase queries ================= */
const SELECT_COLS =
  "id, kind, title, page_url, source_url, last_seen, location, date_start, date_end, price, description, raw";

const buildOrIlike = (keys, keywords) =>
  keywords.flatMap((k) => keys.map((col) => `${col}.ilike.%${k}%`)).join(",");

async function findEvents(client, { keywords = [], topK = 12 } = {}) {
  let q = client.from("page_entities").select(SELECT_COLS).eq("kind", "event");
  q = q.gte("date_start", new Date().toISOString());
  if (keywords.length) {
    q = q.or(
      buildOrIlike(
        ["title","page_url","location","description","raw->>metaDescription","raw->meta->>description"],
        keywords
      )
    );
  }
  q = q.order("date_start", { ascending: true }).limit(topK);
  const { data, error } = await q; if (error) throw error; return data || [];
}

async function findProducts(client, { keywords = [], topK = 6 } = {}) {
  let q = client.from("page_entities").select(SELECT_COLS).eq("kind", "product");
  if (keywords.length) {
    q = q.or(
      buildOrIlike(
        ["title","page_url","description","raw->>metaDescription","raw->meta->>description"],
        keywords
      )
    );
  }
  q = q.order("last_seen", { ascending: false }).limit(topK);
  const { data, error } = await q; if (error) throw error; return data || [];
}

async function findArticles(client, { keywords = [], topK = 12 } = {}) {
  let q = client.from("page_entities").select(SELECT_COLS).in("kind", ["article","blog","page"]);
  if (keywords.length) {
    q = q.or(
      buildOrIlike(
        ["title","page_url","description","raw->>metaDescription","raw->meta->>description"],
        keywords
      )
    );
  }
  q = q.order("last_seen", { ascending: false }).limit(topK);
  const { data, error } = await q; if (error) throw error; return data || [];
}

async function findLanding(client, { keywords = [] } = {}) {
  let q = client.from("page_entities").select(SELECT_COLS)
    .in("kind", ["article", "page"])
    .eq("raw->>canonical", "true")
    .eq("raw->>role", "landing");

  if (keywords.length) {
    q = q.or(
      buildOrIlike(
        ["title","page_url","description","raw->>metaDescription","raw->meta->>description"],
        keywords
      )
    );
  }
  q = q.order("last_seen", { ascending: false }).limit(3);
  const { data, error } = await q; if (error) throw error; return data || [];
}

/* ================= Matching helpers ================= */
function isWorkshopEvent(e) {
  const u = (pickUrl(e) || "").toLowerCase();
  const t = (e?.title || e?.raw?.name || "").toLowerCase();
  const hasWorkshop = /workshop|photowalk|walk|masterclass/.test(u + " " + t) || /photo-workshops-uk|photographic-workshops/.test(u);
  const looksCourse = /(lesson|lessons|tuition|course|courses|class|classes)/.test(u + " " + t);
  return hasWorkshop && !looksCourse;
}
function isCourseEvent(e) {
  const u = (pickUrl(e) || "").toLowerCase();
  const t = (e?.title || e?.raw?.name || "").toLowerCase();
  const hasCourse = /(lesson|lessons|tuition|course|courses|class|classes)/.test(u + " " + t);
  const looksWorkshop = /workshop|photowalk|walk|masterclass/.test(u + " " + t);
  return hasCourse && !looksWorkshop;
}

function extractTopicAndLocationTokens(ev) {
  const all = uniq([...titleTokens(ev), ...urlTokens(ev)]);
  const topic = all.filter((x) =>
    /(exposure|long|sunset|night|woodland|seascape|landscape|architecture|dartmoor|yorkshire|devon|dales|windmill)/.test(x)
  );
  const location = all.filter((x) =>
    /(kenilworth|coventry|dartmoor|yorkshire|devon|wales|betws|hartland|chesterton)/.test(x)
  );
  return { topic: uniq(topic), location: uniq(location), all };
}

function overlapScore(refSet, candUrl, candTitle) {
  const candTokens = new Set(
    [...tokenize(String(candUrl || "").replace(/^https?:\/\//, "").replace(/[\/_-]+/g, " ")), ...tokenize(candTitle || "")]
      .map(normaliseToken).filter((t) => t.length >= 4 && !GENERIC.has(t))
  );
  let inter = 0; for (const t of refSet) if (candTokens.has(t)) inter++;
  const union = refSet.size + candTokens.size - inter || 1;
  return { inter, score: inter / union };
}

// Stronger product→event match (heavily weight location & same host)
function productMatchesEvent(p, ev) {
  const ref = new Set([...titleTokens(ev), ...urlTokens(ev)]);
  const { score, inter } = overlapScore(ref, pickUrl(p), p?.title || "");
  const evLoc = extractTopicAndLocationTokens(ev).location;
  const hay = (String(pickUrl(p)) + " " + (p.title || "")).toLowerCase();
  const hasLocation = evLoc.length ? evLoc.some((t) => hay.includes(t)) : false;
  let s = score + (hasLocation ? 0.25 : 0) + (sameHost(p, ev) ? 0.15 : 0);
  return { s, inter, hasLocation };
}

/* ============ Clean price lookup (ai_products_clean) ============ */
async function lookupCleanPriceValidated(client, ev) {
  const { topic, location, all } = extractTopicAndLocationTokens(ev);
  const tokens = uniq([...topic, ...location, ...all]).slice(0, 12);
  if (!tokens.length) return null;

  // strict AND on url tokens when possible
  let q = client.from("ai_products_clean").select("title,url,price_gbp");
  for (const t of tokens) q = q.ilike("url", `%${t}%`);
  q = q.limit(24);
  const { data, error } = await q;
  if (error) return null;
  // choose cheapest that contains at least one location token
  const filtered = (data || []).filter((r) => {
    const hay = (r.url + " " + (r.title || "")).toLowerCase();
    return !location.length || location.some((t) => hay.includes(t));
  });
  if (!filtered.length) return null;
  filtered.sort((a, b) => (Number(a.price_gbp) || 1e9) - (Number(b.price_gbp) || 1e9));
  return filtered[0] || null;
}

/* ================= Panels / Pills ================= */
function selectDisplayPriceNumber(prod) {
  const pg = prod?.price_gbp != null ? Number(prod.price_gbp) : null;
  const pn = prod?.price != null ? Number(prod.price) : null;
  const candidate = (pg && pg > 0) ? pg : (pn && pn > 0 ? pn : null);
  return candidate && candidate > 0 ? candidate : null;
}
function formatGBP(n) {
  if (n == null) return null;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(n));
}
function buildAdviceMarkdown(articles) {
  const lines = ["**Guides**"];
  for (const a of (articles || []).slice(0, 5)) {
    const t = a.title || a.raw?.name || "Read more";
    lines.push(`- ${t} — ${pickUrl(a) ? `[Link](${pickUrl(a)})` : ""}`.trim());
  }
  return lines.join("\n");
}
function buildProductPanelMarkdown(prod) {
  const title = prod?.title || prod?.raw?.name || "Workshop";
  const priceStr = formatGBP(selectDisplayPriceNumber(prod));
  const meta = prod?.raw?.meta || {};
  const desc = meta?.description || prod?.raw?.metaDescription || prod?.raw?.meta?.description || prod?.description || "";

  const lines = [`**${title}**${priceStr ? ` — ${priceStr}` : ""}`];
  if (desc) lines.push("", desc);

  // Extra details if present
  const details = [];
  const loc = meta.location || prod.location;
  if (loc) details.push(`**Location:** ${loc}`);
  if (meta.participants) details.push(`**Participants:** ${meta.participants}`);
  if (meta.fitness) details.push(`**Fitness:** ${meta.fitness}`);
  if (Array.isArray(meta.pricing) && meta.pricing.length) {
    for (const p of meta.pricing) {
      if (p?.label || p?.price) {
        const ps = p?.price ? formatGBP(p.price) : "";
        details.push(`- ${p?.label || "Standard"} — ${ps}`.trim());
      }
    }
  }
  if (details.length) lines.push("", details[0], ...details.slice(1));

  const url = pickUrl(prod);
  if (url) lines.push("", `[Open](${url})`);
  return lines.join("\n");
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
function buildEventPills(firstEvent, productOrNull) {
  const eventUrl = pickUrl(firstEvent);
  const productUrl = pickUrl(productOrNull);
  const bookUrl = productUrl || eventUrl;
  const pills = [];
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
  try {
    const { query, topK = 8 } = req.body || {};
    const q = String(query || "").trim();
    const client = supabaseAdmin();

    const intent = detectIntent(q);
    const subtype = detectEventSubtype(q);
    const keywords = extractKeywords(q, intent, subtype);
    const topic = topicFromKeywords(keywords);

    let events = [], products = [], articles = [], landing = [];

    if (intent === "events") {
      [events, products, landing] = await Promise.all([
        findEvents(client, { keywords, topK: Math.max(8, topK) }),
        findProducts(client, { keywords, topK: 12 }),  // fetch a few – we'll filter below
        findLanding(client, { keywords }),
      ]);
      if (subtype === "workshop") events = events.filter(isWorkshopEvent);
      else if (subtype === "course") events = events.filter(isCourseEvent);

      try { articles = await findArticles(client, { keywords, topK: 12 }); } catch { articles = []; }
    } else {
      [articles, products] = await Promise.all([
        findArticles(client, { keywords, topK: Math.max(12, topK) }),
        findProducts(client, { keywords, topK: 6 }),
      ]);
    }

    // Rank, but keep events in date order
    const qTokens = keywords;
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
    const datedEvents = (events || [])
      .slice()
      .sort((a, b) => (Date.parse(a.date_start || 0) || 0) - (Date.parse(b.date_start || 0) || 0))
      .map((e) => ({ ...e, _score: Math.round(scoreEntity(e, qTokens) * 100) / 100 }));

    const firstEvent = datedEvents[0] || null;

    // === PRODUCT SECTION ===
    let featuredProduct = null;

    if (firstEvent) {
      // Prefer products that clearly match the first event (topic/location/host overlap)
      const scored = (products || [])
        .map((p) => ({ p, ...productMatchesEvent(p, firstEvent) }))
        .filter((x) => x.hasLocation || x.s >= 0.35) // location match or decent overlap
        .sort((a, b) => b.s - a.s);

      if (scored.length && (scored[0].s >= 0.45 || scored[0].hasLocation)) {
        featuredProduct = { ...scored[0].p };
      } else {
        // No clear product in page_entities → build a synthetic product tied to the event
        const synthetic = {
          id: `evt-${firstEvent.id || "next"}`,
          title: firstEvent.title || "Upcoming Workshop",
          page_url: pickUrl(firstEvent),
          source_url: pickUrl(firstEvent),
          description: firstEvent.description || firstEvent.raw?.metaDescription || firstEvent.raw?.description || "",
          price: null,
          location: firstEvent.location || null,
          raw: { ...(firstEvent.raw || {}), _syntheticFromEvent: true },
          _score: 1,
        };

        // Try to attach a clean price; only swap URL if it clearly matches (keeps ‘Book Now’ sane)
        const tip = await lookupCleanPriceValidated(client, firstEvent);
        if (tip && Number(tip.price_gbp) > 0) {
          // keep event URL unless the tip URL looks like the actual product for this event
          const hay = (tip.url + " " + (tip.title || "")).toLowerCase();
          const { topic, location } = extractTopicAndLocationTokens(firstEvent);
          const looksSame = (location.length ? location.some((t) => hay.includes(t)) : false)
            && (topic.length ? topic.some((t) => hay.includes(t)) : true);

          featuredProduct = {
            ...synthetic,
            ...(looksSame ? { page_url: tip.url, source_url: tip.url } : {}),
            price_gbp: Number(tip.price_gbp),
          };
        } else {
          featuredProduct = synthetic;
        }
      }
    }

    // Final rankedProducts array (featured first if any)
    const rankedProducts = featuredProduct
      ? [featuredProduct, ...products.filter((p) => pickUrl(p) !== pickUrl(featuredProduct) )]
          .map((p) => ({ ...p, _score: Math.round(scoreEntity(p, qTokens) * 100) / 100 }))
      : scoreWrap(products);

    // Confidence
    const scoresForConfidence = [
      ...(rankedArticles[0]?._score ? [rankedArticles[0]._score] : []),
      ...(datedEvents[0]?._score ? [datedEvents[0]._score] : []),
      ...(rankedProducts[0]?._score ? [rankedProducts[0]._score] : []),
    ].map((x) => x / 100);
    const confidence_pct = confidenceFrom(scoresForConfidence);

    // Compose markdown (Product panel if we have one)
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

    // Citations
    const citations = uniq([
      ...rankedArticles.slice(0, 3).map(pickUrl),
      ...(firstEvent ? [pickUrl(firstEvent)] : []),
      ...(rankedProducts[0] ? [pickUrl(rankedProducts[0])] : []),
    ]);

    // Pills
    const pills = intent === "events"
      ? buildEventPills(firstEvent, rankedProducts[0] || null)
      : buildAdvicePills(rankedArticles, q);

    // Structured payload
    const structured = {
      intent,
      topic,
      event_subtype: subtype,
      events: datedEvents.map((e) => ({
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
      })),
      products: rankedProducts.map((p) => ({
        id: p.id,
        title: p.title,
        page_url: p.page_url,
        source_url: p.source_url,
        description: p.description,
        price: p.price ?? null,
        price_gbp: p.price_gbp ?? null,
        location: p.location,
        raw: p.raw,
        _score: p._score,
        display_price: selectDisplayPriceNumber(p),
      })),
      articles: rankedArticles.map((a) => ({
        id: a.id,
        title: a.title,
        page_url: a.page_url,
        source_url: a.source_url,
        last_seen: a.last_seen,
      })),
      pills,
    };

    const payload = {
      ok: true,
      answer_markdown,
      citations,
      structured,
      confidence: confidence_pct / 100,
      confidence_pct,
      meta: { duration_ms: Date.now() - started, endpoint: "/api/chat", topK, intent },
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
