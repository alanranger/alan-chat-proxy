// api/ingest-embed-replace.js
// Replace-per-URL ingest: delete existing rows for URL, fetch page, chunk, embed via OpenRouter,
// insert into Supabase, and return JSON (always).

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Optional hard guard: set this in Vercel if you want to enforce a token.
// If not set, we only require a Bearer header to be present.
const REQUIRED_INGEST_TOKEN = process.env.INGEST_TOKEN || null;

// Use a small embedding model -> 1536 dims (commonly used with Supabase vector(1536))
const EMBEDDING_MODEL = 'text-embedding-3-small'; // OpenRouter forwards to OpenAI-compatible embeddings
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

function asJson(res, body, status = 200) {
  return res
    .status(status)
    .setHeader('Content-Type', 'application/json')
    .send(JSON.stringify(body));
}

// ultra-simple HTML -> text
function htmlToText(html) {
  if (!html) return '';
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '')
             .replace(/<style[\s\S]*?<\/style>/gi, '');
  const text = html.replace(/<\/?[^>]+(>|$)/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

function chunkText(text, maxLen = 900) {
  const out = [];
  for (let i = 0; i < text.length; i += maxLen) {
    out.push(text.slice(i, i + maxLen));
  }
  return out;
}

async function fetchPageText(url) {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) IngestBot',
      'Accept': 'text/html,application/xhtml+xml'
    }
  });
  if (!resp.ok) throw new Error(`Fetch failed ${resp.status}`);
  const html = await resp.text();
  return htmlToText(html);
}

async function embedChunks(chunks) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('Missing OPENROUTER_API_KEY');
  }

  // OpenAI-compatible batch embeddings
  const resp = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: chunks
    })
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data?.data) {
    throw new Error(`Embedding error: ${resp.status} ${JSON.stringify(data)}`);
  }

  // data.data[i].embedding -> number[]
  return data.data.map(d => d.embedding);
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return asJson(res, { error: 'method_not_allowed' }, 405);
    }

    // Authorization
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
      return asJson(res, { error: 'unauthorized', detail: 'Missing Bearer token' }, 401);
    }
    if (REQUIRED_INGEST_TOKEN) {
      const token = auth.slice('Bearer '.length).trim();
      if (token !== REQUIRED_INGEST_TOKEN) {
        return asJson(res, { error: 'unauthorized', detail: 'Invalid ingest token' }, 401);
      }
    }

    const { url, title } = req.body || {};
    if (!url || typeof url !== 'string') {
      return asJson(res, { error: 'bad_request', detail: 'Provide { url }' }, 400);
    }

    // 1) Delete existing rows for this URL
    const { error: delErr } = await supabase.from('page_chunks').delete().eq('url', url);
    if (delErr) {
      // not fatal, but report
      console.warn('Supabase delete error:', delErr);
    }

    // 2) Fetch page & chunk
    const text = await fetchPageText(url);
    if (!text || text.length < 50) {
      return asJson(res, { error: 'too_short', detail: 'Page text too short' }, 400);
    }
    const chunks = chunkText(text, 900);

    // 3) Embed
    const embeddings = await embedChunks(chunks);
    if (embeddings.length !== chunks.length) {
      throw new Error('Embedding count mismatch');
    }

    // 4) Insert
    const rows = chunks.map((chunk_text, i) => ({
      url,
      title: title || null,
      chunk_text,
      embedding: embeddings[i]
    }));

    const { error: insErr, count } = await supabase
      .from('page_chunks')
      .insert(rows, { count: 'exact' });

    if (insErr) {
      return asJson(res, { error: 'insert_failed', detail: insErr }, 500);
    }

    return asJson(res, { ok: true, replaced: true, inserted: count ?? rows.length }, 200);
  } catch (err) {
    console.error(err);
    return asJson(res, { error: 'server_error', detail: String(err) }, 500);
  }
}
