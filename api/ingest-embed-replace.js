// /api/ingest-embed-replace.js  (ESM file; package.json has "type":"module")
export const config = { runtime: 'nodejs20.x' };

import crypto from 'node:crypto';
import { htmlToText } from 'html-to-text';
import { createClient } from '@supabase/supabase-js';

const need = (k) => {
  const v = process.env[k];
  if (!v || !v.trim()) throw new Error(`missing_env:${k}`);
  return v;
};
const opt = (k) => process.env[k] || '';

const toJSON = (res, status, obj) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const safe = (x) => (typeof x === 'string' ? x : JSON.stringify(x));
  if (obj && 'detail' in obj) obj.detail = safe(obj.detail);
  res.status(status).send(JSON.stringify(obj));
};

const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

const chunkText = (txt, size = 3500, overlap = 300) => {
  const out = [];
  for (let i = 0; i < txt.length; i += (size - overlap)) {
    out.push(txt.slice(i, Math.min(i + size, txt.length)).trim());
  }
  return out.filter(Boolean);
};

async function fetchPage(url) {
  const r = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
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
      { selector: 'style', format: 'skip' },
    ],
    wordwrap: false,
  }).trim();
  return { text };
}

async function getEmbeddings(inputs) {
  const orKey = opt('OPENROUTER_API_KEY');
  const oaKey = opt('OPENAI_API_KEY');
  if (!orKey && !oaKey) throw new Error('no_embedding_provider_configured');

  const body = JSON.stringify({ model: 'text-embedding-3-small', input: inputs });

  if (orKey) {
    const resp = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${orKey}`, 'Content-Type': 'application/json' },
      body,
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      throw new Error(`openrouter_error:${resp.status}:${t.slice(0,300)}`);
    }
    const j = await resp.json();
    const out = (j?.data || []).map((d) => d?.embedding);
    if (!out.length) throw new Error('openrouter_empty_embeddings');
    return out;
  }

  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${oaKey}`, 'Content-Type': 'application/json' },
    body,
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`openai_error:${resp.status}:${t.slice(0,300)}`);
  }
  const j = await resp.json();
  const out = (j?.data || []).map((d) => d?.embedding);
  if (!out.length) throw new Error('openai_empty_embeddings');
  return out;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return toJSON(res, 405, { error: 'method_not_allowed' });

    const token = req.headers['authorization']?.trim();
    if (token !== `Bearer ${need('INGEST_TOKEN')}`) return toJSON(res, 401, { error: 'unauthorized' });

    const { url } = req.body || {};
    if (!url) return toJSON(res, 400, { error: 'bad_request', detail: 'Provide "url"' });

    const supa = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));

    const { text } = await fetchPage(url);
    if (!text || text.length < 10) return toJSON(res, 422, { error: 'empty_content' });

    const totalLen = text.length;
    const chunks = chunkText(text);
    const embeds = await getEmbeddings(chunks);

    const rows = chunks.map((content, i) => ({
      url,
      title: null,
      content,
      embedding: embeds[i],
      tokens: Math.ceil(content.length / 4),
      hash: sha1(`${url}#${i}:${content.slice(0, 128)}`),
    }));

    const { data, error } = await supa
      .from('page_chunks')
      .upsert(rows, { onConflict: 'hash' })
      .select('id')
      .order('id', { ascending: false });

    if (error) return toJSON(res, 500, { error: 'supabase_upsert_failed', detail: error.message });

    const firstId = data?.[0]?.id ?? null;
    return toJSON(res, 200, { ok: true, id: firstId, len: totalLen, chunks: rows.length });
  } catch (err) {
    return toJSON(res, 500, { error: 'server_error', detail: err?.message || String(err) });
  }
}
