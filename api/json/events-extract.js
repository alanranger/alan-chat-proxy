// /api/json/events-extract.js
// Pure helper: parse JSON-LD blocks and normalize Event/Course items.
// No DB writes here.

function isHttpUrl(u) {
  try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; }
  catch { return false; }
}

function coerceFutureISODate(raw, today = new Date()) {
  if (!raw) return null;
  const s = String(raw).trim();
  // Try full ISO first
  const d1 = new Date(s);
  if (!isNaN(d1.getTime())) return d1.toISOString().slice(0, 10);

  // Accept DD-MM or MM-DD and roll forward to a future date in the next 12 months
  const m = /^(\d{1,2})[\/\-](\d{1,2})$/.exec(s);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    // Best-effort: treat first as month if <=12 (US-style), else day-month (UK-style)
    let month = a <= 12 ? a : b;
    let day   = a <= 12 ? b : a;
    let year  = today.getUTCFullYear();
    let dt    = new Date(Date.UTC(year, month - 1, day));
    if (dt < today) dt = new Date(Date.UTC(year + 1, month - 1, day));
    return dt.toISOString().slice(0, 10);
  }
  return null;
}

const EVENT_TYPES = new Set(['Event', 'EducationEvent', 'Course', 'EventSeries']);

function mapEventType(schemaType = '') {
  const t = String(schemaType || '').toLowerCase();
  if (t.includes('course')) return 'course';
  if (t.includes('educationevent')) return 'course';
  if (t.includes('eventseries')) return 'event';
  if (t.includes('event')) return 'event';
  return 'event';
}

function tryParseJSON(text, index = 0) {
  try { return JSON.parse(text); }
  catch {
    const cleaned = text.replace(/<!--.*?-->/gs, '').trim();
    try { return JSON.parse(cleaned); }
    catch (err) {
      console.error('[events-extract] JSON-LD parse error at block', index, err?.message);
      return null;
    }
  }
}

function collectEventNodes(node, out = []) {
  if (!node || typeof node !== 'object') return out;

  if (Array.isArray(node['@graph'])) {
    node['@graph'].forEach(n => collectEventNodes(n, out));
  }

  const typeVal = node['@type'];
  if (typeVal) {
    const types = Array.isArray(typeVal) ? typeVal : [typeVal];
    const hit = types.some(t => EVENT_TYPES.has(String(t)));
    if (hit) out.push(node);
  }

  if (Array.isArray(node)) {
    node.forEach(n => collectEventNodes(n, out));
  } else {
    for (const k of Object.keys(node)) {
      if (k === '@graph') continue;
      const v = node[k];
      if (v && typeof v === 'object') collectEventNodes(v, out);
    }
  }
  return out;
}

function normaliseLocation(loc) {
  if (!loc || typeof loc !== 'object') return '';
  const nm = loc.name || '';
  const addr = loc.address;
  if (typeof addr === 'string') return nm ? `${nm} | ${addr}` : addr;
  if (addr && typeof addr === 'object') {
    const parts = [
      addr.name,
      addr.streetAddress,
      addr.addressLocality,
      addr.addressRegion,
      addr.postalCode
    ].filter(Boolean);
    const addrStr = parts.join(', ');
    return nm ? `${nm}${addrStr ? ' | ' + addrStr : ''}` : addrStr;
  }
  return String(nm || '');
}

function guessWorkshopCategory({ url = '', title = '' }) {
  const s = `${url} ${title}`.toLowerCase();
  if (/(residential|multi[-\s]?day|betws|wales|fairy[-\s]?glen)/.test(s)) return 'residential';
  if (/(one[-\s]?day|dartmoor|yorkshire|woodland(?!.*walk)|cotswolds)/.test(s)) return 'one-day';
  if (/(half[-\s]?day|walk|evening|sunset|golden hour|oakley|coombe|warwick)/.test(s)) return 'half-day';
  return undefined;
}

function normaliseEventNode(node, pageUrl, today = new Date()) {
  const title = node.name || node.headline || node['@id'] || '';

  const startRaw = node.startDate || node.startTime || node.start || '';
  const endRaw   = node.endDate   || node.endTime   || node.end   || '';
  const date_start = coerceFutureISODate(startRaw, today);
  const date_end   = endRaw ? coerceFutureISODate(endRaw, today) : undefined;

  const location =
    normaliseLocation(node.location) ||
    normaliseLocation(node['@location']) ||
    '';

  const url =
    (isHttpUrl(node.url) && node.url) ||
    (isHttpUrl(node['@id']) && node['@id']) ||
    pageUrl;

  const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type'] || ''];
  const event_type = mapEventType(types.join(','));
  const category = event_type === 'event' ? guessWorkshopCategory({ url, title }) : undefined;

  const out = {
    kind: 'event',
    event_type,
    category,
    title: String(title || '').trim(),
    date_start,
    date_end,
    location: String(location || '').trim(),
    url: String(url || '').trim(),
    source_url: pageUrl,
    last_seen: new Date().toISOString(),
    raw: {
      '@type': node['@type'],
      name: node.name || undefined,
      startDate: node.startDate || undefined,
      endDate: node.endDate || undefined
    }
  };

  if (!out.title) return null;
  if (!out.date_start) return null;
  if (!isHttpUrl(out.url) && !isHttpUrl(out.source_url)) return null;

  return out;
}

function extractJsonLdBlocks(html) {
  const blocks = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) blocks.push(m[1]);
  return blocks;
}

export function extractEventItemsFromHtml(html, pageUrl, today = new Date()) {
  const items = [];
  const scripts = extractJsonLdBlocks(html);

  scripts.forEach((jsonText, idx) => {
    const data = tryParseJSON(jsonText, idx);
    if (!data) return;
    const roots = Array.isArray(data) ? data : [data];
    roots.forEach(root => {
      const nodes = collectEventNodes(root, []);
      nodes.forEach(node => {
        const norm = normaliseEventNode(node, pageUrl, today);
        if (norm) items.push(norm);
      });
    });
  });

  const seen = new Set();
  const dedup = [];
  for (const it of items) {
    const key = `${it.title}|${it.date_start}|${it.url}`;
    if (!seen.has(key)) { seen.add(key); dedup.push(it); }
  }
  return dedup;
}

export async function extractEventItemsFromUrl(url, today = new Date()) {
  const res = await fetch(url, { headers: { 'User-Agent': 'alanranger-bot/1.0 (+events-extract)' } });
  const html = await res.text();
  return extractEventItemsFromHtml(html, url, today);
}

// **Alias expected by /api/extract** (fixes “not a function”)
export async function extractEventsFromUrl(url, today = new Date()) {
  return extractEventItemsFromUrl(url, today);
}
