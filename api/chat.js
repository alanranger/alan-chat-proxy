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

/* -------------------------- Intent & keywording -------------------------- */
function inferIntent(query) {
  const q = (query || "").toLowerCase();

  const hasWorkshopish = /(workshop|course|event|class|devon|bluebell|autumn|astro|batsford|coventry|lightroom)s?/i.test(q);
  const askSchedule   = /(when|date|next|upcoming|where|time|schedule|book|cost|price)/i.test(q);

  // Bias towards "events" if it's about workshops/courses/events at all
  if (hasWorkshopish) return "events";
  // Otherwise general advice/articles
  if (askSchedule) return "events"; // many schedule-ish questions without explicit word "workshop"
  return "advice";
}
function kwFromQuery(query, limit = 5) {
  const stop = new Set(["the","a","an","of","in","on","for","to","your","my","is","are","and","or","do","i","you","me","with","about","what","when","where","how","next"]);
  return (query || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(w => !stop.has(w))
    .slice(0, limit);
}

/* --------------------------- Data lookups (DB) --------------------------- */
async function searchUpcomingEvents(client, query, topK = 100) {
  const nowIso = new Date().toISOString();
  const kws = kwFromQuery(query);
  // Build ilike OR for keywords (title/page_url)
  const ors = kws.map(k => `title.ilike.%${k}%,page_url.ilike.%${k}%`).join(",");
  const filter = ors ? `.or(${ors})` : "";

  let q = client
    .from("page_entities")
    .select("id,title,page_url,source_url,date_start,date_end,location,raw")
    .eq("kind", "event")
    .gte("date_start", nowIso)
    .order("date_start", { ascending: true })
    .limit(topK);

  if (filter) q = q.or(ors);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function searchArticles(client, query, topK = 10) {
  const kws = kwFromQuery(query);
  const ors = kws.map(k => `title.ilike.%${k}%,page_url.ilike.%${k}%`).join(",");
  // Include both 'article' and 'page' so we catch guides and info pages
  let q = client
    .from("page_entities")
    .select("id,title,page_url,source_url,raw")
    .in("kind", ["article", "page"])
    .order("last_seen", { ascending: false })
    .limit(topK);

  if (ors) q = q.or(ors);
  const { data, error } = await q;
  if (error) throw error;

  // prefer blog posts if present
  const blogFirst = (data || []).sort((a,b) => {
    const au = (a.page_url || "").includes("/blog-on-photography/") ? 1 : 0;
    const bu = (b.page_url || "").includes("/blog-on-photography/") ? 1 : 0;
    return bu - au;
  });
  return blogFirst;
}

/* ----------------------------- Pills builder ---------------------------- */
function buildEventPills(firstEventUrl) {
  // Use stable listing/search URLs rather than echoing user query
  const listing = "https://www.alanranger.com/search?query=workshops";
  const photos  = "https://www.alanranger.com/gallery-image-portfolios";

  const pills = [];
  if (firstEventUrl) pills.push({ label: "Book Now", url: firstEventUrl, brand: true });
  pills.push({ label: "Event Listing", url: listing, brand: true });
  pills.push({ label: "More Events", url: listing, brand: true });
  pills.push({ label: "Photos", url: photos, brand: false });
  return pills;
}
function buildAdvicePills(firstArticleUrl, query) {
  const searchUrl = `https://www.alanranger.com/search?query=${encodeURIComponent(query || "")}`;
  const photos    = "https://www.alanranger.com/gallery-image-portfolios";
  const out = [];
  if (firstArticleUrl) out.push({ label: "Read Guide", url: firstArticleUrl, brand: true });
  out.push({ label: "More Articles", url: searchUrl, brand: true });
  out.push({ label: "Events", url: "https://www.alanranger.com/search?query=workshops", brand: false });
  out.push({ label: "Photos", url: photos, brand: false });
  return out;
}

/* ------------------------------ Handler core ---------------------------- */
export default async function handler(req, res) {
  const started = Date.now();
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed", where: "http" });
      return;
    }

    const { query, topK } = req.body || {};
    const client = supabaseAdmin();
    const intent = inferIntent(query);

    if (intent === "events") {
      const events = await searchUpcomingEvents(client, query, Math.max(50, Number(topK || 8)));
      const firstUrl = pickUrl(events?.[0]);
      const pills = buildEventPills(firstUrl);

      const structured = {
        intent: "events",
        events: (events || []).map(e => ({
          id: e.id,
          title: e.title,
          when: fmtDateLondon(e.date_start),
          page_url: e.page_url,
          source_url: e.source_url,
          location: e.location || null,
        })),
        articles: [],
        pills,
      };

      const citations = uniq((events || []).map(pickUrl));

      // Friendly markdown (panel content primarily lives in the UI)
      const answer_markdown =
        events?.length
          ? "" // UI renders the events list; no extra prose needed
          : "I couldn’t find upcoming dates for that just now — try the Event Listing or ask me about a specific location or month.";

      res.status(200).json({
        ok: true,
        answer_markdown,
        citations,
        structured,
        meta: {
          duration_ms: Date.now() - started,
          endpoint: "/api/chat",
          topK: topK || null,
          intent: "events",
        },
      });
      return;
    }

    // ----- ADVICE PATH -----
    // Expand synonyms so “feedback / critique / mentoring / 1-2-1” get hits.
    const enrichedQuery = enrichAdviceQuery(query);
    const articles = await searchArticles(client, enrichedQuery, Math.max(10, Number(topK || 8)));
    const firstArticleUrl = pickUrl(articles?.[0]);
    const pills = buildAdvicePills(firstArticleUrl, query);

    const structured = {
      intent: "advice",
      events: [],
      articles: (articles || []).slice(0, 12).map(a => ({
        id: a.id,
        title: a.title,
        url: pickUrl(a),
      })),
      pills,
    };

    const citations = uniq((articles || []).map(pickUrl));
    const linksMd = (structured.articles || [])
      .slice(0, 6)
      .map(a => `- ${a.title} — ${a.url}`)
      .join("\n");

    const answer_markdown =
      linksMd ||
      "I couldn’t find a specific guide for that yet.";

    res.status(200).json({
      ok: true,
      answer_markdown,
      citations,
      structured,
      meta: {
        duration_ms: Date.now() - started,
        endpoint: "/api/chat",
        topK: topK || null,
        intent: "advice",
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

/* --------------------------- tiny query enrichers ----------------------- */
function enrichAdviceQuery(q) {
  const s = (q || "").toLowerCase();
  // add synonyms for some FAQs so article search hits
  let extra = "";
  if (/feedback|critique|review|personal/i.test(s)) extra += " feedback critique mentoring 1-2-1";
  if (/tripod/i.test(s)) extra += " tripod head legs travel carbon";
  if (/sharp|focus|blurry|blur/i.test(s)) extra += " sharpness focus technique";
  if (/long exposure|nd filter|big stopper|slow shutter/i.test(s)) extra += " long exposure nd-filter";
  if (/certificate/i.test(s)) extra += " certificate course policy";
  if (/camera.*need/i.test(s)) extra += " camera requirements gear kit";
  return (q || "") + " " + extra.trim();
}
