// /api/chat.js
// Node runtime on Vercel. Data-driven. No hard-coded query terms.
// Keys are inlined per your request for debugging (keep server-side only).

export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

/* ================= Supabase (robust) ================= */
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
function pickUrl(e) { return e?.page_url || e?.source_url || e?.url || null; }
function uniq(arr) { return Array.from(new Set(arr.filter(Boolean))); }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function tokenize(s) { return (s || "").toLowerCase().match(/[a-z0-9]+/g) || []; }

// normalise: strip trailing run numbers like kenilworth1 → kenilworth
function normaliseToken(t) { return String(t || "").replace(/\d+$/, ""); }

const GENERIC = new Set([
  "alan","ranger","photography","photo","workshop","workshops","course","courses",
  "class","classes","tuition","lesson","lessons","uk","england","blog","near","me",
  "photographic","landscape","seascape","monthly","day","days","1","one","two","2"
]);

function nonGenericTokens(str) {
  return (tokenize(str) || [])
    .map(normaliseToken)
    .filter(t => t.length >= 4 && !GENERIC.has(t));
}

function titleTokens(x) {
  return (tokenize((x?.title || x?.raw?.name || "")) || [])
    .map(normaliseToken)
    .filter(t => t.length >= 4 && !GENERIC.has(t));
}
function urlTokens(x) {
  const u = (pickUrl(x) || "").toLowerCase();
  return (tokenize(u.replace(/^https?:\/\//, "").replace(/[\/_-]+/g, " ")) || [])
    .map(normaliseToken)
    .filter(t => t.length >= 4 && !GENERIC.has(t));
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
  const eventish = /\b(when|date|dates|where|location|next|upcoming|availability|available|schedule|book|booking|time)\b/;
  const classish = /\b(workshop|course|class|tuition|lesson|lessons|photowalk|walk|masterclass)\b/;
  return eventish.test(s) && classish.test(s) ? "events" : "advice";
}
function detectEventSubtype(q) {
  const s = String(q || "").toLowerCase();
  if (/\b(course|courses|class|classes|tuition|lesson|lessons)\b/.test(s)) return "course";
  if (/\b(workshop|workshops)\b/.test(s)) return "workshop";
  return null;
}
const STOPWORDS = new Set([
  "the","and","or","what","whats","when","whens","next","cost",
  "workshop","workshops","photography","photo","near","me","uk",
  "warks","warwickshire","devonshire","class","classes","course","courses",
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
const SELECT_COLS = "id, kind, title, page_url, source_url, last_seen, location, date_start, date_end, price, description, raw";
function buildOrIlike(keys, keywords) {
  const clauses = [];
  for (const k of keywords) for (const col of keys) clauses.push(`${col}.ilike.%${k}%`);
  return clauses.join(",");
}
async function findEvents(client, { keywords = [], topK = 12 } = {}) {
  let q = client.from("page_entities").select(SELECT_COLS).eq("kind", "event");
  q = q.gte("date_start", new Date().toISOString());
  if (keywords.length) q = q.or(buildOrIlike(["title", "page_url", "location", "description", "raw->>metaDescription", "raw->meta->>description"], keywords));
  q = q.order("date_start", { ascending: true }).limit(topK);
  const { data, error } = await q; if (error) throw error; return data || [];
}
async function findProducts(client, { keywords = [], topK = 6 } = {}) {
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
  let q = client.from("page_entities").select(SELECT_COLS).in("kind", ["article", "page"]).eq("raw->>canonical", "true").eq("raw->>role", "landing");
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
function matchProductToEvent(products, ev) {
  if (!ev || !products?.length) return null;
  const eTokens = new Set([...titleTokens(ev), ...urlTokens(ev)]);
  let best = null, bestScore = 0;
  for (const p of products) {
    const pTokens = new Set([...titleTokens(p), ...urlTokens(p)]);
    let inter = 0; for (const tk of eTokens) if (pTokens.has(tk)) inter++;
    const union = eTokens.size + pTokens.size - inter || 1;
    let score = inter / union;
    if (sameHost(p, ev)) score += 0.15;
    const tAll = (p.title || "").toLowerCase() + " " + (ev.title || "").toLowerCase();
    if (/(workshop|course|tuition|lesson)/.test(tAll)) score += 0.05;
    if (score > bestScore) { best = p; bestScore = score; }
  }
  return best && bestScore >= 0.45 ? best : null;
}

/* ================= ai_products_clean deterministic accessor ================= */
// Only run strict AND when we actually have tokens.
// Also, expose a validator that requires topic+location when present.
function urlOrTitleHasAll(u, t, required) {
  const hay = (String(u || "") + " " + String(t || "")).toLowerCase();
  return required.every(tok => hay.includes(tok));
}

async function findProductsClean(client, { tokens = [], urlFragment = "" } = {}) {
  const urlToks = nonGenericTokens(urlFragment);
  const tok = uniq([ ...urlToks, ...tokens.map(normaliseToken).filter(t => t.length >= 4) ]).slice(0, 8);

  // If we have no tokens, do NOT run a wide-open query.
  if (!tok.length) return [];

  // Strict AND on URL first
  let andQuery = client.from("ai_products_clean").select("title,url,price_gbp");
  for (const t of tok) andQuery = andQuery.ilike("url", `%${t}%`);
  andQuery = andQuery.limit(16);
  let { data: andRows, error: andErr } = await andQuery; if (andErr) throw andErr;

  // Deduplicate and keep min price per URL
  const byUrl = new Map();
  for (const row of (andRows || [])) {
    const p = Number(row.price_gbp); if (!(p > 0)) continue;
    const prev = byUrl.get(row.url);
    if (!prev || p < prev.price_gbp) byUrl.set(row.url, { ...row, price_gbp: p });
  }
  return Array.from(byUrl.values());
}

/* ================= Clean price lookup (overlap with validation) ================= */
function overlapScore(refTokens, candUrl, candTitle) {
  const candTokens = new Set([
    ...tokenize(String(candUrl || "").replace(/^https?:\/\//, "").replace(/[\/_-]+/g, " ")),
    ...tokenize(String(candTitle || "")),
  ].map(normaliseToken).filter(t => t.length >= 4 && !GENERIC.has(t)));
  let inter = 0; for (const t of refTokens) if (candTokens.has(t)) inter++;
  const union = refTokens.size + candTokens.size - inter || 1;
  return { inter, score: inter / union };
}

function extractTopicAndLocationTokens(ev) {
  const t = titleTokens(ev);
  const u = urlTokens(ev);
  const all = uniq([...t, ...u]);
  // crude heuristics
  const topicHints = all.filter(x => /(exposure|long|seascape|woodland|sunset|night|architecture)/.test(x));
  const locationHints = all.filter(x => /(kenilworth|coventry|dartmoor|yorkshire|devon|wales|betws|windmill|hartland)/.test(x));
  return { topic: uniq(topicHints), location: uniq(locationHints), all };
}

async function lookupCleanPriceValidated(client, ev, extraTokens = []) {
  const { topic, location, all } = extractTopicAndLocationTokens(ev);
  const baseTokens = uniq([ ...all, ...extraTokens.map(normaliseToken) ]).filter(t => t.length >= 4);
  const refTokens = new Set(baseTokens);
  if (refTokens.size === 0) return { best: null, diag: { reason: "no_ref_tokens", topic, location, all } };

  // Try strict AND on URL using topic+location tokens where available
  const strictTokens = uniq([ ...topic, ...location ]).slice(0, 6);
  let strictRows = [];
  if (strictTokens.length) {
    strictRows = await findProductsClean(client, { tokens: strictTokens, urlFragment: pickUrl(ev) || "" });
  }

  // Build candidates set
  const candidates = new Map();
  for (const r of strictRows) candidates.set(r.url, r);

  // Fallback: broad OR (title+url) then rank
  if (!candidates.size) {
    const orParts = Array.from(refTokens).slice(0, 12).flatMap(t => [`url.ilike.%${t}%`, `title.ilike.%${t}%`]).join(",");
    const { data, error } = await client.from("ai_products_clean").select("title,url,price_gbp").or(orParts).limit(48);
    if (error) throw error;
    for (const r of (data || [])) {
      const p = Number(r.price_gbp); if (!(p > 0)) continue;
      const prev = candidates.get(r.url);
      if (!prev || p < prev.price_gbp) candidates.set(r.url, { ...r, price_gbp: p });
    }
  }

  if (!candidates.size) return { best: null, diag: { reason: "no_candidates", topic, location, all } };

  // Score & validate
  let best = null, bestScore = -1, bestInter = 0, why = "overlap_threshold";
  for (const cand of candidates.values()) {
    const { inter, score } = overlapScore(refTokens, cand.url, cand.title);
    const hay = (String(cand.url || "") + " " + String(cand.title || "")).toLowerCase();

    const hasTopic = topic.length ? topic.every(tok => hay.includes(tok)) || topic.some(tok => hay.includes(tok)) : true;
    const hasLocation = location.length ? location.some(tok => hay.includes(tok)) : false;

    const passes = (
      // strong case: both topic and location tokens appear
      (hasTopic && hasLocation) ||
      // fallback: decent overlap plus at least a location token
      ((inter >= 2 && score >= 0.25) || (inter >= 1 && score >= 0.18)) && hasLocation
    );

    if (passes && score > bestScore) {
      best = cand; bestScore = score; bestInter = inter;
      why = hasTopic && hasLocation ? "topic+location" : "overlap+location";
    }
  }

  if (!best) return { best: null, diag: { reason: "no_valid_candidate", topic, location, all } };

  return { best: { ...best, _diagnostic: { inter: bestInter, score: bestScore, why, topic, location, all } }, diag: null };
}

/* ================= Answer composition ================= */
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
  const desc = prod?.raw?.metaDescription || prod?.raw?.meta?.description || prod?.description || "";
  const url = pickUrl(prod);
  const head = `**${title}**${priceStr ? ` — ${priceStr}` : ""}`;
  const body = desc ? `\n\n${desc}` : "";
  return head + body + (url ? `\n\n[Open](${url})` : "");
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
  const bookUrl = productUrl || eventUrl;
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
    const { query, topK = 8, debug_level = "basic", include_raw = false } = req.body || {};
    const q = String(query || "").trim();
    const client = supabaseAdmin();

    const health = await probeSupabaseHealth();

    const intent = detectIntent(q);
    const subtype = detectEventSubtype(q);
    const keywords = extractKeywords(q, intent, subtype);
    const topic = topicFromKeywords(keywords);

    let t_supabase = 0, t_rank = 0, t_comp = 0;

    // Probe: count clean view
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
        findEvents(client, { keywords, topK: Math.max(8, topK) }),
        findProducts(client, { keywords, topK: 6 }),
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
    t_supabase += Date.now() - s1;

    const s2 = Date.now();
    const qTokens = keywords;

    const scoreWrap = (arr) =>
      (arr || [])
        .map((e) => ({ e, s: scoreEntity(e, qTokens) }))
        .sort((a, b) => { if (b.s !== a.s) return b.s - a.s; const by = Date.parse(b.e?.last_seen || "") || 0; const ax = Date.parse(a.e?.last_seen || "") || 0; return by - ax; })
        .map((x) => Object.assign({ _score: Math.round(x.s * 100) / 100 }, x.e));

    const rankedEvents = (events || [])
      .slice()
      .sort((a, b) => (Date.parse(a.date_start || 0) || 0) - (Date.parse(b.date_start || 0) || 0))
      .map((e) => ({ ...e, _score: Math.round(scoreEntity(e, qTokens) * 100) / 100 }));

    let rankedProducts = scoreWrap(products);
    const rankedArticles = scoreWrap(articles).slice(0, 12);

    const firstEvent = rankedEvents[0] || null;
    const eventUrl = firstEvent ? pickUrl(firstEvent) : null;
    t_rank += Date.now() - s2;

    // Build featured product from first event
    let featuredProduct = null, matchedProduct = null, cleanTip = null, decisionPath = null, diag = null;

    const s3 = Date.now();
    if (firstEvent) {
      const matched = matchProductToEvent(rankedProducts, firstEvent);
      const evTokensAll = uniq([ ...urlTokens(firstEvent), ...titleTokens(firstEvent) ]);

      if (matched) {
        decisionPath = "matched_product";
        // Try enrich price but keep matched.url
        const { best, diag: d } = await lookupCleanPriceValidated(client, firstEvent, evTokensAll);
        diag = d;
        if (best?.price_gbp > 0 && urlOrTitleHasAll(best.url, best.title, [ ...(extractTopicAndLocationTokens(firstEvent).location || []) ])) {
          featuredProduct = { ...matched, price_gbp: Number(best.price_gbp) };
          cleanTip = best;
        } else {
          featuredProduct = matched;
        }
        rankedProducts = [featuredProduct, ...rankedProducts.filter((p) => p.id !== matched.id)];
      } else {
        decisionPath = "synthetic_from_event";
        const synthetic = {
          id: `evt-${firstEvent.id || "next"}`,
          title: firstEvent.title || "Upcoming Workshop",
          page_url: eventUrl,
          source_url: eventUrl,
          description: firstEvent.description || firstEvent.raw?.metaDescription || firstEvent.raw?.description || "",
          price: null,
          location: firstEvent.location || null,
          raw: { ...(firstEvent.raw || {}), _syntheticFromEvent: true },
          _score: 1,
        };
        const { best, diag: d } = await lookupCleanPriceValidated(client, firstEvent, evTokensAll);
        cleanTip = best || null; diag = d || null;

        // Only promote price+URL if candidate passes topic+location requirement
        if (best?.price_gbp > 0) {
          const { location: loc } = extractTopicAndLocationTokens(firstEvent);
          const hay = (best.url + " " + (best.title || "")).toLowerCase();
          const hasLocation = !loc.length || loc.some(tok => hay.includes(tok));
          const hasTopic = extractTopicAndLocationTokens(firstEvent).topic.some(tok => hay.includes(tok));
          const allowPromote = hasLocation && hasTopic;

          if (allowPromote) {
            featuredProduct = {
              ...synthetic,
              page_url: best.url,
              source_url: best.url,
              price_gbp: Number(best.price_gbp),
            };
          } else {
            // safer: keep event URL and fill price only if location matches
            featuredProduct = {
              ...synthetic,
              price_gbp: hasLocation ? Number(best.price_gbp) : null,
            };
          }
        } else {
          featuredProduct = synthetic;
        }
        rankedProducts = [featuredProduct, ...rankedProducts];
      }
    }
    t_comp += Date.now() - s3;

    // Confidence
    const scoresForConfidence = [
      ...(rankedArticles[0]?._score ? [rankedArticles[0]._score] : []),
      ...(rankedEvents[0]?._score ? [rankedEvents[0]._score] : []),
      ...(rankedProducts[0]?._score ? [rankedProducts[0]._score] : []),
    ].map((x) => x / 100);
    const confidence_pct = confidenceFrom(scoresForConfidence);

    // Compose markdown
    const s4 = Date.now();
    let answer_markdown = "";
    if (intent === "advice") {
      answer_markdown = buildAdviceMarkdown(rankedArticles);
    } else {
      const preferred = rankedProducts[0] || featuredProduct || null;
      if (preferred) answer_markdown = buildProductPanelMarkdown(preferred);
      else if (rankedArticles?.length) answer_markdown = buildAdviceMarkdown(rankedArticles);
      else answer_markdown = "Upcoming workshops and related info below.";
    }
    t_comp += Date.now() - s4;

    // Citations
    const citations = uniq([
      ...rankedArticles.slice(0, 3).map(pickUrl),
      ...(firstEvent ? [pickUrl(firstEvent)] : []),
      ...(rankedProducts[0] ? [pickUrl(rankedProducts[0])] : []),
    ]);

    // Structured
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
      pills: intent === "events" ? buildEventPills(firstEvent, rankedProducts[0] || null) : buildAdvicePills(rankedArticles, q),
    };

    // Debug
    const baseDebug = {
      version: "v0.9.31-clean-guard+tokens-normalised+topicLocationGate",
      path: decisionPath,
      intent, keywords,
      event: firstEvent ? { id: firstEvent.id, title: firstEvent.title, url: pickUrl(firstEvent), date_start: firstEvent.date_start } : null,
      product: rankedProducts[0] ? {
        id: rankedProducts[0].id, title: rankedProducts[0].title, url: pickUrl(rankedProducts[0]),
        price_gbp: rankedProducts[0].price_gbp ?? null, display_price: selectDisplayPriceNumber(rankedProducts[0]),
        source: decisionPath === "matched_product" ? "matched" : (rankedProducts[0]?.raw?._syntheticFromEvent ? "synthetic" : "product")
      } : null,
      clean_lookup: cleanTip ? {
        hit: true, url: cleanTip.url, price_gbp: cleanTip.price_gbp,
        why: cleanTip._diagnostic?.why || null,
        inter: cleanTip._diagnostic?.inter ?? null, score: cleanTip._diagnostic?.score ?? null,
        topic_tokens: cleanTip._diagnostic?.topic ?? null,
        location_tokens: cleanTip._diagnostic?.location ?? null,
        all_tokens: cleanTip._diagnostic?.all ?? null
      } : { hit: false, diag },
      pills: { book_now: (structured.pills?.[0]?.url) || null, event_url: pickUrl(firstEvent) || null, product_url: pickUrl(rankedProducts[0]) || null },
      counts: { events: rankedEvents.length, products: rankedProducts.length, articles: rankedArticles.length },
      probes: { ai_products_clean_count: cleanCount, supabase_health: health },
      timings_ms: { total: Date.now() - started, supabase: t_supabase, rank: t_rank, compose: t_comp }
    };
    const debug = baseDebug;

    // Payload
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
