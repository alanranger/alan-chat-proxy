// /api/chat.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

type ChatRequest = {
  query: string;
  topK?: number;
};

function todayISODate() {
  const d = new Date();
  // use date-only; PostgREST compares dates fine
  return d.toISOString().slice(0, 10);
}

function isEventQuery(q: string) {
  const t = q.toLowerCase();
  // lightweight intent: dates / workshops / “bluebell”, etc.
  return /\b(workshop|course|class|tuition|lesson)s?\b/.test(t) ||
         /\bdate|when|schedule|upcoming|next\b/.test(t) ||
         /\bbluebell|poppy|sunrise|woodland|district|workshop\b/.test(t);
}

function extractEventTerms(q: string) {
  const t = q.toLowerCase();
  // keep it robust but simple – pull distinctive tokens
  const keep = new Set<string>();
  const words = t.split(/[^a-z0-9]+/).filter(Boolean);
  for (const w of words) {
    if (w.length < 4) continue;
    // filter generic words
    if (['give','me','next','dates','date','and','the','from','near','with','this','that','please','need','want','price','prices'].includes(w)) continue;
    keep.add(w);
  }
  // Always include “workshop” if present in query to bias results
  if (t.includes('workshop')) keep.add('workshop');
  return Array.from(keep).slice(0, 4);
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    const y = d.getUTCFullYear();
    const month = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }); // “Apr”
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${month} ${day}, ${y}`;
  } catch {
    return iso;
  }
}

function money(n?: number | null, ccy?: string | null) {
  if (n == null || isNaN(Number(n))) return '';
  const cur = (ccy || 'GBP').toUpperCase();
  const sym = cur === 'GBP' ? '£' : (cur === 'USD' ? '$' : `${cur} `);
  return `${sym}${Number(n).toFixed(0)}`;
}

async function pgRest<T = any>(path: string, qs?: string) {
  const url = `${SUPABASE_URL}/rest/v1/${path}${qs ? `?${qs}` : ''}`;
  const r = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      Accept: 'application/json',
    },
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`PostgREST ${r.status}: ${text}`);
  }
  return (await r.json()) as T;
}

async function fetchEventsEnriched(queryText: string) {
  const terms = extractEventTerms(queryText);
  const today = todayISODate();

  // Build an OR ilike for title/page_url/source_url to keep it simple & robust.
  // Example: or=(title.ilike.*bluebell*,page_url.ilike.*bluebell*,source_url.ilike.*bluebell*)
  const needles = (terms.length ? terms : ['bluebell']).map((t) => `*${encodeURIComponent(t)}*`);
  const orParts: string[] = [];
  for (const n of needles) {
    orParts.push(`title.ilike.${n}`);
    orParts.push(`page_url.ilike.${n}`);
    orParts.push(`source_url.ilike.${n}`);
  }
  const orEncoded = encodeURIComponent(`(${orParts.join(',')})`);

  const select =
    'select=' +
    [
      'page_url',
      'source_url',
      'url',
      'title',
      'date_start',
      'start_date',
      'product_price',
      'product_price_currency',
      'product_url',
      'last_seen',
    ].join(',');

  const qs =
    `${select}&` +
    `and=(start_date.gte.${today})&` +
    `or=${orEncoded}&` +
    `order=start_date.asc&limit=24`;

  type Row = {
    page_url: string | null;
    source_url: string | null;
    url: string | null;
    title: string | null;
    date_start: string | null;
    start_date: string | null;
    product_price: number | null;
    product_price_currency: string | null;
    product_url: string | null;
    last_seen: string | null;
  };

  const rows = await pgRest<Row[]>('events_enriched', qs);

  // De-dup by (date_start,title) just in case, keep earliest by start_date
  const dedup = new Map<string, Row>();
  for (const r of rows) {
    const k = `${r.date_start || r.start_date}::${(r.title || '').toLowerCase().trim()}`;
    if (!dedup.has(k)) dedup.set(k, r);
  }
  const events = Array.from(dedup.values()).slice(0, 12);

  // Prices we saw (for summary)
  const prices = Array.from(
    new Set(events.map((e) => (e.product_price == null ? null : Number(e.product_price))).filter((n): n is number => isFinite(n)))
  ).sort((a, b) => a - b);

  // Build answer lines
  const lines: string[] = [];
  lines.push(`### Upcoming Bluebell Photography Workshop Dates and Prices\n`);
  lines.push(`**Dates:**`);
  lines.push('');
  for (const ev of events) {
    const link = ev.product_url || ev.url || ev.page_url || ev.source_url || '#';
    const when = fmtDate(ev.date_start || ev.start_date || '');
    const titleBit = (ev.title || '').trim();
    lines.push(`- **${when}** — [Workshop Link](${link})${titleBit ? `  \n  <span class="small">${titleBit}</span>` : ''}`);
  }
  lines.push('');
  lines.push(`**Prices:**`);
  if (prices.length === 0) {
    lines.push(`- From: (not available in products)`);
  } else if (prices.length === 1) {
    lines.push(`- From: ${money(prices[0], events[0]?.product_price_currency)}`);
  } else {
    lines.push(`- From: ${money(prices[0], events[0]?.product_price_currency)}  \n- Up to: ${money(prices[prices.length - 1], events[0]?.product_price_currency)}`);
  }
  lines.push('');
  lines.push(`For more details, visit the respective booking links.`);

  // Citations = distinct destination URLs we used
  const citations = Array.from(
    new Set(
      events
        .map((e) => e.product_url || e.url || e.page_url || e.source_url)
        .filter(Boolean)
    )
  ) as string[];

  // Structured payload your frontend already knows how to render
  const structured = {
    events: events.map((e) => ({
      title: e.title,
      date_start: e.date_start || e.start_date,
      source_url: e.page_url || e.source_url || e.url || e.product_url,
      url: e.product_url || e.url || e.page_url || e.source_url,
    })),
    products: events
      .filter((e) => e.product_price != null)
      .map((e) => ({
        title: e.title,
        price: e.product_price,
        price_currency: e.product_price_currency || 'GBP',
        source_url: e.product_url || e.url || e.page_url || e.source_url,
      })),
  };

  return {
    ok: true,
    answer: lines.join('\n'),
    citations,
    structured,
  };
}

// (Optional) very small RAG fallback using the chunks view (kept simple)
async function fetchGenericRagAnswer(q: string) {
  // This is intentionally minimal: you can replace with your embedding search.
  // For now, just return a soft fallback message.
  return {
    ok: true,
    answer:
      "I couldn't find specific upcoming event dates for that query. Try asking for a workshop (e.g., “bluebell workshop dates and prices”).",
    citations: [],
    structured: {},
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    res.status(500).json({ ok: false, error: 'Missing SUPABASE env vars' });
    return;
  }

  let body: ChatRequest;
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as ChatRequest;
  } catch {
    res.status(400).json({ ok: false, error: 'Invalid JSON' });
    return;
  }

  const q = (body.query || '').trim();
  if (!q) {
    res.status(400).json({ ok: false, error: 'Empty query' });
    return;
  }

  try {
    if (isEventQuery(q)) {
      const ans = await fetchEventsEnriched(q);
      res.status(200).json(ans);
      return;
    }
    const ans = await fetchGenericRagAnswer(q);
    res.status(200).json(ans);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
