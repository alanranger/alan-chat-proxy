// api/ingest-embed-replace.js
// Serverless function: crawl → chunk → embed → upsert (replace per URL)
// Runtime: Node (so normal process.env works on Vercel)

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { htmlToText } from 'html-to-text';

export const config = { runtime: 'nodejs' };

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY ||
  process.env.OPENROUTER_APIKEY ||
  process.env.OPENROUTER_KEY ||
  '';
const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY || '';

const INGEST_TOKEN = process.env.INGEST_TOKEN || '';

const EMBED_MODEL_OPENROUTER = 'openai/text-embedding-3-small'; // 1536 dims on OR
const EMBED_MODEL_OPENAI = 'text-embedding-3-small';            // 1536 dims on OA

function okJson(res, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  return res.status(200).json(body);
}
function badRequest(res, detail) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  return res.status(400).json({ error: 'bad_request', detail });
}
function serverError(res, detail) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  return res.status(500).json({ error: 'server_error', detail });
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function chunkPlainText(text, maxChars = 2000, overlap = 200) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + maxChars, text.length);
    const slice = text.slice(i, end);
    chunks.push(slice.trim());
    i = end - overlap;
    if (i < 0) i = 0;
    if (i >= text.length) break;
  }
  // filter out any empty fragments
  return chunks.filter((c) => c && c.length > 0);
}

async function embedTexts({ texts }) {
  // Prefer OpenRouter if key is present; otherwise OpenAI
  const useOpenRouter = !!OPENROUTER_API_KEY;
  const provider = useOpenRouter ? 'openrouter' : OPENAI_API_KEY ? 'openai' : null;

  if (!provider) {
    throw Object.assign(new Error('no_embedding_provider_configured'), {
      code: 'no_embedding_provider_configured',
      hint: 'Set OPENROUTER_API_KEY or OPENAI_API_KEY',
    });
  }

  const url = useOpenRouter
    ? 'https://openrouter.ai/api/v1/embeddings'
    : 'https://api.openai.com/v1/embeddings';

  const model = useOpenRouter ? EMBED_MODEL_OPENROUTER : EMBED_MODEL_OPENAI;
  const key = useOpenRouter ? OPENROUTER_API_KEY : OPENAI_API_KEY;

  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${key}`,
  };

  // OpenRouter likes these (harmless for OpenAI as well)
  if (useOpenRouter) {
    headers['HTTP-Referer'] = 'https://alan-chat-proxy.vercel.app';
    headers['X-Title'] = 'AlanRanger Ingest';
  }

  const body = JSON.stringify({ input: texts, model });

  const resp = await fetch(url, { method: 'POST', headers, body });

  // We expect JSON — if we get HTML (status 200) it usually means missing/invalid key
  const ctype = resp.headers.get('content-type') || '';
  const isJson = ctype.toLowerCase().includes('application/json');

  if (!isJson) {
    const snippet = (await resp.text()).slice(0, 500);
    const err = Object.assign(
      new Error('embedding_non_json'),
      {
        code: 'embedding_non_json',
        status: resp.status,
        hint:
          'Provider returned non-JSON response. Check API key and provider availability.',
        snippet,
      }
    );
    throw err;
  }

  const json = await resp.json();

  if (!resp.ok) {
    const err = Object.assign(new Error('embedding_error'), {
      code: 'embedding_error',
      status: resp.status,
      response: json,
    });
    throw err;
  }

  // OpenAI-compatible shape: { data: [{ embedding: [...]}, ...] }
  if (!json?.data || !Array.isArray(json.data)) {
    const err = Object.assign(new Error('embedding_shape_unexpected'), {
      code: 'embedding_shape_unexpected',
      response: json,
    });
    throw err;
  }

  return json.data.map((row) => row.embedding);
}

async function upsertChunks({ supa, rows, replaceUrl }) {
  const { url } = rows[0] || {};
  if (!url) return;

  // Replace mode = delete current rows for URL then insert
  if (replaceUrl) {
    await supa.from('page_chunks').delete().eq('url', url);
  }

  // Insert / upsert rows
  const { error } = await supa.from('page_chunks').upsert(rows, {
    onConflict: 'chunk_hash', // dedupe by hash
  });
  if (error) throw error;
}

// ───────────────────────────────────────────────────────────────────────────────
// Handler
// ───────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return badRequest(res, 'Use POST');
    }

    // Simple bearer check so only your bulk page can call it
    const auth = req.headers.authorization || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!INGEST_TOKEN || bearer !== INGEST_TOKEN) {
      return badRequest(res, 'Invalid or missing ingest token');
    }

    let payload;
    try {
      payload = await req.json?.() ?? await new Response(req.body).json();
    } catch {
      payload = null;
    }

    const url = payload?.url || req.query?.url; // allow query for quick tests
    const title = payload?.title || null;
    const replace = !!payload?.replace; // replace per URL if true

    if (!url || typeof url !== 'string') {
      return badRequest(res, 'Provide "url"');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return serverError(res, 'Supabase env (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) not set');
    }

    // 1) Fetch page
    const pageResp = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (IngestBot)' },
    });

    if (!pageResp.ok) {
      return serverError(res, `Fetch failed (${pageResp.status}) for ${url}`);
    }

    const html = await pageResp.text();

    // 2) Extract text
    const text = htmlToText(html, {
      wordwrap: false,
      hideLinkHrefIfSameAsText: true,
      selectors: [
        { selector: 'script', format: 'skip' },
        { selector: 'style', format: 'skip' },
        { selector: 'noscript', format: 'skip' },
      ],
    }).trim();

    if (!text) {
      return serverError(res, 'No text extracted');
    }

    // 3) Chunk
    const pieces = chunkPlainText(text, 2000, 200);
    if (!pieces.length) {
      return serverError(res, 'No chunks produced');
    }

    // 4) Embed
    let embeddings;
    try {
      embeddings = await embedTexts({ texts: pieces });
    } catch (e) {
      // Normalize error for the UI console
      if (e?.code === 'no_embedding_provider_configured') {
        return serverError(res, `Error: no_embedding_provider_configured (set OPENROUTER_API_KEY or OPENAI_API_KEY)`);
      }
      if (e?.code === 'embedding_non_json') {
        return serverError(
          res,
          `Error: embedding_non_json (status ${e.status}) :: ${e.snippet || ''}`.trim()
        );
      }
      return serverError(res, `Error embedding: ${e?.message || String(e)}`);
    }

    // 5) Prepare rows for upsert
    const nowIso = new Date().toISOString();
    const rows = pieces.map((chunkText, idx) => {
      const content = chunkText; // canonical field
      const chunk_hash = sha256(`${url}::${idx}::${sha256(content)}`);
      const embedding = embeddings[idx]; // vector(float[])

      // approx tokens for visibility (len/4 heuristic)
      const tokens = Math.ceil(content.length / 4);

      return {
        url,
        title,
        content,
        chunk_text: content, // backfill, in case a viewer still uses chunk_text
        embedding,
        tokens,
        chunk_hash,
        created_at: nowIso,
      };
    });

    // 6) Upsert
    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    await upsertChunks({ supa, rows, replaceUrl: replace });

    return okJson(res, {
      ok: true,
      url,
      chunks: rows.length,
      provider: OPENROUTER_API_KEY ? 'openrouter' : (OPENAI_API_KEY ? 'openai' : 'none'),
      model: OPENROUTER_API_KEY ? EMBED_MODEL_OPENROUTER : EMBED_MODEL_OPENAI,
    });
  } catch (err) {
    return serverError(res, err?.message ?? String(err));
  }
}
