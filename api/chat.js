// /api/chat.js
// Site-wide AI chat endpoint (Bluebell path sends a complete answer_markdown block)
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
function normAvailability(v) {
  if (!v) return null;
  const s = String(v).toLowerCase();
  if (s.includes("instock")) return "In Stock";
  if (s.includes("outofstock") || s.includes("out_of_stock")) return "Out of Stock";
  if (s.includes("preorder")) return "Preorder";
  return null;
}

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
    .from("page_entities").select("*")
    .eq("kind", "product")
    .eq("raw->>canonical", "true")
    .eq("raw->>topic", topic)
    .eq("raw->>role", "product")
    .order("last_seen", { ascending: false }).limit(1);

  const { data: landA2, error: landErr } = await client
    .from("page_entities").select("*")
    .in("kind", ["article", "page"])
    .eq("raw->>canonical", "true")
    .eq("raw->>topic", topic)
    .eq("raw->>role", "landing")
    .order("last_seen", { ascending: false }).limit(1);

  out.product = prodA2?.[0] || null;
  out.landing = landA2?.[0] || null;
  out.debug.explicitErrors = { prodErr, landErr };
  out.debug.selected = { product: out.product?.id || null, landing: out.landing?.id || null };
  return out;
}

/* -------------------- Product description field parser ------------------- */
function parseDesc(desc) {
  const out = {
    blurb: "",
    location_text: null,
    participants_text: null,
    fitness_text: null,
    sessions: [],
  };
  if (!desc) return out;

  const lines = String(desc).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);

  // blurb = first non-label line that looks like prose
  out.blurb = lines.find(
    ln => !/^\w+\s*:$/i.test(ln) &&
          !/^(location|participants|fitness|availability)\s*:/i.test(ln)
  ) || "";

  const grab = (label) => {
    // pattern: "Label: value"
    const m = lines.map(ln => ln.match(new RegExp(`^${label}\\s*:\\s*(.+)$`, "i"))).find(Boolean);
    if (m) return m[1].trim();
    // pattern: "Label:" then next non-empty line
    for (let i=0;i<lines.length;i++){
      if (new RegExp(`^${label}\\s*:\\s*$`, "i").test(lines[i])) {
        const nxt = lines.slice(i+1).find(x=>x && !/:$/.test(x));
        if (nxt) return nxt.trim();
      }
    }
    return null;
  };

  out.location_text = grab("Location");
  out.participants_text = grab("Participants");
  out.fitness_text = grab("Fitness");

  // session lines (4hrs…, OR 1 day…, Full day…)
  for (const ln of lines) {
    if (/^(\s*or\s*)?(?:\d+\s*hrs?|\d+\s*hours?|full\s*day|\d+\s*day)/i.test(ln)) {
      out.sessions.push(ln.replace(/^or\s*/i, "").trim());
    }
  }
  return out;
}

/* ------------------------- Price / options builder ----------------------- */
function extractPricesFromOffers(raw) {
  if (!raw) return {};
  const offers = raw.offers || raw.Offers || null;
  const single = offers && !Array.isArray(offers) && String(offers["@type"]).toLowerCase()==="offer" ? offers : null;
  const aggr   = offers && !Array.isArray(offers) && String(offers["@type"]).toLowerCase()==="aggregateoffer" ? offers : null;

  const price_currency = single?.priceCurrency || aggr?.priceCurrency || raw?.priceCurrency || "GBP";
  const availability_text = normAvailability(single?.availability) || normAvailability(aggr?.availability) || null;

  return {
    price_single: single?.price != null ? Number(single.price) : null,
    price_low: aggr?.lowPrice != null ? Number(aggr.lowPrice) : null,
    price_high: aggr?.highPrice != null ? Number(aggr.highPrice) : null,
    price_currency,
    availability_text,
  };
}

function buildSessionOptions(parsedDesc, prices) {
  const sessions = parsedDesc.sessions || [];
  const items = [];
  const priceText = (n) => (n != null ? toGBP(n) : null);

  if (!sessions.length) return items;

  const ordered = [...sessions].sort((a,b)=>a.length-b.length); // shortest wording first
  const { price_low: low, price_high: high, price_single: single } = prices;

  if (low != null && high != null && ordered.length >= 2) {
    ordered.forEach((ln, idx) => {
      const p = idx === 0 ? low : high;
      items.push({ label: ln.split("-")[0].trim(), time: ln, price: p, price_text: priceText(p) });
    });
  } else {
    ordered.forEach((ln) => {
      items.push({ label: ln.split("-")[0].trim(), time: ln, price: single ?? null, price_text: priceText(single ?? null) });
    });
  }
  return items;
}

function enrichProduct(p) {
  const raw = p?.raw || {};
  const parsed = parseDesc(p?.description || raw?.description || "");
  const prices = extractPricesFromOffers(raw);
  const session_options = buildSessionOptions(parsed, prices);

  return {
    ...p,
    _enriched: {
      blurb: parsed.blurb || "",
      location_text: parsed.location_text,
      participants_text: parsed.participants_text,
      fitness_text: parsed.fitness_text,
      availability_text: prices.availability_text,
      price_single: prices.price_single,
      price_low: prices.price_low,
      price_high: prices.price_high,
      price_currency: prices.price_currency || "GBP",
      session_options,
      price_title: prices.price_single != null
        ? toGBP(prices.price_single)
        : (prices.price_low != null || prices.price_high != null)
          ? [prices.price_low, prices.price_high].filter(v=>v!=null).map(toGBP).join("–")
          : null,
    },
  };
}

/* ----------------------- Option line construction ----------------------- */
function buildOptionLines(products) {
  const items = (products || [])
    .map(p => {
      const name = (p.raw && (p.raw.name || p.raw?.["@name"])) || (p.title || "Option");
      const price =
        p.price != null ? Number(p.price)
        : p.raw?.offers?.price != null ? Number(p.raw.offers.price)
        : null;
      return { name: String(name).trim(), price, row: p };
    })
    .filter(x => x.price != null);

  const seen = new Set();
  const uniqItems = [];
  for (const it of items) {
    const key = `${it.name}__${it.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqItems.push(it);
  }

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
  add("Upcoming dates", anotherUrl);
  return chips.slice(0, 4);
}

/* ---------------------- Compose product markdown block ------------------- */
function productMarkdownBlock(prodEnriched) {
  if (!prodEnriched) return "";
  const p = prodEnriched;
  const e = p._enriched || {};
  const title = p.title || p.raw?.name || "Workshop";
  const priceTitle = e.price_title ? ` — ${e.price_title}` : "";
  const url = pickUrl(p);

  const lines = [];
  lines.push(`**${title}**${priceTitle}`);
  if (e.blurb) lines.push(`${e.blurb}`);

  const facts = [];
  if (e.location_text) facts.push(`**Location:** ${e.location_text}`);
  if (e.participants_text) facts.push(`**Participants:** ${e.participants_text}`);
  if (e.fitness_text) facts.push(`**Fitness:** ${e.fitness_text}`);
  if (e.availability_text) facts.push(`**Availability:** ${e.availability_text}`);
  if (facts.length) {
    lines.push("");
    lines.push(facts.join(" • "));
  }

  const opts = e.session_options || [];
  if (opts.length) {
    lines.push("");
    lines.push("**Options:**");
    for (const o of opts) {
      const price = o.price_text ? ` — ${o.price_text}` : "";
      lines.push(`- ${o.time}${price}`);
    }
  }

  if (url) {
    lines.push("");
    lines.push(`[Book Now](${url})`);
  }
  return lines.join("\n");
}

/* ------------------------------- Bluebell -------------------------------- */
async function answerBluebell({ query, client }) {
  const nowIso = new Date().toISOString();

  const canon = await resolveCanonicalsOptionA(client, "bluebell");

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

  const products_enriched = (products || []).map(enrichProduct);

  // Choose the product that gives us the best pricing signal (range > single > anything)
  const productPreferred =
    products_enriched.find(p => p._enriched?.price_low != null || p._enriched?.price_high != null) ||
    products_enriched.find(p => p._enriched?.price_single != null) ||
    products_enriched[0] ||
    null;

  // Build event bullets for the bottom section
  const eventList = (events || []).slice(0, 10);
  const eventLines = [];
  const bulletCitations = [];
  for (const ev of eventList) {
    const when = fmtDateLondon(ev.date_start);
    const where = ev.location ? ` — ${ev.location}` : "";
    const evUrl = pickUrl(ev);
    eventLines.push(`- ${when} — [Link](${evUrl})${where}`);
    if (evUrl) bulletCitations.push(evUrl);
  }
  if (eventLines.length === 0) eventLines.push("- (no upcoming dates found)");

  // Book button source
  let bookNowUrl = pickUrl(productPreferred);
  if (!bookNowUrl && eventList[0]) bookNowUrl = pickUrl(eventList[0]);

  const chips = buildChips({
    bookNowUrl,
    landingUrl: pickUrl(canon.landing),
    anotherUrl: pickUrl(eventList[0]),
  });

  // ---------- Compose final markdown so the UI shows ALL details ----------
  const parts = [];
  if (productPreferred) {
    parts.push(productMarkdownBlock(productPreferred));
  }
  parts.push("");
  parts.push("### Upcoming bluebell Workshops");
  parts.push(eventLines.join("\n"));
  const answer_markdown = parts.join("\n");

  const citations = uniq([
    pickUrl(canon.landing),
    pickUrl(canon.product),
    ...bulletCitations,
    bookNowUrl,
  ]).filter(Boolean);

  const structured = {
    topic: "bluebell",
    events: eventList,
    products: products || [],
    products_enriched,
    top_product: productPreferred || null,
    canonicals: { product: canon.product || null, landing: canon.landing || null, debug: canon.debug },
    chips,
    option_lines: buildOptionLines(products || []),
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
