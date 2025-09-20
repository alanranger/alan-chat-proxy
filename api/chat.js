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
const SELECT_COLS = "id, kind, title, page_url, source_url, last_seen, location, date_start, date_end, price, description, raw";

function pickUrl(e) { return e?.page_url || e?.source_url || e?.url || null; }
function baseUrl(u) { return String(u || "").split("?")[0]; }
function uniq(arr) { return Array.from(new Set((arr || []).filter(Boolean))); }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function tokenize(s) { return (s || "").toLowerCase().match(/[a-z0-9]+/g) || []; }
function normaliseToken(t) { return String(t || "").replace(/\d+$/, ""); }

const GENERIC = new Set([
  "alan","ranger","photography","photo","workshop","workshops","course","courses",
  "class","classes","tuition","lesson","lessons","uk","england","blog","near","me",
  "photographic","landscape","seascape","monthly","day","days","one","two","1","2"
]);

function nonGenericTokens(str) {
  return (tokenize(str) || [])
    .map(normaliseToken)
    .filter(t => t.length >= 3 && !GENERIC.has(t));
}
function titleTokens(x) {
  return (tokenize((x?.title || x?.raw?.name || "")) || [])
    .map(normaliseToken)
    .filter(t => t.length >= 3 && !GENERIC.has(t));
}
function urlTokens(x) {
  const u = (pickUrl(x) || "").toLowerCase();
  return (tokenize(u.replace(/^https?:\/\//, "").replace(/[\/_-]+/g, " ")) || [])
    .map(normaliseToken)
    .filter(t => t.length >= 3 && !GENERIC.has(t));
}
function sameHost(a, b) {
  try {
    const ha = new URL(pickUrl(a)).host;
    const hb = new URL(pickUrl(b)).host;
    return ha && hb && ha === hb;
  } catch { return false; }
}

/* ================= Intent & Keywords ================= */
function detectIntent(q) {
  const s = String(q || "").toLowerCase();
  const eventish = /\b(when|date|dates|where|location|next|upcoming|availability|available|schedule|book|booking|time|how much|price|cost)\b/;
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
  "the","and","or","what","whats","when","whens","next","cost","how","much",
  "workshop","workshops","photography","photo","near","me","uk",
  "class","classes","course","courses",
  "where","location","dates","date","upcoming","available","availability",
  "book","booking"
]);

function extractKeywords(q, intent, subtype) {
  const tokens = tokenize(String(q || ""));
  const kept = tokens.map(normaliseToken).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  if (!kept.length) return [intent === "events" ? (subtype === "course" ? "course" : "workshop") : "photography"];
  return uniq(kept);
}
function topicFromKeywords(kws) { return uniq(kws).join(", "); }

/* ================= Scoring ================= */
function jaccard(a, b) { const A = new Set(a), B = new Set(b); let inter = 0; for (const x of A) if (B.has(x)) inter++; const union = A.size + B.size - inter; return union ? inter / union : 0; }
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
async function findEvents(client, { keywords = [], topK = 12 } = {}) {
  let q = client.from("page_entities").select(SELECT_COLS).eq("kind", "event");
  q = q.gte("date_start", new Date().toISOString());
  if (keywords.length) {
    q = q.or(buildOrIlike(
      ["title", "page_url", "location", "description", "raw->>metaDescription", "raw->meta->>description"],
      keywords
    ));
  }
  q = q.order("date_start", { ascending: true }).limit(topK);
  const { data, error } = await q; if (error) throw error; return data || [];
}

function buildOrIlike(keys, keywords) {
  const clauses = [];
  for (const k of keywords) for (const col of keys) clauses.push(`${col}.ilike.%${k}%`);
  return clauses.join(",");
}

async function findProducts(client, { keywords = [], topK = 12 } = {}) {
  let q = client.from("page_entities").select(SELECT_COLS).eq("kind", "product");
  if (keywords.length) q = q.or(buildOrIlike(["title", "page_url", "description", "raw->>metaDescription", "raw->meta->>description"], keywords));
  q = q.order("last_seen", { ascending: false }).limit(topK);
  const { data, error } = await q; if (error) throw error; return data || [];
}
async function findArticles(client, { keywords = [], topK = 12 } = {}) {
  let q = client.from("page_entities").select(SELECT_COLS).in("kind", ["article", "blog", "page"]);
  if (keywords.length) q = q.or(buildOrIlike(["title", "page_url", "description", "raw->>metaDescription", "raw->meta->>description"], keywords));
  q = q.order("last_seen", { ascending: false }).limit(topK);
  const { data, error } = await q; if (error) throw error; return data || [];
}
async function findLanding(client, { keywords = [] } = {}) {
  let q = client.from("page_entities").select(SELECT_COLS)
    .in("kind", ["article", "page"]).eq("raw->>canonical", "true").eq("raw->>role", "landing");
  if (keywords.length) q = q.or(buildOrIlike(["title", "page_url", "description", "raw->>metaDescription", "raw->meta->>description"], keywords));
  q = q.order("last_seen", { ascending: false }).limit(3);
  const { data, error } = await q; if (error) throw error; return data || [];
}

/* ================= Matching helpers ================= */
function isWorkshopEvent(e) {
  const u = (pickUrl(e) || "").toLowerCase(); const t = (e?.title || e?.raw?.name || "").toLowerCase();
  const hasWorkshop = /workshop/.test(u) || /workshop/.test(t) || /photo-workshops-uk|photographic-workshops/.test(u);
  const looksCourse = /(lesson|lessons|tuition|course|courses|class|classes)/.test(u + " " + t);
  return hasWorkshop && !looksCourse;
}
function isCourseEvent(e) {
  const u = (pickUrl(e) || "").toLowerCase(); const t = (e?.title || e?.raw?.name || "").toLowerCase();
  const hasCourse = /(lesson|lessons|tuition|course|courses|class|classes)/.test(u + " " + t);
  const looksWorkshop = /workshop/.test(u + " " + t);
  return hasCourse && !looksWorkshop;
}

/* Product kind (kept generic) */
function isWorkshopProduct(p) {
  const u = (pickUrl(p) || "").toLowerCase(); const t = (p?.title || "").toLowerCase();
  const hasWorkshop = /workshop/.test(u + " " + t) || /photo-workshops-uk|photographic-workshops/.test(u);
  const looksCourse = /(lesson|lessons|tuition|course|courses|class|classes)/.test(u + " " + t);
  return hasWorkshop && !looksCourse;
}
function isCourseProduct(p) {
  const u = (pickUrl(p) || "").toLowerCase(); const t = (p?.title || "").toLowerCase();
  const hasCourse = /(lesson|lessons|tuition|course|courses|class|classes)/.test(u + " " + t);
  const looksWorkshop = /workshop/.test(u + " " + t);
  return hasCourse && !looksWorkshop;
}

/* Location hints used elsewhere too */
const LOCATION_HINTS = [
  "devon","hartland","dartmoor","yorkshire","dales","kenilworth","coventry",
  "warwickshire","anglesey","wales","betws","snowdonia","northumberland",
  "gloucestershire","batsford","chesterton","windmill","lynmouth","exmoor","quay"
];

/* ---- extract tokens from the first event ---- */
function extractTopicAndLocationTokensFromEvent(ev) {
  const t = titleTokens(ev);
  const u = urlTokens(ev);
  const all = uniq([...t, ...u]);
  const locFromField = nonGenericTokens(ev?.location || "");
  const locationHints = uniq(
    [...all, ...locFromField].filter(x =>
      /(kenilworth|coventry|warwickshire|dartmoor|devon|hartland|anglesey|yorkshire|dales|wales|betws|snowdonia|northumberland|batsford|gloucestershire|chesterton|windmill|lynmouth|exmoor|quay)/.test(x)
    )
  );
  const topicHints = all.filter(x => !locationHints.includes(x));
  return { all, topic: uniq(topicHints), location: uniq(locationHints) };
}

/* ---- similarity helpers ---- */
function symmetricOverlap(eventTokens, url, title) {
  const pTokens = new Set([
    ...tokenize(String(url || "").replace(/^https?:\/\//, "").replace(/[\/_-]+/g, " ")),
    ...tokenize(String(title || ""))
  ].map(normaliseToken).filter(x => x.length >= 3 && !GENERIC.has(x)));

  const eTokens = new Set(eventTokens);
  let inter = 0;
  for (const tk of eTokens) if (pTokens.has(tk)) inter++;

  const eSize = eTokens.size || 1;
  const pSize = pTokens.size || 1;

  const recall = inter / eSize;
  const precision = inter / pSize;
  const f1 = (precision + recall) ? (2 * precision * recall) / (precision + recall) : 0;
  return { f1, pTokens };
}

/* ---- derive 'anchor' tokens from a product title (distinctive words) ---- */
function productAnchorTokens(prod) {
  const title = prod?.title || "";
  const tokens = titleTokens({ title });
  return tokens.filter(t =>
    t.length >= 5 &&
    !LOCATION_HINTS.includes(t) &&
    t !== "beginners" && t !== "beginner" // prevent generic overlap that caused Lightroom to match
  );
}

/* ---- domain anchor mapping (camera vs lightroom vs portrait etc.) ---- */
const DOMAIN_ANCHORS = {
  camera: new Set(["camera","dslr","mirrorless"]),
  lightroom: new Set(["lightroom","editing","post","postproduction","develop"]),
  portrait: new Set(["portrait","headshot"]),
  landscape: new Set(["landscape","seascape"]),
  monochrome: new Set(["black","white","monochrome","bw","b+w"])
};
function mapToAnchors(tokens) {
  const hits = new Set();
  for (const tk of tokens) {
    for (const [key, set] of Object.entries(DOMAIN_ANCHORS)) {
      if (set.has(tk)) hits.add(key);
    }
  }
  return hits;
}
function eventAnchors(ev) {
  const evTokens = uniq([...titleTokens(ev), ...urlTokens(ev)]);
  return mapToAnchors(evTokens);
}
function productAnchors(p) {
  const pTokens = uniq([...titleTokens(p), ...urlTokens(p)]);
  return mapToAnchors(pTokens);
}

/* ===== prefer richer duplicate rows for the same product URL ===== */
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
  const same = (allProducts || []).filter(p => baseUrl(pickUrl(p)) === url);
  return same.reduce(preferRicherProduct, chosen);
}

/** Try hard to find a product URL for the first event; require anchor alignment. */
async function findBestProductForEvent(client, firstEvent, preloadProducts = [], subtype = null) {
  if (!firstEvent) return null;

  const { topic, location, all } = extractTopicAndLocationTokensFromEvent(firstEvent);
  const refCore = uniq([...(location || []), ...(topic || [])]);
  const refTokens = new Set(refCore.length ? refCore : all);
  const needLoc = location.length ? location : [];
  const evAnch = eventAnchors(firstEvent); // e.g. {"camera"}

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

    const hasLoc = !needLoc.length || needLoc.some(l => u.toLowerCase().includes(l) || t.toLowerCase().includes(l));
    if (!hasLoc) return false;

    // STRICT domain-anchor intersection (prevents Lightroom when the event is a Camera course)
    const pAnch = productAnchors(p);
    const hasAnchorHit = [...pAnch].some(a => evAnch.has(a));
    if (!hasAnchorHit) return false;

    const { f1 } = symmetricOverlap(refTokens, u, t);
    return f1 >= 0.30; // slightly lower since we already enforce anchor alignment
  };

  let candidates = (preloadProducts || []).filter(pass);
  if (candidates.length) {
    const ranked = candidates.map(p => {
      const { f1 } = symmetricOverlap(refTokens, pickUrl(p), p.title);
      let s = f1;
      if (sameHost(p, firstEvent)) s += 0.1;
      return { p, s };
    }).sort((a,b)=>b.s-a.s);
    if (ranked[0]?.p) return ranked[0].p;
  }

  const core = uniq([...Array.from(refTokens)]).slice(0, 12);
  let fallback = [];
  if (core.length) {
    const orParts = core.flatMap(t => [
      `title.ilike.%${t}%`, `page_url.ilike.%${t}%`,
      `description.ilike.%${t}%`, `raw->>metaDescription.ilike.%${t}%`,
      `raw->meta->>description.ilike.%${t}%`
    ]).join(",");
    const { data } = await client.from("page_entities")
      .select(SELECT_COLS)
      .eq("kind","product")
      .or(orParts)
      .order("last_seen",{ascending:false})
      .limit(50);
    fallback = (data || []).filter(pass);
  }

  if (fallback.length) {
    const ranked = fallback.map(p => {
      const { f1 } = symmetricOverlap(refTokens, pickUrl(p), p.title);
      let s = f1;
      if (sameHost(p, firstEvent)) s += 0.1;
      return { p, s };
    }).sort((a,b)=>b.s-a.s);
    if (ranked[0]?.p) return ranked[0].p;
  }

  return null;
}

/* ================= Clean-price view (used only to enrich price) ================= */
async function findProductsClean(client, { tokens = [], urlFragment = "" } = {}) {
  const urlToks = nonGenericTokens(urlFragment);
  const tok = uniq([ ...urlToks, ...tokens.map(normaliseToken).filter(t => t.length >= 4) ]).slice(0, 8);
  if (!tok.length) return [];

  let andQuery = client.from("ai_products_clean").select("title,url,price_gbp");
  for (const t of tok) andQuery = andQuery.ilike("url", `%${t}%`);
  andQuery = andQuery.limit(16);
  let { data: andRows, error: andErr } = await andQuery; if (andErr) throw andErr;

  const byUrl = new Map();
  for (const row of (andRows || [])) {
    const p = Number(row.price_gbp); if (!(p > 0)) continue;
    const prev = byUrl.get(row.url);
    if (!prev || p < prev.price_gbp) byUrl.set(row.url, { ...row, price_gbp: p });
  }
  return Array.from(byUrl.values());
}

/* ================= Product block rendering ================= */
function selectDisplayPriceNumber(prod) {
  const pg = prod?.price_gbp != null ? Number(prod.price_gbp) : null;
  const pn = prod?.price != null ? Number(prod.price) : null;
  const candidate = (pg && pg > 0) ? pg : (pn && pn > 0 ? pn : null);
  return candidate && candidate > 0 ? candidate : null;
}
function formatDisplayPriceGBP(n) {
  if (n == null) return null;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(n));
}

/* --- sanitize rich text/HTML to plain text before parsing --- */
function sanitizeDesc(s) {
  if (!s || typeof s !== "string") return "";
  let out = s;
  out = out.replace(/\s+[a-z-]+="[^"]*"/gi, " "); // strip attributes
  out = out.replace(/<[^>]*>/g, " ");              // strip tags
  out = out.replace(/--\s*>/g, " ");               // stray “-- >”
  out = out.replace(/\s+/g, " ").trim();           // collapse whitespace
  return out;
}

/* FIXED: safe regex grab with grouped alternation and guard */
function parseProductBlock(desc) {
  const out = {};
  const clean = sanitizeDesc(desc);
  if (!clean) return out;

  const grab = (label) => {
    const r = new RegExp(`(?:${label})\\s*:\\s*([\\s\\S]*?)(?:\\n\\s*[A-Z][A-Za-z ]+:|$)`, "i");
    const m = clean.match(r);
    if (!m || m.length < 2 || typeof m[1] !== "string") return null;
    return m[1].trim().replace(/\s+/g, " ").slice(0, 300);
  };

  out.location = grab("Location");
  out.dates = grab("Dates|\\b20\\d{2}\\b");
  out.participants = grab("Participants");
  out.fitness = grab("Fitness");
  return out;
}

function buildAdviceMarkdown(articles) {
  const lines = ["**Guides**"];
  for (const a of (articles || []).slice(0, 5)) {
    const t = a.title || a.raw?.name || "Read more"; const u = pickUrl(a);
    lines.push(`- ${t} — ${u ? `[Link](${u})` : ""}`.trim());
  }
  return lines.join("\n");
}
function buildProductPanelMarkdown(prod) {
  const title = prod?.title || prod?.raw?.name || "Workshop";
  const priceNum = selectDisplayPriceNumber(prod);
  const priceStr = formatDisplayPriceGBP(priceNum);
  const url = pickUrl(prod);

  const long = prod?.raw?.metaDescription || prod?.raw?.meta?.description || prod?.description || "";
  const block = parseProductBlock(long);

  const head = `**${title}**${priceStr ? ` — ${priceStr}` : ""}`;
  const bullets = [];
  if (block.location) bullets.push(`- **Location:** ${block.location}`);
  if (block.dates) bullets.push(`- **Dates:** ${block.dates}`);
  if (block.participants) bullets.push(`- **Participants:** ${block.participants}`);
  if (block.fitness) bullets.push(`- **Fitness:** ${block.fitness}`);

  const plain = sanitizeDesc(long);
  const bodyText = plain && !bullets.length ? `\n\n${plain}` : "";
  const bulletsText = bullets.length ? `\n\n${bullets.join("\n")}` : "";

  return head + bulletsText + bodyText + (url ? `\n\n[Open](${url})` : "");
}
function buildAdvicePills(articles, originalQuery) {
  const pills = [];
  const top = articles?.[0] ? pickUrl(articles[0]) : null;
  if (top) pills.push({ label: "Read Guide", url: top, brand: "primary" });
  pills.push({ label: "More Articles", url: `https://www.alanranger.com/search?query=${encodeURIComponent(String(originalQuery || ""))}`, brand: "secondary" });
  return pills;
}
function buildEventPills(firstEvent, productOrNull) {
  const pills = [];
  const eventUrl = pickUrl(firstEvent);
  const productUrl = pickUrl(productOrNull);
  const bookUrl = productUrl || null;
  if (bookUrl) pills.push({ label: "Book Now", url: bookUrl, brand: "primary" });
  if (eventUrl) pills.push({ label: "View event", url: eventUrl, brand: "secondary" });
  pills.push({ label: "Photos", url: "https://www.alanranger.com/photography-portfolio", brand: "secondary" });
  return pills;
}

/* Location filtering for events when query contains a place */
function filterEventsByLocationKeywords(events, keywords) {
  const locs = keywords.filter(k => LOCATION_HINTS.includes(k.toLowerCase()));
  if (!locs.length) return events;
  return events.filter(e => {
    const hay = ((e.title || "") + " " + (e.location || "") + " " + (pickUrl(e) || "")).toLowerCase();
    return locs.some(l => hay.includes(l));
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
    const keywords = extractKeywords(q, intent, subtype);
    const topic = topicFromKeywords(keywords);

    let t_supabase = 0, t_rank = 0, t_comp = 0;

    // Probe: count clean view (optional)
    let cleanCount = null;
    try {
      const sProbe = Date.now();
      const { count } = await client.from("ai_products_clean").select("*", { count: "exact", head: true });
      cleanCount = typeof count === "number" ? count : null;
      t_supabase += Date.now() - sProbe;
    } catch { cleanCount = null; }

    const s1 = Date.now();
    let events = [], products = [], articles = [], landing = [];
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

      try { articles = await findArticles(client, { keywords, topK: 12 }); } catch { articles = []; }
    } else {
      [articles, products] = await Promise.all([
        findArticles(client, { keywords, topK: Math.max(12, topK) }),
        findProducts(client, { keywords, topK: 12 }),
      ]);
    }
    t_supabase += Date.now() - s1;

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
      .sort((a, b) => (Date.parse(a.date_start || 0) || 0) - (Date.parse(b.date_start || 0) || 0))
      .map((e) => ({ ...e, _score: Math.round(scoreEntity(e, qTokens) * 100) / 100 }));

    let rankedProducts = scoreWrap(products);
    const rankedArticles = scoreWrap(articles).slice(0, 12);

    const firstEvent = rankedEvents[0] || null;
    t_rank += Date.now() - s2;

    /* =================== FEATURED PRODUCT strictly from first event =================== */
    let featuredProduct = null;

    if (firstEvent) {
      const matched = await findBestProductForEvent(client, firstEvent, rankedProducts, subtype);

      if (matched) {
        featuredProduct = upgradeToRichestByUrl(rankedProducts, matched);

        const tokensForClean = uniq([...urlTokens(firstEvent), ...titleTokens(firstEvent)]);
        try {
          const cleanRows = await findProductsClean(client, { tokens: tokensForClean, urlFragment: pickUrl(firstEvent) || "" });
          const fromClean = cleanRows.find(r => baseUrl(r.url) === baseUrl(pickUrl(featuredProduct)));
          if (fromClean && Number(fromClean.price_gbp) > 0) {
            featuredProduct.price_gbp = Number(fromClean.price_gbp);
          }
        } catch {}
      }
      if (featuredProduct) {
        const topUrl = baseUrl(pickUrl(featuredProduct));
        rankedProducts = [ featuredProduct, ...rankedProducts.filter(p => baseUrl(pickUrl(p)) !== topUrl) ];
      }
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
      const preferred = featuredProduct || rankedProducts[0] || null;
      if (preferred) answer_markdown = buildProductPanelMarkdown(preferred);
      else if (rankedArticles?.length) answer_markdown = buildAdviceMarkdown(rankedArticles);
      else answer_markdown = "Upcoming workshops and related info below.";
    }
    t_comp += Date.now() - s4;

    const citations = uniq([
      ...rankedArticles.slice(0, 3).map(pickUrl),
      ...(firstEvent ? [pickUrl(firstEvent)] : []),
      ...(rankedProducts[0] ? [pickUrl(rankedProducts[0])] : []),
    ]);

    const structured = {
      intent, topic, event_subtype: subtype,
      events: (rankedEvents || []).map((e) => ({
        id: e.id, title: e.title, page_url: e.page_url, source_url: e.source_url,
        date_start: e.date_start, date_end: e.date_end, location: e.location,
        when: e.date_start ? new Date(e.date_start).toUTCString() : null, href: pickUrl(e), _score: e._score,
      })),
      products: (rankedProducts || []).map((p) => ({
        id: p.id, title: p.title, page_url: p.page_url, source_url: p.source_url,
        description: p.description, price: p.price ?? null, price_gbp: p.price_gbp ?? null,
        location: p.location, _score: p._score, display_price: selectDisplayPriceNumber(p),
      })),
      articles: (rankedArticles || []).map((a) => ({
        id: a.id, title: a.title, page_url: a.page_url, source_url: a.source_url, last_seen: a.last_seen
      })),
      pills: intent === "events" ? buildEventPills(firstEvent, featuredProduct || null) : buildAdvicePills(rankedArticles, q),
    };

    const debug = {
      version: "v0.9.40-domain-anchor",
      intent, keywords, event_subtype: subtype,
      first_event: firstEvent ? { id: firstEvent.id, title: firstEvent.title, url: pickUrl(firstEvent), date_start: firstEvent.date_start } : null,
      featured_product: featuredProduct ? {
        id: featuredProduct.id, title: featuredProduct.title, url: pickUrl(featuredProduct),
        display_price: selectDisplayPriceNumber(featuredProduct)
      } : null,
      pills: { book_now: structured.pills?.find(p=>p.label==="Book Now")?.url || null },
      counts: { events: (structured.events||[]).length, products: (structured.products||[]).length, articles: (structured.articles||[]).length },
      probes: { ai_products_clean_count: cleanCount, supabase_health: health }
    };

    const payload = {
      ok: true,
      answer_markdown,
      citations,
      structured,
      confidence: confidence_pct / 100,
      confidence_pct,
      debug,
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
