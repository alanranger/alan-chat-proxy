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

const SITE_ORIGIN =
  process.env.SITE_ORIGIN?.replace(/\/$/, "") || "https://www.alanranger.com";

/* ------------------------------ Small utils ------------------------------ */
const TZ = "Europe/London";
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

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
function currency(n, ccy = "GBP") {
  if (n == null || isNaN(Number(n))) return null;
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: ccy,
      maximumFractionDigits: 0,
    }).format(Number(n));
  } catch {
    return `£${n}`;
  }
}
function pickUrl(row) {
  return row?.page_url || row?.source_url || row?.url || null;
}
function titleCase(slugish) {
  const t = String(slugish || "")
    .replace(/\.(html?|php)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return t
    ? t.replace(/\b([a-z])/g, (m, a) => a.toUpperCase())
    : "Related link";
}

/* --------------------------- Intent + tokeniser -------------------------- */
function tokenize(q) {
  return (q || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length >= 3 && !stop.has(t));
}
const stop = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "your",
  "you",
  "what",
  "when",
  "next",
  "date",
  "into",
  "about",
  "more",
  "how",
  "can",
  "are",
  "any",
  "who",
  "does",
  "do",
]);

function detectIntent(q) {
  const s = (q || "").toLowerCase();
  const asksDate =
    /(when|date|next|schedule|time)/.test(s) && /(workshop|course|event)/.test(s);
  const mentionsPlace =
    /(devon|batsford|warwickshire|cotswolds|lake|district|wales|coventry|dorset|bluebell|autumn|woodland)/.test(
      s
    );
  if (asksDate || mentionsPlace) return "events";
  // default to advice (guides/blog answers)
  return "advice";
}

/* ----------------------------- SQL helpers ------------------------------ */
function buildOrIlike(cols, tokens) {
  const parts = [];
  for (const t of tokens) {
    for (const c of cols) parts.push(`${c}.ilike.%${t}%`);
  }
  return parts.join(",");
}

/* ------------------------------ Events flow ----------------------------- */
async function fetchEvents(client, tokens) {
  const nowIso = new Date().toISOString();
  let orExpr = buildOrIlike(
    ["title", "page_url", "source_url", "location"],
    tokens
  );
  if (!orExpr) orExpr = "title.ilike.%%";

  const { data, error } = await client
    .from("page_entities")
    .select(
      "id,title,page_url,source_url,date_start,date_end,location,raw,kind,last_seen"
    )
    .eq("kind", "event")
    .gte("date_start", nowIso)
    .or(orExpr)
    .order("date_start", { ascending: true })
    .limit(100);

  if (error) throw error;
  return data || [];
}

async function fetchProducts(client, tokens) {
  let orExpr = buildOrIlike(["title", "page_url", "source_url"], tokens);
  if (!orExpr) orExpr = "title.ilike.%%";

  const { data, error } = await client
    .from("page_entities")
    .select("*")
    .eq("kind", "product")
    .or(orExpr)
    .order("last_seen", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data || [];
}

function extractFacts(desc) {
  const lines = String(desc || "")
    .split(/\r?\n/)
    .map((s) => s.trim());

  const cleaned = lines.filter((l) => {
    if (/^dates?\b/i.test(l)) return false;
    if (/^\s*(mon|tue|wed|thu|fri|sat|sun)\b/i.test(l)) return false;
    if (/\b\d{1,2}[:.]\d{2}\s*(am|pm)/i.test(l) && /–|—|-/.test(l)) return true;
    return true;
  });

  const nextVal = (i) => {
    for (let j = i + 1; j < cleaned.length; j++) {
      const t = cleaned[j].trim();
      if (!t) continue;
      return t;
    }
    return null;
  };

  const out = {
    location: null,
    participants: null,
    fitness: null,
    availability: null,
    optionLines: [],
  };

  for (let i = 0; i < cleaned.length; i++) {
    const ln = cleaned[i];
    if (/^location\b/i.test(ln))
      out.location = ln.replace(/^location\s*:?\s*/i, "").trim() || nextVal(i);
    if (/^participants?\b/i.test(ln))
      out.participants =
        ln.replace(/^participants?\s*:?\s*/i, "").trim() || nextVal(i);
    if (/^fitness\b/i.test(ln))
      out.fitness = ln.replace(/^fitness\s*:?\s*/i, "").trim() || nextVal(i);
    if (/^availability\b/i.test(ln))
      out.availability =
        ln.replace(/^availability\s*:?\s*/i, "").trim() || nextVal(i);

    if (
      /^\s*(?:4\s*hrs?|4\s*hours?|half\s*day|1\s*day|full\s*day|day)\b/i.test(ln)
    ) {
      out.optionLines.push(ln);
    } else if (/^\s*or\s*1\s*day\b/i.test(ln)) {
      out.optionLines.push(ln);
    }
  }
  return out;
}

function buildOptions(prod, facts) {
  const ccy =
    prod.price_currency || prod?.raw?.offers?.priceCurrency || "GBP";
  const base = prod.price ?? prod?.raw?.offers?.price;
  const low = prod?.raw?.offers?.lowPrice;
  const high = prod?.raw?.offers?.highPrice;

  const text = (facts.optionLines || []).join("\n").toLowerCase();
  const has4h =
    /(?:^|\n)\s*(?:4\s*hrs?|4\s*hours?|half\s*day)\b/.test(text);
  const has1d = /(?:^|\n)\s*(?:1\s*day|full\s*day|day)\b/.test(text);

  const opts = [];
  if (low != null && high != null && has4h && has1d) {
    opts.push({ label: "4 hours", price: currency(low, ccy) });
    opts.push({ label: "1 day", price: currency(high, ccy) });
  } else {
    if (base != null) opts.push({ label: "Standard", price: currency(base, ccy) });
    if (low != null || high != null) {
      const range = [low, high]
        .filter((v) => v != null)
        .map((v) => currency(v, ccy))
        .join(" – ");
      if (range) opts.push({ label: "Pricing", price: range });
    }
  }

  const timePat =
    /(\d{1,2}:\d{2}\s*(?:am|pm))\s*[–-]\s*(\d{1,2}:\d{2}\s*(?:am|pm))(?:\s*or\s*(\d{1,2}:\d{2}\s*(?:am|pm))\s*[–-]\s*(\d{1,2}:\d{2}\s*(?:am|pm)))?/i;
  for (const ln of facts.optionLines || []) {
    const label = ln.replace(/\s*—.*$/i, "").replace(/^OR\s*/i, "").trim();
    const tm = ln.match(timePat);
    const window = tm
      ? `${tm[1]} – ${tm[2]}${tm[3] ? ` or ${tm[3]} – ${tm[4]}` : ""}`
      : null;
    if (
      label &&
      !opts.some((o) => o.label.toLowerCase() === label.toLowerCase())
    ) {
      opts.push({ label, time: window });
    } else if (window) {
      const o = opts.find((o) => o.label.toLowerCase() === label.toLowerCase());
      if (o && !o.time) o.time = window;
    }
  }
  return opts;
}

function productPanelMarkdown(prod) {
  const facts = extractFacts(prod.description || prod?.raw?.description || "");
  const opts = buildOptions(prod, facts);

  const bits = [];
  bits.push(`**${prod.title || prod?.raw?.name || "Workshop"}**`);
  if (facts.location) bits.push(`\n**Location:** ${facts.location}`);
  if (facts.participants) bits.push(`\n**Participants:** ${facts.participants}`);
  if (facts.fitness) bits.push(`\n**Fitness:** ${facts.fitness}`);
  if (facts.availability) bits.push(`\n**Availability:** ${facts.availability}`);
  if (opts.length) {
    bits.push("");
    for (const o of opts) {
      const more = [o.time, o.price].filter(Boolean).join(" — ");
      bits.push(`- **${o.label}**${more ? ` — ${more}` : ""}`);
    }
  }
  return bits.join("\n");
}

/* ------------------------------ Advice flow ------------------------------ */
async function fetchArticlesByEntities(client, tokens, limit = 8) {
  if (!tokens.length) return [];
  let orExpr = buildOrIlike(["title", "page_url", "source_url"], tokens);
  if (!orExpr) orExpr = "title.ilike.%%";

  const { data, error } = await client
    .from("page_entities")
    .select("title,page_url,source_url,kind,last_seen")
    .in("kind", ["article", "page"])
    .or(orExpr)
    .order("last_seen", { ascending: false })
    .limit(limit * 2);

  if (error) throw error;

  const rows = (data || []).filter((r) =>
    /alanranger\.com/.test(pickUrl(r) || "")
  );

  const out = [];
  const seen = new Set();
  for (const r of rows) {
    const u = pickUrl(r);
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push({ title: r.title || "", url: u });
    if (out.length >= limit) break;
  }
  return out;
}

async function fetchArticlesByChunks(client, tokens, limit = 8) {
  if (!tokens.length) return [];
  const orExpr = buildOrIlike(["text"], tokens) || "text.ilike.%%";

  const { data, error } = await client
    .from("chunks")
    .select("source_url,url")
    .or(orExpr)
    .limit(250);

  if (error) throw error;

  const urls = uniq(
    (data || [])
      .map((r) => r.source_url || r.url)
      .filter((u) => /alanranger\.com\/blog-on-photography/i.test(u || ""))
  ).slice(0, 40);

  if (!urls.length) return [];

  const { data: arts } = await client
    .from("page_entities")
    .select("title,page_url,source_url,kind,last_seen")
    .in("kind", ["article", "page"])
    .in("source_url", urls)
    .limit(limit * 2);

  const out = [];
  const seen = new Set();
  for (const r of arts || []) {
    const u = pickUrl(r);
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push({ title: r.title || "", url: u });
    if (out.length >= limit) break;
  }
  return out;
}

async function findArticleExtras(client, articleUrl) {
  // Probe page_chunks for extracted.links containing pdf and related links
  const { data } = await client
    .from("page_chunks")
    .select("url,extracted")
    .ilike("url", `${articleUrl}%`)
    .limit(50);

  const links = [];
  for (const row of data || []) {
    const arr = row?.extracted?.links || row?.extracted?.["links"] || [];
    for (const it of arr) {
      const href = (typeof it === "string" ? it : it?.href) || null;
      if (href) links.push(href);
    }
  }
  const uniqLinks = uniq(links);

  const pdf = uniqLinks.find((u) => /\.pdf(\?|#|$)/i.test(u || ""));
  const related = uniqLinks.find(
    (u) =>
      /^https?:\/\/(www\.)?alanranger\.com\//i.test(u || "") &&
      !/\.pdf(\?|#|$)/i.test(u || "") &&
      u !== articleUrl
  );

  let relatedLabel = null;
  if (related) {
    try {
      const u = new URL(related);
      const parts = u.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1] || parts[parts.length - 2] || "";
      relatedLabel = "Related: " + titleCase(last);
    } catch {
      relatedLabel = "Related link";
    }
  }

  return { pdf, related, relatedLabel };
}

/* ------------------------------- Hubs etc -------------------------------- */
async function findWorkshopsHub(client) {
  // Try to find a good workshops hub page (no hard-coding)
  const { data } = await client
    .from("page_entities")
    .select("title,page_url,source_url,kind,last_seen")
    .in("kind", ["page", "article"])
    .or("title.ilike.%workshop%,page_url.ilike.%workshop%")
    .order("last_seen", { ascending: false })
    .limit(30);

  const pick = (data || []).find((r) =>
    /\/workshops/i.test(pickUrl(r) || "")
  );
  return pick ? pickUrl(pick) : `${SITE_ORIGIN}/workshops`;
}

/* ------------------------------ Main handler ----------------------------- */
export default async function handler(req, res) {
  const started = Date.now();
  try {
    if (req.method !== "POST") {
      res
        .status(405)
        .json({ ok: false, error: "method_not_allowed", where: "http" });
      return;
    }

    const { query, topK = 8 } = req.body || {};
    const client = supabaseAdmin();

    const intent = detectIntent(query);
    const tokens = tokenize(query);

    const structured = { intent, topic: null, events: [], products: [], articles: [], pills: [] };
    const citations = [];

    if (intent === "events") {
      const events = await fetchEvents(client, tokens);
      structured.events = events.map((e) => ({
        ...e,
        when: e.date_start ? fmtDateLondon(e.date_start) : null,
      }));

      // Product(s) that seem to match this topic
      const products = await fetchProducts(client, tokens);
      structured.products = products;

      // Build event/product pills
      const firstEventUrl = pickUrl(events[0]) || null;
      const firstProductUrl = pickUrl(products[0]) || null;

      const hubUrl = await findWorkshopsHub(client);

      if (firstProductUrl) {
        structured.pills.push({ label: "Book Now", url: firstProductUrl, brand: true });
      }
      if (firstEventUrl) {
        structured.pills.push({ label: "Event Listing", url: firstEventUrl });
      }
      if (hubUrl) {
        structured.pills.push({ label: "More Events", url: hubUrl });
      }
      structured.pills.push({
        label: "Photos",
        url: `${SITE_ORIGIN}/gallery-image-portfolios`,
      });

      citations.push(...uniq([firstEventUrl, firstProductUrl, hubUrl]).filter(Boolean));

      // Render product panel as the main answer when a product exists
      let answer_markdown = "";
      if (products.length) {
        answer_markdown = productPanelMarkdown(products[0]);
      }

      res.status(200).json({
        ok: true,
        answer_markdown: answer_markdown || "",
        citations: uniq(citations),
        structured,
        meta: {
          duration_ms: Date.now() - started,
          endpoint: "/api/chat",
          topK,
          intent,
        },
      });
      return;
    }

    // ---- Advice intent (guides/blog answers)
    let articles = await fetchArticlesByEntities(client, tokens, topK);
    if (articles.length < clamp(topK / 2, 2, 4)) {
      const extra = await fetchArticlesByChunks(client, tokens, topK);
      const merged = [];
      const seen = new Set(articles.map((a) => a.url));
      for (const a of extra) {
        if (seen.has(a.url)) continue;
        seen.add(a.url);
        merged.push(a);
      }
      articles = articles.concat(merged).slice(0, topK);
    }
    structured.articles = articles;

    // Advice pills
    if (articles.length) {
      const first = articles[0].url;
      structured.pills.push({ label: "Read Guide", url: first, brand: true });
      structured.pills.push({
        label: "More Articles",
        url: `${SITE_ORIGIN}/search?query=${encodeURIComponent(query || "")}`,
        brand: true,
      });

      // Try to find a downloadable checklist or a related internal link
      const extras = await findArticleExtras(client, first);
      if (extras.pdf) structured.pills.push({ label: "Download Checklist", url: extras.pdf });
      if (extras.related) {
        structured.pills.push({
          label: extras.relatedLabel || "Related link",
          url: extras.related,
        });
      }
      citations.push(first);
    } else {
      // No articles at all; keep the experience helpful
      structured.pills.push({
        label: "More Articles",
        url: `${SITE_ORIGIN}/search?query=${encodeURIComponent(query || "")}`,
        brand: true,
      });
      structured.pills.push({
        label: "Photos",
        url: `${SITE_ORIGIN}/gallery-image-portfolios`,
      });
    }

    const answer_markdown =
      articles.length
        ? `Here are Alan’s guides that match your question:\n\n${articles
            .map((a) => `- [${a.title || "Read guide"}](${a.url})`)
            .join("\n")}`
        : "I couldn’t find a specific guide for that yet.";

    res.status(200).json({
      ok: true,
      answer_markdown,
      citations: uniq(citations),
      structured,
      meta: {
        intent,
        duration_ms: Date.now() - started,
        endpoint: "/api/chat",
        topK,
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
