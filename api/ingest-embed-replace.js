// /api/ingest-embed-replace.js — FULL FILE (ESM, robust OpenRouter→OpenAI fallback)
export const config = { runtime: 'nodejs' };

import crypto from 'node:crypto';
import { htmlToText } from 'html-to-text';
import { createClient } from '@supabase/supabase-js';

// ---------- utils ----------
const need = (k) => {
  const v = process.env[k];
  if (!v || !String(v).trim()) throw new Error(`missing_env:${k}`);
  return v;
};
const opt = (k) => process.env[k] || '';
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

// ---------- page fetcher ----------
async function fetchPage(url) {
  const r = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

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

// ---------- embeddings with fallback ----------
async function getEmbeddings(inputs) {
  const orKey = opt('OPENROUTER_API_KEY');
  const oaKey = opt('OPENAI_API_KEY');
  if (!orKey && !oaKey) throw new Error('no_embedding_provider_configured');

  const tryOpenRouter = async () => {
    const body = JSON.stringify({ model: 'openai/text-embedding-3-small', input: inputs });
    const resp = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      redirect: 'manual', // surface redirects
      headers: {
        Authorization: `Bearer ${orKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: 'https://alan-chat-proxy.vercel.app',
        'HTTP-Referer': 'https://alan-chat-proxy.vercel.app',
        'X-Title': 'alan-chat-proxy',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body
    });

    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get('location') || '(none)';
      throw new Error(`openrouter_redirect:status=${resp.status}:url=${resp.url || '(unknown)'}:location=${loc}`);
    }
    const ct = (resp.headers.get('content-type') || '').toLowerCase();
    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`openrouter_error:${resp.status}:url=${resp.url || '(unknown)'}:${text.slice(0,300)}`);
    }
    if (!ct.includes('application/json')) {
      throw new Error(`openrouter_bad_content_type:${ct || '(none)'}:status=${resp.status}:url=${resp.url || '(unknown)'}:${text.slice(0,300)}`);
    }
    let j;
    try { j = JSON.parse(text); }
    catch (e) {
      throw new Error(`openrouter_bad_json:${String(e?.message || e)}:status=${resp.status}:url=${resp.url || '(unknown)'}:${text.slice(0,300)}`);
    }
    const out = (j?.data || []).map(d => d?.embedding);
    if (!out.length) throw new Error('openrouter_empty_embeddings');
    if (!Array.isArray(out[0]) || out[0].length !== 1536)
      throw new Error('openrouter_bad_embedding_dim');
    return out;
  };

  const tryOpenAI = async () => {
    const body = JSON.stringify({ model: 'text-embedding-3-small', input: inputs });
    const resp = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      redirect: 'follow',
      headers: {
        Authorization: `Bearer ${oaKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body
    });
    const ct = (resp.headers.get('content-type') || '').toLowerCase();
    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`openai_error:${resp.status}:url=${resp.url || '(unknown)'}:${text.slice(0,300)}`);
    }
    if (!ct.includes('application/json')) {
      throw new Error(`openai_bad_content_type:${ct || '(none)'}:status=${resp.status}:url=${resp.url || '(unknown)'}:${text.slice(0,300)}`);
    }
    let j;
    try { j = JSON.parse(text); }
    catch (e) {
      throw new Error(`openai_bad_json:${String(e?.message || e)}:status=${resp.status}:url=${resp.url || '(unknown)'}:${text.slice(0,300)}`);
    }
    const out = (j?.data || []).map(d => d?.embedding);
    if (!out.length) throw new Error('openai_empty_embeddings');
    if (!Array.isArray(out[0]) || out[0].length !== 1536)
      throw new Error('openai_bad_embedding_dim');
    return out;
  };

  // prefer OpenRouter; on failure and if OpenAI key exists, fall back
  if (orKey) {
    try {
      return await tryOpenRouter();
    } catch (err) {
      // If OpenAI key exists, fall back; include cause in thrown detail if fallback also fails
      if (oaKey) {
        try {
          return await tryOpenAI();
        } catch (err2) {
          throw new Error(`embed_fallback_failed: openrouter→openai | cause1=${asString(err)} | cause2=${asString(err2)}`);
        }
      }
      // No OpenAI key available; surface the OpenRouter error
      throw err;
    }
  }

  // No OpenRouter key; use OpenAI directly
  return await tryOpenAI();
}

// ---------- handler ----------
export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method_not_allowed' });

  let stage = 'start';
  try {
    stage = 'auth';
    const token = req.headers['authorization']?.trim();
    if (token !== `Bearer ${need('INGEST_TOKEN')}`) {
      return sendJSON(res, 401, { error: 'unauthorized', stage });
    }

    stage = 'parse_body';
    const { url } = req.body || {};
    if (!url) return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide "url"', stage });

    stage = 'db_client';
    const supa = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));

    stage = 'fetch_page';
    const { text } = await fetchPage(url);
    if (!text || text.length < 10) {
      return sendJSON(res, 422, { error: 'empty_content', stage });
    }

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
      embedding: embeds[i], // float[] for pgvector
      tokens: Math.ceil(content.length / 4),
      hash: sha1(`${url}#${i}:${content.slice(0, 128)}`)
    }));

    stage = 'upsert';
    const { data, error } = await supa
      .from('page_chunks')
      .upsert(rows, { onConflict: 'hash' })
      .select('id')
      .order('id', { ascending: false });

    if (error) {
      return sendJSON(res, 500, {
        error: 'supabase_upsert_failed',
        detail: error.message || error,
        stage
      });
    }

    stage = 'done';
    const firstId = data?.[0]?.id ?? null;
    return sendJSON(res, 200, { ok: true, id: firstId, len: text.length, chunks: rows.length, stage });
  } catch (err) {
    return sendJSON(res, 500, { error: 'server_error', detail: asString(err), stage });
  }
}
