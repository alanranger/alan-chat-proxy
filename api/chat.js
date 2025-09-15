// api/chat.js — Vercel serverless function (Node)
// No hard-coded prices or titles. Combines event + product data.

export const config = { runtime: "nodejs" };

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function getSupabase() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}

function extractTopicTerm(query) {
  const s = (query || "").toLowerCase();
  // expand as needed
  const terms = [
    "bluebell",
    "poppy",
    "poppy fields",
    "district",
    "woodland",
    "sunrise",
    "sunset",
  ];
  for (const t of terms) if (s.includes(t)) return t;
  // last resort: single keyword that looks like a subject
  const m = s.match(/\b[ a-z]{3,}\b/gi);
  return (m && m[0]) || "workshop";
}

function titleCase(s) {
  return s
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function dateLabel(iso) {
  if (!iso) return "Date TBC";
  const d = new Date(iso);
  if (isNaN(d)) return "Date TBC";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function asGBP(n, currency) {
  const cur = (currency || "GBP").toUpperCase();
  const sym = cur === "GBP" ? "£" : cur + " ";
  return typeof n === "number" && isFinite(n) ? `${sym}${Math.round(n)}` : `${sym}?`;
}

function wantsDatesOrPrices(query) {
  const s = (query || "").toLowerCase();
  return /(date|when|schedule|time)/.test(s) || /(price|cost|£|\bgbp\b|fee)/.test(s);
}

export default async function handler(req, res) {
  const t0 = Date.now();
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    let body = {};
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    } catch {}

    const query = (body.query || "").trim();
    const topK = Number(body.topK || 8);

    // If the user is asking for dates/prices, hit events+products
    if (wantsDatesOrPrices(query)) {
      const term = extractTopicTerm(query); // e.g., "bluebell"
      const topic = titleCase(term);

      const supabase = await getSupabase();

      // 1) Primary fetch: combined events+products RPC (you created earlier)
      const { data: events, error: rpcErr } = await supabase.rpc("events_products", {
        q: term, // match by title/page for this topic
        from_date: new Date().toISOString(),
        max_rows: Math.max(6, Math.min(topK * 3, 30)),
      });
      if (rpcErr) throw rpcErr;

      const rows = Array.isArray(events) ? events : [];

      // Gather page URLs for a secondary price lookup if needed
      const pageUrls = new Set();
      const anyMissingPrice = rows.some((r) => !(typeof r.price === "number" && isFinite(r.price)));
      if (anyMissingPrice) {
        rows.forEach((r) => {
          // Both event and product are typically keyed by page URL in your schema
          if (r.page_url) pageUrls.add(r.page_url);
          else if (r.event_url) pageUrls.add(r.event_url);
        });
      }

      // 2) Secondary enrichment: pull product prices by page_url when missing
      let priceByPage = new Map();
      if (anyMissingPrice && pageUrls.size) {
        const { data: prodRows, error: prodErr } = await supabase
          .from("page_entities")
          .select("page_url, price, price_currency")
          .eq("kind", "product")
          .in("page_url", Array.from(pageUrls))
          .not("price", "is", null);
        if (prodErr) throw prodErr;
        (prodRows || []).forEach((p) => {
          if (typeof p.price === "number" && isFinite(p.price)) {
            priceByPage.set(p.page_url, { price: p.price, currency: p.price_currency || "GBP" });
          }
        });
      }

      // Build answer
      const bullets = [];
      const citations = new Set();
      const structuredEvents = [];
      const allPrices = [];

      for (const r of rows) {
        const p =
          typeof r.price === "number" && isFinite(r.price)
            ? { price: r.price, currency: r.price_currency || "GBP" }
            : priceByPage.get(r.page_url || r.event_url) || null;

        if (p) allPrices.push(p.price);

        const eventUrl = r.event_url || r.page_url || r.product_url || null;
        const productUrl = r.product_url || null;
        const when = dateLabel(r.date_start);

        bullets.push(`- ${when} — [Workshop Link](${eventUrl})`);
        if (eventUrl) citations.add(eventUrl);
        if (productUrl) citations.add(productUrl);

        structuredEvents.push({
          title: r.title || `${topic} Workshop`,
          date_start: r.date_start || null,
          date_end: r.date_end || null,
          source_url: eventUrl,
          price: p ? p.price : null,
          price_currency: p ? (p.currency || "GBP").toUpperCase() : null,
        });
      }

      // Price line (no hard-coded numbers)
      let priceLine = "";
      if (allPrices.length) {
        const uniq = Array.from(new Set(allPrices)).sort((a, b) => a - b);
        priceLine =
          uniq.length === 1
            ? `\n\n**Prices:** ${asGBP(uniq[0], "GBP")}`
            : `\n\n**Prices:** ${asGBP(uniq[0], "GBP")} – ${asGBP(
                uniq[uniq.length - 1],
                "GBP"
              )}`;
      } else {
        priceLine = `\n\n**Prices:** See the booking link for current pricing.`;
      }

      const heading = `### Upcoming ${topic} Workshop Dates and Prices`;
      const answer =
        (rows.length ? `${heading}\n\n` : "") +
        (rows.length ? `**Dates:**\n${bullets.join("\n")}` : "No upcoming dates were found.") +
        priceLine +
        (rows.length ? "\n\nFor booking/details, open the link next to each date." : "");

      if (!citations.size) {
        citations.add("https://www.alanranger.com/photography-workshops-near-me");
      }

      return res.status(200).json({
        ok: true,
        answer,
        citations: Array.from(citations),
        structured: { events: structuredEvents },
        took_ms: Date.now() - t0,
      });
    }

    // Generic fallback
    return res.status(200).json({
      ok: true,
      answer:
        "I can help with workshops, tuition, equipment, and photography advice. Ask about upcoming dates, prices, or specific workshop types.",
      citations: ["https://www.alanranger.com/photography-workshops-near-me"],
      structured: {},
      took_ms: Date.now() - t0,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}
