// api/ingest-embed-replace.js
import { createClient } from '@supabase/supabase-js';
import { htmlToText } from 'html-to-text';
import crypto from 'node:crypto';

// ---------- config ----------
const EMBED_MODEL = 'text-embedding-3-small'; // 1536 dims
const OPENAI_URL = 'https://api.openai.com/v1/embeddings';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/embeddings';

// Chunking targets (character-based heuristic)
const TARGET_CHARS = 1200;
const MAX_CHARS = 1800;

// ---------- helpers ----------
function env(name, required = true) {
  const v = process.env[name];
  if (required && !v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function splitIntoChunks(text) {
  const chunks = [];
  let start = 0;
  const len = text.length;

  while (start < len) {
    let end = Math.min(start + TARGET_CHARS, len);

    // try to end on a sentence boundary if within MAX_CHARS
    if (end < len) {
      const windowEnd = Math.min(start + MAX_CHARS, len);
      let lastStop = -1;
      const slice = text.slice(start, windowEnd);
      // prefer punctuation breaks
      const match = slice.match(/[\.\!\?]\s+[A-Z(“"'\[]/g);
      if (match) {
        const last = match[match.length - 1];
        lastStop = slice.lastIndexOf(last) + (last ? last.length : 0);
      }
      // fallback: last space
      if (lastStop === -1) {
        lastStop = slice.lastIndexOf(' ');
      }
      if (lastStop > 0) {
        end = start + lastStop;
      } else {
        end = windowEnd; // force cut
      }
    }

    const piece = text.slice(start, end).trim();
    if (piece.length > 0) chunks.push(piece);
    start = end;
  }
  return chunks;
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; alan-chat-proxy/1.0; +https://vercel.app)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}) ${response.statusText}`);
  }
  const html = await response.text();

  let title = '';
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m) title = m[1].trim();

  const text = htmlToText(html, {
    wordwrap: false,
    selectors: [
      { selector: 'script', format: 'skip' },
      { selector: 'style', format: 'skip' },
      { selector: 'noscript', format: 'skip' },
    ],
  }).trim();

  return { html, title, text };
}

async function embedTexts(inputs) {
  // Use OpenAI if available, else OpenRouter
  const openaiKey = process.env.OPENAI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  const url = openaiKey ? OPENAI_URL : OPENROUTER_URL;
  const key = openaiKey || openrouterKey;
  if (!key) {
    throw new Error(
      'Missing embedding key. Set OPENAI_API_KEY or OPENROUTER_API_KEY.'
    );
  }

  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: inputs,
    }),
  });

  if (!r.ok) {
    const errTxt = await r.text().catch(() => '');
    throw new Error(
      `Embedding error: ${r.status} ${r.statusText} — ${errTxt?.slice(0, 500)}`
    );
  }

  const data = await r.json();
  if (!data?.data || !Array.isArray(data.data)) {
    throw new Error('Embedding response missing data array');
  }
  // Return array of vectors
  return data.data.map((d) => d.embedding);
}

function supabaseClient() {
  const url = env('SUPABASE_URL');
  // Service role recommended because this route deletes & inserts
  const key = env('SUPABASE_SERVICE_ROLE');
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// ---------- handler ----------
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Accept JSON { url, title? }  (title optional, we’ll also try to fetch it)
  let url;
  let providedTitle = '';
  try {
    const body = req.body ?? {};
    url = body.url || req.query?.url;
    providedTitle = body.title || '';
  } catch {
    // If someone posts raw text/plain, try to parse
    try {
      const txt = await new Response(req).text();
      const parsed = JSON.parse(txt || '{}');
      url = parsed.url;
      providedTitle = parsed.title || '';
    } catch {
      /* ignore */
    }
  }

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'missing_url' });
  }

  const supa = supabaseClient();

  try {
    // Fetch page & extract text
    const { title: fetchedTitle, text } = await fetchPage(url);
    const title = providedTitle || fetchedTitle || '';

    if (!text || text.length < 10) {
      return res.status(400).json({
        error: 'empty_text',
        detail: 'Extracted zero/very small text from the page.',
      });
    }

    // Chunk & embed
    const chunks = splitIntoChunks(text);
    const vectors = await embedTexts(chunks);

    // Replace per URL (first delete any existing)
    const { error: delErr } = await supa.from('page_chunks').delete().eq('url', url);
    if (delErr) {
      throw new Error(`Delete failed: ${delErr.message ?? String(delErr)}`);
    }

    // Prepare rows
    const rows = chunks.map((c, i) => ({
      url,
      title,
      content: c,
      embedding: vectors[i],
      chunk_hash: sha256(`${url}##${i}##${c.slice(0, 1024)}`),
    }));

    // Insert in small batches to be safe
    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const { error: insErr } = await supa.from('page_chunks').insert(slice);
      if (insErr) {
        throw new Error(`Insert failed: ${insErr.message ?? String(insErr)}`);
      }
    }

    // Count rows for this URL so UI can show chunks count
    const { count, error: cntErr } = await supa
      .from('page_chunks')
      .select('id', { head: true, count: 'exact' })
      .eq('url', url);

    if (cntErr) {
      return res.status(200).json({
        ok: true,
        url,
        chunks: null,
        warn: 'count_failed',
        detail: cntErr.message ?? String(cntErr),
      });
    }

    return res.status(200).json({
      ok: true,
      url,
      chunks: count ?? 0,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'server_error',
      detail: err?.message ?? String(err),
    });
  }
}

// Vercel runtime — keep Node (NOT Edge)
export const config = {
  runtime: 'nodejs18.x',
};
