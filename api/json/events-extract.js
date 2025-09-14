// /api/json/events-extract.js
// Step 2A: Pure helper,  to extract Event/Course data from JSON-LD into unified EventItem objects.
// No DB writes here. Step 2B uses this from /api/extract.js.

import { coerceFutureISODate, isHttpUrl } from './workshops-schema.js';

/** Accept Event-like @type values (string or array) */
const EVENT_TYPES = new Set([
  'Event',
  'EducationEvent',
  'Course',
  'EventSeries'
]);

/** Map schema.org @type -> our event_type */
function mapEventType(schemaType = '') {
  const t = String(schemaType || '').toLowerCase();
  if (t.includes('course')) return 'course';
  if (t.includes('educationevent')) return 'course'; // treat education events as courses for now
  if (t.includes('eventseries')) return 'event';
  if (t.includes('event')) return 'event';
  return 'event';
}

/** Guess workshop category from URL or title (best-effort; optional) */
function guessWorkshopCategory({ url = '', title = '' }) {
  const s = `${url} ${title}`.toLowerCase();
  if (/(residential|multi[-\s]?day|betws|wales|fairy[-\s]?glen)/.test(s)) return 'residential';
  if (/(one[-\s]?day|dartmoor|yorkshire|woodland(?!.*walk)|cotswolds)/.test(s)) return 'one-day';
  if (/(half[-\s]?day|walk|evening|sunset|golden hour|oakley|coombe|warwick)/.test(s)) return 'half-day';
  return undefined;
}

/** Safe JSON parse with helpful context for debugging */
function tryParseJSON(text, index = 0) {
  try { return JSON.parse(text); }
  catch (e) {
    // Strip HTML comments inside JSON-LD if any
    const cleaned = text.replace(/<!--.*?-->/gs, '').trim();
    try { return JSON.parse(cleaned); }
    catch (err) {
      console.error('[events-extract] JSON-LD parse error at block', index, err?.message);
      return null;
    }
  }
}

/** Recursively walk any object/array to collect nodes that have an Event-like @type */
function collectEventNodes(node, out = []) {
  if (!node || typeof node !== 'object') return out;

  // Handle @graph: [...]
  if (Array.isArray(node['@graph'])) {
    node['@graph'].forEach(n => collectEventNodes(n, out));
  }

  // Handle this node
  const typeVal = node['@type'];
  if (typeVal) {
    const types = Array.isArray(typeVal) ? typeVal : [typeVal];
    const hit = types.some(t => EVENT_TYPES.has(String(t)));
    if (hit) out.push(node);
  }

  // Recurse through arrays/objects
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

/** Pull text from location object */
function normaliseLocation(loc) {
  if (!loc || typeof loc !== 'object') return '';
  // schema.org location can be Place or PostalAddress
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

/** Normalise a single schema.org Event/Course object into an EventItem */
function normaliseEventNode(node, pageUrl, today = new Date()) {
  // Titles
  const title =
    node.name ||
    node.headline ||
    node['@id'] ||
    '';

  // Dates
  const startRaw = node.startDate || node.startTime || node.start || '';
  const endRaw = node.endDate || node.endTime || node.end || '';

  // Coerce to ISO (if missing year, roll forward to next future date)
  const date_start = coerceFutureISODate(startRaw, today);
  const date_end = endRaw ? coerceFutureISODate(endRaw, today) : undefined;

  // Location
  const location =
    normaliseLocation(node.location) ||
    normaliseLocation(node['@location']) ||
    '';

  // URL preference: node.url > node['@id'] > pageUrl
  const url =
    (isHttpUrl(node.url) && node.url) ||
    (isHttpUrl(node['@id']) && node['@id']) ||
    pageUrl;

  // Event type (workshop vs course vs event)
  const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type'] || ''];
  const event_type = mapEventType(types.join(','));

  // Optional workshop category guess
  const category = event_type === 'event' ? guessWorkshopCategory({ url, title }) : undefined;

  const out = {
    kind: 'event',
    event_type,            // 'event' | 'course'
    category,              // 'half-day' | 'one-day' | 'residential' (optional)
    title: String(title || '').trim(),
    date_start,            // 'YYYY-MM-DD' or null if unknown
    date_end,              // optional
    location: String(location || '').trim(),
    url: String(url || '').trim(),
    source_url: pageUrl,
    last_seen: new Date().toISOString(),
    // Keep a small raw slice for debugging (non-PII)
    raw: {
      '@type': node['@type'],
      name: node.name || undefined,
      startDate: node.startDate || undefined,
      endDate: node.endDate || undefined
    }
  };

  // Minimal validation
  if (!out.title) return null;
  if (!out.date_start) return null; // must have a usable date
  if (!isHttpUrl(out.url) && !isHttpUrl(out.source_url)) return null;

  return out;
}

/** Extract <script type="application/ld+json"> blocks from HTML (no extra deps) */
function extractJsonLdBlocks(html) {
  const blocks = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    blocks.push(m[1]);
  }
  return blocks;
}

/**
 * Main: from HTML → EventItem[]
 * - Parses all JSON-LD blocks
 * - Collects Event/Course nodes
 * - Normalises into unified objects
 */
export function extractEventItemsFromHtml(html, pageUrl, today = new Date()) {
  const items = [];
  const scripts = extractJsonLdBlocks(html);

  scripts.forEach((jsonText, idx) => {
    const data = tryParseJSON(jsonText, idx);
    if (!data) return;

    // Top-level can be object or array
    const roots = Array.isArray(data) ? data : [data];

    roots.forEach(root => {
      const nodes = collectEventNodes(root, []);
      nodes.forEach(node => {
        const norm = normaliseEventNode(node, pageUrl, today);
        if (norm) items.push(norm);
      });
    });
  });

  // Deduplicate by (title + date_start + url)
  const seen = new Set();
  const dedup = [];
  for (const it of items) {
    const key = `${it.title}|${it.date_start}|${it.url}`;
    if (!seen.has(key)) { seen.add(key); dedup.push(it); }
  }

  return dedup;
}

/** Convenience: fetch a URL and extract events. No DB here. */
export async function extractEventItemsFromUrl(url, today = new Date()) {
  const res = await fetch(url, { headers: { 'User-Agent': 'alanranger-bot/1.0 (+events-extract)' } });
  const html = await res.text();
  return extractEventItemsFromHtml(html, url, today);
}
