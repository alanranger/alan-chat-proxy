// /api/extract.js
// Unified JSON-LD extractor API
// - GET or POST with { url } and optional ?kind=events|articles|products|services|all
// - "all" now truly returns events + articles + products + services.

export const config = { runtime: 'nodejs' };

import { extractEventItemsFromUrl } from './json/events-extract.js';
import {
  extractAllFromUrl as extractAPSFromUrl, // Articles/Products/Services
} from './json/content-extract.js';

function send(res, status, obj) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).send(JSON.stringify(obj, null, 2));
}

function readUrl(req) {
  // POST body or query ?url=...
  try {
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      if (b && b.url) return String(b.url).trim();
    }
  } catch { /* ignore */ }

  const q = req.query?.url || req.query?.u;
  return q ? String(q).trim() : '';
}

export default async function handler(req, res) {
  // Simple CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET' && req.method !== 'POST') {
    return send(res, 405, { error: 'method_not_allowed' });
  }

  const url = readUrl(req);
  const kind = String(req.query?.kind || 'all').toLowerCase();

  if (!url) return send(res, 400, { error: 'bad_request', detail: 'Provide ?url=… or body { url }' });

  try {
    // Always fetch APS first (Articles/Products/Services).
    const aps = await extractAPSFromUrl(url);

    // Optionally fetch events
    let events = [];
    if (kind === 'events' || kind === 'all') {
      try {
        events = await extractEventItemsFromUrl(url);
      } catch (e) {
        // don’t explode the whole request if events fail
        events = [];
      }
    }

    // Return subsets if a specific kind was requested
    if (kind === 'events') {
      return send(res, 200, {
        ok: true,
        url,
        events,
        counts: { events: events.length }
      });
    }
    if (kind === 'articles') {
      return send(res, 200, {
        ok: true,
        url,
        articles: aps.articles,
        counts: { articles: aps.articles.length }
      });
    }
    if (kind === 'products') {
      return send(res, 200, {
        ok: true,
        url,
        products: aps.products,
        counts: { products: aps.products.length }
      });
    }
    if (kind === 'services') {
      return send(res, 200, {
        ok: true,
        url,
        services: aps.services,
        counts: { services: aps.services.length }
      });
    }

    // kind === 'all' → merge everything
    const out = {
      ok: true,
      url,
      articles: aps.articles,
      products: aps.products,
      services: aps.services,
      events,
      counts: {
        articles: aps.articles.length,
        products: aps.products.length,
        services: aps.services.length,
        events: events.length
      }
    };
    return send(res, 200, out);
  } catch (e) {
    return send(res, 500, {
      error: 'server_error',
      detail: String(e?.message || e)
    });
  }
}
