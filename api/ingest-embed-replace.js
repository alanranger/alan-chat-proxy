// api/ingest-embed-replace.js
export const config = { runtime: 'nodejs' };

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36 AlanBot/1.0';

export default async function handler(req, res) {
  try {
    // Simple GET health/test mode:
    if (req.method !== 'POST') {
      const url = req.query.url;
      if (!url) {
        res.status(200).json({ ok: true, route: '/api/ingest-embed-replace', mode: 'alive' });
        return;
      }
      const r = await fetch(url, { headers: { 'user-agent': UA } });
      const text = await r.text();
      res.status(200).json({
        ok: true,
        mode: 'GET-test',
        url,
        status: r.status,
        bytes: text.length,
        sample: text.slice(0, 200)
      });
      return;
    }

    // POST mode (used by bulk.html)
    let body = {};
    if (req.headers['content-type']?.includes('application/json')) {
      body = req.body || {};
    } else if (typeof req.body === 'string') {
      try { body = JSON.parse(req.body); } catch { body = {}; }
    }

    const { url, title, replace } = body;
    if (!url) {
      res.status(400).json({ ok: false, error: 'missing url' });
      return;
    }

    const upstream = await fetch(url, { headers: { 'user-agent': UA } });
    const html = await upstream.text();

    // Minimal placeholder "ingest" that simply confirms we fetched the page.
    res.status(200).json({
      ok: true,
      url,
      title: title || null,
      replace: !!replace,
      status: upstream.status,
      bytes: html.length
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
