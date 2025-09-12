// api/ingest-embed.js
//
// Ingest endpoint (REPLACE mode):
// - Auth via Authorization: Bearer <INGEST_TOKEN>
// - Body: { url: string, title?: string, chunks: string[] }
// - For each request, delete all existing chunks for that URL, then insert fresh rows.
// - Embeddings are generated via OpenRouter.
//
// Required env vars in Vercel:
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//   - OPENROUTER_API_KEY
//   - (optional) INGEST_TOKEN  (falls back to the default string below if unset)

import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// --- Config ---
const REQUIRED_MIN_CHARS = 30; // too-short chunks are skipped (adjust if you like)
const EMBEDDING_MODEL = 'text-embedding-3-large'; // OpenRouter embedding model
const DEFAULT_INGEST_TOKEN = 'b6c3f0c9e6f44cce9e1a4f3f2d3a5c76'; // fallback if env missing

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ---- Helpers ----
function md5(text) {
  return crypto.createHash('md5').update(text || '', 'utf8').digest('hex');
}

async function embedText(text) {
  const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text
    })
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw new Error(`Embedding request failed (${res.status}): ${raw}`);
  }

  const json = await res.json();
  const emb = json?.data?.[0]?.embedding;
  if (!emb || !Array.isArray(emb)) {
    throw new Error('Embedding response missing embedding array.');
  }
  return emb;
}

// ---- Handler ----
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    // Simple bearer token check
    const tokenFromEnv = process.env.INGEST_TOKEN || DEFAULT_INGEST_TOKEN;
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${tokenFromEnv}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { url, title, chunks } = req.body || {};
    if (!url || !Array.isArray(chunks) || chunks.length === 0) {
      return res.status(400).json({ error: 'bad_request', detail: 'Provide { url, chunks[] }' });
    }

    // Clean + prepare rows with embeddings
    const rows = [];
    for (const c of chunks) {
      const text = String(c || '').trim();
      if (!text) continue;
      if (text.length < REQUIRED_MIN_CHARS) continue; // skip super-short chunks

      // Embed
      const embedding = await embedText(text);

      rows.push({
        url,
        title: title || null,
        chunk_text: text,
        chunk_hash: md5(text),
        embedding
      });
    }

    // REPLACE MODE: wipe all existing chunks for this URL, then insert fresh ones
    const del = await supabase.from('page_chunks').delete().eq('url', url);
    if (del.error) {
      return res.status(500).json({ error: 'delete_failed', detail: del.error.message });
    }

    if (rows.length === 0) {
      // Nothing to insert (e.g., all chunks too short)
      return res.status(200).json({ success: true, inserted: 0, note: 'no_valid_chunks' });
    }

    const ins = await supabase.from('page_chunks').insert(rows);
    if (ins.error) {
      return res.status(500).json({ error: 'insert_failed', detail: ins.error.message });
    }

    return res.status(200).json({ success: true, inserted: rows.length });
  } catch (err) {
    console.error('ingest-embed error:', err);
    return res.status(500).json({ error: 'server_error', detail: err?.message || String(err) });
  }
}
