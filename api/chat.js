// /api/chat.js
// Node runtime on Vercel. Data-driven. No hard-coded query terms.

export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

/* ================= Supabase ================= */
const FALLBACK_URL = "https://igzvwvbvgvmzvvzoclufx.supabase.co";
const SUPABASE_URL = process.env.SUPABASE_URL || FALLBACK_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M";

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY";

// <<< CHANGED: Node<18-safe fetch shim
async function ensureFetch() {
  if (typeof globalThis.fetch === "function") return globalThis.fetch;
  const mod = await import("node-fetch");
  return mod.default;
}

function supabaseAdmin(fetchFn) { // <<< CHANGED (accept fetch)
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: { fetch: fetchFn }, // <<< CHANGED
  });
}

async function probeSupabaseHealth(fetchFn) { // <<< CHANGED (accept fetch)
  const url = `${String(SUPABASE_URL).replace(/\/+$/, "")}/auth/v1/health`;
  const out = { url, ok: false, status: null, error: null };
  try {
    const resp = await fetchFn(url); // <<< CHANGED
    out.status = resp.status;
    out.ok = resp.ok;
  } catch (e) {
    out.error = String(e && e.message ? e.message : e);
  }
  return out;
}

/* ================= Utilities ================= */
const SELECT_COLS =
  "id, kind, title, page_url, source_url, last_seen, location, date_start, date_end, price, description, raw";

function pickUrl(e) {
  return e?.page_url || e?.source_url || e?.url || null;
}
function baseUrl(u) {
  return String(u || "").split("?")[0];
}
function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
function tokenize(s) {
  return (s || "").toLowerCase().match(/[a-z0-9]+/g) || [];
}
function normaliseToken(t) {
  return String(t || "").replace(/\d+$/, "");
}
function lc(s) {
  return String(s || "").toLowerCase();
}

const GENERIC = new Set([
  "alan",
  "ranger",
  "photography",
  "photo",
  "workshop",
  "workshops",
  "course",
  "courses",
  "class",
  "classes",
  "tuition",
  "lesson",
  "lessons",
  "uk",
  "england",
  "blog",
  "near",
  "me",
  "photographic",
  "landscape",
  "seascape",
  "monthly",
  "day",
  "days",
  "one",
  "two",
  "1",
  "2",
]);

function nonGenericTokens(str) {
  return (tokenize(str) || [])
    .map(normaliseToken)
    .filter((t) => t.length >= 3 && !GENERIC.has(t));
}
function titleTokens(x) {
  return (tokenize((x?.title || x?.raw?.name || "")) || [])
    .map(normaliseToken)
    .filter((t) => t.length >= 3 && !GENERIC.has(t));
}
function urlTokens(x) {
  const u = (pickUrl(x) || "").toLowerCase();
  return (tokenize(u.replace(/^https?:\/\//, "").replace(/[\/_-]+/g, " ")) || [])
    .map(normaliseToken)
    .filter((t) => t.length >= 3 && !GENERIC.has(t));
}
function sameHost(a, b) {
  try {
    const ha = new URL(pickUrl(a)).host;
    const hb = new URL(pickUrl(b)).host;
    return ha && hb && ha === hb;
  } catch {
    return false;
  }
}

/* ================= Intent & Keywords ================= */
function detectIntent(q) {
  const s = String(q || "").toLowerCase();
  const eventish =
    /\b(when|date|dates|where|location|next|upcoming|availability|available|schedule|book|booking|time|how much|price|cost)\b/;
  const classish =
    /\b(workshop|course|class|tuition|lesson|lessons|photowalk|walk|masterclass)\b/;
  return eventish.test(s) && classish.test(s) ? "events" : "advice";
}
function detectEventSubtype(q) {
  const s = String(q || "").toLowerCase();
  if (/\b(course|courses|class|classes|tuition|lesson|lessons)\b/.test(s))
    return "course";
  if (/\b(workshop|workshops|photowalk|walk|masterclass)\b/.test(s))
    return "workshop";
  return null;
}

const STOPWORDS = new Set([
  "the",
  "and",
  "or",
  "what",
  "whats",
  "when",
  "whens",
  "next",
  "cost",
  "how",
  "much",
  "workshop",
  "workshops",
  "photography",
  "photo",
  "near",
  "me",
  "uk",
  "class",
  "classes",
  "course",
  "courses",
  "where",
  "location",
  "dates",
  "date",
  "upcoming",
  "available",
  "availability",
  "book",
  "booking",
  "time",
]);

function extractKeywords(q, intent, subtype) {
  const tokens = tokenize(String(q || ""));
  const kept = tokens
    .map(normaliseToken)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  if (!kept.length)
    return [
      intent === "events"
        ? subtype === "course"
          ? "course"
          : "workshop"
        : "photography",
    ];
  return uniq(kept);
}
function topicFromKeywords(kws) {
  return uniq(kws).join(", ");
}

/* ================= Scoring ================= */
function jaccard(a, b) {
  const A = new Set(a),
    B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}
function scoreEntity(ent, qTokens) {
  const hayTitle = (ent?.title || ent?.raw?.name || "").toLowerCase();
  const hayUrl = (pickUrl(ent) || "").toLowerCase();
  const hayLoc = (ent?.location || "").toLowerCase();
  const hayDesc = (
    ent?.description ||
    ent?.raw?.metaDescription ||
    ent?.raw?.meta?.description ||
    ""
  )?.toLowerCase();
  const tTokens = tokenize(hayTitle + " " + hayUrl + " " + hayLoc + " " + hayDesc);
  if (!tTokens.length || !qTokens.length) return 0;
  let score = jaccard(new Set(qTokens), new Set(tTokens));
  if (qTokens.some((t) => t.length >= 3 && hayTitle.includes(t))) score += 0.2;
  return Math.min(1, score);
}
function confidenceFrom(scores) {
  if (!scores?.length) return 25;
  const top = Math.max(...scores);
  const meanTop3 = scores
    .slice()
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((s, x, _, arr) => s + x / arr.length, 0);
  const pct = 20 + top * 60 + meanTop3 * 15;
  return clamp(Math.round(pct), 20, 95);
}

/* ================= Supabase queries ================= */
function buildOrIlike(keys, keywords) {
  const clauses = [];
  for (const k of keywords)
    for (const col of keys) clauses.push(`${col}.ilike.%${k}%`);
  return clauses.join(",");
}

async function findEvents(client, { keywords = [], topK = 12 } = {}) {
  let q = client.from("page_entities").select(SELECT_COLS).eq("kind", "event");
  q = q.gte("date_start", new Date().toISOString());
  if (keywords.length) {
    q = q.or(
      buildOrIlike(
        [
          "title",
          "page_url",
          "location",
          "description",
          "raw->>metaDescription",
          "raw->meta->>description",
        ],
        keywords
      )
    );
  }
  q = q.order("date_start", { ascending: true }).limit(topK);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function findProducts(client, { keywords = [], topK = 12 } = {}) {
  let q = client
    .from("page_entities")
    .select(SELECT_COLS)
    .eq("kind", "product");
  if (keywords.length)
    q = q.or(
      buildOrIlike(
        [
          "title",
          "page_url",
          "description",
          "raw->>metaDescription",
          "raw->meta->>description",
        ],
        keywords
      )
    );
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
  if (keywords.length)
    q = q.or(
      buildOrIlike(
        [
          "title",
          "page_url",
          "description",
          "raw->>metaDescription",
          "raw->meta->>description",
        ],
        keywords
      )
    );
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
  if (keywords.length)
    q = q.or(
      buildOrIlike(
        [
          "title",
          "page_url",
          "description",
          "raw->>metaDescription",
          "raw->meta->>description",
        ],
        keywords
      )
    );
  q = q.order("last_seen", { ascending: false }).limit(3);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/* ================= Views: unified price + availability ================= */

// <<< CHANGED: both helpers now read from v_products_unified

// Fetch canonical price/kind/source from unified view
async function fetchDisplayPrices(client, productUrls = []) {
  const urls = uniq((productUrls || []).map(baseUrl)).filter(Boolean);
  if (!urls.length) return new Map();
  const { data, error } = await client
    .from("v_products_unified")
    .select("product_url, display_price_gbp, product_kind_resolved, price_source")
    .in("product_url", urls);
  if (error) return new Map();
  const map = new Map();
  for (const row of data || []) {
    map.set(baseUrl(row.product_url), {
      display_price_gbp: row.display_price_gbp ?? null,
      preferred_source: row.price_source ?? null, // keep same downstream prop name
      product_kind: row.product_kind_resolved ?? null,
    });
  }
  return map;
}

// Availability (and optional location hint) from unified view
async function fetchAvailability(client, productUrls = []) {
  const urls = uniq((productUrls || []).map(baseUrl)).filter(Boolean);
  if (!urls.length) return new Map();
  try {
    const { data, error } = await client
      .from("v_products_unified")
      .select("product_url, availability_status, location_hint")
      .in("product_url", urls);
    if (error) return new Map();
    const map = new Map();
    for (const row of data || []) {
      map.set(baseUrl(row.product_url), {
        availability_status: row.availability_status ?? null,
        availability_raw: null, // unified view doesn’t carry raw; keep shape stable
        location_hint: row.location_hint ?? null,
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

/* ================= Matching helpers ================= */
function isWorkshopEvent(e) {
  const u = (pickUrl(e) || "").toLowerCase();
  const t = (e?.title || e?.raw?.name || "").toLowerCase();
  const hasWorkshop =
    /workshop/.test(u) ||
    /workshop/.test(t) ||
    /photo-workshops-uk|photographic-workshops/.test(u);
  const looksCourse = /(lesson|lessons|tuition|course|courses|class|classes)/.test(
    u + " " + t
  );
  return hasWorkshop && !looksCourse;
}
function isCourseEvent(e) {
  const u = (pickUrl(e) || "").toLowerCase();
  const t = (e?.title || e?.raw?.name || "").toLowerCase();
  const hasCourse = /(lesson|lessons|tuition|course|courses|class|classes)/.test(
    u + " " + t
  );
  const looksWorkshop = /workshop/.test(u + " " + t);
  return hasCourse && !looksWorkshop;
}

/* Product kind (kept generic) */
function isWorkshopProduct(p) {
  const u = (pickUrl(p) || "").toLowerCase();
  const t = (p?.title || "").toLowerCase();
  const hasWorkshop =
    /workshop/.test(u + " " + t) ||
    /photo-workshops-uk|photographic-workshops/.test(u);
  const looksCourse = /(lesson|lessons|tuition|course|courses|class|classes)/.test(
    u + " " + t
  );
  return hasWorkshop && !looksCourse;
}
function isCourseProduct(p) {
  const u = (pickUrl(p) || "").toLowerCase();
  const t = (p?.title || "").toLowerCase();
  const hasCourse = /(lesson|lessons|tuition|course|courses|class|classes)/.test(
    u + " " + t
  );
  const looksWorkshop = /workshop/.test(u + " " + t);
  return hasCourse && !looksWorkshop;
}

/* Location hints used elsewhere too */
const LOCATION_HINTS = [
  "devon",
  "hartland",
  "dartmoor",
  "yorkshire",
  "dales",
  "kenilworth",
  "coventry",
  "warwickshire",
  "anglesey",
  "wales",
  "betws",
  "snowdonia",
  "northumberland",
  "gloucestershire",
  "batsford",
  "chesterton",
  "windmill",
  "lynmouth",
  "exmoor",
  "quay",
];

/* ---- extract tokens from the first event ---- */
function extractTopicAndLocationTokensFromEvent(ev) {
  const t = titleTokens(ev);
  const u = urlTokens(ev);
  const all = uniq([...t, ...u]);
  const locFromField = nonGenericTokens(ev?.location || "");
  const locationHints = uniq(
    [...all, ...locFromField].filter((x) =>
      /(kenilworth|coventry|warwickshire|dartmoor|devon|hartland|anglesey|yorkshire|dales|wales|betws|snowdonia|northumberland|batsford|gloucestershire|chesterton|windmill|lynmouth|exmoor|quay)/.test(
        x
      )
    )
  );
  const topicHints = all.filter((x) => !locationHints.includes(x));
  return { all, topic: uniq(topicHints), location: uniq(locationHints) };
}

/* ---- similarity helpers ---- */
function symmetricOverlap(eventTokens, url, title) {
  const pTokens = new Set(
    [
      ...tokenize(
        String(url || "").replace(/^https?:\/\//, "").replace(/[\/_-]+/g, " ")
      ),
      ...tokenize(String(title || "")),
    ]
      .map(normaliseToken)
      .filter((x) => x.length >= 3 && !GENERIC.has(x))
  );

  const eTokens = new Set(eventTokens);
  let inter = 0;
  for (const tk of eTokens) if (pTokens.has(tk)) inter++;

  const eSize = eTokens.size || 1;
  const pSize = pTokens.size || 1;

  const recall = inter / eSize;
  const precision = inter / pSize;
  const f1 =
    precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { f1, pTokens };
}

/* ---- derive 'anchor' tokens from a product title (distinctive words) ---- */
function productAnchorTokens(prod) {
  const title = prod?.title || "";
  const tokens = titleTokens({ title });
  return tokens.filter((t) => t.length >= 5 && !LOCATION_HINTS.includes(t)); // no location anchors
}

/* ===== prefer richer duplicate rows for the same product URL ===== */
function preferRicherProduct(a, b) {
  if (!a) return b;
  if (!b) return a;
  const au = baseUrl(pickUrl(a)),
    bu = baseUrl(pickUrl(b));
  if (au !== bu) return a;
  const aHasPrice = (a.price_gbp > 0) || (a.price > 0);
  const bHasPrice = (b.price_gbp > 0) || (b.price > 0);
  if (aHasPrice !== bHasPrice) return bHasPrice ? b : a;
  const aLen = (a.description || "").length;
  const bLen = (b.description || "").length;
  if (aLen !== bLen) return bLen > aLen ? b : a;
  return a;
}
function upgradeToRichestByUrl(allProducts, chosen) {
  if (!chosen) return null;
  const url = baseUrl(pickUrl(chosen));
  const same = (allProducts || []).filter((p) => baseUrl(pickUrl(p)) === url);
  return same.reduce(preferRicherProduct, chosen);
}

/* ===== date parsing used for strict workshop matching ===== */
function monthIdx(m) {
  const s = lc(m).slice(0, 3);
  const map = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };
  return s in map ? (s in map ? map[s] : null) : null;
}
function extractDatesFromText(text, defaultYear) {
  const out = [];
  if (!text) return out;
  const re =
    /(?:(?:mon|tue|wed|thu|fri|sat|sun)\s*,?\s*)?(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const d = parseInt(m[1], 10);
    const mi = monthIdx(m[2]);
    const y = m[3]
      ? parseInt(m[3], 10)
      : defaultYear || new Date().getFullYear();
    if (mi != null && d >= 1 && d <= 31) {
      const dt = new Date(Date.UTC(y, mi, d));
      if (!isNaN(dt)) out.push(dt);
    }
  }
  return out;
}
function withinDays(a, b, days) {
  const diff = Math.abs(a.getTime() - b.getTime());
  return diff <= days * 86400000;
}

/* --- strict product-vs-event gate --- */
function strictlyMatchesEvent(product, firstEvent, subtype = null) {
  if (!product || !firstEvent) return false;

  const { topic, location, all } = extractTopicAndLocationTokensFromEvent(firstEvent);
  const refCore = uniq([...(location || []), ...(topic || [])]);
  const refTokens = new Set(refCore.length ? refCore : all);

  const anchors = productAnchorTokens(product);
  const hasAnchorHit = anchors.some((a) => refTokens.has(a));
  if (!hasAnchorHit) return false;

  const { f1 } = symmetricOverlap(refTokens, pickUrl(product), product.title);
  if (f1 < 0.35) return false;

  if ((location || []).length) {
    const long = sanitizeDesc(
      product?.raw?.metaDescription ||
        product?.raw?.meta?.description ||
        product?.description ||
        ""
    );
    const hay = lc(
      (product.title || "") + " " + (pickUrl(product) || "") + " " + long
    );
    const locOk = location.some((l) => hay.includes(l));
    if (!locOk) return false;
  }

  if (subtype === "workshop") {
    const eventDate = firstEvent?.date_start ? new Date(firstEvent.date_start) : null;
    if (eventDate && !isNaN(eventDate)) {
      const long = sanitizeDesc(
        product?.raw?.metaDescription ||
          product?.raw?.meta?.description ||
          product?.description ||
          ""
      );
      const dates = extractDatesFromText(long, eventDate.getUTCFullYear());
      if (dates.length) {
        const anyClose = dates.some((d) => withinDays(d, eventDate, 5));
        if (!anyClose) return false;
      }
    }
  }

  const okKind =
    (isWorkshopEvent(firstEvent) ? isWorkshopProduct(product) : true) &&
    (isCourseEvent(firstEvent) ? isCourseProduct(product) : true);
  if (!okKind) return false;

  const evtLower = lc((firstEvent.title || "") + " " + (pickUrl(firstEvent) || ""));
  const tl = lc(product.title || "");
  if (/portrait/.test(tl) && !/portrait/.test(evtLower)) return false;
  if (/(lightroom|editing)/.test(tl) && !/(lightroom|editing)/.test(evtLower)) return false;

  return true;
}

/* ========= Resolve event→product via view (preferred), with fallback ========= */
async function resolveEventProductByView(client, eventUrl) {
  if (!eventUrl) return null;
  try {
    const { data, error } = await client
      .from("v_event_product_links_all")
      .select("product_url")
      .eq("event_url", baseUrl(eventUrl))
      .limit(1);
    if (error) return null;
    const hit = (data || [])[0];
    return hit?.product_url ? baseUrl(hit.product_url) : null;
  } catch {
    return null;
  }
}

/** Try hard to find a product URL for the first event; require anchor alignment. */
async function findBestProductForEvent(client, firstEvent, preloadProducts = [], subtype = null) {
  if (!firstEvent) return null;

  // Preferred path: lookup mapping view
  const evUrl = pickUrl(firstEvent);
  const mapped = await resolveEventProductByView(client, evUrl);
  if (mapped) {
    // Try to find in preload list first
    let prod =
      (preloadProducts || []).find((p) => baseUrl(pickUrl(p)) === baseUrl(mapped)) ||
      null;
    if (!prod) {
      // Fallback to fetching the entity by URL
      const { data } = await client
        .from("page_entities")
        .select(SELECT_COLS)
        .eq("kind", "product")
        .or(
          [
            `page_url.eq.${mapped}`,
            `source_url.eq.${mapped}`,
            `url.eq.${mapped}`,
          ].join(",")
        )
        .limit(1);
      if (data && data[0]) prod = data[0];
    }
    if (prod && strictlyMatchesEvent(prod, firstEvent, subtype)) {
      return prod;
    }
    // If mapping exists but strict gate fails, continue to heuristic search
  }

  // Heuristic fallback (your previous logic)
  const { topic, location, all } = extractTopicAndLocationTokensFromEvent(firstEvent);
  const refCore = uniq([...(location || []), ...(topic || [])]);
  const refTokens = new Set(refCore.length ? refCore : all);
  const needLoc = location.length ? location : [];
  const evtLower = lc(((firstEvent?.title || "") + " " + (pickUrl(firstEvent) || "")));

  const kindAlign = (p) => {
    if (!subtype) return true;
    if (subtype === "course") return isCourseProduct(p) || !isWorkshopProduct(p);
    if (subtype === "workshop") return isWorkshopProduct(p) || !isCourseProduct(p);
    return true;
  };

  const pass = (p) => {
    if (!kindAlign(p)) return false;

    const u = pickUrl(p) || "";
    const t = p?.title || "";

    const hasLoc =
      !needLoc.length || needLoc.some((l) => lc(u).includes(l) || lc(t).includes(l));
    if (!hasLoc) return false;

    const anchors = productAnchorTokens(p);
    const hasAnchorHit = anchors.some((a) => refTokens.has(a));
    if (!hasAnchorHit) return false;

    const { f1 } = symmetricOverlap(refTokens, u, t);
    return f1 >= 0.3;
  };

  const extraScore = (p, base) => {
    let s = base;
    const tl = lc(p.title || "");
    if (/portrait/.test(tl) && !/portrait/.test(evtLower)) s -= 0.45;
    if (/(lightroom|editing)/.test(tl) && !/(lightroom|editing)/.test(evtLower))
      s -= 0.45;
    const slug = lc(((pickUrl(p) || "") + " " + (p.title || "")));
    if (/beginners[-\s]photography[-\s]course/.test(slug)) s += 0.35;
    return s;
  };

  let candidates = (preloadProducts || []).filter(pass);
  if (candidates.length) {
    const ranked = candidates
      .map((p) => {
        const { f1 } = symmetricOverlap(refTokens, pickUrl(p), p.title);
        let s = f1;
        if (sameHost(p, firstEvent)) s += 0.1;
        s = extraScore(p, s);
        return { p, s };
      })
      .sort((a, b) => b.s - a.s);
    if (ranked[0]?.p) return ranked[0].p;
  }

  // Expand recall
  const core = uniq([...Array.from(refTokens)]).slice(0, 12);
  let fallback = [];
  if (core.length) {
    const orParts = core
      .flatMap((t) => [
        `title.ilike.%${t}%`,
        `page_url.ilike.%${t}%`,
        `description.ilike.%${t}%`,
        `raw->>metaDescription.ilike.%${t}%`,
        `raw->meta->>description.ilike.%${t}%`,
      ])
      .join(",");
    const { data } = await client
      .from("page_entities")
      .select(SELECT_COLS)
      .eq("kind", "product")
      .or(orParts)
      .order("last_seen", { ascending: false })
      .limit(50);
    fallback = (data || []).filter(pass);
  }

  if (fallback.length) {
    const ranked = fallback
      .map((p) => {
        const { f1 } = symmetricOverlap(refTokens, pickUrl(p), p.title);
        let s = f1;
        if (sameHost(p, firstEvent)) s += 0.1;
        s = extraScore(p, s);
        return { p, s };
      })
      .sort((a, b) => b.s - a.s);
    if (ranked[0]?.p) return ranked[0].p;
  }

  return null;
}

/* ================= Product & Event panel rendering ================= */
function selectDisplayPriceNumber(prod) {
  // If we've enriched via v_products_unified (or legacy price_gbp), prefer that
  const pg =
    prod?.display_price_gbp != null
      ? Number(prod.display_price_gbp)
      : prod?.price_gbp != null
      ? Number(prod.price_gbp)
      : null;
  const pn = prod?.price != null ? Number(prod.price) : null;
  const candidate = pg && pg > 0 ? pg : pn && pn > 0 ? pn : null;
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

/* --- sanitize rich text/HTML to plain text before parsing --- */
function sanitizeDesc(s) {
  if (!s || typeof s !== "string") return "";
  let out = s;
  // structure → newlines
  out = out.replace(/<br\s*\/?>/gi, "\n");
  out = out.replace(/<\/p>/gi, "\n");
  out = out.replace(/<\/li>/gi, "\n");
  out = out.replace(/<li[^>]*>/gi, "• ");
  // tidy entities & attrs
  out = out.replace(/\s+[a-z-]+="[^"]*"/gi, "");
  out = out.replace(/&nbsp;|&#160;/gi, " ");
  out = out.replace(/&amp;/gi, "&");
  // strip tags & collapse
  out = out.replace(/\u2013|\u2014/g, "-");
  out = out.replace(/<[^>]*>/g, " ");
  out = out.replace(/[ \t\f\v]+/g, " ");
  out = out.replace(/\s*\n\s*/g, "\n");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

/* Robust: extract labelled bullets */
function parseProductBlock(desc) {
  const out = {};
  const clean = sanitizeDesc(desc);
  if (!clean) return out;

  const NEXT_LABELS =
    "(?:Location|Address|Participants|Group\\s*Size|Max\\s*Participants|Class\\s*Size|Time|Times|Timing|Start\\s*Time|Dates|Start\\s*Dates|Multi\\s*Course\\s*Start\\s*Dates|Experience\\s*(?:\\-|\\s*)Level|Fitness|Difficulty)";

  const capture = (labelExpr) => {
    const re = new RegExp(
      `(?:^|\\b|\\n)${labelExpr}\\s*(?:\\:|\\-|—)\\s*([\\s\\S]*?)(?=(?:\\n|\\b)${NEXT_LABELS}\\s*(?:\\:|\\-|—)|$)`,
      "i"
    );
    const m = clean.match(re);
    if (!m || m.length < 2 || typeof m[1] !== "string") return null;
    return m[1]
      .replace(/^\s*(?:-+|—)\s*/, "")
      .trim()
      .replace(/\s{2,}/g, " ")
      .slice(0, 300);
  };

  out.location = capture("(?:Location|Address)");
  out.participants = capture(
    "(?:Participants|Group\\s*Size|Max\\s*Participants|Class\\s*Size)"
  );
  out.time = capture("(?:Time|Times|Timing|Start\\s*Time)");
  out.dates = capture("(?:Dates|Start\\s*Dates|Multi\\s*Course\\s*Start\\s*Dates)");
  out.fitness = capture("(?:Fitness|Difficulty|Experience\\s*(?:\\-|\\s*)Level)");

  return out;
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
  const priceNum = selectDisplayPriceNumber(prod);
  const priceStr = formatDisplayPriceGBP(priceNum);
  const url = pickUrl(prod);

  const long =
    prod?.raw?.metaDescription ||
    prod?.raw?.meta?.description ||
    prod?.description ||
    "";
  const block = parseProductBlock(long);

  const head = `**${title}**${priceStr ? ` — ${priceStr}` : ""}`;
  const bullets = [];
  if (prod.availability_status)
    bullets.push(`- **Availability:** ${prod.availability_status}`);
  if (block.location) bullets.push(`- **Location:** ${block.location}`);
  if (block.participants) bullets.push(`- **Participants:** ${block.participants}`);
  if (block.time) bullets.push(`- **Time:** ${block.time}`);
  if (block.dates) bullets.push(`- **Dates:** ${block.dates}`);
  if (block.fitness) bullets.push(`- **Fitness:** ${block.fitness}`);

  const plain = sanitizeDesc(long);
  const bodyText = plain && !bullets.length ? `\n\n${plain}` : "";
  const bulletsText = bullets.length ? `\n\n${bullets.join("\n")}` : "";

  return head + bulletsText + bodyText + (url ? `\n\n[Open](${url})` : "");
}

/* Minimal event card (kept for other surfaces; NOT used in product panel anymore) */
function buildEventPanelMarkdown(ev) {
  if (!ev) return "";
  const title = ev.title || ev.raw?.name || "Upcoming Workshop";
  const when = ev.date_start ? new Date(ev.date_start).toUTCString() : null;
  const loc = ev.location || null;
  const url = pickUrl(ev) || null;

  const items = [`**${title}**`];
  if (loc) items.push(`- **Location:** ${loc}`);
  if (when) items.push(`- **When:** ${when}`);
  return items.join("\n") + (url ? `\n\n[View event](${url})` : "");
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
function buildEventPills(firstEvent, productOrNull) {
  const pills = [];
  const eventUrl = pickUrl(firstEvent);
  const productUrl = pickUrl(productOrNull);
  const bookUrl = productUrl || null;
  if (bookUrl) pills.push({ label: "Book Now", url: bookUrl, brand: "primary" });
  if (eventUrl) pills.push({ label: "View event", url: eventUrl, brand: "secondary" });
  pills.push({
    label: "Photos",
    url: "https://www.alanranger.com/photography-portfolio",
    brand: "secondary",
  });
  return pills;
}

/* Location filtering for events when query contains a place */
function filterEventsByLocationKeywords(events, keywords) {
  const locs = keywords.filter((k) => LOCATION_HINTS.includes(k.toLowerCase()));
  if (!locs.length) return events;
  return events.filter((e) => {
    const hay = (
      (e.title || "") +
      " " +
      (e.location || "") +
      " " +
      (pickUrl(e) || "")
    ).toLowerCase();
    return locs.some((l) => hay.includes(l));
  });
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

    const _fetch = await ensureFetch();           // <<< CHANGED
    const client = supabaseAdmin(_fetch);         // <<< CHANGED

    const health = await probeSupabaseHealth(_fetch); // <<< CHANGED

    const intent = detectIntent(q);
    const subtype = detectEventSubtype(q);
    const keywords = extractKeywords(q, intent, subtype);
    const topic = topicFromKeywords(keywords);

    let t_supabase = 0,
      t_rank = 0,
      t_comp = 0;

    const s1 = Date.now();
    let events = [],
      products = [],
      articles = [],
      landing = [];
    if (intent === "events") {
      [events, products, landing] = await Promise.all([
        findEvents(client, { keywords, topK: Math.max(10, topK + 2) }),
        findProducts(client, { keywords, topK: 24 }),
        findLanding(client, { keywords }),
      ]);

      if (subtype === "workshop") events = events.filter(isWorkshopEvent);
      else if (subtype === "course") events = events.filter(isCourseEvent);

      const locFiltered = filterEventsByLocationKeywords(events, keywords);
      if (locFiltered.length) events = locFiltered;

      try {
        articles = await findArticles(client, { keywords, topK: 12 });
      } catch {
        articles = [];
      }
    } else {
      [articles, products] = await Promise.all([
        findArticles(client, { keywords, topK: Math.max(12, topK) }),
        findProducts(client, { keywords, topK: 12 }),
      ]);
    }
    t_supabase += Date.now() - s1;

    // Enrich product list with canonical price + availability
    const allProdUrls = (products || []).map((p) => pickUrl(p)).filter(Boolean);
    const [priceMap, availMap] = await Promise.all([
      fetchDisplayPrices(client, allProdUrls),
      fetchAvailability(client, allProdUrls),
    ]);
    products = (products || []).map((p) => {
      const u = baseUrl(pickUrl(p));
      const priceRow = priceMap.get(u);
      const availRow = availMap.get(u);
      return {
        ...p,
        display_price_gbp: priceRow?.display_price_gbp ?? null,
        product_kind_resolved: priceRow?.product_kind ?? null,
        price_source: priceRow?.preferred_source ?? null,
        availability_status: availRow?.availability_status ?? null,
        availability_raw: availRow?.availability_raw ?? null,
        location_hint: availRow?.location_hint ?? null,
      };
    });

    const s2 = Date.now();
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

    const rankedEvents = (events || [])
      .slice()
      .sort(
        (a, b) =>
          (Date.parse(a.date_start || 0) || 0) -
          (Date.parse(b.date_start || 0) || 0)
      )
      .map((e) => ({
        ...e,
        _score: Math.round(scoreEntity(e, qTokens) * 100) / 100,
      }));

    let rankedProducts = scoreWrap(products);
    const rankedArticles = scoreWrap(articles).slice(0, 12);

    const firstEvent = rankedEvents[0] || null;
    t_rank += Date.now() - s2;

    /* =================== FEATURED PRODUCT from event mapping/view =================== */
    let featuredProduct = null;

    if (firstEvent) {
      const matched = await findBestProductForEvent(
        client,
        firstEvent,
        rankedProducts,
        subtype
      );
      if (matched && strictlyMatchesEvent(matched, firstEvent, subtype)) {
        featuredProduct = upgradeToRichestByUrl(rankedProducts, matched);

        // Ensure unified enrichment for the featured item too
        const u = baseUrl(pickUrl(featuredProduct));
        const priceRow = (await fetchDisplayPrices(client, [u])).get(u);
        const availRow = (await fetchAvailability(client, [u])).get(u);
        if (priceRow) {
          featuredProduct.display_price_gbp =
            priceRow.display_price_gbp ?? featuredProduct.display_price_gbp ?? null;
          featuredProduct.product_kind_resolved =
            priceRow.product_kind ?? featuredProduct.product_kind_resolved ?? null;
          featuredProduct.price_source =
            priceRow.preferred_source ?? featuredProduct.price_source ?? null;
        }
        if (availRow) {
          featuredProduct.availability_status =
            availRow.availability_status ?? featuredProduct.availability_status ?? null;
          featuredProduct.availability_raw =
            availRow.availability_raw ?? featuredProduct.availability_raw ?? null;
          featuredProduct.location_hint =
            availRow.location_hint ?? featuredProduct.location_hint ?? null;
        }
      }

      // Re-rank products for structured list (independent of panel gating)
      if (rankedProducts.length) {
        const evTokens = new Set(
          uniq([...titleTokens(firstEvent), ...urlTokens(firstEvent)])
        );
        rankedProducts = rankedProducts
          .map((p) => {
            const { f1 } = symmetricOverlap(evTokens, pickUrl(p), p.title);
            let s = (p._score || 0) + f1;
            if (sameHost(p, firstEvent)) s += 0.15;
            const anchors = productAnchorTokens(p);
            if (anchors.length) {
              if (anchors.some((a) => evTokens.has(a))) s += 0.4;
              else s -= 0.35;
            }
            if (/camera/i.test(firstEvent?.title || "") && /camera/i.test(p.title || ""))
              s += 0.2;

            // Penalties for off-topic
            const evtLower = lc(
              (firstEvent?.title || "") + " " + (pickUrl(firstEvent) || "")
            );
            if (/portrait/.test(lc(p.title || "")) && !/portrait/.test(evtLower))
              s -= 0.45;
            if (/(lightroom|editing)/.test(lc(p.title || "")) && !/(lightroom|editing)/.test(evtLower))
              s -= 0.45;
            if (
              /beginners[-\s]photography[-\s]course/.test(
                lc(((pickUrl(p) || "") + " " + (p.title || "")))
              )
            )
              s += 0.35;

            return { p, s };
          })
          .sort((a, b) => b.s - a.s)
          .map((x) => x.p);
      }
    }

    /* -------- Preferred product for structured payload only -------- */
    let preferredProduct = featuredProduct || rankedProducts[0] || null;
    preferredProduct = upgradeToRichestByUrl(rankedProducts, preferredProduct);

    if (preferredProduct) {
      const topUrl = baseUrl(pickUrl(preferredProduct));
      rankedProducts = [
        preferredProduct,
        ...rankedProducts.filter((p) => baseUrl(pickUrl(p)) !== topUrl),
      ];
    }

    /* =================== Compose =================== */
    const pricesForConf = [
      ...(rankedArticles[0]?._score ? [rankedArticles[0]._score] : []),
      ...(rankedEvents[0]?._score ? [rankedEvents[0]._score] : []),
      ...(rankedProducts[0]?._score ? [rankedProducts[0]._score] : []),
    ].map((x) => x / 100);
    const confidence_pct = confidenceFrom(pricesForConf);

    const s4 = Date.now();
    let answer_markdown = "";
    if (intent === "advice") {
      answer_markdown = buildAdviceMarkdown(rankedArticles);
    } else {
      // Product panel shows ONLY a product — never an event fallback
      if (
        firstEvent &&
        featuredProduct &&
        strictlyMatchesEvent(featuredProduct, firstEvent, subtype)
      ) {
        answer_markdown = buildProductPanelMarkdown(featuredProduct);
      } else {
        answer_markdown = "";
      }
    }
    t_comp += Date.now() - s4;

    const citations = uniq([
      ...rankedArticles.slice(0, 3).map(pickUrl),
      ...(featuredProduct &&
      strictlyMatchesEvent(featuredProduct, firstEvent, subtype)
        ? [pickUrl(featuredProduct)]
        : []),
      ...(firstEvent ? [pickUrl(firstEvent)] : []),
    ]);

    const structured = {
      intent,
      topic,
      event_subtype: subtype,
      events: (rankedEvents || []).map((e) => ({
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
      products: (rankedProducts || []).map((p) => {
        const long =
          p?.raw?.metaDescription ||
          p?.raw?.meta?.description ||
          p?.description ||
          "";
        const parsed = parseProductBlock(long);
        const priceNum = selectDisplayPriceNumber(p);
        const priceStr = formatDisplayPriceGBP(priceNum);
        return {
          id: p.id,
          title: p.title,
          page_url: p.page_url,
          source_url: p.source_url,
          description: p.description,
          price: p.price ?? null,
          price_gbp:
            p.display_price_gbp != null ? p.display_price_gbp : p.price_gbp ?? null,
          display_price_number: priceNum,
          display_price: priceStr,
          price_source: p.price_source || null,
          product_kind_resolved: p.product_kind_resolved || null,
          location: p.location,
          _score: p._score,
          availability_status: p.availability_status || null,
          availability_raw: p.availability_raw || null,
          location_parsed: parsed.location || null,
          participants_parsed: parsed.participants || null,
          time_parsed: parsed.time || null,
          dates_parsed: parsed.dates || null,
          fitness_parsed: parsed.fitness || null,
          location_hint: p.location_hint || null,
        };
      }),
      articles: (rankedArticles || []).map((a) => ({
        id: a.id,
        title: a.title,
        page_url: a.page_url,
        source_url: a.source_url,
        last_seen: a.last_seen,
      })),
      pills:
        intent === "events"
          ? buildEventPills(
              firstEvent,
              featuredProduct &&
                strictlyMatchesEvent(featuredProduct, firstEvent, subtype)
                ? featuredProduct
                : null
            )
          : buildAdvicePills(rankedArticles, q),
    };

    const debug = {
      version: "v1.1.1-unified-products", // <<< CHANGED (bump)
      intent,
      keywords,
      event_subtype: subtype,
      first_event: firstEvent
        ? {
            id: firstEvent.id,
            title: firstEvent.title,
            url: pickUrl(firstEvent),
            date_start: firstEvent.date_start,
          }
        : null,
      featured_product: featuredProduct
        ? {
            id: featuredProduct.id,
            title: featuredProduct.title,
            url: pickUrl(featuredProduct),
            strictly_matches_first_event: strictlyMatchesEvent(
              featuredProduct,
              firstEvent,
              subtype
            ),
            display_price: formatDisplayPriceGBP(
              selectDisplayPriceNumber(featuredProduct)
            ),
            availability_status: featuredProduct.availability_status || null,
            price_source: featuredProduct.price_source || null,
          }
        : null,
      pills: {
        book_now: structured.pills?.find((p) => p.label === "Book Now")?.url || null,
      },
      counts: {
        events: (structured.events || []).length,
        products: (structured.products || []).length,
        articles: (structured.articles || []).length,
      },
      probes: { supabase_health: health },
      views: {
        unified_view: "public.v_products_unified", // <<< CHANGED
        event_map_view: "public.v_event_product_links_all",
      },
    };

    const payload = {
      ok: true,
      answer_markdown,
      citations,
      structured,
      confidence: confidence_pct / 100,
      confidence_pct,
      debug,
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
