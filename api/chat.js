// pages/chat.js (or wherever your chat screen lives)
// Plain JS (no TypeScript). Drop-in replacement.
//
// What this file does:
// - Calls /api/chat with { query, topK }.
// - Renders:
//    1) Answer + "Next Workshop" (from structured.events sorted by date_start)
//    2) Product Panel (STRICT: only /photo-workshops-uk/ items or items with price fields)
//    3) Events list (optional, separate from Product Panel)
// - Never renders an Event card in the Product Panel.
// - No flags, no special-case text rules. Classification is based on data shape + URL patterns.

import React, { useCallback, useMemo, useState } from "react";

const API_ENDPOINT = "/api/chat";
const DEFAULT_TOPK = 8;

// ---------- Helpers: Kind detection & normalization ----------

// URL-driven taxonomy: stable and scalable for your site structure
const isProductUrl = (url) =>
  typeof url === "string" && url.includes("/photo-workshops-uk/");
const isEventUrl = (url) =>
  typeof url === "string" && url.includes("/photographic-workshops-near-me/");

// Shape hints (for safety if a URL is missing but the item is clearly a product)
const hasPriceLike = (item) =>
  item?.display_price_number != null ||
  item?.display_price != null ||
  item?.price != null;

// Events have dates
const hasEventDates = (item) => Boolean(item?.date_start);

// STRONG product check: prefer URL taxonomy; fall back to price fields
const isProductItem = (item) => {
  const url = item?.page_url || item?.source_url || item?.href;
  if (isProductUrl(url)) return true;
  if (isEventUrl(url)) return false; // explicitly exclude events by URL
  // fallback: if no clear URL taxonomy, allow items that look like products
  return hasPriceLike(item) && !hasEventDates(item);
};

// STRONG event check
const isEventItem = (item) => {
  const url = item?.page_url || item?.source_url || item?.href;
  if (isEventUrl(url)) return true;
  if (isProductUrl(url)) return false;
  return hasEventDates(item);
};

const uniqueBy = (arr, keyFn) => {
  const seen = new Set();
  const out = [];
  for (const x of arr || []) {
    const k = keyFn(x);
    if (!k) continue;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
};

const coerceProductsStrict = (items) =>
  uniqueBy(
    (items || []).filter(isProductItem),
    (x) => x.page_url || x.source_url || x.href
  );

const coerceEvents = (items) =>
  uniqueBy(
    (items || []).filter(isEventItem),
    (x) => x.page_url || x.source_url || x.href
  );

const toDate = (s) => (s ? new Date(s) : null);
const isFuture = (d) => d && !Number.isNaN(d.valueOf()) && d.getTime() >= Date.now();

const sortByDateStartAsc = (a, b) => {
  const da = toDate(a.date_start)?.getTime() ?? Infinity;
  const db = toDate(b.date_start)?.getTime() ?? Infinity;
  return da - db;
};

// ---------- API ----------

async function fetchChat({ query, topK = DEFAULT_TOPK }) {
  const res = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, topK }),
  });
  const data = await res.json();
  // normalize a little
  data.structured = data.structured || {};
  data.structured.products = Array.isArray(data.structured.products)
    ? data.structured.products
    : [];
  data.structured.events = Array.isArray(data.structured.events)
    ? data.structured.events
    : [];
  data.structured.articles = Array.isArray(data.structured.articles)
    ? data.structured.articles
    : [];
  return data;
}

// ---------- UI: Cards ----------

function ExternalLink({ href, children }) {
  if (!href) return <span>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="link">
      {children}
    </a>
  );
}

function ProductCard({ item }) {
  const url = item.page_url || item.source_url || item.href;
  return (
    <div className="card">
      <div className="card-title">{item.title || "Untitled product"}</div>
      <div className="card-body">
        {item.location_parsed && <div>Location: {item.location_parsed}</div>}
        {item.display_price && <div>Price: {item.display_price}</div>}
        {!item.display_price && item.price != null && (
          <div>Price: £{item.price}</div>
        )}
        {item.dates_parsed && <div>Dates: {item.dates_parsed}</div>}
        <div style={{ marginTop: 8 }}>
          <ExternalLink href={url}>Open</ExternalLink>
        </div>
      </div>
    </div>
  );
}

function EventCard({ item, label }) {
  const url = item.page_url || item.source_url || item.href;
  const when =
    item.when ||
    (item.date_start ? new Date(item.date_start).toUTCString() : null);
  return (
    <div className="card">
      <div className="card-title">
        {label ? `${label}: ` : ""}
        {item.title || "Untitled event"}
      </div>
      <div className="card-body">
        {item.location && <div>Location: {item.location}</div>}
        {when && <div>When: {when}</div>}
        <div style={{ marginTop: 8 }}>
          <ExternalLink href={url}>View event</ExternalLink>
        </div>
      </div>
    </div>
  );
}

// ---------- Panels ----------

function ProductPanel({ products }) {
  if (!products?.length) return null;
  return (
    <section>
      <h3>Products</h3>
      <div className="grid">
        {products.map((p) => (
          <ProductCard key={p.page_url || p.source_url || p.href} item={p} />
        ))}
      </div>
    </section>
  );
}

function EventsPanel({ events, limit = 5 }) {
  if (!events?.length) return null;
  return (
    <section>
      <h3>Upcoming Workshops</h3>
      <div className="stack">
        {events.slice(0, limit).map((e) => (
          <EventCard key={e.page_url || e.source_url || e.href} item={e} />
        ))}
      </div>
    </section>
  );
}

function NextWorkshop({ events }) {
  const next = useMemo(() => {
    const upcoming = (events || [])
      .filter((e) => isFuture(toDate(e.date_start)))
      .sort(sortByDateStartAsc);
    return upcoming[0] || null;
  }, [events]);

  if (!next) return null;
  return (
    <section>
      <EventCard item={next} label="Next workshop" />
    </section>
  );
}

// ---------- Main ----------

export default function ChatPage() {
  const [query, setQuery] = useState("whens the next workshop");
  const [resp, setResp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [error, setError] = useState(null);

  const onAsk = useCallback(
    async (e) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      try {
        const data = await fetchChat({ query, topK: DEFAULT_TOPK });
        setResp(data);
      } catch (err) {
        console.error(err);
        setError("Request failed. Check the network tab for details.");
      } finally {
        setLoading(false);
      }
    },
    [query]
  );

  const productsStrict = useMemo(() => {
    const raw = resp?.structured?.products || [];
    return coerceProductsStrict(raw);
  }, [resp]);

  const eventsClean = useMemo(() => {
    const raw = resp?.structured?.events || [];
    // Only real events; sort by date
    return coerceEvents(raw).sort(sortByDateStartAsc);
  }, [resp]);

  const answerMarkdown = resp?.answer_markdown;

  return (
    <div className="page">
      <h1>Chat</h1>
      <form onSubmit={onAsk} className="row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask something…"
          className="input"
        />
        <button className="btn" disabled={loading}>
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      {resp && (
        <>
          {/* Answer */}
          {answerMarkdown && (
            <section>
              <h3>Answer</h3>
              <div className="answer">{answerMarkdown}</div>
            </section>
          )}

          {/* Next workshop (from events only) */}
          <NextWorkshop events={eventsClean} />

          {/* Product panel (STRICT products only) */}
          <ProductPanel products={productsStrict} />

          {/* Optional: show an events list too */}
          <EventsPanel events={eventsClean} />

          <section>
            <button className="btn-secondary" onClick={() => setShowDebug((v) => !v)}>
              {showDebug ? "Hide debug" : "Show debug"}
            </button>
            {showDebug && (
              <pre className="debug">
                {JSON.stringify(resp, null, 2)}
              </pre>
            )}
          </section>
        </>
      )}

      <style jsx>{`
        .page {
          max-width: 900px;
          margin: 24px auto;
          padding: 0 16px;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu,
            Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji",
            "Segoe UI Emoji";
        }
        h1 {
          font-size: 24px;
          margin: 0 0 16px;
        }
        h3 {
          margin: 24px 0 8px;
          font-size: 18px;
        }
        .row {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        .input {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
        }
        .btn, .btn-secondary {
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid #333;
          background: #111;
          color: white;
          cursor: pointer;
        }
        .btn-secondary {
          background: #fff;
          color: #111;
          border-color: #aaa;
        }
        .answer {
          white-space: pre-wrap;
          background: #fafafa;
          border: 1px solid #eee;
          border-radius: 8px;
          padding: 12px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 12px;
        }
        .stack {
          display: grid;
          gap: 12px;
        }
        .card {
          border: 1px solid #eee;
          border-radius: 10px;
          padding: 12px;
          background: white;
        }
        .card-title {
          font-weight: 600;
          margin-bottom: 6px;
        }
        .card-body {
          font-size: 14px;
          color: #333;
        }
        .link {
          text-decoration: underline;
        }
        .error {
          margin: 12px 0;
          color: #b00020;
        }
        .debug {
          margin-top: 8px;
          background: #0b1020;
          color: #c8d2ff;
          padding: 12px;
          border-radius: 8px;
          overflow-x: auto;
        }
      `}</style>
    </div>
  );
}
