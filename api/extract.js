// /api/extract.js
// Read-only tester endpoint that exposes JSON-LD extraction helpers.
// Actions (GET):
//   - action=events-extract&url=...
//   - action=articles-extract&url=...
//   - action=products-extract&url=...
//   - action=services-extract&url=...
//   - action=extract-all&url=...
//
// This does NOT write to the database. Safe to use from bulk.html.

import { extractEventItemsFromUrl }   from '../json/events-extract.js';
import {
  extractArticleItemsFromUrl,
  extractProductItemsFromUrl,
  extractServiceItemsFromUrl,
  extractAllFromUrl,
} from '../json/content-extract.js';

function send(res, status, obj) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).send(JSON.stringify(obj));
}

function isHttpUrl(u) { try { const x = new URL(String(u)); return x.protocol === 'http:' || x.protocol === 'https:'; } catch { return false; } }

export default async function handler(req, res) {
  // CORS (read-only)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });

  const action = String(req.query?.action || '').toLowerCase();
  const url    = String(req.query?.url || '').trim();

  if (!action) return send(res, 400, { error: 'missing_action' });
  if (!url || !isHttpUrl(url)) return send(res, 400, { error: 'missing_or_bad_url', detail: 'Provide ?url=https://...' });

  try {
    if (action === 'events-extract') {
      const events = await extractEventItemsFromUrl(url);
      return send(res, 200, { ok: true, url, count: events.length, events });
    }
    if (action === 'articles-extract') {
      const articles = await extractArticleItemsFromUrl(url);
      return send(res, 200, { ok: true, url, count: articles.length, articles });
    }
    if (action === 'products-extract') {
      const products = await extractProductItemsFromUrl(url);
      return send(res, 200, { ok: true, url, count: products.length, products });
    }
    if (action === 'services-extract') {
      const services = await extractServiceItemsFromUrl(url);
      return send(res, 200, { ok: true, url, count: services.length, services });
    }
    if (action === 'extract-all') {
      const all = await extractAllFromUrl(url);
      return send(res, 200, { ok: true, url, ...all });
    }
    return send(res, 400, { error: 'unknown_action', action });
  } catch (e) {
    return send(res, 500, { error: 'extract_failed', detail: String(e?.message || e) });
  }
}
