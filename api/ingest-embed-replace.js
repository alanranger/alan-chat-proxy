// /api/ingest-embed-replace.js — OpenAI embeddings + REPLACE semantics
// Now also extracts JSON-LD and persists to `page_entities`.

export const config = { runtime: 'nodejs' };

import crypto from 'node:crypto';
import { htmlToText } from 'html-to-text';
import { createClient } from '@supabase/supabase-js';

// IMPORTANT: our JSON-LD helpers live in /json/content-extract.js
// (you already have this file; it exposes extractAllFromUrl(url))
import { extractAllFromUrl } from '../json/content-extract.js';

const need = (k) => {
  const v = process.env[k];
  if (!v || !String(v).trim()) throw new Error(`missing_env:${k}`);
  return v;
};
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

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

// ---------- page fetcher (with retry & strong headers) ----------
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
      ...(referer ? { 'Referer': referer } : {})
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
      { selector: 'style',  format: 'skip' }
    ],
    wordwrap: false
  }).trim();

  return { text };
}

// ---------- embeddings (OpenAI only) ----------
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

// ---------- helpers for entity upsert ----------
function normalizeEntityRows(url, extracted) {
  const rows = [];

  const push = (kind, item) => {
    // determine a stable hash from the meaningful fields
    const keyBits = [
      kind,
      item?.title || item?.name || '',
      item?.date_start || item?.raw?.startDate || '',
      item?.price || '',
      item?.sku || ''
    ].join('|');
    const entity_hash = sha1(keyBits);

    rows.push({
      url,
      kind,
      title: item?.title || item?.name || null,
      description: item?.description || null,
      date_start: item?.date_start || null,
      date_end: item?.date_end || null,
      location: item?.location || null,
      price: (item?.price != null ? Number(item.price) : null),
      price_currency: item?.priceCurrency || null,
      availability: item?.availability || null,
      sku: item?.sku || null,
      provider: item?.provider || null,
      source_url: item?.source_url || null,
      raw: item?.raw || item || {},
      entity_hash
    });
  };

  // The extractors you already have return arrays keyed by plural names
  for (const ev of extracted?.events || [])   push('event',   ev);
  for (const pr of extracted?.products || []) push('product', pr);
  for (const sv of extracted?.services || []) push('service', sv);
  for (const ar of extracted?.articles || []) push('article', ar);

  return rows;
}

async function replaceEntitiesForUrl(supa, url, extracted) {
  const rows = normalizeEntityRows(url, extracted);
  // REPLACE semantics: wipe existing then insert fresh
  const del = await supa.from('page_entities').delete().eq('url', url);
  if (del.error) throw new Error(`supabase_delete_entities_failed: ${del.error.message}`);

  if (!rows.length) return { inserted: 0 };
  const ins = await supa.from('page_entities').upsert(rows, { onConflict: 'url,entity_hash' }).select('id');
  if (ins.error) throw new Error(`supabase_upsert_entities_failed: ${ins.error.message}`);
  return { inserted: ins.data?.length || 0 };
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
    const { text } = await fetchPage(url);
    if (!text || text.length < 10) return sendJSON(res, 422, { error: 'empty_content', stage });

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

    // REPLACE semantics for chunks
    stage = 'delete_old_chunks';
    const delOld = await supa.from('page_chunks').delete().eq('url', url);
    if (delOld.error) return sendJSON(res, 500, { error: 'supabase_delete_failed', detail: delOld.error.message, stage });

    stage = 'upsert_chunks';
    const up = await supa.from('page_chunks')
      .upsert(rows, { onConflict: 'hash' })
      .select('id')
      .order('id', { ascending: false });

    if (up.error) return sendJSON(res, 500, { error: 'supabase_upsert_failed', detail: up.error.message, stage });

    // NEW: extract structured JSON-LD and store it
    stage = 'extract_jsonld';
    let extracted = {};
    try {
      extracted = await extractAllFromUrl(url);
    } catch (e) {
      // non-fatal: store chunks even if extract failed
      extracted = { error: String(e) };
    }

    stage = 'store_entities';
    try {
      if (!extracted?.error) {
        await replaceEntitiesForUrl(supa, url, extracted);
      }
    } catch (e) {
      // also non-fatal: we still return success for chunks
      // but we’ll include the entity error in the response
      return sendJSON(res, 200, {
        ok: true,
        id: up.data?.[0]?.id ?? null,
        len: text.length,
        chunks: rows.length,
        stage,
        entity_store_error: String(e)
      });
    }

    stage = 'done';
    return sendJSON(res, 200, {
      ok: true,
      id: up.data?.[0]?.id ?? null,
      len: text.length,
      chunks: rows.length,
      stage
    });
  } catch (err) {
    return sendJSON(res, 500, { error: 'server_error', detail: asString(err), stage });
  }
}
