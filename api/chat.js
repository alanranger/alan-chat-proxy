// /api/chat.ts (or /app/api/chat/route.ts for Next.js 13+)
// Runtime: edge (recommended), Node also fine.

export const config = { runtime: 'edge' };

import { createClient } from '@supabase/supabase-js';

type Env = {
  OPENAI_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

function need(name: keyof Env): string {
  const v = process.env[name as string];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const OPENAI_API_KEY = need('OPENAI_API_KEY');
const SUPABASE_URL = need('SUPABASE_URL');
const SUPABASE_KEY = need('SUPABASE_SERVICE_ROLE_KEY');

const openai = {
  async chat(system: string, user: string) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const json = await res.json();
    return json.choices?.[0]?.message?.content || '';
  },
};

function tokens(x: string) {
  return (x || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function preferBluebell(query: string) {
  const t = tokens(query);
  return t.includes('bluebell') || t.includes('bluebells');
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr.filter(Boolean) as T[]));
}

function pickUrl(row: any): string | null {
  return (row?.source_url || row?.url || null) as string | null;
}

function mapEvent(r: any) {
  return {
    title: r.title || null,
    description: r.description || null,
    date_start: r.date_start || null,
    date_end: r.date_end || null,
    location: r.location || null,
    price: r.price ?? null,
    price_currency: r.price_currency || null,
    availability: r.availability || null,
    url: pickUrl(r),
    raw: r.raw ?? null,
  };
}

function mapProduct(r: any) {
  return {
    title: r.title || null,
    description: r.description || null,
    price: r.price ?? null,
    price_currency: r.price_currency || null,
    availability: r.availability || null,
    sku: r.sku || null,
    provider: r.provider || null,
    url: pickUrl(r),
    raw: r.raw ?? null,
  };
}

async function retrieveChunks(supa: any, query: string, topK = 8) {
  // Build an OR filter for page_chunks: title/chunk_text/url ilike %token%
  const t = uniq(tokens(query)).slice(0, 6);
  const ors: string[] = [];
  if (t.length === 0) {
    ors.push('title.ilike.%workshop%,chunk_text.ilike.%workshop%');
  } else {
    for (const k of t) {
      ors.push(`title.ilike.%${k}%,chunk_text.ilike.%${k}%,url.ilike.%${k}%`);
    }
  }
  const orFilter = ors.join(',');

  // Prefer bluebell pages if the question says "bluebell"
  const bluebellBias = preferBluebell(query) ? '%bluebell%' : null;

  let q = supa
    .from('page_chunks')
    .select('url,title,chunk_text', { count: 'exact' })
    .or(orFilter)
    .limit(Math.max(topK * 3, 24));

  if (bluebellBias) q = q.ilike('url', bluebellBias);

  const { data, error } = await q;
  if (error) throw error;

  // Deduplicate by URL while keeping good coverage
  const seen = new Set<string>();
  const rows = [];
  for (const r of data || []) {
    if (!r?.url) continue;
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    rows.push(r);
    if (rows.length >= Math.max(topK, 8)) break;
  }
  return rows as { url: string; title: string; chunk_text: string }[];
}

async function fetchEntitiesForUrls(supa: any, urls: string[]) {
  if (!urls.length) return { events: [], products: [] };

  // 1) url in urls
  let { data: d1, error: e1 } = await supa
    .from('page_entities')
    .select('*')
    .in('url', urls);
  if (e1) throw e1;

  // 2) source_url in urls (some extractors store canonical here)
  let { data: d2, error: e2 } = await supa
    .from('page_entities')
    .select('*')
    .in('source_url', urls);
  if (e2) throw e2;

  const all = [...(d1 || []), ...(d2 || [])];

  const events = all.filter((r) => (r.kind || '').toLowerCase() === 'event').map(mapEvent);
  const products = all.filter((r) => (r.kind || '').toLowerCase() === 'product').map(mapProduct);

  return { events, products };
}

function buildPrompt(query: string, chunks: { url: string; title: string; chunk_text: string }[], entities: { events: any[]; products: any[] }) {
  // Collate concise context
  const ctxLines: string[] = [];
  for (const c of chunks) {
    const clean = (c.chunk_text || '').replace(/\s+/g, ' ').trim();
    if (clean) ctxLines.push(`- (${c.url}) ${clean.slice(0, 400)}`);
  }

  // Entity hints: dates & prices if present
  const eventHints = entities.events
    .map((e) => {
      const ds = e.date_start ? new Date(e.date_start).toUTCString() : null;
      const pr =
        e.price != null
          ? `${e.price_currency || 'GBP'} ${e.price}`
          : null;
      return `• Event: ${e.title || ''} @ ${e.location || ''} ${ds ? `on ${ds}` : ''} ${pr ? `price ${pr}` : ''} ${e.url ? `(${e.url})` : ''}`.trim();
    })
    .slice(0, 12);

  const productHints = entities.products
    .map((p) => {
      const pr =
        p.price != null
          ? `${p.price_currency || 'GBP'} ${p.price}`
          : null;
      return `• Product: ${p.title || ''} ${pr ? `price ${pr}` : ''} ${p.url ? `(${p.url})` : ''}`.trim();
    })
    .slice(0, 12);

  const system = `You are a helpful assistant grounded ONLY in the provided context. 
- If the user asks about Bluebell workshops, prioritise pages and entities that clearly relate to "bluebell". 
- If explicit prices are present in entities, use them; otherwise say price wasn't given.
- Keep answers concise and structured with bullets, include dates (dd Mon yyyy) and a single "Location:" line.
- Do not invent links; the UI will attach them.`;

  const user = `Question: ${query}

Context (excerpts):
${ctxLines.join('\n')}

Entities:
${eventHints.concat(productHints).join('\n')}

Answer in bullet points:
- For dates, list each upcoming date on its own bullet (format "Thu, 24 Apr 2026").
- Add a "Location:" line (one line).
- Add a "Price:" line with GBP if given; otherwise note it's not specified.
- Add "Max participants" if given.
- Keep it brief.`;

  return { system, user };
}

function asProvenance(citations: string[], entities: { events: any[]; products: any[] }) {
  const fromEntities = uniq(
    []
      .concat(entities.events.map((e) => e.url).filter(Boolean))
      .concat(entities.products.map((p) => p.url).filter(Boolean))
  );
  const tried = uniq(citations);
  return { tried, events: entities.events, products: entities.products };
}

export default async function handler(req: Request) {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { status: 405 });
    }

    const { query, topK = 8 } = await req.json();

    const supa = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });

    // 1) retrieve site chunks
    const chunks = await retrieveChunks(supa, query, topK);
    const urls = uniq(chunks.map((c) => c.url));

    // 2) fetch entities for those URLs (events & products)
    const entities = await fetchEntitiesForUrls(supa, urls);

    // 3) build prompt and ask OpenAI
    const { system, user } = buildPrompt(query, chunks, entities);
    const answer = await openai.chat(system, user);

    // 4) citations: prioritize entity urls first, then chunk urls
    const citations = uniq(
      []
        .concat(entities.events.map((e) => e.url).filter(Boolean))
        .concat(entities.products.map((p) => p.url).filter(Boolean))
        .concat(urls)
    );

    const structured = asProvenance(citations, entities);

    return new Response(
      JSON.stringify({
        ok: true,
        answer,
        citations,
        structured, // { tried, events, products } → your debug panel & UI can use this directly
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
