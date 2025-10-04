// /api/chat.js

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

function supabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: { fetch },
  });
}

async function probeSupabaseHealth() {
  const url = `${String(SUPABASE_URL).replace(/\/+$/, "")}/auth/v1/health`;
  const out = { url, ok: false, status: null, error: null };
  try {
    const resp = await fetch(url);
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
  return e?.event_url || e?.page_url || e?.source_url || e?.url || null;
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
  return String(t || "").replace(/\d+$/, "").replace(/ers$/, "er");
}
function lc(s) {
  return String(s || "").toLowerCase();
}
function hasAny(hay, list) {
  if (!hay) return false;
  const h = lc(hay);
  return (list || []).some((x) => h.includes(lc(x)));
}

const GENERIC = new Set([
  "alan","ranger","photography","photo","workshop","workshops","course","courses",
  "class","classes","tuition","lesson","lessons","uk","england","blog","near","me",
  "photographic","landscape","seascape","monthly","day","days","one","two","1","2",
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
  
  // Check for follow-up questions first
  if (/^(how many|what|when|where|how much|how long|can i|do you|is there)/i.test(s)) {
    // If it's a follow-up question, check if it's about events/workshops
    if (s.includes("people") || s.includes("attend") || s.includes("participants") || 
        s.includes("cost") || s.includes("price") || s.includes("when") || s.includes("where")) {
      return "events"; // Treat as event-related follow-up
    }
  }
  
  const eventish =
    /\b(when|date|dates|where|location|next|upcoming|availability|available|schedule|book|booking|time|how much|price|cost)\b/;
  const classish =
    /\b(workshop|course|class|tuition|lesson|lessons|photowalk|walk|masterclass)\b/;
  return eventish.test(s) && classish.test(s) ? "events" : "advice";
}
function detectEventSubtype(q) {
  const s = String(q || "").toLowerCase();
  if (/\b(course|courses|class|classes|tuition|lesson|lessons|beginner|beginners)\b/.test(s))
    return "course";
  if (/\b(workshop|workshops|photowalk|walk|masterclass)\b/.test(s))
    return "workshop";
  return null;
}

const STOPWORDS = new Set([
  "the","and","or","what","whats","when","whens","next","cost","how","much",
  "workshop","workshops","photography","photo","near","me","uk","class","classes",
  "course","courses","where","location","dates","date","upcoming","available",
  "availability","book","booking","time",
]);

function extractKeywords(q, intent, subtype) {
  const tokens = tokenize(String(q || ""));
  const kept = tokens
    .map(normaliseToken)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  
  // For event queries, be more permissive - include location and topic words
  if (intent === "events" && kept.length === 0) {
    const eventTokens = tokens
      .map(normaliseToken)
      .filter((t) => t.length >= 3);
    if (eventTokens.length > 0) {
      return eventTokens;
    }
  }
  
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
  return clauses;
}

async function findEvents(client, { keywords = [], topK = 12 } = {}) {
  let q = client.from("v_events_for_chat").select("*");
  q = q.gte("date_start", new Date().toISOString());
  if (keywords.length) {
    const orClauses = buildOrIlike(
      [
        "event_title",
        "event_url",
        "event_location",
      ],
      keywords
    );
    q = q.or(orClauses.join(","));
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
      ).join(",")
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
      ).join(",")
    );
  q = q.order("last_seen", { ascending: false }).limit(topK);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/* ================= Views: display price + availability ================= */
async function fetchDisplayPrices(client, productUrls = []) {
  const urls = uniq((productUrls || []).map(baseUrl)).filter(Boolean);
  if (!urls.length) return new Map();
  const { data, error } = await client
    .from("v_product_display")
    .select("product_url, display_price_gbp, product_kind, preferred_source")
    .in("product_url", urls);
  if (error) return new Map();
  const map = new Map();
  for (const row of data || []) {
    map.set(baseUrl(row.product_url), {
      display_price_gbp: row.display_price_gbp,
      preferred_source: row.preferred_source || null,
      product_kind: row.product_kind || null,
    });
  }
  return map;
}
async function fetchAvailability(client, productUrls = []) {
  const urls = uniq((productUrls || []).map(baseUrl)).filter(Boolean);
  if (!urls.length) return new Map();
  try {
    const { data, error } = await client
      .from("v_product_availability")
      .select("product_url, availability_status, availability_raw")
      .in("product_url", urls);
    if (error) return new Map();
    const map = new Map();
    for (const row of data || []) {
      map.set(baseUrl(row.product_url), {
        availability_status: row.availability_status || null,
        availability_raw: row.availability_raw || null,
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

/* ================= Matching helpers ================= */
function isWorkshopEvent(e) {
  const u = (pickUrl(e) || e?.event_url || "").toLowerCase();
  const t = (e?.event_title || e?.title || e?.raw?.name || "").toLowerCase();
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
  const u = (pickUrl(e) || e?.event_url || "").toLowerCase();
  const t = (e?.event_title || e?.title || e?.raw?.name || "").toLowerCase();
  const hasCourse = /(lesson|lessons|tuition|course|courses|class|classes)/.test(
    u + " " + t
  );
  const looksWorkshop = /workshop/.test(u + " " + t);
  return hasCourse && !looksWorkshop;
}
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

const LOCATION_HINTS = [
  "devon","hartland","dartmoor","yorkshire","dales","kenilworth","coventry",
  "warwickshire","anglesey","wales","betws","snowdonia","northumberland",
  "gloucestershire","batsford","chesterton","windmill","lynmouth","exmoor","quay",
  "north devon","hartland quay","lynmouth harbour","betws-y-coed","yorkshire dales",
  "snowdonia national park",
];

const TOPIC_ANCHORS = ["seascape","woodland","moor","long exposure"];

function expandLocationKeywords(keywords = [], rawQuery = "") {
  const set = new Set();
  const rq = lc(String(rawQuery || ""));

  for (const phrase of LOCATION_HINTS) {
    if (rq.includes(lc(phrase))) set.add(lc(phrase));
  }

  for (const k of keywords) {
    const t = k.toLowerCase();
    if (t === "kenilworth") {
      set.add("kenilworth"); set.add("coventry"); set.add("warwickshire");
    } else if (t === "coventry") {
      set.add("coventry"); set.add("kenilworth"); set.add("warwickshire");
    } else if (t === "warwickshire") {
      set.add("warwickshire"); set.add("coventry"); set.add("kenilworth");
    } else if (t === "devon") {
      set.add("devon"); set.add("north devon"); set.add("hartland"); set.add("hartland quay"); set.add("lynmouth"); set.add("lynmouth harbour");
    } else if (t === "yorkshire") {
      set.add("yorkshire"); set.add("yorkshire dales");
    } else if (t === "betws") {
      set.add("betws"); set.add("betws-y-coed");
    } else if (t === "snowdonia") {
      set.add("snowdonia"); set.add("snowdonia national park");
    } else {
      set.add(t);
    }
  }
  return Array.from(set);
}

function extractTopicAndLocationTokensFromEvent(ev) {
  const t = titleTokens(ev);
  const u = urlTokens(ev);
  const all = uniq([...t, ...u]);
  const locFromField = nonGenericTokens(ev?.location || "");
  const locationHints = uniq(
    [...all, ...locFromField].filter((x) =>
      /(kenilworth|coventry|warwickshire|dartmoor|devon|hartland|anglesey|yorkshire|dales|wales|betws|snowdonia|northumberland|batsford|gloucestershire|chesterton|windmill|lynmouth|exmoor|quay|north|harbour|dales)/.test(
        x
      )
    )
  );
  const topicHints = all.filter((x) => !locationHints.includes(x));
  return { all, topic: uniq(topicHints), location: uniq(locationHints) };
}

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

function productAnchorTokens(prod) {
  const title = prod?.title || "";
  const tokens = titleTokens({ title });
  return tokens.filter((t) => t.length >= 5 && !LOCATION_HINTS.includes(t));
}

function preferRicherProduct(a, b) {
  if (!a) return b;
  if (!b) return a;
  const au = baseUrl(pickUrl(a)), bu = baseUrl(pickUrl(b));
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

function monthIdx(m) {
  const s = lc(m).slice(0, 3);
  const map = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  return s in map ? map[s] : null;
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

async function findBestProductForEvent(client, firstEvent, preloadProducts = [], subtype = null) {
  if (!firstEvent) return null;

  // 1) Trust explicit mapping if present (no strict gating)
  const evUrl = pickUrl(firstEvent);
  const mapped = await resolveEventProductByView(client, evUrl);
  if (mapped) {
    let prod =
      (preloadProducts || []).find((p) => baseUrl(pickUrl(p)) === baseUrl(mapped)) ||
      null;
    if (!prod) {
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
    if (prod) {
      // VALIDATION: Check if mapped product actually matches the event topic
      const eventTitle = (firstEvent?.event_title || firstEvent?.title || "").toLowerCase();
      const productTitle = (prod?.title || "").toLowerCase();
      
      // If event is about bluebell but product is not, skip the mapping
      if (eventTitle.includes("bluebell") && !productTitle.includes("bluebell")) {
        console.log("Skipping bad mapping: bluebell event -> non-bluebell product");
        prod = null;
      } else {
        // mark provenance so downstream treats it as approved
        prod._matched_via = "mapping";
        return prod;
      }
    }
  }

  // 2) Heuristic fallback (unchanged)
  const { topic, location, all } = extractTopicAndLocationTokensFromEvent(firstEvent);
  const refCore = uniq([...(location || []), ...(topic || [])]);
  const refTokens = new Set(refCore.length ? refCore : all);
  const needLoc = location.length ? location : [];

  const kindAlign = (p) => {
    if (!subtype) return true;
    if (subtype === "course") return isCourseProduct(p);
    if (subtype === "workshop") return isWorkshopProduct(p);
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
    if (!anchors.some((a) => refTokens.has(a))) return false;

    const { f1 } = symmetricOverlap(refTokens, u, t);
    return f1 >= 0.3;
  };

  let candidates = (preloadProducts || []).filter(pass);
  if (candidates.length) {
    const ranked = candidates
      .map((p) => {
        const { f1 } = symmetricOverlap(refTokens, pickUrl(p), p.title);
        let s = f1;
        if (sameHost(p, firstEvent)) s += 0.1;
        if (hasAny(lc((p.title||"") + " " + (pickUrl(p)||"")), TOPIC_ANCHORS)) s += 0.1;
        return { p, s };
      })
      .sort((a, b) => b.s - a.s);
    if (ranked[0]?.p) return ranked[0].p;
  }

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
        if (hasAny(lc((p.title||"") + " " + (pickUrl(p)||"")), TOPIC_ANCHORS)) s += 0.1;
        return { p, s };
      })
      .sort((a, b) => b.s - a.s);
    if (ranked[0]?.p) return ranked[0].p;
  }

  return null;
}

function extraScore(p, base) {
  let s = base;
  const slug = lc(((pickUrl(p) || "") + " " + (p.title || "")));
  if (/beginners[-\s]photography[-\s]course/.test(slug)) s += 0.35;
  if (hasAny(slug, TOPIC_ANCHORS)) s += 0.1;
  return s;
}

/* ================= Product & Event panel rendering ================= */
function selectDisplayPriceNumber(prod) {
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
function sanitizeDesc(s) {
  if (!s || typeof s !== "string") return "";
  let out = s;
  out = out.replace(/<br\s*\/?>/gi, "\n");
  out = out.replace(/<\/p>/gi, "\n");
  out = out.replace(/<\/li>/gi, "\n");
  out = out.replace(/<li[^>]*>/gi, "• ");
  out = out.replace(/\s+[a-z-]+="[^"]*"/gi, "");
  out = out.replace(/&nbsp;|&#160;/gi, " ");
  out = out.replace(/&amp;/gi, "&");
  out = out.replace(/\u2013|\u2014/g, "-");
  out = out.replace(/<[^>]*>/g, " ");
  out = out.replace(/[ \t\f\v]+/g, " ");
  out = out.replace(/\s*\n\s*/g, "\n");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}
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
async function generateIntelligentResponse({ query, intent, events, products, articles, featuredProduct, firstEvent, isSimpleFollowUp }) {
  // Create a comprehensive data context from all retrieved information
  const dataContext = buildDataContext({ events, products, articles, featuredProduct, firstEvent });
  
  // Use RAG to generate intelligent response based on query and data context
  const response = await generateRAGResponse(query, dataContext, intent);
  
  return response;
}

function buildDataContext({ events, products, articles, featuredProduct, firstEvent }) {
  return {
    events: events || [],
    products: products || [],
    articles: articles || [],
    featuredProduct: featuredProduct || null,
    firstEvent: firstEvent || null
  };
}

function isSimpleFollowUp(query) {
  const followUpPatterns = /^(how many|what|when|where|how much|how long|can i|do you|is there|what time|what's the|how do i)/i;
  return followUpPatterns.test(query.trim());
}

async function generateRAGResponse(query, dataContext, intent) {
  console.log(`🤖 RAG: Processing "${query}" | Intent=${intent} | SimpleFollowUp=${isSimpleFollowUp(query)}`);
  
  // For simple follow-up questions, use extracted information to answer directly
  if (isSimpleFollowUp(query)) {
    return await generateDirectAnswer(query, dataContext);
  }
  
  // For event/product queries, determine the best response format based on available data
  if (intent === "events") {
    return generateEventResponse(query, dataContext);
  } else if (intent === "advice") {
    return generateAdviceResponse(query, dataContext);
  }
  
  // Fallback to general response
  return generateGeneralResponse(query, dataContext);
}

async function generateDirectAnswer(query, dataContext) {
  console.log(`🎯 RAG: Direct answer for "${query}" | Products=${dataContext.products?.length || 0}`);
  
  // Use AI to intelligently extract relevant information from the data context
  const relevantInfo = await extractRelevantInfo(query, dataContext);
  
  if (relevantInfo) {
    console.log(`✅ RAG: Returning answer="${relevantInfo}"`);
    return `**${relevantInfo}**`;
  }
  
  console.log('❌ RAG: No relevant info found, using fallback');
  // If no specific information found, provide a helpful response
  return `I don't have a confident answer to that yet. I'm trained on Alan's site, so I may miss things. If you'd like to follow up, please reach out:`;
}

async function extractRelevantInfo(query, dataContext) {
  const { products, events, articles } = dataContext;
  const lowerQuery = query.toLowerCase();
  
  // Search through all available data sources for relevant information
  const allData = [...(products || []), ...(events || []), ...(articles || [])];
  
  // Check if this is a participant question
  const isParticipantQuestion = (lowerQuery.includes('how many') && (lowerQuery.includes('people') || lowerQuery.includes('attend'))) ||
                               lowerQuery.includes('participants') || lowerQuery.includes('capacity');
  
  console.log(`🔍 RAG: Query="${query}" | ParticipantQ=${isParticipantQuestion} | Data=${allData.length} items`);
  
  if (isParticipantQuestion) {
    // Look for participant data in first few items only
    const sampleItems = allData.slice(0, 3);
    console.log(`🔍 RAG: Checking ${sampleItems.length} items for participants`);
    
    for (const item of sampleItems) {
      const participants = item.participants_parsed || item.participants;
      
      if (participants && participants.trim().length > 0) {
        console.log(`✅ RAG: Found participants="${participants}" in "${item.title?.substring(0, 30)}..."`);
        return participants.replace(/\n•/g, '').trim();
      }
    }
    
    console.log('❌ RAG: No participant data found in sample items');
  }
  
  // Check for other types of information (location, price, etc.)
  const sampleItems = allData.slice(0, 2); // Only check first 2 items for other info
  for (const item of sampleItems) {
    // Check for location information
    if (lowerQuery.includes('where') || lowerQuery.includes('location')) {
      const location = item.location_parsed || item.location;
      if (location) {
        console.log(`✅ RAG: Found location="${location}"`);
        return location.replace(/\n•/g, '').trim();
      }
    }
    
    // Check for price information
    if (lowerQuery.includes('how much') || lowerQuery.includes('price') || lowerQuery.includes('cost')) {
      const price = item.display_price || item.price_gbp || item.price;
      if (price) {
        console.log(`✅ RAG: Found price="${price}"`);
        return `£${price}`;
      }
    }
    
    // Check for date/time information
    if (lowerQuery.includes('when') || lowerQuery.includes('date') || lowerQuery.includes('time')) {
      const date = item.date_start || item.dates_parsed;
      if (date) {
        console.log(`✅ RAG: Found date="${date}"`);
        return new Date(date).toLocaleDateString();
      }
    }
  }
  
  return null;
}

function generateEventResponse(query, dataContext) {
  if (dataContext.featuredProduct) {
    return buildProductPanelMarkdown(dataContext.featuredProduct);
  } else if (dataContext.firstEvent) {
    return buildEventPanelMarkdown(dataContext.firstEvent);
  } else {
    return "";
  }
}

function generateAdviceResponse(query, dataContext) {
  return buildAdviceMarkdown(dataContext.articles);
}

function generateGeneralResponse(query, dataContext) {
  // For general queries, provide the most relevant information
  if (dataContext.featuredProduct) {
    return buildProductPanelMarkdown(dataContext.featuredProduct);
  } else if (dataContext.firstEvent) {
    return buildEventPanelMarkdown(dataContext.firstEvent);
  } else if (dataContext.articles.length > 0) {
    return buildAdviceMarkdown(dataContext.articles);
  } else {
    return "";
  }
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

  return head + bulletsText + bodyText + (url ? `\n\n[Book now →](${url})` : "");
}
function buildEventPanelMarkdown(ev) {
  if (!ev) return "";
  const title = ev.title || ev.raw?.name || "Upcoming Workshop";
  const when = ev.date_start ? new Date(ev.date_start).toUTCString() : null;
  const loc = ev.locatio
