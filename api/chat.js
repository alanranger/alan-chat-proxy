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
const STOP = new Set([
  "a","an","and","or","the","this","that","these","those","is","are","was","were",
  "what","whats","when","whens","where","how","to","of","for","with","on","in",
  "at","next","date","dates","workshop","workshops","event","events","course","courses",
  "cost","price","prices","book","booking","please","me","its","my","your"
]);
function tokens(query){
  return (String(query||"").toLowerCase().match(/[a-z]{3,}/g) || [])
    .filter(t=>!STOP.has(t))
    .slice(0,6);
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
function pickUrl(row) { return row?.page_url || row?.source_url || row?.url || null; }
function getOrigin(url) { try { return new URL(url).origin; } catch { return null; } }
function anyOriginFrom(...urls) { for (const u of urls){ const o=getOrigin(u); if(o) return o; } return null; }
function stripInlineNoise(s){
  return String(s||"")
    .replace(/\sstyle="[^"]*"/gi,"")
    .replace(/\sdata-[\w-]+="[^"]*"/gi,"")
    .replace(/\scontenteditable="[^"]*"/gi,"")
    .replace(/\sclass="[^"]*"/gi,"");
}

/* ----------------------- Intent detection (robust) ----------------------- */
function inferIntent(query) {
  const q = (query || "").toLowerCase();
  const workshopSignals = [
    "workshop","event","events","course","class","tuition","lesson",
    "date","dates","when","next","upcoming","book","booking","availability",
    "available","places","spaces","sold","sold out","price","prices","cost"
  ];
  if (workshopSignals.some(k => q.includes(k))) return "events";

  const adviceSignals = [
    "how to","tips","best","review","which","recommend","guide","settings",
    "tripod","lens","filter","camera","editing","lightroom","photoshop"
  ];
  if (adviceSignals.some(k => q.includes(k))) return "advice";
  return "auto";
}

/* ----------------------- DB helpers: search entities --------------------- */
async function searchEventsProducts(client, query) {
  const nowIso = new Date().toISOString();
  const toks = tokens(query);

  // EVENTS — raw query first
  const { data: eventsRaw } = await client
    .from("page_entities")
    .select("id, title, page_url, source_url, date_start, date_end, location, raw")
    .eq("kind", "event")
    .or(`title.ilike.%${query}%,page_url.ilike.%${query}%,source_url.ilike.%${query}%`)
    .gte("date_start", nowIso)
    .order("date_start", { ascending: true })
    .limit(100);

  let events = eventsRaw || [];

  // If no events, try tokens
  if (!events.length && toks.length){
    for (const t of toks){
      const { data: evTok } = await client
        .from("page_entities")
        .select("id, title, page_url, source_url, date_start, date_end, location, raw")
        .eq("kind", "event")
        .or(`title.ilike.%${t}%,page_url.ilike.%${t}%`)
        .gte("date_start", nowIso)
        .order("date_start", { ascending: true })
        .limit(60);
      if (evTok?.length){ events = evTok; break; }
    }
  }

  // PRODUCTS — raw query first
  const { data: prodRaw } = await client
    .from("page_entities")
    .select("*")
    .eq("kind", "product")
    .or(`title.ilike.%${query}%,page_url.ilike.%${query}%,source_url.ilike.%${query}%`)
    .order("last_seen", { ascending: false })
    .limit(50);

  let products = prodRaw || [];

  // If no products, still try tokens (even when events were found)
  if (!products.length && toks.length){
    for (const t of toks){
      const { data: prTok } = await client
        .from("page_entities")
        .select("*")
        .eq("kind", "product")
        .or(`title.ilike.%${t}%,page_url.ilike.%${t}%`)
        .order("last_seen", { ascending: false })
        .limit(50);
      if (prTok?.length){ products = prTok; break; }
    }
  }

  return { events, products };
}

async function searchArticles(client, query) {
  const { data: articles } = await client
    .from("page_entities")
    .select("title, page_url, source_url, url, last_seen")
    .in("kind", ["article","page"])
    .or(`title.ilike.%${query}%,page_url.ilike.%${query}%,source_url.ilike.%${query}%`)
    .order("last_seen", { ascending: false })
    .limit(10);

  return (articles || []).map(a => ({ title: a.title || "Article", url: pickUrl(a) }))
    .filter(a => a.url);
}

async function findGalleryHub(client) {
  const { data } = await client
    .from("page_entities")
    .select("page_url, source_url, url, title, last_seen")
    .or("page_url.ilike.%/gallery-%,page_url.ilike.%/gallery%,url.ilike.%/gallery%")
    .order("last_seen", { ascending: false })
    .limit(50);

  const urls = (data || []).map(pickUrl).filter(Boolean);
  const exact = urls.find(u => u.includes("/gallery-image-portfolios"));
  if (exact) return exact;
  const galleryRoots = urls.filter(u => /\/gallery(\/|$)/i.test(u) || /\/gallery-/.test(u)).sort((a,b)=>a.length-b.length);
  return galleryRoots[0] || urls[0] || null;
}

/* ----------------------- Product facts & panel --------------------------- */
function extractFromDescription(descRaw) {
  const desc = stripInlineNoise(descRaw);
  const out = { location:null, participants:null, fitness:null, availability:null, summary:null, sessions:[] };
  if (!desc) return out;

  const lines = desc.split(/\r?\n/).map(s=>s.trim());
  const nonEmpty = lines.filter(Boolean);
  if (nonEmpty.length) out.summary = nonEmpty[0];

  const nextVal = (i)=>{ for(let j=i+1;j<lines.length;j++){ const t=lines[j].trim(); if(t) return t; } return null; };

  for (let i=0;i<lines.length;i++){
    const ln = lines[i];
    if (/^location:/i.test(ln)){ out.location = ln.replace(/^location:\s*/i,'').trim() || nextVal(i); continue; }
    if (/^participants:/i.test(ln) || /^max\s*\d+/i.test(ln)){
      out.participants = ln.replace(/^participants:\s*/i,'').trim() || nextVal(i) || ln.match(/\bmax\s*\d+\b/i)?.[0] || null;
      continue;
    }
    if (/^fitness:/i.test(ln)){ out.fitness = ln.replace(/^fitness:\s*/i,'').trim() || nextVal(i); continue; }
    if (/^availability:/i.test(ln)){ out.availability = ln.replace(/^availability:\s*/i,'').trim() || nextVal(i); continue; }
    const m1 = ln.match(/^(\d+\s*(?:hrs?|hours?|day))(?:\s*[-–—]\s*)(.+)$/i);
    if (m1){ out.sessions.push({ label:m1[1].replace(/\s+/g,' ').trim(), time:m1[2].trim(), price:null }); }
  }

  if (out.summary && /^summary$/i.test(out.summary.trim())){
    const idx = lines.findIndex(s=>/^summary$/i.test(s.trim()));
    if (idx>=0){ const nxt = lines.slice(idx+1).find(s=>s.trim()); if(nxt) out.summary = nxt.trim(); }
  }
  return out;
}

function buildProductPanelMarkdown(products) {
  if (!products?.length) return "";
  const primary = products.find(p=>p.price!=null) || products[0];

  let lowPrice=null, highPrice=null, priceCurrency="GBP";
  for (const p of products){
    const ro = p?.raw?.offers || {};
    const lp = ro.lowPrice ?? ro.lowprice ?? null;
    const hp = ro.highPrice ?? ro.highprice ?? null;
    if (lp!=null) lowPrice = lp;
    if (hp!=null) highPrice = hp;
    if (ro.priceCurrency) priceCurrency = ro.priceCurrency;
  }
  const headlineSingle = primary?.price!=null ? toGBP(primary.price) : null;
  const lowTx = lowPrice!=null ? toGBP(lowPrice) : null;
  const highTx= highPrice!=null? toGBP(highPrice): null;

  const title = primary.title || primary?.raw?.name || "Workshop";
  const headBits=[]; if(headlineSingle) headBits.push(headlineSingle); if(lowTx && highTx) headBits.push(`${lowTx}–${highTx}`);
  const priceHead = headBits.length ? ` — ${headBits.join(" • ")}` : "";

  const info = extractFromDescription(primary.description || primary?.raw?.description || "") || {};
  const sessions = [...(info.sessions||[])];
  if (sessions.length){
    if (lowPrice!=null && highPrice!=null && sessions.length>=2){ sessions[0].price=lowPrice; sessions[1].price=highPrice; }
    else if (primary?.price!=null){ sessions.forEach(s=>s.price=primary.price); }
  }

  const lines = [];
  lines.push(`**${title}**${priceHead}`);
  if (info.summary) lines.push(`\n${info.summary}`);

  const facts=[];
  if (info.location) facts.push(`**Location:** ${info.location}`);
  if (info.participants) facts.push(`**Participants:** ${info.participants}`);
  if (info.fitness) facts.push(`**Fitness:** ${info.fitness}`);
  if (info.availability) facts.push(`**Availability:** ${info.availability}`);
  if (facts.length){ lines.push(""); for(const f of facts) lines.push(f); }

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

/* ----------------------------- Pills builder ----------------------------- */
function buildEventPills({ productUrl, firstEventUrl, origin, photosUrl }) {
  const pills=[];
  if (productUrl)   pills.push({ label:"Book Now",     url:productUrl, brand:true });
  if (firstEventUrl)pills.push({ label:"Event Listing", url:firstEventUrl, brand:true });
  const moreEvents = origin ? `${origin}/search?query=workshops` : (productUrl || firstEventUrl);
  if (moreEvents)   pills.push({ label:"More Events",   url:moreEvents });
  if (photosUrl)    pills.push({ label:"Photos",        url:photosUrl });
  return pills.slice(0,4);
}

/* ----------------------------- Main flows -------------------------------- */
async function answerEventsFlow({ client, query }) {
  const { events, products } = await searchEventsProducts(client, query);

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
    .map(e=>({ ...e, when: fmtDateLondon(e.date_start) }))
    .slice(0,12);

  const structured = { topic:null, events:eventList, products:products||[], pills };

  return { ok:true, answer_markdown: productPanel || undefined, citations, structured, metaExtras:{ intent:"events" } };
}

async function answerAdviceFlow({ client, query }) {
  const articles = await searchArticles(client, query);
  const photosUrl = await findGalleryHub(client);

  const bulletList = articles.length
    ? "Here are Alan’s guides that match your question:\n\n" + articles.map(a=>`- [${a.title}](${a.url})`).join("\n")
    : "I couldn’t find a specific guide for that yet.";

  const origin = anyOriginFrom(articles?.[0]?.url);
  const pills = [
    articles[0] ? { label:"Read Guide", url:articles[0].url, brand:true } : null,
    origin ? { label:"More Articles", url:`${origin}/search?query=${encodeURIComponent(query)}`, brand:true } : null,
    origin ? { label:"Events", url:`${origin}/blog-on-photography/` } : null,
    photosUrl ? { label:"Photos", url:photosUrl } : null
  ].filter(Boolean).slice(0,4);

  return { ok:true, answer_markdown: bulletList, citations: articles.map(a=>a.url),
           structured:{ topic:null, events:[], products:[], articles, pills, chips:pills },
           metaExtras:{ intent:"advice" } };
}

/* -------------------------------- Handler -------------------------------- */
export default async function handler(req, res) {
  const started = Date.now();
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok:false, error:"method_not_allowed", where:"http" }); return;
    }

    const { query, topK } = req.body || {};
    const client = supabaseAdmin();

    let intent = inferIntent(query);
    if (intent === "auto") {
      const probe = await searchEventsProducts(client, query);
      intent = (probe.events?.length || probe.products?.length) ? "events" : "advice";
    }

    const result = intent === "events"
      ? await answerEventsFlow({ client, query })
      : await answerAdviceFlow({ client, query });

    res.status(200).json({
      ...result,
      meta: { duration_ms: Date.now()-started, endpoint:"/api/chat", topK: topK || null, intent: result?.metaExtras?.intent || intent }
    });
  } catch (err) {
    res.status(500).json({ ok:false, error:"unhandled_exception", where:"handler",
      hint:String(err?.message || err),
      meta:{ duration_ms: Date.now()-started, endpoint:"/api/chat" } });
  }
}
