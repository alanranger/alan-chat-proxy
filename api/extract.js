// /api/extract.js
// Single API for JSON-LD extraction tests used by bulk.html.
// Actions:
//   - events-extract
//   - articles-extract
//   - products-extract
//   - services-extract
//   - extract-all
//
// NOTE: This file expects helper modules in /json (sibling of /api)

export const config = { runtime: 'nodejs' };

import {
  extractEventItemsFromUrl,
} from '../json/events-extract.js';

import {
  extractArticleItemsFromUrl,
  extractProductItemsFromUrl,
  extractServiceItemsFromUrl,
  extractAllFromUrl,
} from '../json/content-extract.js';

function send(res, code, obj) {
  res.status(code).setHeader('Content-Type', 'application/json; charset=utf-8');
  // ensure any thrown errors end up as strings
  if (obj && obj.detail && typeof obj.detail !== 'string') {
    try { obj.detail = String(obj.detail); } catch {}
  }
  res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return send(res, 405, { error: 'method_not_allowed' });
    }

    const url = String(req.query.url || '').trim();
    const action = String(req.query.action || '').trim();

    if (!url) return send(res, 400, { error: 'bad_request', detail: 'Missing ?url=' });
    if (!action) return send(res, 400, { error: 'bad_request', detail: 'Missing ?action=' });

    // Route actions
    if (action === 'events-extract') {
      const items = await extractEventItemsFromUrl(url);
      return send(res, 200, { ok: true, url, count: items.length, items });
    }

    if (action === 'articles-extract') {
      const items = await extractArticleItemsFromUrl(url);
      return send(res, 200, { ok: true, url, count: items.length, items });
    }

    if (action === 'products-extract') {
      const items = await extractProductItemsFromUrl(url);
      return send(res, 200, { ok: true, url, count: items.length, items });
    }

    if (action === 'services-extract') {
      const items = await extractServiceItemsFromUrl(url);
      return send(res, 200, { ok: true, url, count: items.length, items });
    }

    if (action === 'extract-all') {
      const out = await extractAllFromUrl(url);
      return send(res, 200, { ok: true, url, ...out, counts: {
        articles: out.articles?.length || 0,
        products: out.products?.length || 0,
        services: out.services?.length || 0,
      }});
    }

    return send(res, 400, { error: 'bad_request', detail: `Unknown action "${action}"` });
  } catch (err) {
    // Make failures visible to the UI instead of generic 500
    return send(res, 500, {
      error: 'server_error',
      detail: err?.message || String(err),
      stack: (err?.stack || '').split('\n').slice(0, 5).join('\n'),
    });
  }
}
