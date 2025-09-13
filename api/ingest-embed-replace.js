// /api/ingest-embed-replace.js
// Single-step: robust JSON errors + basic fetch -> text -> Supabase insert.
// (No embeddings yet. We'll add once we see success.)

import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Vercel wants 'nodejs' here (not 'nodejs20.x')
export const config = { runtime: 'nodejs' };

// --- helpers ---------------------------------------------------------------

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

function parseBody(req) {
  // In Vercel/Node, body may be already parsed, a string, or undefined
  if (req.body && typeof req.body === 'object') return req.body;
  if (req.body && typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { /* fall through */ }
  }
  // If no body was parsed, collect it
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { resolve({}); }
    });
  });
}

function stripHtml(html) {
  if (!html) return '';
  // remove scripts/styles
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '')
             .replace(/<style[\s\S]*?<\/style>/gi, '');
  // replace <br> & block tags with newlines
  html = html.replace(/<(\/)?(p|div|li|h[1-6]|tr|table|section|article|header|footer|blockquote|pre)>/gi, '\n');
  html = html.replace(/<br\s*\/?>/gi, '\n');
  // strip all tags
  html = html.replace(/<\/?[^>]+>/g, '');
  // decode some entities
  html = html.replace(/&nbsp;/g, ' ')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'");
  // collapse whitespace
  html = html.replace(/\r/g, '').replace(/\t/g, ' ');
  html = html.split('\n').map(s => s.trim()).filter(Boolean).join('\n');
  return html;
}

// --- handler ---------------------------------------------------------------

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return json(res, 405, { error: 'method_not_allowed', allowed: ['POST'] });
    }

    const body = await parseBody(req);
    const url = (body?.url || '').trim();

    if (!url) {
      return json(res, 400, { error: 'bad_request', detail: 'Provide "url"' });
    }

    // Fetch the page
    let pageResp;
    try {
      pageResp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AlanChatProxy/1.0; +https://alan-chat-proxy.vercel.app)'
        },
      });
    } catch (e) {
      return json(res, 502, { error: 'fetch_failed', detail: String(e) });
    }

    const status = pageResp.status;
    const contentType = pageResp.headers.get('content-type') || '';
    const bodyText = await pageResp.text();

    if (status >= 400) {
      return json(res, 502, {
        error: 'upstream_error',
        status,
        contentType,
        sample: bodyText.slice(0, 400)
      });
    }

    if (!/html|text/i.test(contentType) && !bodyText.startsWith('<!DOCTYPE')) {
      return json(res, 415, {
        error: 'unsupported_content_type',
        got: contentType
      });
    }

    const text = stripHtml(bodyText);
    if (!text || text.length < 20) {
      return json(res, 422, { error: 'empty_or_too_short', len: text?.length || 0 });
    }

    // Insert into Supabase (basic fields only)
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json(res, 500, { error: 'missing_supabase_env', need: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)'] });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // keep content size reasonable (adjust as you like)
    const contentForDb = text.length > 15000 ? text.slice(0, 15000) : text;

    const row = {
      url,
      content: contentForDb,
      created_at: new Date().toISOString()
      // add other columns if your schema requires them
      // e.g., title, chunk_hash, tokens, embedding (once we add it)
    };

    const { data, error } = await supabase.from('page_chunks').insert([row]).select('id');

    if (error) {
      return json(res, 500, { error: 'db_insert_failed', detail: error.message });
    }

    return json(res, 200, {
      ok: true,
      id: data?.[0]?.id,
      url,
      len: text.length
    });

  } catch (err) {
    // Always send JSON on any unhandled error
    return json(res, 500, { error: 'server_error', detail: err?.message || String(err) });
  }
}
