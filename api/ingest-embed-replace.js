// /api/ingest-embed-replace.js
// Single-file ingest that also parses JSON-LD and stores "entities" + enriched chunks.
// Updated to align with DB: page_entities UNIQUE (url, entity_hash), page_chunks requires chunk_hash NOT NULL.

export const config = { runtime: 'nodejs' };

import crypto from 'node:crypto';
import { htmlToText } from 'html-to-text';
import { createClient } from '@supabase/supabase-js';

/* ========== utils ========== */
const need = (k) => {
  const v = process.env[k];
  if (!v || !String(v).trim()) throw new Error(`missing_env:${k}`);
  return v;
};
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

const asString = (e) => {
  if (!e) return '(unknown)';
  if (typeof e === 'string') return e;
  if (e.message && typeof e.message === 'string') return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
};

const sendJSON = (res, status, obj) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (obj && 'detail' in obj) obj.detail = asString(obj.detail);
  res.status(status).send(JSON.stringify(obj));
};

const chunkText = (txt, size = 3500, overlap = 300) => {
  const out = [];
  for (let i = 0; i < txt.length; i += (size - overlap)) {
    out.push(txt.slice(i, Math.min(i + size, txt.length)).trim());
  }
  return out.filter(Boolean);
};

/* ========== page fetch (HTML + plain text) ========== */
const PRIMARY_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SECONDARY_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchOnce(url, ua, referer) {
  return fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-GB,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Upgrade-Insecure-Requests': '1',
      ...(referer ? { Referer: referer } : {})
    }
  });
}

async function fetchPage(url) {
  const origin = (() => { try { return new URL(url).origin; } catch { return undefined; } })();

  let r = await fetchOnce(url, PRIMARY_UA, origin);
  if ([401, 403, 429, 503].includes(r.status)) r = await fetchOnce(url, SECONDARY_UA, origin);

  if (!r.ok) {
    const body = await r.text().catch(() => '');
    const snippet = (body || '').slice(0, 240).replace(/\s+/g, ' ');
    throw new Error(`fetch_failed:${r.status}:${snippet}`);
  }

  const html = await r.text();
  const text = htmlToText(html, {
    selectors: [
      { selector: 'nav', format: 'skip' },
      { selector: 'footer', format: 'skip' },
      { selector: 'script', format: 'skip' },
      { selector: 'style', format: 'skip' }
    ],
    wordwrap: false
  }).trim();

  return { html, text };
}

/* ========== JSON-LD extraction (inline) ========== */
function* findJsonLdBlocks(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = (m[1] || '').trim();
    if (!raw) continue;
    yield raw;
  }
}

function parseAnyJson(s) {
  const cleaned = s.replace(/^\s*<!--/, '').replace(/-->\s*$/, '');
  try { return JSON.parse(cleaned); } catch { return null; }
}

function flattenJsonLd(node) {
  const out = [];
  const push = (x) => { if (x && typeof x === 'object') out.push(x); };
  const walk = (x) => {
    if (!x) return;
    if (Array.isArray(x)) x.forEach(walk);
    else if (typeof x === 'object') {
      if (x['@type']) push(x);
      for (const k of Object.keys(x)) {
        const v = x[k];
        if (v && typeof v === 'object') walk(v);
      }
    }
  };
  walk(node);
  return out;
}

function normText(x) {
  if (x == null) return null;
  if (typeof x === 'string') return x.trim();
  if (typeof x === 'object' && x.name) return String(x.name).trim();
  return null;
}

function firstOf(...vals) {
  for (const v of vals) if (v != null && String(v).trim() !== '') return String(v).trim();
  return null;
}

function normalizeEntity(item, pageUrl) {
  const type = Array.isArray(item['@type']) ? item['@type'][0] : item['@type'];
  const t = String(type || '').toLowerCase();

  // Common fields
  const url = firstOf(item.url, item['@id'], pageUrl);
  const title = normText(firstOf(item.name, item.headline, item.title));
  const description = normText(item.description);
  const provider = normText(item.provider) || normText(item.brand) || normText(item.author);

  let kind = null;
  let date_start = null;
  let date_end = null;
  let location = null;
  let price = null;
  let price_currency = null;
  let availability = normText(item.availability);
  let sku = normText(item.sku);

  // Map types
  if (t === 'event' || t === 'course' || /event$/i.test(type || '')) {
    kind = 'event';
    date_start = firstOf(item.startDate);
    date_end = firstOf(item.endDate);
    location = firstOf(
      item.location?.name,
      item.location?.address?.streetAddress && item.location?.address?.addressLocality
        ? `${item.location.address.streetAddress}, ${item.location.address.addressLocality}`
        : item.location?.address?.addressLocality,
      item.location?.address?.addressRegion,
      item.location?.address
    );
    const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
    if (offer) {
      price = offer.price != null ? String(offer.price) : null;
      price_currency = offer.priceCurrency || null;
      availability = availability || normText(offer.availability);
      sku = sku || normText(offer.sku);
    }
  } else if (t === 'product') {
    kind = 'product';
    const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
    if (offer) {
      price = offer.price != null ? String(offer.price) : null;
      price_currency = offer.priceCurrency || null;
      availability = availability || normText(offer.availability);
      sku = sku || normText(offer.sku);
    }
  } else if (t === 'service') {
    kind = 'service';
  } else if (t === 'article' || t === 'blogposting' || t === 'newsarticle') {
    kind = 'article';
    date_start = firstOf(item.datePublished, item.dateCreated);
    // Normalize date-only strings to ISO timestamp to satisfy timestamptz
    if (date_start && /^\d{4}-\d{2}-\d{2}$/.test(String(date_start))) {
      date_start = `${date_start}T00:00:00Z`;
    }
    date_end = firstOf(item.dateModified);
  } else {
    return null; // ignore unrelated types
  }

  const raw = item; // keep full JSON for reference
  const entity_hash = sha1(`${pageUrl}::${kind}::${title || ''}::${date_start || ''}::${date_end || ''}::${JSON.stringify(raw || {})}`);

  return {
    url: pageUrl,
    kind,
    title,
    description,
    date_start,
    date_end,
    location,
    price,
    price_currency,
    availability,
    sku,
    provider,
    source_url: url,
    raw,
    entity_hash,
    last_seen: new Date().toISOString()
  };
}

function extractEntitiesFromHtml(html, pageUrl) {
  const entities = [];
  for (const raw of findJsonLdBlocks(html)) {
    const parsed = parseAnyJson(raw);
    if (!parsed) continue;
    const candidates = flattenJsonLd(parsed);
    for (const node of candidates) {
      const ent = normalizeEntity(node, pageUrl);
      if (ent) entities.push(ent);
    }
  }
  return entities;
}

function entitySnippets(entities) {
  const lines = [];
  for (const e of entities) {
    if (e.kind === 'event') {
      lines.push(
        `[EVENT] ${e.title || ''}${e.date_start ? ` • Date: ${e.date_start}` : ''}${e.location ? ` • Location: ${e.location}` : ''}${
          e.price ? ` • Price: ${e.price}${e.price_currency ? ' ' + e.price_currency : ''}` : ''
        }${e.source_url ? ` • URL: ${e.source_url}` : ''}`
      );
    } else if (e.kind === 'article') {
      lines.push(
        `[ARTICLE] ${e.title || ''}${e.date_start ? ` • Published: ${e.date_start}` : ''}${e.source_url ? ` • URL: ${e.source_url}` : ''}`
      );
    } else if (e.kind === 'product') {
      lines.push(
        `[PRODUCT] ${e.title || ''}${e.price ? ` • Price: ${e.price}${e.price_currency ? ' ' + e.price_currency : ''}` : ''}${
          e.availability ? ` • Availability: ${e.availability}` : ''
        }${e.source_url ? ` • URL: ${e.source_url}` : ''}`
      );
    } else if (e.kind === 'service') {
      lines.push(
        `[SERVICE] ${e.title || ''}${e.provider ? ` • Provider: ${e.provider}` : ''}${e.source_url ? ` • URL: ${e.source_url}` : ''}`
      );
    }
  }
  return lines.length ? lines.join('\n') + '\n\n' : '';
}

/* ========== embeddings (OpenAI) ========== */
async function getEmbeddings(inputs) {
  const oaKey = need('OPENAI_API_KEY');

  const body = JSON.stringify({ model: 'text-embedding-3-small', input: inputs });
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    redirect: 'follow',
    headers: {
      Authorization: `Bearer ${oaKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': PRIMARY_UA
    },
    body
  });

  const ct = (resp.headers.get('content-type') || '').toLowerCase();
  const text = await resp.text();

  if (!resp.ok) throw new Error(`openai_error:${resp.status}:url=${resp.url || '(unknown)'}:${text.slice(0, 300)}`);
  if (!ct.includes('application/json')) throw new Error(`openai_bad_content_type:${ct || '(none)'}:status=${resp.status}:url=${resp.url || '(unknown)'}:${text.slice(0, 300)}`);

  let j;
  try { j = JSON.parse(text); } catch (e) { throw new Error(`openai_bad_json:${String(e?.message || e)}`); }
  const out = (j?.data || []).map(d => d?.embedding);
  if (!out.length) throw new Error('openai_empty_embeddings');
  if (!Array.isArray(out[0]) || out[0].length !== 1536) throw new Error('openai_bad_embedding_dim');
  return out;
}

/* ========== handler ========== */
export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method_not_allowed' });

  let stage = 'start';
  try {
    stage = 'auth';
    const token = req.headers['authorization']?.trim();
    if (token !== `Bearer ${need('INGEST_TOKEN')}`) return sendJSON(res, 401, { error: 'unauthorized', stage });

    stage = 'parse_body';
    const { url } = req.body || {};
    if (!url) return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide "url"', stage });

    stage = 'db_client';
    const supa = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));

    /* 1) Fetch page */
    stage = 'fetch_page';
    const { html, text: rawText } = await fetchPage(url);
    if (!rawText || rawText.length < 10) return sendJSON(res, 422, { error: 'empty_content', stage });

    /* 2) Extract JSON-LD entities */
    stage = 'extract_entities';
    const entitiesRaw = extractEntitiesFromHtml(html, url);

    // Dedupe entities within this batch by entity_hash to avoid UNIQUE (url, entity_hash) collisions
    const seen = new Set();
    const entities = [];
    for (const e of entitiesRaw) {
      if (!e?.entity_hash) continue;
      if (seen.has(e.entity_hash)) continue;
      seen.add(e.entity_hash);
      entities.push(e);
    }

    // 3) Do NOT modify event records from scraper.
    // Filter out event entities entirely (CSV is the sole source of truth for events)
    const nonEventEntities = entities.filter(e => e.kind !== 'event');
    if (nonEventEntities.length) {
      stage = 'upsert_non_event_entities';
      const { error: insE } = await supa.from('page_entities').insert(nonEventEntities, { upsert: true, onConflict: 'url,entity_hash' });
      if (insE) return sendJSON(res, 500, { error: 'supabase_entities_insert_failed', detail: insE.message || insE, stage });
    }

    /* 4) Enrich text with entity snippets, then chunk + embed */
    stage = 'prepare_text';
    const preface = entitySnippets(entities);
    const fullText = preface + rawText;

    stage = 'chunk';
    const chunks = chunkText(fullText);
    if (!chunks.length) return sendJSON(res, 422, { error: 'no_chunks', stage });

    stage = 'embed';
    const embeds = await getEmbeddings(chunks);

    stage = 'prepare_rows';
    const rows = chunks.map((content, i) => {
      const chunk_hash = sha1(`${url}|${content}`); // stable by url+content
      return {
        url,
        title: null,
        chunk_text: content,  // NEW: store chunk text explicitly
        content,
        embedding: embeds[i],
        tokens: Math.ceil(content.length / 4),
        chunk_hash,           // NEW: NOT NULL, matches unique (url, chunk_hash)
        hash: chunk_hash      // mirror for legacy 'hash' reads
      };
    });

    /* 5) REPLACE chunks for this URL (delete → insert) */
    stage = 'delete_old_chunks';
    {
      const { error: delC } = await supa.from('page_chunks').delete().eq('url', url);
      if (delC) return sendJSON(res, 500, { error: 'supabase_delete_failed', detail: delC.message || delC, stage });
    }

    stage = 'insert_chunks';
    let firstChunkId = null;
    {
      // We deleted first, so a plain insert is correct (no ON CONFLICT)
      const { data: ins, error } = await supa
        .from('page_chunks')
        .insert(rows)
        .select('id')
        .order('id', { ascending: false });

      if (error) return sendJSON(res, 500, { error: 'supabase_insert_failed', detail: error.message || error, stage });
      firstChunkId = ins?.[0]?.id ?? null;
    }

    /* 6) Done */
    stage = 'done';
    return sendJSON(res, 200, {
      ok: true,
      id: firstChunkId,
      len: fullText.length,
      chunks: rows.length,
      entities: entities.length,
      stage
    });
  } catch (err) {
    return sendJSON(res, 500, { error: 'server_error', detail: asString(err), stage });
  }
}
