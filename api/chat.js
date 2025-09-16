// /api/chat.js
// Site-wide AI chat endpoint (Bluebell path: product panel + topic events)
// Runtime: NodeJS (Vercel)
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

/* ---------------------------- Supabase client ---------------------------- */
function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_*_KEY");
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
function uniq(arr) { return [...new Set((arr || []).filter(Boolean))]; }
function toGBP(n) {
  if (n == null || isNaN(Number(n))) return null;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(n));
}
function pickUrl(row) { return row?.source_url || row?.page_url || row?.url || null; }

/* ----------------------- Topic detection (simple) ------------------------ */
function getTopicFromQuery(query) {
  const q = (query || "").toLowerCase();
  if (q.includes("bluebell")) return "bluebell";
  return null;
}

/* --------- Canonical resolver (Option A) – tolerant if missing ---------- */
async function resolveCanonicalsOptionA(client, topic) {
  const out = { product: null, landing: null, debug: {} };

  const { data: prodA2, error: prodErr } = await client
    .from("page_entities")
    .select("*")
    .eq("kind", "product")
    .eq("raw->>canonical", "true")
    .eq("raw->>topic", topic)
    .eq("raw->>role", "product")
    .order("last_seen", { ascending: false })
    .limit(1);

  const { data: landA2, error: landErr } = await client
    .from("page_entities")
    .select("*")
    .in("kind", ["article", "page"])
    .eq("raw->>canonical", "true")
    .eq("raw->>topic", topic)
    .eq("raw->>role", "landing")
    .order("last_seen", { ascending: false })
    .limit(1);

  out.product = prodA2?.[0] || null;
  out.landing = landA2?.[0] || null;
  out.debug.explicitErrors = { prodErr, landErr };
  out.debug.selected = {
    product: out.product?.id || null,
    landing: out.landing?.id || null,
  };
  return out;
}

/* ----------------------- Product description parsing -------------------- */
/**
 * Handles lines like:
 *   Location:
 *   Warwickshire (Near Stratford Upon Avon)
 * or inline:
 *   Participants: Max 6
 * Also collects session lines and a short summary paragraph.
 */
function extractFromDescription(desc) {
  const out = {
    location: null,
    participants: null,
    fitness: null,
    availability: null,
    summary: null,
    sessions: [], // array of { label, time, price: null|number }
  };
  if (!desc) return out;

  const lines = desc.split(/\r?\n/).map(s => s.trim());
  // First non-empty line(s) that are not labels become the summary paragraph
  const nonEmpty = lines.filter(Boolean);
  if (nonEmpty.length) {
    // Grab the first sentence-like chunk as summary
    out.summary = nonEmpty[0];
  }

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];

    // Look-ahead helper: when a label is on this line and the value is on the next
    const nextVal = () => {
      for (let j = i + 1; j < lines.length; j++) {
        const t = lines[j].trim();
        if (!t) continue;
        return t;
      }
      return null;
    };

    // Labels (inline or next-line value)
    if (/^location:/i.test(ln)) {
      const v = ln.replace(/^location:\s*/i, '').trim() || nextVal();
      if (v) out.location = v;
      continue;
    }
    if (/^participants:/i.test(ln)) {
      const v = ln.replace(/^participants:\s*/i, '').trim() || nextVal();
      if (v) out.participants = v;
      continue;
    }
    if (/^fitness:/i.test(ln)) {
      const v = ln.replace(/^fitness:\s*/i, '').trim() || nextVal();
      if (v) out.fitness = v;
      continue;
    }
    if (/^availability:/i.test(ln)) {
      const v = ln.replace(/^availability:\s*/i, '').trim() || nextVal();
      if (v) out.availability = v;
      continue;
    }

    // Session lines (generic)
    // e.g. "4hrs - 5:45 am to 9:45 am or 10:30 am to 2:30 pm"
    // or   "OR 1 day - 5:45 am to 2:30 pm"
    const m1 = ln.match(/^(\d+\s*(?:hrs?|hours?|day))(?:\s*[-–—]\s*)(.+)$/i);
    if (m1) {
      const rawLabel = m1[1].replace(/\s+/g, ' ').trim();
      const time = m1[2].trim();
      out.sessions.push({ label: rawLabel, time, price: null });
      continue;
    }
  }

  // De-dup quick pass for summary repeating in description again
  if (out.summary && out.summary.toLowerCase().startsWith("summary")) {
    // If literal "Summary" header, try the next non-empty as actual summary
    const idx = lines.findIndex(s => /^summary$/i.test(s.trim()));
    if (idx >= 0) {
      const nxt = lines.slice(idx + 1).find(s => s.trim());
      if (nxt) out.summary = nxt.trim();
    }
  }

  return out;
}

/* --------------------- Build product panel (markdown) -------------------- */
function buildProductPanelMarkdown(products) {
  if (!products?.length) return "";

  // Prefer an entry with a direct price; else fall back to the first
  const primary = products.find(p => p.price != null) || products[0];

  // Price headline bits
  const headlinePrice = primary?.price != null ? toGBP(primary.price) : null;

  // Also capture aggregate low/high if present anywhere
  let lowPrice = null, highPrice = null, priceCurrency = "GBP";
  for (const p of products) {
    const ro = p?.raw?.offers || p?.raw?.Offers || {};
    const lp = ro.lowPrice ?? ro.lowprice ?? null;
    const hp = ro.highPrice ?? ro.highprice ?? null;
    if (lp != null) lowPrice = lp;
    if (hp != null) highPrice = hp;
    if (ro.priceCurrency) priceCurrency = ro.priceCurrency;
  }
  const lowTx  = lowPrice != null ? toGBP(lowPrice) : null;
  const highTx = highPrice != null ? toGBP(highPrice) : null;

  // Pull description fields (including look-ahead labels)
  const info = extractFromDescription(primary.description || primary?.raw?.description || "");

  // Attach prices to session rows:
  // If we have both low/high and we have 2 sessions, assume first = low, second = high.
  const sessions = [...(info.sessions || [])];
  if (sessions.length) {
    if (lowPrice != null && highPrice != null && sessions.length >= 2) {
      sessions[0].price = lowPrice;
      sessions[1].price = highPrice;
    } else if (primary?.price != null) {
      // Single price -> attach to each session
      sessions.forEach(s => (s.price = primary.price));
    }
  }

  const title = primary.title || primary?.raw?.name || "Workshop";
  const priceHeadBits = [];
  if (headlinePrice) priceHeadBits.push(headlinePrice);
  if (lowTx && highTx) priceHeadBits.push(`${lowTx}–${highTx}`);
  const priceHead = priceHeadBits.length ? ` — ${priceHeadBits.join(" • ")}` : "";

  const lines = [];
  lines.push(`**${title}**${priceHead}`);

  if (info.summary) lines.push(`\n${info.summary}`);

  const detailRows = [];
  if (info.availability) detailRows.push(`**Availability:**  ${info.availability}`);
  if (info.location)     detailRows.push(`**Location:**  ${info.location}`);
  if (info.participants) detailRows.push(`**Participants:**  ${info.participants}`);
  if (info.fitness)      detailRows.push(`**Fitness:**  ${info.fitness}`);
  if (detailRows.length) {
    lines.push("");
    for (const d of detailRows) lines.push(d);
  }

  if (sessions.length) {
    lines.push("");
    for (const s of sessions) {
      const pretty = s.label.replace(/\bhrs\b/i, "hours");
      const ptxt = s.price != null ? ` — ${toGBP(s.price)}` : "";
      lines.push(`- **${pretty}** — ${s.time}${ptxt}`);
    }
  }

  // No raw "Book Now" link here; chips will handle that.
  return lines.join("\n");
}

/* ----------------------------- Chips builder ---------------------------- */
function buildChips({ bookNowUrl, landingUrl, anotherUrl }) {
  const chips = [];
  const used = new Set();
  const add = (label, url, brand=false) => {
    if (!label || !url) return;
    if (used.has(url)) return;
    used.add(url);
    chips.push({ label, url, brand });
  };

  add("Book Now", bookNowUrl, true);
  add("Prices", bookNowUrl ? bookNowUrl + "#prices" : landingUrl || anotherUrl, true);
  add("Upcoming dates", anotherUrl || bookNowUrl || landingUrl, true);
  if (landingUrl) add("Info", landingUrl, false);

  return chips.slice(0, 4);
}

/* -------------------------------- Bluebell -------------------------------- */
async function answerBluebell({ query, client }) {
  const nowIso = new Date().toISOString();

  // 1) Optional canonicals
  const canon = await resolveCanonicalsOptionA(client, "bluebell");

  // 2) Future events (topic by title/page_url)
  const { data: events, error: evErr } = await client
    .from("page_entities")
    .select("id, title, page_url, source_url, date_start, date_end, location, raw")
    .eq("kind", "event")
    .or("title.ilike.%bluebell%,page_url.ilike.%bluebell%")
    .gte("date_start", nowIso)
    .order("date_start", { ascending: true })
    .limit(100);

  if (evErr) {
    return { ok: false, error: "event_query_failed", where: "events", hint: evErr.message };
  }

  // 3) Products by topic
  const { data: products, error: prodErr } = await client
    .from("page_entities")
    .select("*")
    .eq("kind", "product")
    .or("title.ilike.%bluebell%,page_url.ilike.%bluebell%")
    .order("last_seen", { ascending: false })
    .limit(50);

  if (prodErr) {
    return { ok: false, error: "product_query_failed", where: "products", hint: prodErr.message };
  }

  // 4) Compose product panel markdown (top block)
  const productPanel = buildProductPanelMarkdown(products || []);

  // 5) Build events list bullets for answer_markdown
  const eventList = (events || []).slice(0, 10);
  const bullets = [];
  for (const ev of eventList) {
    const when = fmtDateLondon(ev.date_start);
    const where = ev.location ? ` — ${ev.location}` : "";
    const evUrl = pickUrl(ev);
    bullets.push(`- ${when} — [Link](${evUrl})${where}`);
  }
  const eventsMd = bullets.length ? `\n\n### Upcoming bluebell Workshops\n\n${bullets.join("\n")}` : "";

  // 6) Book Now URL
  let bookNowUrl = pickUrl(products?.[0]);
  if (!bookNowUrl && eventList[0]) bookNowUrl = pickUrl(eventList[0]);

  // 7) Chips
  const chips = buildChips({
    bookNowUrl,
    landingUrl: pickUrl(canon.landing),
    anotherUrl: pickUrl(eventList[0]),
  });

  // 8) Final markdown answer: product panel + events list (no inline raw URL)
  const answer_markdown = [productPanel, eventsMd].filter(Boolean).join("\n");

  // 9) Citations
  const citations = uniq([
    pickUrl(canon.landing),
    pickUrl(canon.product),
    ...((events || []).map(pickUrl)),
    pickUrl(products?.[0]),
  ]).filter(Boolean);

  // 10) Structured payload
  const structured = {
    topic: "bluebell",
    events: eventList,
    products: products || [],
    canonicals: { product: canon.product || null, landing: canon.landing || null, debug: canon.debug },
    chips,
  };

  return { ok: true, answer_markdown, citations, structured };
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

    const topic = getTopicFromQuery(query);

    if (topic === "bluebell") {
      const result = await answerBluebell({ query, client });
      res.status(result.ok ? 200 : 500).json({
        ...result,
        meta: { duration_ms: Date.now() - started, endpoint: "/api/chat", topK: topK || null },
      });
      return;
    }

    // Generic fallback — to be expanded later
    res.status(200).json({
      ok: true,
      answer_markdown:
        "I don’t have a specific answer for that yet. Try asking about workshops, tuition, kit, or locations — for example, “When are the next Bluebell dates?”",
      citations: [],
      structured: { topic: null },
      meta: { duration_ms: Date.now() - started, endpoint: "/api/chat", topK: topK || null },
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
