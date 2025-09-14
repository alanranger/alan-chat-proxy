// /api/ingest-embed-replace.js — single-file, JSON-LD + HTML, REPLACE semantics
export const config = { runtime: 'nodejs' };

import crypto from 'node:crypto';
import { htmlToText } from 'html-to-text';
import { createClient } from '@supabase/supabase-js';

/* ------------------------- tiny utils ------------------------- */
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
  if (!txt) return out;
  for (let i = 0; i < txt.length; i += (size - overlap)) {
    const slice = txt.slice(i, Math.min(i + size, txt.length)).trim();
    if (slice) out.push(slice);
  }
  return out;
};

/* --------------------- page fetch (robust) --------------------- */
const UA_PRIMARY =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const UA_SECONDARY =
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

async function fetchHTML(url) {
  const origin = (() => { try { return new URL(url).origin; } catch { return undefined; } })();

  let r = await fetchOnce(url, UA_PRIMARY, origin);
  if ([401, 403, 429, 503].includes(r.status)) r = await fetchOnce(url, UA_SECONDARY, origin);

  if (!r.ok) {
    const body = await r.text().catch(() => '');
    const snippet = (body || '').slice(0, 240).replace(/\s+/g, ' ');
    throw new Error(`fetch_failed:${r.status}:${snippet}`);
  }
  return await r.text();
}

/* ---------------- JSON-LD extraction (inline) ------------------ */
/** Extracts raw <script type="application/ld+json"> blocks */
function extractJsonLdBlocks(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = (m[1] || '').trim();
    if (raw) out.push(raw);
  }
  return out;
}

/** A very small "loose" JSON parser (removes comments, trailing commas) */
function looseParse(jsonText) {
  let s = (jsonText || '').trim();
  // Remove BOM, comments, and trailing commas
  s = s.replace(/^\uFEFF/, '');
  s = s.replace(/\/\*[\s\S]*?\*\//g, ''); // /* ... */
  s = s.replace(/(^|\s)\/\/.*$/gm, '');  // // ...
  s = s.replace(/,\s*([\]}])/g, '$1');   // trailing commas
  // Sometimes sites HTML-entity encode quotes. Quick fix:
  s = s.replace(/&quot;/g, '"').replace(/&#39;/g, '\'');
  return JSON.parse(s);
}

/** Ensure we always return an array of JSON objects */
function flattenLd(ld) {
  if (ld == null) return [];
  if (Array.isArray(ld)) return ld.flatMap(flattenLd);
  if (typeof ld === 'object' && Array.isArray(ld['@graph'])) return flattenLd(ld['@graph']);
  return [ld];
}

const hasType = (obj, names) => {
  const set = Array.isArray(names) ? names.map(x => String(x).toLowerCase()) : [String(names).toLowerCase()];
  const t = obj && obj['@type'];
  const norm = Array.isArray(t) ? t.map(String).map(s => s.toLowerCase()) : [String(t || '').toLowerCase()];
  return norm.some(v => set.includes(v));
};

/** Normalise a few common schema.org types to text chunks */
function jsonldObjectsToChunks(url, objs) {
  const chunks = [];
  for (const o of objs) {
    try {
      // ARTICLE / BLOGPOSTING
      if (hasType(o, ['Article', 'BlogPosting', 'NewsArticle'])) {
        const title = o.headline || o.name || '';
        const desc  = o.description || '';
        const dateP = o.datePublished || o.dateCreated || '';
        const dateM = o.dateModified || '';
        const author = (typeof o.author === 'string')
          ? o.author
          : (o.author && (o.author.name || (Array.isArray(o.author) && o.author[0]?.name))) || '';
        const source = o.url || url;

        chunks.push(
`[ARTICLE]
title: ${title}
author: ${author}
date_published: ${dateP}
date_modified: ${dateM}
source_url: ${source}
description: ${desc}`.trim()
        );
      }

      // PRODUCT
      if (hasType(o, 'Product')) {
        const title = o.name || '';
        const desc  = o.description || '';
        const sku   = o.sku || '';
        let price = '', currency = '', availability = '';
        const offers = Array.isArray(o.offers) ? o.offers[0] : o.offers;
        if (offers && typeof offers === 'object') {
          price = offers.price ?? '';
          currency = offers.priceCurrency ?? '';
          availability = (offers.availability || '').split('/').pop();
        }
        const source = o.url || url;

        chunks.push(
`[PRODUCT]
title: ${title}
sku: ${sku}
price: ${price}
priceCurrency: ${currency}
availability: ${availability}
source_url: ${source}
description: ${desc}`.trim()
        );
      }

      // SERVICE
      if (hasType(o, 'Service')) {
        const title = o.name || '';
        const desc  = o.description || '';
        const provider = (typeof o.provider === 'string')
          ? o.provider
          : (o.provider && (o.provider.name || '')) || '';
        const area = o.areaServed || '';
        const source = o.url || url;

        chunks.push(
`[SERVICE]
title: ${title}
provider: ${provider}
areaServed: ${typeof area === 'string' ? area : JSON.stringify(area)}
source_url: ${source}
description: ${desc}`.trim()
        );
      }

      // EVENT (incl. EducationEvent)
      if (hasType(o, ['Event', 'EducationEvent'])) {
        const title = o.name || '';
        const desc  = o.description || '';
        const start = o.startDate || '';
        const end   = o.endDate || '';
        const source = o.url || url;

        // Location formatting
        let location = '';
        const loc = o.location;
        if (typeof loc === 'string') location = loc;
        else if (loc && typeof loc === 'object') {
          const name = loc.name || '';
          const addr = loc.address;
          if (typeof addr === 'string') location = `${name} | ${addr}`.trim();
          else if (addr && typeof addr === 'object') {
            const parts = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode, addr.addressCountry]
              .filter(Boolean).join(', ');
            location = [name, parts].filter(Boolean).join(' | ');
          } else location = name;
        }

        chunks.push(
`[EVENT]
title: ${title}
date_start: ${start}
date_end: ${end}
location: ${location}
source_url: ${source}
description: ${desc}`.trim()
        );
      }
    } catch {
      // ignore malformed node
    }
  }
  return chunks.filter(Boolean);
}

/* -------------- HTML -> plain text extraction ----------------- */
function htmlToPlainText(html) {
  return htmlToText(html, {
    selectors: [
      { selector: 'nav', format: 'skip' },
      { selector: 'footer', format: 'skip' },
      { selector: 'script', format: 'skip' },
      { selector: 'style', format: 'skip' }
    ],
    wordwrap: false
  }).trim();
}

/* ------------------------ embeddings -------------------------- */
async function getEmbeddings(inputs) {
  const key = need('OPENAI_API_KEY');
  const body = JSON.stringify({ model: 'text-embedding-3-small', input: inputs });

  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': UA_PRIMARY
    },
    body
  });

  const ct = (resp.headers.get('content-type') || '').toLowerCase();
  const text = await resp.text();

  if (!resp.ok)
    throw new Error(`openai_error:${resp.status}:url=${resp.url || '(unknown)'}:${text.slice(0, 300)}`);
  if (!ct.includes('application/json'))
    throw new Error(`openai_bad_content_type:${ct || '(none)'}:status=${resp.status}:url=${resp.url || '(unknown)'}:${text.slice(0, 300)}`);

  let j;
  try { j = JSON.parse(text); } catch (e) { throw new Error(`openai_bad_json:${String(e?.message || e)}`); }
  const out = (j?.data || []).map(d => d?.embedding);
  if (!out.length) throw new Error('openai_empty_embeddings');
  if (!Array.isArray(out[0]) || out[0].length !== 1536) throw new Error('openai_bad_embedding_dim');
  return out;
}

/* ------------------------- handler ---------------------------- */
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

    // 1) Fetch HTML
    stage = 'fetch_html';
    const html = await fetchHTML(url);

    // 2) Extract JSON-LD chunks (short, structured) — put these FIRST
    stage = 'extract_jsonld';
    const ldBlocks = extractJsonLdBlocks(html);
    let jsonChunks = [];
    for (const raw of ldBlocks) {
      try {
        const parsed = looseParse(raw);
        const objs = flattenLd(parsed);
        jsonChunks.push(...jsonldObjectsToChunks(url, objs));
      } catch {
        // ignore individual bad blocks
      }
    }
    // de-dupe JSON chunks (sometimes multiple scripts repeat)
    jsonChunks = Array.from(new Set(jsonChunks));

    // 3) Extract plain text & chunk
    stage = 'html_to_text';
    const text = htmlToPlainText(html);
    const textChunks = chunkText(text);

    const allChunks = [...jsonChunks, ...textChunks];
    if (!allChunks.length) return sendJSON(res, 422, { error: 'no_chunks', stage });

    // 4) Embed
    stage = 'embed';
    const embeddings = await getEmbeddings(allChunks);

    // 5) Prepare rows
    stage = 'prepare_rows';
    const rows = allChunks.map((content, i) => ({
      url,
      title: null,
      content,
      embedding: embeddings[i],
      tokens: Math.ceil(content.length / 4),
      hash: sha1(`${url}#${i}:${content.slice(0, 128)}`)
    }));

    // 6) REPLACE semantics — wipe then insert
    stage = 'delete_old';
    const del = await supa.from('page_chunks').delete().eq('url', url);
    if (del.error) return sendJSON(res, 500, { error: 'supabase_delete_failed', detail: del.error.message || del.error, stage });

    stage = 'upsert';
    const ins = await supa.from('page_chunks')
      .upsert(rows, { onConflict: 'hash' })
      .select('id')
      .order('id', { ascending: false });

    if (ins.error) return sendJSON(res, 500, { error: 'supabase_upsert_failed', detail: ins.error.message || ins.error, stage });

    stage = 'done';
    const firstId = ins.data?.[0]?.id ?? null;
    return sendJSON(res, 200, {
      ok: true,
      id: firstId,
      len: text.length,
      chunks: rows.length,
      stage
    });
  } catch (err) {
    return sendJSON(res, 500, { error: 'server_error', detail: asString(err), stage });
  }
}
