// /api/chat.js
// Site-wide AI chat endpoint (Bluebell path updated to use topic-level product lookup)
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
// If explicit flags exist (raw.canonical=true/raw.topic/raw.role), use them.
// If not present or tags aren’t JSON, simply return nulls (we omit those chips).
async function resolveCanonicalsOptionA(client, topic) {
  const out = { product: null, landing: null, debug: {} };

  // explicit keys
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

  // We intentionally **do not** run a raw->tags contains() here because your data
  // isn’t guaranteed to store tags as a JSON array (which threw 22P02 in your log).
  return out;
}

/* ----------------------- Option line construction ----------------------- */
// Show each product option separately; dedupe by (name, price).
// If same name with multiple prices → collapse to "£99 • £150".
function buildOptionLines(products) {
  const items = (products || [])
    .map(p => {
      const name =
        (p.raw && (p.raw.name || p.raw?.["@name"])) ||
        (p.title || "Option");
      const price = p.price != null ? Number(p.price) : null;
      return { name: String(name).trim(), price, row: p };
    })
    .filter(x => x.price != null);

  // dedupe by name+price
  const seen = new Set();
  const uniqItems = [];
  for (const it of items) {
    const key = `${it.name}__${it.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqItems.push(it);
  }

  // group by name
  const byName = new Map();
  for (const it of uniqItems) {
    if (!byName.has(it.name)) byName.set(it.name, []);
    byName.get(it.name).push(it);
  }

  const lines = [];
  for (const [name, arr] of byName.entries()) {
    const prices = arr.map(a => a.price).sort((a,b)=>a-b);
    const priceBits = prices.map(p => toGBP(p)).filter(Boolean);
    if (!priceBits.length) continue;
    lines.push(arr.length === 1 ? `${name} — ${priceBits[0]}` : `${name} — ${priceBits.join(" • ")}`);
  }
  return lines;
}

/* ----------------------------- Chips builder ---------------------------- */
function buildChips({ bookNowUrl, landingUrl, anotherUrl }) {
  const chips = [];
  const used = new Set();
  const add = (label, url) => {
    if (!label || !url) return;
    if (used.has(url)) return;
    used.add(url);
    chips.push({ label, url });
  };

  add("Book Now", bookNowUrl);
  add("Bluebell info", landingUrl);
  add("Upcoming dates", anotherUrl); // first event page
  // cap at 4 total, but we only add up to 3 above (+ Book Now)
  return chips.slice(0, 4);
}

/* ------------------------------- Bluebell -------------------------------- */
async function answerBluebell({ query, client }) {
  const nowIso = new Date().toISOString();

  // 1) Resolve canonicals if present (no errors if missing)
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

  // 3) Products by topic (NOT by page_url)
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

  // 4) Build events list (cap 10) and citations
  const eventList = (events || []).slice(0, 10);
  const bullets = [];
  const bulletCitations = [];
  for (const ev of eventList) {
    const when = fmtDateLondon(ev.date_start);
    const where = ev.location ? ` — ${ev.location}` : "";
    const evUrl = pickUrl(ev);
    bullets.push(`- ${when} — [Link](${evUrl})${where}`);
    if (evUrl) bulletCitations.push(evUrl);
  }
  if (bullets.length === 0) bullets.push("- (no upcoming dates found)");

  // 5) Build workshop option lines (topic-level)
  const optionLines = buildOptionLines(products || []);

  // 6) Book Now URL: first product (topic-level) → fallback: first event
  let bookNowUrl = pickUrl(products?.[0]);
  if (!bookNowUrl && eventList[0]) bookNowUrl = pickUrl(eventList[0]);

  // 7) Chips
  const chips = buildChips({
    bookNowUrl,
    landingUrl: pickUrl(canon.landing),
    anotherUrl: pickUrl(eventList[0]),
  });

  // 8) Compose answer
  const parts = [];
  parts.push(`### Upcoming Bluebell Workshops`);
  parts.push(bullets.join("\n"));
  if (optionLines.length) {
    parts.push(`\n**Workshop Options:**`);
    parts.push(optionLines.map(l => `- ${l}`).join("\n"));
  }
  if (bookNowUrl) parts.push(`\n**Booking:** [Book Now](${bookNowUrl})`);

  const answer_markdown = parts.filter(Boolean).join("\n");

  // 9) Citations
  const citations = uniq([
    pickUrl(canon.landing),
    pickUrl(canon.product),
    ...bulletCitations,
    bookNowUrl,
  ]).filter(Boolean);

  // 10) Structured debug
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
