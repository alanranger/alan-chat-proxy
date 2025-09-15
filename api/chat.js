// /api/chat.js
// RAG chat + structured answers (events + optional product prices) from Supabase.

export const config = { runtime: 'nodejs' };

import { createClient } from '@supabase/supabase-js';

/* =============================== Utilities =============================== */
const asString = (e) => {
  if (!e) return '(unknown)';
  if (typeof e === 'string') return e;
  if (e.message) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
};
const need = (k) => {
  const v = process.env[k];
  if (!v || !String(v).trim()) throw new Error(`missing_env:${k}`);
  return v;
};
const dedupe = (arr) => Array.from(new Set((arr || []).filter(Boolean)));
const norm = (s) => (s || '').toLowerCase();

/* very small "score" helper to match product ↔ event by title/source */
function scoreTitleMatch(a, b) {
  if (!a || !b) return 0;
  const A = norm(a).replace(/[^a-z0-9 ]+/g, ' ');
  const B = norm(b).replace(/[^a-z0-9 ]+/g, ' ');
  const tokens = dedupe(A.split(/\s+/).filter(t => t.length > 3));
  let score = 0;
  for (const t of tokens) if (B.includes(t)) score += 1;
  return score;
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

/* ============================ Retrieval on DB ============================ */

/** Simple OR/ILIKE over content/title to get top chunks (with URLs) */
async function retrieveChunks(supa, query, topK = 8) {
  const q = (query || '').trim();
  if (!q) return [];
  // try full text search first, then fall back to ILIKE
  const { data, error } = await supa.rpc('rag_search_chunks', { q, k: topK }).select();
  if (!error && Array.isArray(data)) return data.map(r => ({ url: r.url, content: r.content }));

  // Fallback: ILIKE score on title/content
  const tokens = q.split(/\s+/).filter(w => w.length > 2);
  let orExpr = tokens.map(t => `content.ilike.%${t}%`).join(',');
  if (!orExpr) orExpr = `content.ilike.%${q}%`;
  const { data: rows, error: e2 } = await supa
    .from('page_chunks')
    .select('url,content')
    .or(orExpr)
    .limit(topK);
  if (e2) throw e2;
  return rows || [];
}

/** Pull events/products that probably relate to the user question */
async function fetchEntities(supa, query) {
  const q = (query || '').trim();
  const toks = dedupe(q.split(/\s+/).filter(w => w.length > 3));
  const orTitle = toks.map(t => `title.ilike.%${t}%`).join(',');
  const orUrl   = toks.map(t => `url.ilike.%${t}%`).join(',');
  const orAny   = [orTitle, orUrl].filter(Boolean).join(',');

  // EVENTS
  const { data: eventsRaw, error: e1 } = await supa
    .from('page_entities')
    .select('url,kind,title,description,provider,source_url,date_start,date_end,price,price_currency,raw')
    .eq('kind','event')
    .or(orAny || 'title.ilike.% %')
    .order('date_start', { ascending: true })
    .limit(50);
  if (e1) throw e1;

  // PRODUCTS
  const { data: productsRaw, error: e2 } = await supa
    .from('page_entities')
    .select('url,kind,title,description,provider,source_url,price,price_currency,raw')
    .eq('kind','product')
    .or(orAny || 'title.ilike.% %')
    .limit(50);
  if (e2) throw e2;

  const toEvent = (r) => ({
    url: r.url || r.source_url || null,
    source_url: r.source_url || r.url || null,
    title: r.title || null,
    description: r.description || null,
    date_start: r.date_start || null,
    date_end: r.date_end || null,
    provider: r.provider || null,
    price: r.price ?? null,
    price_currency: r.price_currency || null,
    raw: r.raw || null
  });

  const toProduct = (r) => ({
    url: r.url || r.source_url || null,
    source_url: r.source_url || r.url || null,
    title: r.title || null,
    description: r.description || null,
    provider: r.provider || null,
    price: r.price ?? null,
    price_currency: r.price_currency || null,
    raw: r.raw || null
  });

  return {
    events: (eventsRaw || []).map(toEvent),
    products: (productsRaw || []).map(toProduct)
  };
}

/** Attach the best product price to each event (if a plausible match exists) */
function attachPricesToEvents(events, products) {
  if (!events?.length) return events || [];

  const out = events.map(e => ({ ...e, offers: [] }));
  for (const ev of out) {
    let best = null, bestScore = -1;

    for (const p of products || []) {
      // prefer same page/host; then score by title similarity
      const samePageish =
        (p.source_url && ev.source_url && norm(p.source_url).split('?')[0] === norm(ev.source_url).split('?')[0]) ||
        (p.url && ev.url && new URL(p.url).origin === new URL(ev.url).origin);

      const s = scoreTitleMatch(`${ev.title || ''} ${ev.description || ''}`, `${p.title || ''} ${p.description || ''}`);
      const score = (samePageish ? 2 : 0) + s;

      if (score > bestScore) { bestScore = score; best = p; }
    }

    if (best && (best.price != null || best.raw?.offers?.price)) {
      // single price product
      const price = best.price ?? best.raw?.offers?.price ?? null;
      const currency = best.price_currency ?? best.raw?.offers?.priceCurrency ?? ev.price_currency ?? 'GBP';
      ev.offers.push({ label: best.title || 'Price', price, currency, href: best.url || best.source_url });
    }

    // additionally map multi-offer products (if present in raw)
    if (best?.raw?.offers && Array.isArray(best.raw.offers)) {
      for (const off of best.raw.offers) {
        const label = off.name || off.description || best.title || 'Offer';
        ev.offers.push({
          label,
          price: off.price ?? null,
          currency: off.priceCurrency || best.price_currency || 'GBP',
          href: off.url || best.url || best.source_url
        });
      }
    }
  }
  return out;
}

/* =============================== OpenAI call ============================== */
async function answerWithOpenAI({ system, user, oaKey }) {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${oaKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.1,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`openai_error:${res.status}:${text.slice(0, 300)}`);
  let j; try { j = JSON.parse(text); } catch { throw new Error('openai_bad_json'); }
  return j?.choices?.[0]?.message?.content || '';
}

/* ================================ Handler ================================ */
export default async function handler(req, res) {
  let stage = 'start';
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

    stage = 'auth';
    const bearer = (req.headers['authorization'] || '').trim();
    const needToken = process.env.INGEST_TOKEN || '';
    if (needToken && bearer !== `Bearer ${needToken}`) return res.status(401).json({ ok: false, error: 'unauthorized' });

    stage = 'parse';
    const { query, topK = 8 } = req.body || {};
    if (!query || typeof query !== 'string') return res.status(400).json({ ok: false, error: 'Provide "query" string.' });

    stage = 'db';
    const supa = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));

    // 1) Retrieve chunks for RAG context
    stage = 'retrieve';
    const rows = await retrieveChunks(supa, query, Math.max(6, Math.min(24, Number(topK) || 8)));
    const context = rows.map((r, i) => `# Doc ${i + 1}\n— ${r.url}\n\n${r.content}\n`).join('\n\n');

    // 2) Pull events + products and attach pricing
    stage = 'entities';
    const { events, products } = await fetchEntities(supa, query);
    const eventsOut = attachPricesToEvents(
      // keep only future-ish events and dedupe by (url + date)
      dedupe((events || [])
        .filter(e => e.date_start)
        .map(e => JSON.stringify({
          url: e.url || e.source_url,
          source_url: e.source_url || e.url,
          title: e.title, description: e.description,
          date_start: e.date_start, date_end: e.date_end,
          provider: e.provider, price: e.price, price_currency: e.price_currency,
          raw: e.raw
        })))
        .map(s => JSON.parse(s))
        .sort((a, b) => (new Date(a.date_start) - new Date(b.date_start))),
      products
    );

    // 3) Build citations: show both chunk URLs and event URLs (de-duped)
    const eventUrls = eventsOut.map(e => e.url || e.source_url).filter(Boolean);
    const citations = dedupe([...(rows.map(r => r.url)), ...eventUrls]).slice(0, 12);

    // 4) Ask OpenAI (concise answer – but we will also return the structured payload explicitly)
    stage = 'answer';
    const system = 'You are a helpful assistant grounded ONLY in the provided context. Cite nothing yourself; the API will attach citations. If date/price not present in context, say it is not specified.';
    const user =
      `Question: ${query}\n` +
      `Context (excerpts):\n${context || '(no context found)'}\n\n` +
      `Be concise and structured for end users.`;

    const answer = await answerWithOpenAI({ system, user, oaKey: need('OPENAI_API_KEY') });

    stage = 'done';
    return res.status(200).json({
      ok: true,
      answer,
      citations,
      structured: {
        events: eventsOut,
        products
      }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: asString(err), stage });
  }
}
