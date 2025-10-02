// /api/extract.js
// Read-only API for structured extraction.
// ?action=events-extract|articles-extract|products-extract|services-extract|extract-all&url=...

import {
  extractArticlesFromUrl,
  extractProductsFromUrl,
  extractServicesFromUrl,
  extractAllFromUrl,
} from './json/content-extract.js';

import {
  extractEventItemsFromUrl, // main
  extractEventsFromUrl,     // alias for compatibility
} from './json/events-extract.js';

function send(res, status, obj) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).send(JSON.stringify(obj));
}

export default async function handler(req, res) {
  try {
    const action = String(req.query.action || '').trim();
    const url = String(req.query.url || '').trim();
    if (!action) return send(res, 400, { ok: false, error: 'bad_request', detail: 'missing action' });
    if (!url)    return send(res, 400, { ok: false, error: 'bad_request', detail: 'missing url' });

    if (action === 'events-extract') {
      const items = await extractEventItemsFromUrl(url);
      return send(res, 200, { ok: true, url, count: items.length, items });
    }

    if (action === 'articles-extract') {
      const items = await extractArticlesFromUrl(url);
      return send(res, 200, { ok: true, url, count: items.length, items });
    }

    if (action === 'products-extract') {
      const items = await extractProductsFromUrl(url);
      return send(res, 200, { ok: true, url, count: items.length, items });
    }

    if (action === 'services-extract') {
      const items = await extractServicesFromUrl(url);
      return send(res, 200, { ok: true, url, count: items.length, items });
    }

    if (action === 'extract-all') {
      const out = await extractAllFromUrl(url);
      return send(res, 200, out);
    }

    // Back-compat alias someone might call
    if (action === 'extract-events') {
      const items = await extractEventsFromUrl(url);
      return send(res, 200, { ok: true, url, count: items.length, items });
    }

    return send(res, 400, { ok: false, error: 'bad_request', detail: 'unknown action' });
  } catch (e) {
    return send(res, 500, { ok: false, error: 'server_error', detail: String(e?.message || e) });
  }
}
