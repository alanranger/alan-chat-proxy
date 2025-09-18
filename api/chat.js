// /api/chat.js
import { NextResponse } from "next/server";

// --- helpers ---------------------------------------------------------------

const parseDate = (d) => (d ? new Date(d) : null);
const isFuture = (d) => d && d.getTime() >= Date.now();

function normalize(str = "") {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSet(str = "", { minLen = 3 } = {}) {
  return new Set(
    normalize(str)
      .split(/\s+/)
      .filter((t) => t.length >= minLen)
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

// Pick the first upcoming event by start date
function pickPrimaryEvent(events = []) {
  const upcoming = events
    .map((e) => ({
      ...e,
      _start: parseDate(e.date_start) || parseDate(e.raw?.startDate),
    }))
    .filter((e) => isFuture(e._start))
    .sort((a, b) => a._start - b._start);
  return upcoming[0] || null;
}

// Make sure each event row has a user-facing title for the list
function decorateEventList(events = []) {
  return events.map((e) => {
    const title =
      e.title ||
      e.raw?.name ||
      e.raw?.headline ||
      e.raw?.title ||
      "Photography Workshop";
    // build display bits the UI expects
    return {
      ...e,
      display_title: title,
      display_location:
        e.location ||
        e.raw?.location?.name ||
        e.raw?.location?.addressLocality ||
        "",
      display_when:
        e.when ||
        (e.date_start ? new Date(e.date_start).toUTCString() : "") ||
        "",
      href: e.href || e.page_url || e.source_url || e.raw?.url || "#",
    };
  });
}

// Try to match a product to an event by fuzzy overlap on title/description/location.
// If no confident product exists, synthesize a "pseudo-product" from the event.
function matchProductToEvent(products = [], event) {
  if (!event) return { product: null, synthesized: false };

  const evTokens = tokenSet(
    `${event.title || ""} ${event.raw?.name || ""} ${event.location || ""}`
  );

  let best = null;
  let bestScore = 0;

  for (const p of products) {
    const pText = [
      p.title,
      p.raw?.name,
      p.description,
      p.raw?.description,
      p.location,
    ]
      .filter(Boolean)
      .join(" ");
    const score = jaccard(evTokens, tokenSet(pText));
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }

  // Require a small but non-trivial overlap; tweak as needed
  if (best && bestScore >= 0.12) {
    return { product: best, synthesized: false };
  }

  // synthesize a product-like object from the event so the product block
  // and "Book Now" pill still point to the correct next event
  const price =
    event.raw?.offers?.price ??
    event.raw?.offers?.lowPrice ??
    event.raw?.offers?.highPrice ??
    null;

  const pseudo = {
    id: `ev-${event.id || event.page_url || event.href}`,
    title: event.title || event.raw?.name || "Photography Workshop",
    page_url: event.href || event.page_url || event.source_url || event.raw?.url,
    source_url:
      event.source_url || event.page_url || event.href || event.raw?.url,
    price: typeof price === "number" ? price : null,
    description:
      event.raw?.description ||
      `Upcoming: ${event.title || "Workshop"} — ${event.location || ""}`,
    location:
      event.location ||
      event.raw?.location?.name ||
      event.raw?.location?.addressLocality ||
      null,
    _synth_from_event: true,
  };

  return { product: pseudo, synthesized: true };
}

// Prefer workshop-relevant guides when the intent is events
function filterGuidesForEvents(articles = []) {
  if (!articles?.length) return [];
  const want = ["workshop", "prepare", "packing", "what to bring", "tips"];
  const scored = articles.map((a) => {
    const hay = normalize(
      `${a.title} ${a.raw?.headline || ""} ${a.raw?.description || ""}`
    );
    const has = want.some((k) => hay.includes(k));
    // keep all, but prefer "workshop-ish"
    return { a, score: has ? 2 : 1 };
  });
  scored.sort((x, y) => y.score - x.score);
  // keep top 5 and ensure at least 1 “workshop-ish” if possible
  const top = scored.slice(0, 5).map((s) => s.a);
  const anyWorkshop = top.some((t) =>
    normalize(t.title).includes("workshop")
  );
  if (!anyWorkshop) {
    const firstWorkshop = scored.find((s) =>
      normalize(s.a.title).includes("workshop")
    );
    if (firstWorkshop) top.splice(Math.min(top.length, 4), 0, firstWorkshop.a);
  }
  return top;
}

// Build the orange pills as requested
function buildPills({ product, firstEvent }) {
  const pills = [];

  if (product?.page_url) {
    pills.push({
      label: "Book Now",
      url: product.page_url,
      brand: "primary",
    });
  }

  if (firstEvent?.href) {
    pills.push({
      label: "Event link",
      url: firstEvent.href,
      brand: "secondary",
    });
  }

  // Always include Photos last (existing behaviour)
  pills.push({
    label: "Photos",
    url: "https://www.alanranger.com/photography-portfolio",
    brand: "secondary",
  });

  return pills;
}

// --- main handler ----------------------------------------------------------

export async function POST(req) {
  try {
    const { query, topK = 8 } = await req.json();

    // Call your existing retrieval/LLM pipeline.
    // (This part is unchanged; assume it returns the same structure you showed.)
    const upstream = await fetch(`${process.env.INTERNAL_SEARCH_URL}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, topK }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return NextResponse.json(
        { ok: false, error: text || "Upstream error" },
        { status: 500 }
      );
    }

    const data = await upstream.json();

    // ----- Post-processing fixes ------------------------------------------

    const structured = data.structured || {};

    // 1) Events: decorate each item with display fields (title, when, location)
    const eventsDecorated = decorateEventList(structured.events || []);
    const firstEvent = pickPrimaryEvent(eventsDecorated);

    // 2) Product: tie to first upcoming event; synthesize if needed
    const { product: matchedProduct } = matchProductToEvent(
      structured.products || [],
      firstEvent
    );
    const productsFinal = matchedProduct ? [matchedProduct] : [];

    // 3) Guides: nudge toward workshop-relevant content for this intent
    const articlesFinal =
      structured.intent === "events"
        ? filterGuidesForEvents(structured.articles || [])
        : structured.articles || [];

    // 4) Pills: Book Now (matched product/event) + Event link (first event)
    const pills = buildPills({
      product: matchedProduct,
      firstEvent,
    });

    // 5) Confidence passthrough
    const confidence = data.confidence ?? structured.confidence ?? 0.5;

    // 6) Build final payload
    const finalPayload = {
      ok: true,
      answer_markdown: data.answer_markdown, // keep whatever summary you produce
      citations: data.citations || [],
      structured: {
        ...structured,
        events: eventsDecorated,
        products: productsFinal,
        articles: articlesFinal,
        pills,
      },
      confidence,
      confidence_pct: Math.round((confidence || 0) * 100),
      meta: data.meta || {},
    };

    return NextResponse.json(finalPayload, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
