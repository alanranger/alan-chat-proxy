// /api/chat.js
import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' }; // or 'nodejs' if you prefer

function env(name, fallback = '') {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const supa = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

// --- tiny helpers
const lowerIncludes = (s, needle) => (s || '').toString().toLowerCase().includes(needle);
const coalesce = (...vals) => vals.find(v => v !== undefined && v !== null && v !== '') ?? null;
const normUrl = (u) => {
  try {
    const x = new URL(u);
    // strip tracking junk
    x.hash = ''; x.search = '';
    // remove trailing slash
    const p = x.pathname.replace(/\/+$/, '');
    x.pathname = p || '/';
    return x.toString();
  } catch { return u || null; }
};

function isEvent(row) {
  const t = (coalesce(row.schema_type, row.kind, row.type, row['@type']) || '').toString().toLowerCase();
  return t.includes('event');
}
function isProduct(row) {
  const t = (coalesce(row.schema_type, row.kind, row.type, row['@type']) || '').toString().toLowerCase();
  return t.includes('product') || t.includes('offer');
}

function firstOffer(row) {
  // common JSON-LD shapes
  const arr = Array.isArray(row.offers) ? row.offers : (row.offers && typeof row.offers === 'object' ? [row.offers] : []);
  if (!arr.length) return null;
  return arr.find(o => o && (o.price != null || o.priceCurrency)) || arr[0];
}

function mapEvent(row) {
  const url = normUrl(coalesce(row.url, row.source_url, row.canonical_url, row.page_url, row.link, row.page));
  const title = coalesce(row.title, row.name);
  const date_start = coalesce(row.date_start, row.startDate, row.start_date, row.date, row.start);
  const date_end = coalesce(row.date_end, row.endDate, row.end_date);
  return { title, url, date_start, date_end };
}

function mapProduct(row) {
  const url = normUrl(coalesce(row.url, row.source_url, row.canonical_url, row.page_url, row.link, row.page));
  const title = coalesce(row.title, row.name);
  let price = row.price ?? null;
  let price_currency = row.price_currency ?? row.priceCurrency ?? null;
  if (price == null || !price_currency) {
    const ofr = firstOffer(row);
    if (ofr) {
      price = price ?? ofr.price ?? null;
      price_currency = price_currency ?? ofr.priceCurrency ?? null;
    }
  }
  return { title, url, price, price_currency };
}

// try to label URLs succinctly
function labelFromUrl(u) {
  try {
    const x = new URL(u);
    const parts = x.pathname.split('/').filter(Boolean);
    return parts.slice(-1)[0] || x.hostname;
  } catch { return u; }
}

// simple chunk fetch (no assumptions beyond typical columns)
async function fetchChunks(query, topK = 8) {
  // Prefer “bluebell” if present to keep the results tight
  const q = query.toLowerCase();
  const must = q.includes('bluebell') ? 'bluebell' : null;

  // Try a couple of quick heuristics: title/content search
  // (If you have pgvector embeddings, replace this with similarity search.)
  const { data, error } = await supa
    .from('chunks')
    .select('id, title, content, url, source_url')
    .limit(50);

  if (error) throw error;

  const scored = (data || []).map(r => {
    const url = normUrl(coalesce(r.url, r.source_url));
    const title = r.title || '';
    const content = r.content || '';
    const text = `${title}\n${content}`.toLowerCase();

    // quick-and-dirty scoring
    let score = 0;
    query.toLowerCase().split(/\s+/).forEach(tok => { if (tok && text.includes(tok)) score += 1; });
    if (must && !text.includes(must)) score -= 100; // push irrelevant down
    if (url && url.includes('bluebell')) score += 3;
    if (title.toLowerCase().includes('bluebell')) score += 2;

    return { ...r, url, score };
  }).sort((a, b) => b.score - a.score);

  // topK non-empty
  const rows = scored.filter(r => r.score > -50).slice(0, topK);
  return rows;
}

async function fetchEntitiesForUrls(urls, topicWord /* e.g., 'bluebell' */) {
  // We purposely select '*' to avoid column-name mismatches.
  const { data, error } = await supa.from('page_entities').select('*').limit(2000);
  if (error) throw error;

  const tried = [];
  const byUrl = (row) => normUrl(coalesce(row.url, row.source_url, row.canonical_url, row.page_url, row.link, row.page));

  // If we have specific URLs, prefer those; otherwise filter by topic word to avoid “every event”.
  const whitelist = new Set((urls || []).map(normUrl).filter(Boolean));
  const topic = (topicWord || '').toLowerCase();

  const keepRow = (row) => {
    const u = byUrl(row);
    if (u) tried.push(u);
    if (whitelist.size) return u && whitelist.has(u);
    // fallback: topic filter on url/title/kind
    const t = (coalesce(row.title, row.name, '')).toString().toLowerCase();
    const k = (coalesce(row.schema_type, row.kind, row.type, row['@type'], '')).toString().toLowerCase();
    return (u && u.toLowerCase().includes(topic)) || t.includes(topic) || k.includes(topic);
  };

  const rows = (data || []).filter(keepRow);

  const events = rows.filter(isEvent).map(mapEvent);
  const products = rows.filter(isProduct).map(mapProduct);

  // de-dupe by (url + title/price)
  const dedupe = (arr, keyFn) => {
    const seen = new Set();
    const out = [];
    for (const x of arr) {
      const k = keyFn(x);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(x);
    }
    return out;
  };

  return {
    tried: Array.from(new Set(tried.filter(Boolean))).slice(0, 20),
    events: dedupe(events, e => `${e.url}::${e.date_start || ''}::${e.title || ''}`),
    products: dedupe(products, p => `${p.url}::${p.price || ''}::${p.title || ''}`),
  };
}

function buildPrompt(query, context) {
  const ctx = context.map((r, i) => `# Doc ${i + 1} — ${r.title || '(untitled)'}\n${r.content || ''}`).join('\n\n');
  const sys = `You are a helpful assistant grounded ONLY in the provided context.
- Cite nothing yourself; the API will attach citations.
- If date/price are present in context/entities, show them clearly.
- Be concise and structured for end users.`;

  const user = `Question: ${query}\n\nContext:\n${ctx}`;

  return { sys, user };
}

export default async function handler(req) {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { status: 405 });
    }

    const { query, topK = 8 } = await req.json().catch(() => ({}));
    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_query' }), { status: 400 });
    }

    // 1) Retrieve chunks (context)
    const rows = await fetchChunks(query, Math.max(3, Math.min(12, topK)));
    const citations = Array.from(new Set(rows.map(r => r.url).filter(Boolean)));

    // 2) Fetch structured entities for those URLs (fallback to topic filter)
    const bluebellIntent = /bluebell/i.test(query);
    const entities = await fetchEntitiesForUrls(citations, bluebellIntent ? 'bluebell' : '');

    // 3) Ask the model using only the chunk text
    const { sys, user } = buildPrompt(query, rows);

    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      }),
    });

    if (!completion.ok) {
      const txt = await completion.text();
      return new Response(JSON.stringify({ ok: false, error: `openai_${completion.status}`, detail: txt.slice(0, 400) }), { status: 502 });
    }
    const cjson = await completion.json();
    const answer = cjson.choices?.[0]?.message?.content?.trim() || 'Sorry — I could not answer that.';

    // 4) Build a clean response
    const structured = {
      events: entities.events,
      products: entities.products,
    };

    const structured_debug = {
      tried: entities.tried,
      events_from: entities.events,
      products_from: entities.products,
    };

    // Prefer Bluebell-ish citations first
    const sortedCitations = [...citations].sort((a, b) => {
      const ab = +(a.toLowerCase().includes('bluebell'));
      const bb = +(b.toLowerCase().includes('bluebell'));
      return bb - ab;
    });

    return new Response(JSON.stringify({
      ok: true,
      answer,
      citations: sortedCitations,
      structured,
      structured_debug,
      followups: [
        'Check the workshop page for booking details.',
        'Consider bringing your camera gear for the workshop.',
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message || 'server_error' }), { status: 500 });
  }
}
