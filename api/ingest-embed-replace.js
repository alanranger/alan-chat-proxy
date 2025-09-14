// /api/ingest-embed-replace.js — OpenAI-only, REPLACE semantics, now with JSON-LD support
export const config = { runtime: 'nodejs' };

import crypto from 'node:crypto';
import { htmlToText } from 'html-to-text';
import { createClient } from '@supabase/supabase-js';

// 🔹 NEW: import JSON extract helper
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

    // 🔹 Step 1: fetch HTML text
    stage = 'fetch_page';
    const { text } = await fetchPage(url);

    // 🔹 Step 2: fetch JSON-LD structured data (NEW)
    stage = 'fetch_json';
    let jsonText = '';
    try {
      const extracted = await extractAllFromUrl(url);
      if (extracted && typeof extracted === 'object') {
        jsonText = JSON.stringify(extracted, null, 2);
      }
    } catch (err) {
      // non-fatal
      console.warn(`json_extract_failed:${url}`, err);
    }

    // 🔹 Step 3: combine text + JSON
    const combinedText = [text, jsonText].filter(Boolean).join('\n\n');
    if (!combinedText || combinedText.length < 10) return sendJSON(res, 422, { error: 'empty_content', stage });

    // 🔹 Step 4: chunk everything
    stage = 'chunk';
    const chunks = chunkText(combinedText);
    if (!chunks.length) return sendJSON(res, 422, { error: 'no_chunks', stage });

    // 🔹 Step 5: embed
    stage = 'embed';
    const embeds = await getEmbeddings(chunks);

    // 🔹 Step 6: prep rows
    stage = 'prepare_rows';
    const rows = chunks.map((content, i) => ({
      url,
      title: null,
      content,
      embedding: embeds[i],
      tokens: Math.ceil(content.length / 4),
      hash: sha1(`${url}#${i}:${content.slice(0, 128)}`)
    }));

    // 🔹 Step 7: REPLACE semantics
    stage = 'delete_old';
    const { error: delErr } = await supa.from('page_chunks').delete().eq('url', url);
    if (delErr) return sendJSON(res, 500, { error: 'supabase_delete_failed', detail: delErr.message || delErr, stage });

    stage = 'upsert';
    const { data, error } = await supa
      .from('page_chunks')
      .upsert(rows, { onConflict: 'hash' })
      .select('id')
      .order('id', { ascending: false });

    if (error) return sendJSON(res, 500, { error: 'supabase_upsert_failed', detail: error.message || error, stage });

    stage = 'done';
    const firstId = data?.[0]?.id ?? null;
    return sendJSON(res, 200, { ok: true, id: firstId, len: combinedText.length, chunks: rows.length, stage });
  } catch (err) {
    return sendJSON(res, 500, { error: 'server_error', detail: asString(err), stage });
  }
}
