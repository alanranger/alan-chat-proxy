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

/** NEW: prefer event date in product panel when we have it */
function formatDateRangeUTC(startISO, endISO) {
  const s = startISO ? new Date(startISO) : null;
  const e = endISO ? new Date(endISO) : null;
  if (!s || isNaN(s)) return null;
  const sameDay =
    e && !isNaN(e)
      ? s.getUTCFullYear() === e.getUTCFullYear() &&
        s.getUTCMonth() === e.getUTCMonth() &&
        s.getUTCDate() === e.getUTCDate()
      : true;
  const fmt = (d) => d.toUTCString().slice(0, 16); // e.g. "Sat, 23 May 2026"
  return sameDay || !e || isNaN(e) ? fmt(s) : `${fmt(s)} – ${fmt(e)}`;
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

/* -------- Extended location synonyms & topic anchors -------- */
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
    if (prod && strictlyMatchesEvent(prod, firstEvent, subtype)) {
      return prod;
    }
  }

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
function buildAdviceMarkdown(articles) {
  const lines = ["**Guides**"];
  for (const a of (articles || []).slice(0, 5)) {
    const t = a.title || a.raw?.name || "Read more";
    const u = pickUrl(a);
    lines.push(`- ${t} — ${u ? `[Link](${u})` : ""}`.trim());
  }
  return lines.join("\n");
}
function buildProductPanelMarkdown(prod, opts = {}) {
  const { eventDateText = null } = opts; // NEW
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
  // Prefer event date (if provided) over parsed product copy
  if (eventDateText) bullets.push(`- **Dates:** ${eventDateText}`);
  else if (block.dates) bullets.push(`- **Dates:** ${block.dates}`);
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
function buildEventPills(firstEvent, productOrNull, fallbackProduct = null) {
  const pills = [];
  const eventUrl = pickUrl(firstEvent);
  const bookProduct = productOrNull || fallbackProduct;
  const productUrl = pickUrl(bookProduct);
  const bookUrl = productUrl || null;

  if (bookUrl) pills.push({ label: "Book now", url: bookUrl, brand: "primary" });
  if (eventUrl) pills.push({ label: "View event", url: eventUrl, brand: "secondary" });
  pills.push({
    label: "Photos",
    url: "https://www.alanranger.com/photography-portfolio",
    brand: "secondary",
  });
  return pills;
}

/* === location filtering with phrase support === */
function filterEventsByLocationKeywords(events, keywords, rawQuery) {
  const expanded = expandLocationKeywords(
    keywords.filter((k) => LOCATION_HINTS.includes(k.toLowerCase())),
    rawQuery
  );
  for (const phrase of LOCATION_HINTS) {
    if (lc(rawQuery).includes(lc(phrase))) expanded.push(lc(phrase));
  }
  const needles = Array.from(new Set(expanded));
  if (!needles.length) return events;

  return events.filter((e) => {
    const hay = (
      (e.title || "") +
      " " +
      (e.location || "") +
      " " +
      (pickUrl(e) || "")
    ).toLowerCase();
    return needles.some((l) => hay.includes(l));
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
    const client = supabaseAdmin();

    const health = await probeSupabaseHealth();

    const intent = detectIntent(q);
    const subtype = detectEventSubtype(q);
    const rawKeywords = extractKeywords(q, intent, subtype);
    const keywords = expandLocationKeywords(rawKeywords, q);
    const topic = topicFromKeywords(keywords);

    const queryHasLocationPhrase = hasAny(q, LOCATION_HINTS);
    const queryHasTopicAnchor = hasAny(q, TOPIC_ANCHORS);

    let t_supabase = 0, t_rank = 0, t_comp = 0;

    const s1 = Date.now();
    let events = [], products = [], articles = [];
    if (intent === "events") {
      [events, products] = await Promise.all([
        findEvents(client, { keywords, topK: Math.max(10, topK + 2) }),
        findProducts(client, { keywords, topK: 24 }),
      ]);

      if (subtype === "workshop") events = events.filter(isWorkshopEvent);
      else if (subtype === "course") events = events.filter(isCourseEvent);

      const locFiltered = filterEventsByLocationKeywords(events, keywords, q);
      if (locFiltered.length) events = locFiltered;

      try {
        articles = await findArticles(client, { keywords, topK: 6 });
      } catch {
        articles = [];
      }

      // Hard-filter products by subtype to avoid wrong services.
      if (subtype === "course") {
        products = (products || []).filter(isCourseProduct);
      } else if (subtype === "workshop") {
        products = (products || []).filter(isWorkshopProduct);
      }
    } else {
      [articles, products] = await Promise.all([
        findArticles(client, { keywords, topK: Math.max(12, topK) }),
        findProducts(client, { keywords, topK: 12 }),
      ]);
    }
    t_supabase += Date.now() - s1;

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
      };
    });

    const s2 = Date.now();
    const qTokens = keywords;

    const scoreWrap = (arr) =>
      (arr || [])
        .map((e) => {
          let s = scoreEntity(e, qTokens);
          const hay = lc(
            (e?.title || e?.raw?.name || "") +
              " " +
              (pickUrl(e) || "") +
              " " +
              (e?.description || e?.raw?.metaDescription || e?.raw?.meta?.description || "")
          );
          if (queryHasLocationPhrase && hasAny(hay, LOCATION_HINTS)) s += 0.12;
          if (queryHasTopicAnchor && hasAny(hay, TOPIC_ANCHORS)) s += 0.12;
          return { e, s };
        })
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
      .map((e) => {
        let s = scoreEntity(e, qTokens);
        const hay = lc(
          (e?.title || e?.raw?.name || "") +
            " " +
            (e?.location || "") +
            " " +
            (pickUrl(e) || "")
        );
        if (queryHasLocationPhrase && hasAny(hay, LOCATION_HINTS)) s += 0.15;
        if (queryHasTopicAnchor && hasAny(hay, TOPIC_ANCHORS)) s += 0.12;
        return { ...e, _score: Math.round(Math.min(1, s) * 100) / 100 };
      });

    let rankedProducts = scoreWrap(products);
    const rankedArticles = scoreWrap(articles).slice(0, 12);

    const firstEvent = rankedEvents[0] || null;
    t_rank += Date.now() - s2;

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
        }
      }

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

            const evtLower = lc(
              (firstEvent?.title || "") + " " + (pickUrl(firstEvent) || "")
            );
            if (/portrait/.test(lc(p.title || "")) && !/portrait/.test(evtLower)) s -= 0.45;
            if (/(lightroom|editing)/.test(lc(p.title || "")) && !/(lightroom|editing)/.test(evtLower)) s -= 0.45;

            const slug = lc(((pickUrl(p) || "") + " " + (p.title || "")));
            if (/beginners[-\s]photography[-\s]course/.test(slug)) s += 0.35;
            if (hasAny(slug, TOPIC_ANCHORS)) s += 0.1;

            return { p, s };
          })
          .sort((a, b) => b.s - a.s)
          .map((x) => x.p);
      }
    }

    let preferredProduct = featuredProduct || rankedProducts[0] || null;
    preferredProduct = upgradeToRichestByUrl(rankedProducts, preferredProduct);

    if (preferredProduct) {
      const topUrl = baseUrl(pickUrl(preferredProduct));
      rankedProducts = [
        preferredProduct,
        ...rankedProducts.filter((p) => baseUrl(pickUrl(p)) !== topUrl),
      ];
    }

    const hasStrictProduct =
      !!(featuredProduct && strictlyMatchesEvent(featuredProduct, firstEvent, subtype));

    // ✅ Always provide a fallback product for the pill if strict match is missing
    const fallbackProductCandidate =
      !hasStrictProduct && rankedProducts.length ? rankedProducts[0] : null;

    const scoresForConf = [
      ...(rankedArticles[0]?._score ? [rankedArticles[0]._score] : []),
      ...(rankedEvents[0]?._score ? [rankedEvents[0]._score] : []),
      ...(rankedProducts[0]?._score ? [rankedProducts[0]._score] : []),
    ].map((x) => x / 100);
    const confidence_pct = confidenceFrom(scoresForConf);

    const s4 = Date.now();
    let answer_markdown = "";
    if (intent === "advice") {
      answer_markdown = buildAdviceMarkdown(rankedArticles);
    } else {
      if (hasStrictProduct) {
        // NEW: pass the event date so the product panel shows the correct dates
        const eventDateText = formatDateRangeUTC(firstEvent?.date_start, firstEvent?.date_end);
        answer_markdown = buildProductPanelMarkdown(featuredProduct, { eventDateText });
      } else if (firstEvent) {
        answer_markdown = buildEventPanelMarkdown(firstEvent);
      } else {
        answer_markdown = "";
      }
    }
    t_comp += Date.now() - s4;

    const citations = uniq([
      ...rankedArticles.slice(0, 3).map(pickUrl),
      ...(hasStrictProduct ? [pickUrl(featuredProduct)] : []),
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
              rankedEvents[0] || null,
              hasStrictProduct ? featuredProduct : null,
              fallbackProductCandidate
            )
          : buildAdvicePills(rankedArticles, q),
    };

    const debug = {
      version: "v1.1.5-clean5",
      intent,
      keywords,
      event_subtype: subtype,
      anchor_flags: {
        queryHasLocationPhrase,
        queryHasTopicAnchor,
      },
      first_event: rankedEvents[0]
        ? {
            id: rankedEvents[0].id,
            title: rankedEvents[0].title,
            url: pickUrl(rankedEvents[0]),
            date_start: rankedEvents[0].date_start,
          }
        : null,
      featured_product: featuredProduct
        ? {
            id: featuredProduct.id,
            title: featuredProduct.title,
            url: pickUrl(featuredProduct),
            strictly_matches_first_event: strictlyMatchesEvent(
              featuredProduct,
              rankedEvents[0],
              subtype
            ),
            display_price: formatDisplayPriceGBP(
              selectDisplayPriceNumber(featuredProduct)
            ),
            availability_status: featuredProduct.availability_status || null,
            price_source: featuredProduct.price_source || null,
          }
        : null,
      strict_product_gate: hasStrictProduct,
      fallback_product_for_pill: fallbackProductCandidate
        ? { id: fallbackProductCandidate.id, title: fallbackProductCandidate.title, url: pickUrl(fallbackProductCandidate) }
        : null,
      pills: {
        book_now:
          structured.pills?.find((p) => p.label.toLowerCase() === "book now")?.url ||
          null,
      },
      counts: {
        events: (structured.events || []).length,
        products: (structured.products || []).length,
        articles: (structured.articles || []).length,
      },
      probes: { supabase_health: health },
      views: {
        price_view: "public.v_product_display",
        availability_view: "public.v_product_availability (optional)",
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
