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
  return row?.page_url || row?.source_url || row?.url || null;
}
function getOrigin(url) {
  try { return new URL(url).origin; } catch { return null; }
}
function anyOriginFrom(...urls) {
  for (const u of urls) { const o = getOrigin(u); if (o) return o; }
  return null;
}
function stripInlineNoise(htmlish) {
  if (!htmlish) return htmlish;
  // remove inline style/data- blobs that sometimes leak into descriptions
  return String(htmlish)
    .replace(/\sstyle="[^"]*"/gi, "")
    .replace(/\sdata-[\w-]+="[^"]*"/gi, "")
    .replace(/\scontenteditable="[^"]*"/gi, "")
    .replace(/\sclass="[^"]*"/gi, "");
}

/* ----------------------- Intent detection (robust) ----------------------- */
function inferIntent(query) {
  const q = (query || "").toLowerCase();

  // Very strong “workshop/course” signals
  const workshopSignals = [
    "workshop","event","events","course","class","classes","tuition","lesson",
    "date","dates","when","next","upcoming","book","booking","availability",
    "available","places","spaces","sold","sold out","price","prices","cost"
  ];
  if (workshopSignals.some(k => q.includes(k))) return "events";

  // Advice-ish keywords (used only if no workshop signals and we find no events/products)
  const adviceSignals = [
    "how to","tips","best","review","which","recommend","guide","settings",
    "what tripod","tripod","lens","filter","camera","editing","lightroom","photoshop"
  ];
  if (adviceSignals.some(k => q.includes(k))) return "advice";

  // Fallback: try events/products first, otherwise advice
  return "auto";
}

/* ----------------------- DB helpers: search entities --------------------- */
async function searchEventsProducts(client, query) {
  const nowIso = new Date().toISOString();

  const { data: eventsRaw } = await client
    .from("page_entities")
    .select("id, title, page_url, source_url, date_start, date_end, location, raw")
    .eq("kind", "event")
    .or(`title.ilike.%${query}%,page_url.ilike.%${query}%,source_url.ilike.%${query}%`)
    .gte("date_start", nowIso)
    .order("date_start", { ascending: true })
    .limit(100);

  const { data: products } = await client
    .from("page_entities")
    .select("*")
    .eq("kind", "product")
    .or(`title.ilike.%${query}%,page_url.ilike.%${query}%,source_url.ilike.%${query}%`)
    .order("last_seen", { ascending: false })
    .limit(50);

  // If nothing for the literal query, try extracting a likely noun-ish token
  const nothingFound = (!eventsRaw || eventsRaw.length === 0) && (!products || products.length === 0);
  let events = eventsRaw || [];
  if (nothingFound) {
    const maybe = (query || "").toLowerCase().match(/\b([a-z]{5,})\b/g) || [];
    const top = uniq(maybe).slice(0, 2); // try 1–2 fallback tokens
    for (const token of top) {
      const { data: ev2 } = await client
        .from("page_entities")
        .select("id, title, page_url, source_url, date_start, date_end, location, raw")
        .eq("kind", "event")
        .or(`title.ilike.%${token}%,page_url.ilike.%${token}%`)
        .gte("date_start", nowIso)
        .order("date_start", { ascending: true })
        .limit(40);
      if (ev2?.length) { events = ev2; break; }
    }
  }

  return { events, products: products || [] };
}

async function searchArticles(client, query) {
  const { data: articles } = await client
    .from("page_entities")
    .select("title, page_url, source_url, url, last_seen")
    .in("kind", ["article","page"])
    .or(`title.ilike.%${query}%,page_url.ilike.%${query}%,source_url.ilike.%${query}%`)
    .order("last_seen", { ascending: false })
    .limit(10);

  return (articles || []).map(a => ({
    title: a.title || "Article",
    url: pickUrl(a)
  })).filter(a => a.url);
}

async function findGalleryHub(client) {
  const { data } = await client
    .from("page_entities")
    .select("page_url, source_url, url, title, last_seen")
    .or("page_url.ilike.%/gallery-%,page_url.ilike.%/gallery%,url.ilike.%/gallery%")
    .order("last_seen", { ascending: false })
    .limit(50);

  const urls = (data || []).map(pickUrl).filter(Boolean);
  // Prefer /gallery-image-portfolios, else shortest clean /gallery* path
  const exact = urls.find(u => u.includes("/gallery-image-portfolios"));
  if (exact) return exact;
  const galleryRoots = urls
    .filter(u => /\/gallery(\/|$)/i.test(u) || /\/gallery-/.test(u))
    .sort((a,b)=>a.length-b.length);
  return galleryRoots[0] || urls[0] || null;
}

/* ----------------------- Description parsing for UI ---------------------- */
function extractFromDescription(descRaw) {
  const desc = stripInlineNoise(descRaw);

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
    if (/^participants:/i.test(ln) || /^max\s*\d+/i.test(ln)) {
      const v = ln.replace(/^participants:\s*/i, "").trim() || nextVal(i) || ln.match(/\bmax\s*\d+\b/i)?.[0];
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

  // Attach prices to sessions
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

  return lines.join("\n");
}

/* ----------------------------- Pills builder ----------------------------- */
function buildEventPills({ productUrl, firstEventUrl, origin, photosUrl }) {
  const pills = [];

  if (productUrl) pills.push({ label: "Book Now", url: productUrl, brand: true });
  if (firstEventUrl) pills.push({ label: "Event Listing", url: firstEventUrl, brand: true });

  // "More Events" goes to a site search for workshops (no hard-coded domain)
  const moreEventsUrl = origin ? `${origin}/search?query=workshops` : (productUrl || firstEventUrl);
  if (moreEventsUrl) pills.push({ label: "More Events", url: moreEventsUrl });

  if (photosUrl) pills.push({ label: "Photos", url: photosUrl });

  return pills.slice(0,4);
}

/* ----------------------------- Main handlers ----------------------------- */
async function answerEventsFlow({ client, query }) {
  const { events, products } = await searchEventsProducts(client, query);

  // If we accidentally got nothing, try a broader pass before giving up
  const hasSomething = (events?.length || products?.length);
  if (!hasSomething) {
    const { events: ev2, products: pr2 } = await searchEventsProducts(client, query.split(/\s+/)[0] || query);
    if (ev2?.length || pr2?.length) {
      return await answerEventsFlow({ client, query }); // let normal flow continue
    }
  }

  const productPanel = buildProductPanelMarkdown(products || []);

  const firstEventUrl = pickUrl((events || [])[0]);
  const productUrl = pickUrl(products?.[0]);
  const origin = anyOriginFrom(productUrl, firstEventUrl);
  const photosUrl = await findGalleryHub(client);

  const pills = buildEventPills({ productUrl, firstEventUrl, origin, photosUrl });

  const citations = uniq([
    ...((events || []).map(pickUrl)),
    ...((products || []).map(pickUrl)),
    photosUrl
  ]);

  const eventList = (events || [])
    .map((e) => ({ ...e, when: fmtDateLondon(e.date_start) }))
    .slice(0, 12);

  const structured = {
    topic: null,
    events: eventList,
    products: products || [],
    pills
  };

  return { ok: true, answer_markdown: productPanel || undefined, citations, structured, metaExtras: { intent: "events" } };
}

async function answerAdviceFlow({ client, query }) {
  const articles = await searchArticles(client, query);
  const photosUrl = await findGalleryHub(client);

  const bulletList = articles.length
    ? "Here are Alan’s guides that match your question:\n\n" +
      articles.map(a => `- [${a.title}](${a.url})`).join("\n")
    : "I couldn’t find a specific guide for that yet.";

  const origin = anyOriginFrom(articles?.[0]?.url);
  const pills = [
    articles[0] ? { label: "Read Guide", url: articles[0].url, brand: true } : null,
    origin ? { label: "More Articles", url: `${origin}/search?query=${encodeURIComponent(query)}`, brand: true } : null,
    origin ? { label: "Events", url: `${origin}/blog-on-photography/` } : null,
    photosUrl ? { label: "Photos", url: photosUrl } : null
  ].filter(Boolean).slice(0,4);

  return {
    ok: true,
    answer_markdown: bulletList,
    citations: articles.map(a=>a.url),
    structured: { topic: null, events: [], products: [], articles, pills, chips: pills },
    metaExtras: { intent: "advice" }
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

    const { query, topK } = req.body || {};
    const client = supabaseAdmin();

    let intent = inferIntent(query);

    // Probe data to override intent when we clearly have events/products
    if (intent === "auto") {
      const probe = await searchEventsProducts(client, query);
      if (probe.events?.length || probe.products?.length) intent = "events";
      else intent = "advice";
    }

    let result;
    if (intent === "events") {
      result = await answerEventsFlow({ client, query });
    } else {
      result = await answerAdviceFlow({ client, query });
    }

    res.status(200).json({
      ...result,
      meta: {
        duration_ms: Date.now() - started,
        endpoint: "/api/chat",
        topK: topK || null,
        intent: result?.metaExtras?.intent || intent
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
