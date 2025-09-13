// /api/ingest-embed-replace.js
// Full file — drop-in replacement

import { createClient } from '@supabase/supabase-js';
import { htmlToText } from 'html-to-text';

// ====== Config ======
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// token you type into the page is checked against this value
const INGEST_BEARER_TOKEN = process.env.INGEST_BEARER_TOKEN || ''; 

// tables (change if your schema uses different names)
const PAGES_TABLE  = 'pages';
const CHUNKS_TABLE = 'chunks';

// chunk size
const MAX_CHARS_PER_CHUNK = 900;

// ====== Helpers ======
function requireEnv(name, value) {
  if (!value) throw new Error(`Missing env var: ${name}`);
}

function chunkString(str, size) {
  const chunks = [];
  let i = 0;
  while (i < str.length) {
    chunks.push(str.slice(i, i + size));
    i += size;
  }
  return chunks;
}

async function fetchHTML(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      'accept': 'text/html,application/xhtml+xml'
    }
  });
  // If site blocks non-JSON text with 200, we still get HTML here — that’s fine.
  // We just need the body text.
  const html = await res.text();
  return { status: res.status, ok: res.ok, html };
}

function extractText(html) {
  // Simple and robust: strip to readable text
  return htmlToText(html, {
    wordwrap: 0,
    selectors: [
      { selector: 'script', format: 'skip' },
      { selector: 'style',  format: 'skip' },
      { selector: 'nav',    format: 'skip' },
      { selector: 'footer', format: 'skip' }
    ]
  }).trim();
}

async function upsertToSupabase({ url, title, chunks, dryRun }) {
  requireEnv('SUPABASE_URL', SUPABASE_URL);
  requireEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  if (dryRun) {
    return { pageId: null, inserted: 0, deleted: 0 };
  }

  // Make sure there is a page row for this URL; delete existing chunks for clean replace
  const { data: pageRow, error: upsertErr } = await supabase
    .from(PAGES_TABLE)
    .upsert({ url, title }, { onConflict: 'url' })
    .select('*')
    .single();

  if (upsertErr) throw upsertErr;

  const pageId = pageRow.id;

  const { error: delErr } = await supabase
    .from(CHUNKS_TABLE)
    .delete()
    .eq('page_id', pageId);

  if (delErr) throw delErr;

  if (!chunks.length) {
    return { pageId, inserted: 0, deleted: 0 };
  }

  const rows = chunks.map((content, idx) => ({
    page_id: pageId,
    url,
    ord: idx,
    content
  }));

  const { error: insErr } = await supabase
    .from(CHUNKS_TABLE)
    .insert(rows);

  if (insErr) throw insErr;

  return { pageId, inserted: rows.length, deleted: 0 };
}

function authOk(req) {
  const header = req.headers.get('authorization') || '';
  const token = header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : '';
  return INGEST_BEARER_TOKEN && token && token === INGEST_BEARER_TOKEN;
}

// ====== Handler ======
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    if (!authOk(req)) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const url = (req.query.url || '').toString().trim();
    const dryRun = req.query.dryRun === '1';

    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'invalid_url' });
    }

    const { status, ok, html } = await fetchHTML(url);
    if (!html || html.length < 25) {
      return res.status(502).json({ error: 'empty_response', upstream_status: status });
    }

    const text = extractText(html);
    const chunks = chunkString(text, MAX_CHARS_PER_CHUNK);

    // Use <title> if we have it, otherwise the URL
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;

    const supa = await upsertToSupabase({ url, title, chunks, dryRun });

    // Return a clear, UI-friendly payload
    return res.status(200).json({
      ok: true,
      url,
      upstream_status: status,
      dryRun,
      chunkSize: MAX_CHARS_PER_CHUNK,
      chunks: chunks.length,   // <— UI can show this
      pageId: supa.pageId,
      inserted: supa.inserted,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'server_error',
      detail: err.message ?? String(err)
    });
  }
}

// Vercel config — keep this on Node runtime
export const config = { runtime: 'nodejs' };
