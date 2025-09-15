// /api/chat.js
// Site-wide AI chat endpoint (generic, no hard-wired topics)
// Runtime: NodeJS (Vercel)
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

/* ---------------------------- Supabase client ---------------------------- */
function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
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
function uniq(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}
function toGBP(n, frac = 0) {
  if (n == null || isNaN(Number(n))) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: frac,
  }).format(Number(n));
}
function pickUrl(row) {
  return row?.source_url || row?.page_url || row?.url || null;
}

/* ----------------------- Query intent/topic helpers ---------------------- */

/** Very light topic extraction: nouns/keywords from the user query. */
function topicTokensFromQuery(q) {
  const stop = new Set(
    [
      "the",
      "a",
      "an",
      "of",
      "in",
      "for",
      "to",
      "and",
      "or",
      "with",
      "please",
      "next",
      "upcoming",
      "workshop",
      "workshops",
      "course",
      "courses",
      "class",
      "classes",
      "dates",
      "date",
      "price",
      "prices",
      "cost",
      "how",
      "when",
      "where",
      "is",
      "are",
      "what",
      "alan",
      "ranger",
      "photography",
      "book",
      "booking",
      "info",
      "information",
      "show",
      "give",
      "me",
      "on",
      "run",
      "running",
      "do",
      "get",
      "certificate",
    ].map((w) => w.toLowerCase())
  );
  return (q || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !stop.has(w))
    .slice(0, 4); // keep it short for ILIKE OR clauses
}

/** Is user asking for “next/upcoming” */
function wantsUpcoming(q) {
  const s = (q || "").toLowerCase();
  return /next|upcoming|soon|dates|schedule|when/i.test(s);
}

/* ------------------------ Canonical resolver (safe) ---------------------- */
// Uses explicit raw flags if present; otherwise returns nulls without error.
async function resolveCanonicals(client, topicTokens) {
  const out = { product: null, landing: null, debug: {} };
  // Try match canonicals by explicit flags + fuzzy topic tokens (best-effort)
  const tokOr = (topicTokens || [])
    .map((t) => `title.ilike.%${t}%,page_url.ilike.%${t}%`)
    .join(",");

  const prodQuery = client
    .from("page_entities")
    .select("*")
    .eq("kind", "product")
    .eq("raw->>canonical", "true")
    .order("last_seen", { ascending: false })
    .limit(1);

  const landQuery = client
    .from("page_entities")
    .select("*")
    .in("kind", ["article", "page"])
    .eq("raw->>canonical", "true")
    .order("last_seen", { ascending: false })
    .limit(1);

  // If we have tokens, include them in an OR clause to bias the canonical
  if (tokOr) {
    prodQuery.or(tokOr);
    landQuery.or(tokOr);
  }

  const { data: prodA, error: prodErr } = await prodQuery;
  const { data: landA, error: landErr } = await landQuery;

  out.product = prodA?.[0] || null;
  out.landing = landA?.[0] || null;
  out.debug.explicitErrors = { prodErr, landErr };
  out.debug.selected = {
    product: out.product?.id || null,
    landing: out.landing?.id || null,
  };
  return out;
}

/* ------------------ Extract product details & prices --------------------- */
function parseParticipantsFitness(rawOrDescription) {
  const text =
    typeof rawOrDescription === "string"
      ? rawOrDescription
      : rawOrDescription?.description || "";
  let participants = null;
  let fitness = null;

  // Look for lines like "Participants: Max 6" and "Fitness: 1. Easy"
  if (text) {
    const pMatch =
      /Participants\s*:\s*([^\r\n]+)/i.exec(text) ||
      /Participants\s*\n\s*([^\r\n]+)/i.exec(text);
    const fMatch =
      /Fitness\s*:\s*([^\r\n]+)/i.exec(text) ||
      /Fitness\s*\n\s*([^\r\n]+)/i.exec(text);

    if (pMatch) participants = pMatch[1].trim();
    if (fMatch) fitness = fMatch[1].trim();
  }
  return { participants, fitness };
}

function buildOptionLines(products) {
  const items = (products || [])
    .map((p) => {
      const name =
        (p.raw && (p.raw.name || p.raw?.["@name"])) ||
        p.title ||
        "Option";
      const offer = p.offer || p.raw?.offers || p.raw?.offer || {};
      // Two possibilities in your data:
      // - Offer { price }
      // - AggregateOffer { lowPrice, highPrice }
      const priceSingle =
        offer?.price != null ? Number(offer.price) : null;
      const priceLow =
        offer?.lowPrice != null ? Number(offer.lowPrice) : null;
      const priceHigh =
        offer?.highPrice != null ? Number(offer.highPrice) : null;

      return {
        name: String(name).trim(),
        priceSingle,
        priceLow,
        priceHigh,
        row: p,
      };
    })
    // keep if any price info present
    .filter(
      (x) =>
        x.priceSingle != null || x.priceLow != null || x.priceHigh != null
    );

  // Deduplicate by (name + price signature)
  const sig = (x) =>
    `${x.name}__${x.priceSingle ?? ""}__${x.priceLow ?? ""}__${
      x.priceHigh ?? ""
    }`;
  const seen = new Set();
  const uniqItems = [];
  for (const it of items) {
    const k = sig(it);
    if (seen.has(k)) continue;
    seen.add(k);
    uniqItems.push(it);
  }

  // Build display lines, include participants/fitness when we have them
  const lines = [];
  for (const it of uniqItems) {
    const { participants, fitness } = parseParticipantsFitness(
      it.row?.description || it.row?.raw?.description || ""
    );

    let priceText = "";
    if (it.priceSingle != null) priceText = toGBP(it.priceSingle);
    else {
      const bits = [];
      if (it.priceLow != null) bits.push(toGBP(it.priceLow));
      if (it.priceHigh != null) bits.push(toGBP(it.priceHigh));
      priceText = bits.join(" • ");
    }

    const extras = [];
    if (participants) extras.push(`Participants: ${participants}`);
    if (fitness) extras.push(`Fitness: ${fitness}`);

    lines.push(
      extras.length
        ? `${it.name} — ${priceText}\n${extras.map((e) => `- ${e}`).join("\n")}`
        : `${it.name} — ${priceText}`
    );
  }

  return lines;
}

/* ----------------------------- Chips builder ---------------------------- */
function buildChips({ bookNowUrl, landingUrl, firstEventUrl }) {
  const chips = [];
  const used = new Set();
  const add = (label, url) => {
    if (!label || !url) return;
    if (used.has(url)) return;
    used.add(url);
    chips.push({ label, url });
  };
  add("Book Now", bookNowUrl);
  if (firstEventUrl) add("Upcoming dates", firstEventUrl);
  if (landingUrl) add("Info", landingUrl);
  return chips.slice(0, 4);
}

/* ------------------------- Core generic answering ------------------------ */
async function answerWorkshopsGeneric({ query, client }) {
  const nowIso = new Date().toISOString();
  const tokens = topicTokensFromQuery(query);

  // 1) Canonicals (best-effort)
  const canon = await resolveCanonicals(client, tokens);

  // 2) Find *future* events, filtered by tokens if present
  const evBase = client
    .from("page_entities")
    .select(
      "id, kind, title, page_url, source_url, date_start, date_end, location, raw"
    )
    .eq("kind", "event")
    .gte("date_start", nowIso)
    .order("date_start", { ascending: true })
    .limit(100);

  if (tokens.length) {
    evBase.or(tokens.map((t) => `title.ilike.%${t}%,page_url.ilike.%${t}%`).join(","));
  }

  const { data: events, error: evErr } = await evBase;
  if (evErr) {
    return { ok: false, error: "event_query_failed", where: "events", hint: evErr.message };
  }

  // 3) Products that look relevant to the same tokens
  const prodBase = client
    .from("page_entities")
    .select("*")
    .eq("kind", "product")
    .order("last_seen", { ascending: false })
    .limit(50);

  if (tokens.length) {
    prodBase.or(tokens.map((t) => `title.ilike.%${t}%,page_url.ilike.%${t}%`).join(","));
  }

  const { data: products, error: prodErr } = await prodBase;
  if (prodErr) {
    return { ok: false, error: "product_query_failed", where: "products", hint: prodErr.message };
  }

  // 4) Build event bullets (cap 10)
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
  if (!bullets.length && wantsUpcoming(query)) {
    bullets.push("- (no upcoming dates found for that topic)");
  }

  // 5) Workshop option lines (merge single/low/high prices; include participants/fitness)
  const optionLines = buildOptionLines(products || []);

  // 6) Book Now URL: prefer first product, fallback to first event
  let bookNowUrl = pickUrl(products?.[0]);
  if (!bookNowUrl && eventList[0]) bookNowUrl = pickUrl(eventList[0]);

  // 7) Chips
  const chips = buildChips({
    bookNowUrl,
    landingUrl: pickUrl(canon.landing),
    firstEventUrl: pickUrl(eventList[0]),
  });

  // 8) Compose answer — no duplicate headings or lists
  const parts = [];
  if (bullets.length) {
    parts.push(`### Upcoming Workshops`);
    parts.push(bullets.join("\n"));
  }
  if (optionLines.length) {
    parts.push(`\n**Workshop Options:**`);
    parts.push(optionLines.map((l) => `- ${l}`).join("\n"));
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
  return {
    ok: true,
    answer_markdown: answer_markdown || "I couldn’t find matching events or products for that yet.",
    citations,
    structured: {
      topic_tokens: tokens,
      events: eventList,
      products: products || [],
      canonicals: { product: canon.product || null, landing: canon.landing || null, debug: canon.debug },
      chips,
    },
  };
}

/* -------------------------------- Handler -------------------------------- */
export default async function handler(req, res) {
  const started = Date.now();
  try {
    if (req.method !== "POST") {
      res
        .status(405)
        .json({ ok: false, error: "method_not_allowed", where: "http" });
      return;
    }

    const { query, topK } = req.body || {};
    const client = supabaseAdmin();

    // Single unified path (no hard-coded topic)
    const result = await answerWorkshopsGeneric({ query, client });
    res.status(result.ok ? 200 : 500).json({
      ...result,
      meta: {
        duration_ms: Date.now() - started,
        endpoint: "/api/chat",
        topK: topK || null,
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
