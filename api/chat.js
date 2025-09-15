// api/chat.js
// Vercel Serverless Function (Node runtime)
// Returns: { ok, answer, citations, structured, took_ms } for your public/chat.html

export const config = { runtime: "nodejs" };

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function asGBP(n, cur) {
  const c = (cur || "GBP").toUpperCase();
  const sym = c === "GBP" ? "£" : c + " ";
  return typeof n === "number" && isFinite(n) ? `${sym}${Math.round(n)}` : `${sym}?`;
}

function wantsBluebellDatesPrices(q) {
  const s = (q || "").toLowerCase();
  return (
    /bluebell/.test(s) &&
    (/(date|when)/.test(s) || /(price|cost|£|gbp|fee)/.test(s)) &&
    /(workshop|course|class)/.test(s)
  );
}

// Lazy import to play nice with ESM/CJS differences on Vercel
async function getSupabase() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}

export default async function handler(req, res) {
  const started = Date.now();
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    let body = {};
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    } catch {
      body = {};
    }

    const query = (body.query || "").trim();
    const topK = Number(body.topK || 8);

    if (!query) {
      return res.status(400).json({ ok: false, error: "No query provided." });
    }

    // Branch: Bluebell dates & prices → use SQL function we created
    if (wantsBluebellDatesPrices(query)) {
      const supabase = await getSupabase();
      const { data, error } = await supabase.rpc("events_products", {
        q: "bluebell",
        from_date: new Date().toISOString(),
        max_rows: Math.max(6, Math.min(topK * 3, 30)),
      });
      if (error) throw error;

      const events = Array.isArray(data) ? data : [];

      if (!events.length) {
        return res.status(200).json({
          ok: true,
          answer:
            "I couldn’t find upcoming Bluebell workshop dates right now. Please check Alan’s workshops page.",
          citations: ["https://www.alanranger.com/photography-workshops-near-me"],
          structured: { events: [] },
          took_ms: Date.now() - started,
        });
      }

      // Build bullet list + collect price range + citations + structured.events
      const bullets = [];
      const citations = new Set();
      const structuredEvents = [];
      const prices = [];

      for (const e of events) {
        const ds = e.date_start ? new Date(e.date_start) : null;
        const when = ds ? ds.toUTCString().slice(0, 16) : "Date TBC";
        const eventUrl = e.event_url;
        const productUrl = e.product_url || undefined;

        bullets.push(`- ${when} — [Workshop Link](${eventUrl})`);
        if (eventUrl) citations.add(eventUrl);
        if (productUrl) citations.add(productUrl);

        if (typeof e.price === "number" && isFinite(e.price)) prices.push(e.price);

        structuredEvents.push({
          title: e.title || "Bluebell Workshop",
          date_start: e.date_start || null,
          date_end: e.date_end || null,
          source_url: eventUrl,
          price: e.price ?? null,
          price_currency: (e.price_currency || "GBP").toUpperCase(),
        });
      }

      let priceLine = "";
      if (prices.length) {
        const uniq = Array.from(new Set(prices)).sort((a, b) => a - b);
        priceLine =
          uniq.length === 1
            ? `\n\n**Prices:** ${asGBP(uniq[0], "GBP")}`
            : `\n\n**Prices:** ${asGBP(uniq[0], "GBP")} – ${asGBP(
                uniq[uniq.length - 1],
                "GBP"
              )}`;
      } else {
        // sensible default you’ve been using
        priceLine =
          "\n\n**Prices:** Half day £99 (discounted from £125) / Full day £150 (discounted from £175).";
        citations.add("https://www.alanranger.com/photography-workshops-near-me");
      }

      const answer =
        "### Upcoming Bluebell Workshop Dates and Prices\n\n" +
        "**Dates:**\n" +
        bullets.join("\n") +
        priceLine +
        "\n\nFor booking/details, open the link next to each date.";

      return res.status(200).json({
        ok: true,
        answer,
        citations: Array.from(citations),
        structured: { events: structuredEvents },
        took_ms: Date.now() - started,
      });
    }

    // Fallback response (kept simple)
    return res.status(200).json({
      ok: true,
      answer:
        "I can help with workshops, tuition, equipment, and photography advice. Ask about upcoming dates, prices, or specific workshop types.",
      citations: ["https://www.alanranger.com/photography-workshops-near-me"],
      structured: {},
      took_ms: Date.now() - started,
    });
  } catch (err) {
    // Make the error visible in your debug panel (no more blank 500s)
    return res
      .status(500)
      .json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}
