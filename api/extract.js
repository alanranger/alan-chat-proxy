// api/extract.js
// Server-side fetch + extract + chunk. Returns { url, title, chunks[] }.

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'bad_request', detail: 'Provide { url }' });
    }

    const resp = await fetch(url, {
      headers: {
        // A benign UA helps some servers
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!resp.ok) {
      return res.status(502).json({
        error: 'upstream_error',
        detail: `Fetch failed ${resp.status} ${resp.statusText}`,
      });
    }

    const html = await resp.text();

    // Extract <title>
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? decodeEntities(stripTags(titleMatch[1])).trim().slice(0, 200) : '';

    // Strip scripts/styles/tags → plain text
    const text = toPlainText(html);

    // Chunk
    const chunks = splitIntoChunks(text, 900); // ~900 chars per chunk

    return res.status(200).json({ url, title, chunks });
  } catch (err) {
    console.error('extract error', err);
    return res.status(500).json({ error: 'server_error', detail: String(err?.message || err) });
  }
}

function toPlainText(html) {
  // Remove script/style contents
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');

  // Remove all tags
  s = s.replace(/<\/?[^>]+>/g, ' ');

  s = decodeEntities(s);
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function decodeEntities(s) {
  // Cheap entity decode that covers common ones; sufficient for text chunking
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(s) {
  return s.replace(/<\/?[^>]+>/g, ' ');
}

function splitIntoChunks(text, maxLen = 900) {
  if (!text) return [];
  const sentences = text.split(/(?<=[\.!?])\s+/);
  const chunks = [];
  let cur = '';

  for (const sent of sentences) {
    if (!sent) continue;
    if ((cur + ' ' + sent).trim().length > maxLen) {
      if (cur) chunks.push(cur.trim());
      if (sent.length > maxLen) {
        // Hard-split very long sentences
        for (let i = 0; i < sent.length; i += maxLen) {
          chunks.push(sent.slice(i, i + maxLen).trim());
        }
        cur = '';
      } else {
        cur = sent;
      }
    } else {
      cur = (cur ? cur + ' ' : '') + sent;
    }
  }
  if (cur) chunks.push(cur.trim());

  // Filter empties & clamp number if extreme
  return chunks.filter(Boolean).slice(0, 200);
}
