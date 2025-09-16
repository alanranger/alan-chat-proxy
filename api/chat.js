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
const DEFAULT_ORIGIN = "https://www.alanranger.com";
const GALLERY_HUB = "/gallery-image-portfolios";

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
  } catch { return ts; }
}
function uniq(arr) { return [...new Set((arr || []).filter(Boolean))]; }
function toGBP(n) {
  if (n == null || isNaN(Number(n))) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP", maximumFractionDigits: 0,
  }).format(Number(n));
}
function stripHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function pickUrl(row) { return row?.source_url || row?.page_url || row?.url || null; }
function pickOriginFromRows(rows) {
  for (const r of rows || []) {
    const u = pickUrl(r);
    try { if (u) return new URL(u).origin; } catch {}
  }
  return DEFAULT_ORIGIN;
}

/* ----------------------- Topic & intent detection ------------------------ */
const TOPIC_HINTS = [
  "bluebell","devon","dartmoor","exmoor","sidmouth",
  "snowdonia","wales","lake district","peak district","warwickshire","coventry"
];
const EVENT_HINTS = [
  "when","date","next","workshop","workshops","course","courses","tuition",
  "event","events","book","availability","where","cost","price","prices"
];

function detectTopic(query) {
  const q = (query||"").toLowerCase();
  for (const t of TOPIC_HINTS) if (q.includes(t)) return t;
  return null;
}
function detectIntentFromQuery(query) {
  const q = (query||"").toLowerCase();
  const hasEvent = EVENT_HINTS.some(w => q.includes(w));
  return hasEvent ? "events" : "advice";
}

/* ----------------------- Facts parsing (server-side) --------------------- */
function extractFromDescription(desc) {
  const out = {
    location:null, participants:null, fitness:null, availability:null,
    summary:null, sessions:[]
  };
  if (!desc) return out;
  const text = stripHtml(desc);
  const lines = text.split(/\r?\n|(?<=\.)\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean);

  // first non-empty sentence as summary
  out.summary = lines[0] || null;

  // scan for labelled facts (value may be next line)
  const nextVal = (idx) => {
    for (let j=idx+1; j<lines.length; j++) {
      const t = lines[j].trim(); if (t) return t;
    }
    return null;
  };
  const tryLabel = (label, idx, key) => {
    const re = new RegExp(`^\\s*${label}\\s*:?\\s*(.+)$`, "i");
    const m = lines[idx].match(re);
    if (m) { out[key] = m[1].trim() || nextVal(idx); return true; }
    return false;
  };

  for (let i=0;i<lines.length;i++){
    const ln = lines[i];

    if (tryLabel("Location", i, "location")) continue;
    if (tryLabel("Participants", i, "participants")) continue;
    if (tryLabel("Fitness", i, "fitness")) continue;
    if (tryLabel("Availability", i, "availability")) continue;

    // session/time rows: "4hrs - 5:45 am to 9:45 am or 10:30 am to 2:30 pm"
    const m1 = ln.match(/^(\d+\s*(?:hrs?|hours?|day|days|half\s*day|full\s*day))\s*[-–—]\s*(.+)$/i);
    if (m1) out.sessions.push({ label: m1[1].replace(/\s+/g," ").trim(), time: m1[2].trim(), price: null });
  }
  return out;
}

/* -------------------------- Markdown renderers --------------------------- */
function buildProductPanelMarkdown(products) {
  if (!products?.length) return "";
  const primary = products.find(p=>p.price!=null) || products[0];

  // headline prices
  let lowPrice=null, highPrice=null, priceCurrency='GBP';
  for (const p of products) {
    const ro = p?.raw?.offers || {};
    const lp = ro.lowPrice ?? ro.lowprice ?? null;
    const hp = ro.highPrice ?? ro.highprice ?? null;
    if (lp!=null) lowPrice = lp;
    if (hp!=null) highPrice = hp;
    if (ro.priceCurrency) priceCurrency = ro.priceCurrency;
  }
  const headSingle = primary?.price!=null ? toGBP(primary.price) : null;
  const lowTx = lowPrice!=null ? toGBP(lowPrice) : null;
  const highTx = highPrice!=null ? toGBP(highPrice) : null;

  const title = primary.title || primary?.raw?.name || "Workshop";
  const headBits = [];
  if (headSingle) headBits.push(headSingle);
  if (lowTx && highTx) headBits.push(`${lowTx}–${highTx}`);
  const priceHead = headBits.length?` — ${headBits.join(" • ")}`:"";

  // facts
  const info = extractFromDescription(
    primary.description || primary?.raw?.description || primary?.html || primary?.raw?.html || ""
  );
  // attach prices to sessions if we can
  const sessions = [...(info.sessions||[])];
  if (sessions.length) {
    if (lowPrice!=null && highPrice!=null && sessions.length>=2) {
      sessions[0].price = lowPrice; sessions[1].price = highPrice;
    } else if (primary?.price!=null) {
      sessions.forEach(s=> s.price = primary.price);
    }
  }

  const lines=[];
  lines.push(`**${title}**${priceHead}`);
  if (info.summary) lines.push(`\n${info.summary}`);
  const facts=[];
  if (info.location)     facts.push(`**Location:** ${info.location}`);
  if (info.participants) facts.push(`**Participants:** ${info.participants}`);
  if (info.fitness)      facts.push(`**Fitness:** ${info.fitness}`);
  if (info.availability) facts.push(`**Availability:** ${info.availability}`);
  if (facts.length){ lines.push(""); for (const f of facts) lines.push(f); }
  if (sessions.length){
    lines.push("");
    for (const s of sessions){
      const pretty = s.label.replace(/\bhrs\b/i,"hours");
      const ptxt = s.price!=null ? ` — ${toGBP(s.price)}` : "";
      lines.push(`- **${pretty}** — ${s.time}${ptxt}`);
    }
  }
  return lines.join("\n");
}

/* ------------------------- Advice pills from HTML ------------------------ */
function extractLinksFromHtml(html, baseUrl) {
  if (!html) return [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  const out = [];
  let m;
  let base = DEFAULT_ORIGIN;
  try { base = new URL(baseUrl||DEFAULT_ORIGIN).origin; } catch {}
  while ((m = re.exec(html))) {
    let href = m[1].trim();
    const text = m[2].replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
    try { href = new URL(href, base).href; } catch {}
    out.push({ href, text });
  }
  return out;
}
function pickChecklistLink(links) {
  const isPdf = (u) => /\.pdf(\?|#|$)/i.test(u);
  const looksChecklist = (t,u) => /a-?page|field|check\s*list/i.test(t) || /checklist/i.test(u);
  for (const l of links) {
    if (isPdf(l.href) && looksChecklist(l.text, l.href)) {
      return { label: "Download Checklist", url: l.href };
    }
  }
  const anyPdf = links.find(l => /\.pdf(\?|#|$)/i.test(l.href));
  return anyPdf ? { label: "Download PDF", url: anyPdf.href } : null;
}
function pickContextLink(links, disallow=[]) {
  const bad = /^(mailto:|tel:|javascript:)|\b(login|signup|share|facebook|twitter|pinterest|contact|privacy|terms|cookie)\b/i;
  const goodHint = /\b(workshop|course|guide|tuition|gallery|portfolio|critique|feedback|astro|long exposure|tripod|filter)\b/i;
  const seen = new Set(disallow.map(u=>u?.toLowerCase()));
  for (const l of links) {
    if (!l.href || seen.has(l.href.toLowerCase())) continue;
    const txt = l.text||"";
    if (bad.test(l.href) || bad.test(txt)) continue;
    if (!txt) continue;
    if (goodHint.test(txt) || goodHint.test(l.href)) {
      const label = ("Related: " + txt).replace(/\s+/g," ").trim();
      return { label: label.length>36?label.slice(0,33)+"…":label, url: l.href };
    }
  }
  const first = links.find(l => l.text && !bad.test(l.href));
  return first ? { label: ("Related: " + first.text).slice(0,36) + (first.text.length>36?"…":""), url: first.href } : null;
}

/* ---------------------------- Pill composers ----------------------------- */
function composeEventPills({ origin, topic, products, events }) {
  const pills = [];
  const used = new Set();
  const add = (label, url, brand=false) => {
    if (!label || !url) return;
    const key = url.toLowerCase();
    if (used.has(key)) return; used.add(key);
    pills.push({ label, url, brand });
  };

  const productUrl = pickUrl(products?.[0]) || null;
  const firstEvent = (events||[])[0] || null;
  const eventUrl = pickUrl(firstEvent);
  const moreEvents = topic
    ? `${origin}/search?query=${encodeURIComponent(topic + " workshop")}`
    : `${origin}/search?query=workshops`;

  if (productUrl) add("Book Now", productUrl, true);
  if (eventUrl)   add("Event Listing", eventUrl, true);
  add("More Events", moreEvents, true);
  add("Photos", `${origin}${GALLERY_HUB}`, false);

  return pills.slice(0,4);
}
function composeAdvicePillsFromArticle({ origin, query, article, events }) {
  const pills = [];
  const used = new Set();
  const add = (label, url, brand=false) => {
    if (!label || !url) return;
    const key = url.toLowerCase();
    if (used.has(key)) return; used.add(key);
    pills.push({ label, url, brand });
  };

  const topUrl = article?.url || null;
  add("Read Guide", topUrl, true);
  add("More Articles", `${origin}/search?query=${encodeURIComponent(query)}`, true);

  const html = article?.html || article?.raw?.html || "";
  const links = extractLinksFromHtml(html, topUrl || origin);

  const pdf = pickChecklistLink(links);
  if (pdf) add(pdf.label, pdf.url);

  const ctx = pickContextLink(links, [topUrl, pdf?.url].filter(Boolean));
  if (ctx) add(ctx.label, ctx.url);

  // fill to 4 with sensible defaults
  if (pills.length < 4) {
    const e = (events||[])[0];
    const evUrl = e ? pickUrl(e) : `${origin}/search?query=workshops`;
    add("Events", evUrl);
  }
  if (pills.length < 4) add("Photos", `${origin}${GALLERY_HUB}`);

  return pills.slice(0,4);
}

/* ----------------------------- Data fetchers ----------------------------- */
async function fetchFutureEvents(client, topic) {
  const nowIso = new Date().toISOString();
  const { data } = await client
    .from("page_entities")
    .select("id, title, page_url, source_url, date_start, date_end, location, raw")
    .eq("kind", "event")
    .gte("date_start", nowIso)
    .order("date_start", { ascending: true })
    .limit(120);
  let events = data || [];
  if (topic) {
    const t = topic.toLowerCase();
    events = events.filter(e => {
      const hay = [e.title, e.page_url, e.source_url, e.location].join(" ").toLowerCase();
      return hay.includes(t);
    });
  }
  return events.slice(0, 60);
}
async function fetchProducts(client, topic) {
  const { data } = await client
    .from("page_entities")
    .select("*")
    .eq("kind", "product")
    .order("last_seen", { ascending: false })
    .limit(60);
  let rows = data || [];
  if (topic) {
    const t = topic.toLowerCase();
    rows = rows.filter(p => {
      const hay = [p.title, p.page_url, p.source_url, p.url, p.description].join(" ").toLowerCase();
      return hay.includes(t);
    });
  }
  return rows;
}
async function fetchArticles(client, query) {
  const { data } = await client
    .from("page_entities")
    .select("id, title, page_url, source_url, url, html, raw")
    .in("kind", ["article","blog","page"])
    .order("last_seen", { ascending: false })
    .limit(120);
  const q = (query||"").toLowerCase();
  // lightweight filter by query tokens
  const tokens = q.split(/\s+/).filter(Boolean).slice(0,6);
  const rows = (data||[]).filter(r=>{
    const hay = [r.title, r.page_url, r.source_url, r.url, stripHtml(r.html||r.raw?.html||"")].join(" ").toLowerCase();
    return tokens.every(t => hay.includes(t));
  });
  return rows.slice(0, 12);
}

/* ----------------------------- Resolvers -------------------------------- */
async function resolveEventsOrProduct({ client, query }) {
  const topic = detectTopic(query) || null;
  const products = await fetchProducts(client, topic);
  const events = await fetchFutureEvents(client, topic);

  const origin = pickOriginFromRows(products.length?products:events);
  const pills = composeEventPills({ origin, topic, products, events });

  const citations = uniq([
    ...products.map(pickUrl),
    ...events.map(pickUrl)
  ]).filter(Boolean);

  const productPanel = products.length ? buildProductPanelMarkdown(products) : "";

  return {
    ok: true,
    answer_markdown: productPanel,
    citations,
    structured: {
      intent: "events",
      topic,
      products,
      events: (events||[]).slice(0,12).map(e => ({ ...e, when: fmtDateLondon(e.date_start) })),
      pills
    },
    meta: { intent: "events" }
  };
}

async function resolveAdvice({ client, query }) {
  const topic = detectTopic(query) || null;
  const articles = await fetchArticles(client, query);
  const eventsForContext = await fetchFutureEvents(client, topic);

  const origin = pickOriginFromRows(articles.length?articles:eventsForContext);
  const top = articles[0] || null;

  // brief markdown with neat list of article links
  const md = articles.length
    ? [
        "Here are Alan’s guides that match your question:",
        "",
        ...articles.map(a => `- [${a.title}](${pickUrl(a) || a.url || "#"})`)
      ].join("\n")
    : "I couldn’t find a specific guide for that yet.";

  const pills = composeAdvicePillsFromArticle({ origin, query, article: top, events: eventsForContext });

  const citations = uniq(articles.map(pickUrl)).filter(Boolean);

  return {
    ok: true,
    answer_markdown: md,
    citations,
    structured: {
      intent: "advice",
      topic,
      articles: articles.map(a => ({ title: a.title, url: pickUrl(a) || a.url || null })),
      pills
    },
    meta: { intent: "advice" }
  };
}

/* -------------------------------- Handler -------------------------------- */
export default async function handler(req, res) {
  const started = Date.now();
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed", where: "http" });
      return;
    }

    const { query="", topK } = req.body || {};
    const client = supabaseAdmin();

    // pick intent quickly, but trust resolvers to return what they find
    const roughIntent = detectIntentFromQuery(query);

    const result = roughIntent === "events"
      ? await resolveEventsOrProduct({ client, query })
      : await resolveAdvice({ client, query });

    res.status(200).json({
      ...result,
      meta: {
        ...(result.meta||{}),
        duration_ms: Date.now() - started,
        endpoint: "/api/chat",
        topK: topK || null
      }
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
