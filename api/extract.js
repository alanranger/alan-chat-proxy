// /api/extract.js
// JSON-LD extraction tester for bulk.html
// Actions: events-extract | articles-extract | products-extract | services-extract | extract-all
export const config = { runtime: 'nodejs' };

function send(res, code, obj) {
  res.status(code).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

// Lazy import so bundling/import errors show up as JSON
async function loadExtractors() {
  try {
    const events = await import('./json/events-extract.js');
    const content = await import('./json/content-extract.js');
    return {
      extractEventItemsFromUrl: events.extractEventItemsFromUrl,
      extractArticleItemsFromUrl: content.extractArticleItemsFromUrl,
      extractProductItemsFromUrl: content.extractProductItemsFromUrl,
      extractServiceItemsFromUrl: content.extractServiceItemsFromUrl,
      extractAllFromUrl: content.extractAllFromUrl,
    };
  } catch (e) {
    throw new Error('extractor_import_failed: ' + (e?.message || String(e)));
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });

    const url = String(req.query.url || '').trim();
    const action = String(req.query.action || '').trim();
    if (!url)    return send(res, 400, { error: 'bad_request', detail: 'Missing ?url=' });
    if (!action) return send(res, 400, { error: 'bad_request', detail: 'Missing ?action=' });

    const {
      extractEventItemsFromUrl,
      extractArticleItemsFromUrl,
      extractProductItemsFromUrl,
      extractServiceItemsFromUrl,
      extractAllFromUrl,
    } = await loadExtractors();

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
      return send(res, 200, {
        ok: true, url, ...out,
        counts: {
          articles: out.articles?.length || 0,
          products: out.products?.length || 0,
          services: out.services?.length || 0,
        }
      });
    }

    return send(res, 400, { error: 'bad_request', detail: `Unknown action "${action}"` });
  } catch (err) {
    return send(res, 500, {
      error: 'server_error',
      detail: err?.message || String(err),
      stack: (err?.stack || '').split('\n').slice(0, 6).join('\n'),
    });
  }
}
