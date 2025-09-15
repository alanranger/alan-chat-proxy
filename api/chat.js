// /api/chat.js
// Site-wide AI chat endpoint with Bluebell golden path,
// dynamic canonical resolver (Option A), and structured debug.
// Runtime: Node.js on Vercel (not nodejs18.x)

export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

// ---- Helpers ---------------------------------------------------------------

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_*_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

function fmtDateLondon(ts) {
  try {
    const d = new Date(ts);
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Europe/London",
    }).format(d);
  } catch {
    return ts;
  }
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function dedupeBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function linkShort(url) {
  if (!url) return "";
  return `[Link](${url})`;
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

// Extract simple topic from query (for now, support "bluebell" explicitly).
function getTopicFromQuery(query) {
  const q = (query || "").toLowerCase();
  if (q.includes("bluebell")) return "bluebell";
  return null; // fallback generic paths (not implemented in this task)
}

// Option A canonical resolver:
// Prefer explicit keys (raw.canonical=true, raw.topic, raw.role),
// else accept tag array raw.tags containing "canonical" + topic + role.
async function resolveCanonicalsOptionA(client, topic) {
  const canonicals = { product: null, landing: null, debug: {} };

  // A2: explicit keys first
  const { data: prodA2, error: prodA2Err } = await client
    .from("page_entities")
    .select("*")
    .eq("kind", "product")
    .eq("raw->>canonical", "true")
    .eq("raw->>topic", topic)
    .eq("raw->>role", "product")
    .order("last_seen", { ascending: false })
    .limit(1);

  const { data: landA2, error: landA2Err } = await client
    .from("page_entities")
    .select("*")
    .in("kind", ["article", "page"])
    .eq("raw->>canonical", "true")
    .eq("raw->>topic", topic)
    .eq("raw->>role", "landing")
    .order("last_seen", { ascending: false })
    .limit(1);

  canonicals.debug.explicitErrors = {
    prodA2Err,
    landA2Err,
  };

  const explicitProduct = prodA2?.[0] || null;
  const explicitLanding = landA2?.[0] || null;

  // A1: tags fallback (requires raw.tags to be a string array)
  let tagsProduct = null;
  let tagsLanding = null;

  if (!explicitProduct || !explicitLanding) {
    const { data: prodA1, error: prodA1Err } = await client
      .from("page_entities")
      .select("*")
      .eq("kind", "product")
      .contains("raw->tags", ["canonical", topic, "product"])
      .order("last_seen", { ascending: false })
      .limit(1);

    const { data: landA1, error: landA1Err } = await client
      .from("page_entities")
      .select("*")
      .in("kind", ["article", "page"])
      .contains("raw->tags", ["canonical", topic, "landing"])
      .order("last_seen", { ascending: false })
      .limit(1);

    canonicals.debug.tagsErrors = { prodA1Err, landA1Err };
    tagsProduct = prodA1?.[0] || null;
    tagsLanding = landA1?.[0] || null;
  }

  canonicals.product = explicitProduct || tagsProduct || null;
  canonicals.landing = explicitLanding || tagsLanding || null;

  canonicals.debug.selected = {
    product: canonicals.product?.id || null,
    landing: canonicals.landing?.id || null,
  };

  return canonicals;
}

// Build option lines for a set of product rows sharing a page_url.
// Rule: show each option separately; dedupe by (name, price).
// If multiple rows share identical name, collapse to "£99 • £150" for that name.
function buildOptionLines(productsForPage) {
  // Name: prefer raw.name, else title; Price from row.price
  const options = productsForPage
    .map((p) => {
      const name =
        (p.raw && (p.raw.name || p.raw?.["@name"])) ||
        p.title ||
        "Option";
      const price = p.price != null ? Number(p.price) : null;
      return { name: String(name).trim(), price, row: p };
    })
    .filter((x) => x.name || x.price != null);

  // Dedupe by (name, price)
  const deduped = dedupeBy(
    options,
    (x) => `${x.name}__${x.price != null ? x.price : "null"}`
  );

  // Group by name
  const byName = new Map();
  for (const opt of deduped) {
    if (!byName.has(opt.name)) byName.set(opt.name, []);
    byName.get(opt.name).push(opt);
  }

  // Build lines: if a name has multiple different prices, show as "£99 • £150"
  const lines = [];
  for (const [name, arr] of byName.entries()) {
    const prices = arr
      .map((o) => o.price)
      .filter((v) => v != null)
      .sort((a, b) => a - b);

    if (prices.length === 0) continue;
    const priceBits = prices.map((p) => toGBP(p)).filter(Boolean);

    if (arr.length === 1) {
      lines.push(`${name} — ${priceBits[0]}`);
    } else {
      // Multiple, same name: collapse to bullets separated by •
      lines.push(`${name} — ${priceBits.join(" • ")}`);
    }
  }

  return lines;
}

// Chips builder: first Book Now (if resolvable), then up to 3 more intent links.
// Omit any chip we cannot resolve; dedupe by URL.
function buildChips({ bookNowUrl, intentLinks = [] }) {
  const chips = [];
  const used = new Set();

  function add(label, url) {
    const u = url || "";
    if (!label || !u) return;
    if (used.has(u)) return;
    used.add(u);
    chips.push({ label, url: u });
  }

  add("Book Now", bookNowUrl);

  for (const c of intentLinks) {
    if (chips.length >= 4) break;
    add(c.label, c.url);
  }

  return chips;
}

// ---- Core Bluebell Flow ----------------------------------------------------

async function answerBluebell({ query, client }) {
  const nowIso = new Date().toISOString();

  // 1) Resolve canonicals dynamically (Option A)
  const canon = await resolveCanonicalsOptionA(client, "bluebell");

  // 2) Events (future) — title/page_url contains bluebell
  const { data: events, error: evErr } = await client
    .from("page_entities")
    .select(
      "id, title, page_url, source_url, date_start, date_end, location, raw"
    )
    .eq("kind", "event")
    .or("title.ilike.%bluebell%,page_url.ilike.%bluebell%")
    .gte("date_start", nowIso)
    .order("date_start", { ascending: true })
    .limit(100); // we will cap presentation to 10

  if (evErr) {
    return {
      ok: false,
      error: "event_query_failed",
      where: "events",
      hint: evErr.message,
    };
  }

  // 3) Collect page_urls → fetch products for those pages
  const pageUrls = uniq((events || []).map((e) => e.page_url).filter(Boolean));

  let products = [];
  let prodErr = null;

  if (pageUrls.length > 0) {
    const { data: prods, error: pErr } = await client
      .from("page_entities")
      .select("*")
      .eq("kind", "product")
      .in("page_url", pageUrls);

    products = prods || [];
    prodErr = pErr || null;
  }

  // Also, if there are no events found, we might still want products for the topic (optional)
  if ((!events || events.length === 0) && products.length === 0) {
    const { data: prodsFallback } = await client
      .from("page_entities")
      .select("*")
      .eq("kind", "product")
      .or("title.ilike.%bluebell%,page_url.ilike.%bluebell%")
      .order("last_seen", { ascending: false })
      .limit(10);
    products = prodsFallback || [];
  }

  if (prodErr) {
    return {
      ok: false,
      error: "product_query_failed",
      where: "products",
      hint: prodErr.message,
    };
  }

  // 4) Build bullets for up to 10 upcoming events
  const bullets = [];
  const bulletCitations = [];
  const perEventOptionLines = [];

  const eventList = (events || []).slice(0, 10);
  for (const ev of eventList) {
    const when = fmtDateLondon(ev.date_start);
    const where = ev.location ? ` — ${ev.location}` : "";
    const evUrl = pickUrl(ev);
    const line = `- ${when} — ${linkShort(evUrl)}${where}`;
    bullets.push(line);
    if (evUrl) bulletCitations.push(evUrl);

    // attach option lines (products sharing this page_url)
    const productsForPage = (products || []).filter(
      (p) => p.page_url && ev.page_url && p.page_url === ev.page_url
    );

    const optionLines = buildOptionLines(productsForPage);
    if (optionLines.length > 0) {
      perEventOptionLines.push({ eventId: ev.id, lines: optionLines });
    }
  }

  if (bullets.length === 0) {
    bullets.push("- (no upcoming dates found)");
  }

  // 5) Book Now link: prefer first product attached to the first listed event
  let bookNowUrl = null;
  if (eventList.length > 0) {
    const firstEv = eventList[0];
    const firstProducts = (products || []).filter(
      (p) => p.page_url && firstEv.page_url && p.page_url === firstEv.page_url
    );
    if (firstProducts.length > 0) {
      bookNowUrl = pickUrl(firstProducts[0]);
    }
  }
  // Fallback to canonical product if unresolved
  if (!bookNowUrl && canon.product) {
    bookNowUrl = pickUrl(canon.product);
  }

  // 6) Chips: Book Now first; add up to 3 more intent links if helpful
  const intentLinks = [];
  // Use landing canonical if available
  if (canon.landing) {
    intentLinks.push({
      label: "Bluebell info",
      url: pickUrl(canon.landing),
    });
  }
  // Add first upcoming event page as "Upcoming dates"
  if (eventList[0]) {
    intentLinks.push({
      label: "Upcoming dates",
      url: pickUrl(eventList[0]),
    });
  }
  // Add another helpful product/event if available (different URL)
  const another =
    products.find((p) => pickUrl(p) && pickUrl(p) !== bookNowUrl) ||
    eventList.find((e) => pickUrl(e) && pickUrl(e) !== bookNowUrl);
  if (another) {
    intentLinks.push({ label: "More details", url: pickUrl(another) });
  }

  const chips = buildChips({ bookNowUrl, intentLinks });

  // 7) Build answer markdown
  const parts = [];
  parts.push(`### Upcoming Bluebell Workshops`);
  parts.push(bullets.join("\n"));

  // Attach option lines under each event (in order)
  for (const ev of eventList) {
    const opt = perEventOptionLines.find((x) => x.eventId === ev.id);
    if (!opt) continue;
    parts.push(
      opt.lines.map((line) => `  - ${line}`).join("\n")
    );
  }

  if (bookNowUrl) {
    parts.push(`\n**Booking:** [Book Now](${bookNowUrl})`);
  }

  const answer_markdown = parts.filter(Boolean).join("\n");

  // 8) Citations: canonicals (if resolved) + all event/product links used
  const citations = uniq([
    pickUrl(canon.landing),
    pickUrl(canon.product),
    ...bulletCitations,
    ...chips.map((c) => c.url),
  ]).filter(Boolean);

  // 9) Structured debug
  const structured = {
    topic: "bluebell",
    events: eventList,
    products,
    canonicals: {
      product: canon.product || null,
      landing: canon.landing || null,
      debug: canon.debug,
    },
    chips,
  };

  return {
    ok: true,
    answer_markdown,
    citations,
    structured,
  };
}

// ---- HTTP Handler ----------------------------------------------------------

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

    const topic = getTopicFromQuery(query);

    // For now we implement just the Bluebell golden path in this task.
    if (topic === "bluebell") {
      const result = await answerBluebell({ query, client });
      res.status(result.ok ? 200 : 500).json({
        ...result,
        meta: {
          duration_ms: Date.now() - started,
          endpoint: "/api/chat",
          topK: topK || null,
        },
      });
      return;
    }

    // Generic fallback (to be expanded in future tasks).
    res.status(200).json({
      ok: true,
      answer_markdown:
        "I don’t have a specific answer for that yet. Please try asking about workshops, courses, kit, or a location — or ask for Bluebell dates and prices.",
      citations: [],
      structured: {
        topic: null,
        note: "Generic path will be implemented in subsequent tasks.",
      },
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
