// api/ingest-embed-replace.js
// Replace per-URL flow: delete existing rows for URL, fetch + chunk page text, forward to existing /api/ingest-embed

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// very basic HTML -> text extractor
function htmlToText(html) {
  if (!html) return '';
  // drop script/style
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '')
             .replace(/<style[\s\S]*?<\/style>/gi, '');
  // strip tags
  const text = html.replace(/<\/?[^>]+(>|$)/g, ' ');
  // collapse whitespace
  return text.replace(/\s+/g, ' ').trim();
}

function splitIntoChunks(text, maxLen = 900) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxLen));
    i += maxLen;
  }
  return chunks;
}

async function fetchPageText(url) {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PowerShell', // keeps some hosts happy
      'Accept': 'text/html,application/xhtml+xml'
    }
  });
  if (!resp.ok) {
    throw new Error(`Fetch ${url} failed: ${resp.status}`);
  }
  const html = await resp.text();
  return htmlToText(html);
}

export default async function handler(req, res) {
  // Always JSON
  const json = (body, status = 200) =>
    res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));

  try {
    if (req.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405);
    }

    // auth passthrough — we reuse your existing /api/ingest-embed
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
      return json({ error: 'unauthorized', detail: 'Missing Bearer token' }, 401);
    }

    const { url, title } = req.body || {};
    if (!url || typeof url !== 'string') {
      return json({ error: 'bad_request', detail: 'Provide { url }' }, 400);
    }

    // 1) delete existing rows for this URL (replace semantics)
    const { error: delErr } = await supabase
      .from('page_chunks')
      .delete()
      .eq('url', url);
    if (delErr) {
      // not fatal, but report
      console.warn('Supabase delete error:', delErr);
    }

    // 2) fetch page & chunk
    const text = await fetchPageText(url);
    if (!text || text.length < 50) {
      return json({ error: 'too_short', detail: 'Page text too short' }, 400);
    }
    const chunks = splitIntoChunks(text, 900);

    // 3) forward to your existing /api/ingest-embed (it already embeds+inserts)
    // get absolute base for the same deployment
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host  = req.headers['host'];
    const base  = `${proto}://${host}`;

    const forwardResp = await fetch(`${base}/api/ingest-embed`, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url, title, chunks })
    });

    const textBody = await forwardResp.text();
    let data;
    try {
      data = JSON.parse(textBody);
    } catch {
      // make it JSON no matter what
      return json({
        error: 'server_error',
        detail: 'Downstream returned non-JSON',
        status: forwardResp.status,
        preview: textBody.slice(0, 200)
      }, 502);
    }

    if (!forwardResp.ok) {
      return json({ error: 'ingest_failed', status: forwardResp.status, detail: data }, forwardResp.status);
    }

    return json({ ok: true, replaced: true, inserted: data?.inserted ?? null });
  } catch (err) {
    console.error(err);
    return json({ error: 'server_error', detail: `${err}` }, 500);
  }
}
