// /api/ingest-embed-replace.js — embeds + JSON-LD → page_chunks + page_entities (REPLACE)
export const config = { runtime: 'nodejs' };

import crypto from 'node:crypto';
import { htmlToText } from 'html-to-text';
import { createClient } from '@supabase/supabase-js';

const need = (k) => {
  const v = process.env[k];
  if (!v || !String(v).trim()) throw new Error(`missing_env:${k}`);
  return v;
};
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');
const nowIso = () => new Date().toISOString();

const PRIMARY_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SECONDARY_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const chunkText = (txt, size = 3500, overlap = 300) => {
  const out = [];
  for (let i = 0; i < txt.length; i += (size - overlap)) {
    out.push(txt.slice(i, Math.min(i + size, txt.length)).trim());
  }
  return out.filter(Boolean);
};

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

// ---------- fetch page ----------
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
  if ([401,403,429,503].includes(r.status)) r = await fetchOnce(url, SECONDARY_UA, origin);
  if (!r.ok) {
    const body = await r.text().catch(()=> '');
    const snippet = (body || '').slice(0, 240).replace(/\s+/g,' ');
    throw new Error(`fetch_failed:${r.status}:${snippet}`);
  }
  const html = await r.text();
  const text = htmlToText(html, {
    selectors: [
      { selector:'nav', format:'skip' },
      { selector:'footer', format:'skip' },
      { selector:'script', format:'skip' },
      { selector:'style', format:'skip' }
    ],
    wordwrap: false
  }).trim();
  return { html, text };
}

// ---------- embeddings (OpenAI) ----------
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
  const ct = (resp.headers.get('content-type')||'').toLowerCase();
  const text = await resp.text();
  if (!resp.ok) throw new Error(`openai_error:${resp.status}:${text.slice(0,300)}`);
  if (!ct.includes('application/json')) throw new Error(`openai_bad_content_type:${ct||'(none)'}:${text.slice(0,300)}`);
  let j; try { j = JSON.parse(text); } catch(e){ throw new Error(`openai_bad_json:${e?.message||e}`); }
  const out = (j?.data||[]).map(d => d?.embedding);
  if (!out.length) throw new Error('openai_empty_embeddings');
  if (!Array.isArray(out[0]) || out[0].length !== 1536) throw new Error('openai_bad_embedding_dim');
  return out;
}

// ---------- JSON-LD extraction (no imports) ----------
function getJsonLdBlocks(html){
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m; while ((m = re.exec(html))){ const raw = (m[1]||'').trim(); if (raw) out.push(raw); }
  return out;
}
function arrayify(x){ return Array.isArray(x) ? x : (x != null ? [x] : []); }
function lastSeg(s){ if(!s) return s; const i = s.lastIndexOf('/'); return i>=0 ? s.slice(i+1) : s; }
function toNumber(x){ const n = Number(x); return Number.isFinite(n) ? n : null; }
function toDate(x){ if(!x) return null; const d = new Date(x); return isNaN(d.getTime()) ? null : d.toISOString(); }

function flattenLD(node, out=[]) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) { node.forEach(n => flattenLD(n, out)); return out; }
  const types = arrayify(node['@type']).map(String);
  if (types.length) out.push(node);
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (v && typeof v === 'object') flattenLD(v, out);
  }
  return out;
}

function normaliseEntity(n, sourceUrl){
  const types = arrayify(n['@type']).map(String);
  const kind = ['Event','Product','Service','Article','Course','CourseInstance']
    .find(t => types.some(tt => tt.toLowerCase().includes(t.toLowerCase())));
  if (!kind) return null;

  const offers = n.offers || {};
  const loc = n.location || {};
  const url = n.url || n.mainEntityOfPage || sourceUrl;

  const price = toNumber(offers.price ?? n.price);
  const priceCurrency = offers.priceCurrency ?? n.priceCurrency ?? null;
  const availability = lastSeg(offers.availability ?? n.availability ?? '') || null;

  const location =
    (typeof loc === 'string' && loc) ||
    loc.name || (loc.address && (loc.address.streetAddress || loc.address.addressLocality || loc.address)) || null;

  const title = n.name || n.headline || n.title || null;

  const row = {
    url,                              // canonical url of the entity (if present)
    source_url: sourceUrl,            // page where we found it (REPLACE by this)
    kind: (kind === 'CourseInstance' ? 'Event' : (kind === 'Course' ? 'Service' : kind)).toLowerCase(), // event/product/service/article
    title,
    description: n.description || null,
    date_start: toDate(n.startDate || n.datePublished || null),
    date_end:   toDate(n.endDate   || n.dateModified  || null),
    location,
    price,
    price_currency: priceCurrency,
    availability,
    sku: n.sku || null,
    provider: (n.provider?.name || n.brand?.name || n.organizer?.name || null),
    raw: n,
    entity_hash: sha1(JSON.stringify({url, sourceUrl, kind, title, date_start: n.startDate, date_end: n.endDate, price, priceCurrency})),
    last_seen: nowIso(),
  };
  return row;
}

function extractEntitiesFromHtml(html, sourceUrl){
  const blocks = getJsonLdBlocks(html);
  const rows = [];
  for (const raw of blocks){
    try {
      const parsed = JSON.parse(raw);
      const nodes = flattenLD(parsed);
      for (const n of nodes){
        const r = normaliseEntity(n, sourceUrl);
        if (r) rows.push(r);
      }
    } catch { /* ignore bad JSON-LD */ }
  }
  // de-dupe by entity_hash
  const uniq = new Map();
  for (const r of rows){ if (!uniq.has(r.entity_hash)) uniq.set(r.entity_hash, r); }
  return Array.from(uniq.values());
}

// Build short summaries to prepend into the page text (helps retrieval)
function summariesForChunks(entities){
  const lines = [];
  for (const e of entities){
    if (e.kind === 'event') {
      const ds = e.date_start ? new Date(e.date_start).toISOString().slice(0,10) : '';
      lines.push(`[EVENT] ${e.title || 'Event'}${ds?` — ${ds}`:''}${e.location?` — ${e.location}`:''}${e.price?` — £${e.price}`:''} ${e.url||e.source_url||''}`);
    } else if (e.kind === 'product') {
      lines.push(`[PRODUCT] ${e.title || 'Product'}${e.price?` — £${e.price}`:''} ${e.url||e.source_url||''}`);
    } else if (e.kind === 'service') {
      lines.push(`[SERVICE] ${e.title || 'Service'} ${e.url||e.source_url||''}`);
    } else if (e.kind === 'article') {
      lines.push(`[ARTICLE] ${e.title || 'Article'} ${e.url||e.source_url||''}`);
    }
  }
  return lines.length ? (lines.join('\n') + '\n\n') : '';
}

// ---------- handler ----------
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

    stage = 'fetch_page';
    const { html, text: baseText } = await fetchPage(url);
    if (!baseText || baseText.length < 10) return sendJSON(res, 422, { error: 'empty_content', stage });

    stage = 'extract_jsonld';
    const entities = extractEntitiesFromHtml(html, url);

    // Put concise JSON-LD summaries before the page text so chunks carry them
    const text = summariesForChunks(entities) + baseText;

    stage = 'chunk';
    const chunks = chunkText(text);
    if (!chunks.length) return sendJSON(res, 422, { error: 'no_chunks', stage });

    stage = 'embed';
    const embeds = await getEmbeddings(chunks);

    stage = 'prepare_rows';
    const rows = chunks.map((content, i) => ({
      url,
      title: null,
      content,
      embedding: embeds[i],
      tokens: Math.ceil(content.length / 4),
      hash: sha1(`${url}#${i}:${content.slice(0, 128)}`)
    }));

    // ---------- REPLACE CHUNKS ----------
    stage = 'delete_old_chunks';
    { const { error: delErr } = await supa.from('page_chunks').delete().eq('url', url);
      if (delErr) return sendJSON(res, 500, { error: 'supabase_delete_failed', detail: delErr.message || delErr, stage });
    }

    stage = 'upsert_chunks';
    {
      const { data, error } = await supa
        .from('page_chunks')
        .upsert(rows, { onConflict: 'hash' })
        .select('id')
        .order('id', { ascending: false });
      if (error) return sendJSON(res, 500, { error: 'supabase_upsert_failed', detail: error.message || error, stage });
    }

    // ---------- REPLACE ENTITIES ----------
    stage = 'replace_entities';
    {
      // Replace “what we found on this page”
      const { error: delE } = await supa.from('page_entities').delete().eq('source_url', url);
      if (delE) return sendJSON(res, 500, { error: 'supabase_entities_delete_failed', detail: delE.message || delE, stage });

      if (entities.length) {
        const { error: insE } = await supa.from('page_entities').insert(entities.map(e => ({
          url: e.url,
          source_url: e.source_url,
          kind: e.kind,
          title: e.title,
          description: e.description,
          date_start: e.date_start,
          date_end: e.date_end,
          location: e.location,
          price: e.price,
          price_currency: e.price_currency,
          availability: e.availability,
          sku: e.sku,
          provider: e.provider,
          raw: e.raw,
          entity_hash: e.entity_hash,
          last_seen: e.last_seen
        })));
        if (insE) return sendJSON(res, 500, { error: 'supabase_entities_insert_failed', detail: insE.message || insE, stage });
      }
    }

    stage = 'done';
    return sendJSON(res, 200, { ok: true, len: text.length, chunks: rows.length, entities: entities.length, stage });
  } catch (err) {
    return sendJSON(res, 500, { error: 'server_error', detail: asString(err), stage });
  }
}
