// /json/content-extract.js
// Unified, dependency-free JSON-LD extractor for Events/Courses, Articles, Products, and Services.
// No DB writes. Step 2B will expose read-only tester endpoints that call these functions.

import { coerceFutureISODate, isHttpUrl } from './json/workshops-schema.js';

/* ------------------------------- Type sets -------------------------------- */
const EVENT_TYPES   = new Set(['Event', 'EducationEvent', 'Course', 'EventSeries']);
const ARTICLE_TYPES = new Set(['Article', 'BlogPosting', 'NewsArticle']);
const PRODUCT_TYPES = new Set(['Product']);
const SERVICE_TYPES = new Set(['Service']);

/* ---------------------------- JSON-LD utilities --------------------------- */
function tryParseJSON(text, index = 0) {
  try { return JSON.parse(text); }
  catch {
    const cleaned = text.replace(/<!--.*?-->/gs, '').trim();
    try { return JSON.parse(cleaned); }
    catch (err) {
      console.error('[content-extract] JSON-LD parse error @ block', index, err?.message);
      return null;
    }
  }
}

function extractJsonLdBlocks(html) {
  const blocks = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m; while ((m = re.exec(html)) !== null) blocks.push(m[1]);
  return blocks;
}

function collectNodesByType(node, typeSet, out = []) {
  if (!node || typeof node !== 'object') return out;

  // @graph arrays
  if (Array.isArray(node['@graph'])) node['@graph'].forEach(n => collectNodesByType(n, typeSet, out));

  // this node
  const t = node['@type'];
  if (t) {
    const arr = Array.isArray(t) ? t : [t];
    if (arr.some(x => typeSet.has(String(x)))) out.push(node);
  }

  // recurse generic
  if (Array.isArray(node)) {
    node.forEach(n => collectNodesByType(n, typeSet, out));
  } else {
    for (const k of Object.keys(node)) {
      if (k === '@graph') continue;
      const v = node[k];
      if (v && typeof v === 'object') collectNodesByType(v, typeSet, out);
    }
  }
  return out;
}

/* ------------------------------ Tiny helpers ------------------------------ */
function firstString(v) {
  if (!v) return '';
  if (Array.isArray(v)) return firstString(v[0]);
  if (typeof v === 'object') return firstString(v.name || v['@id'] || v.url);
  return String(v || '').trim();
}
function normaliseLocation(loc) {
  if (!loc || typeof loc !== 'object') return '';
  const nm = loc.name || '';
  const addr = loc.address;
  if (typeof addr === 'string') return nm ? `${nm} | ${addr}` : addr;
  if (addr && typeof addr === 'object') {
    const parts = [
      addr.name, addr.streetAddress, addr.addressLocality,
      addr.addressRegion, addr.postalCode, addr.addressCountry
    ].filter(Boolean);
    const addrStr = parts.join(', ');
    return nm ? `${nm}${addrStr ? ' | ' + addrStr : ''}` : addrStr;
  }
  return String(nm || '');
}

/* --------------------------------- Events --------------------------------- */
function mapEventType(schemaType = '') {
  const t = String(schemaType || '').toLowerCase();
  if (t.includes('course')) return 'course';
  if (t.includes('educationevent')) return 'course';
  if (t.includes('eventseries')) return 'event';
  if (t.includes('event')) return 'event';
  return 'event';
}
function guessWorkshopCategory({ url = '', title = '' }) {
  const s = `${url} ${title}`.toLowerCase();
  if (/(residential|multi[-\s]?day|betws|wales|fairy[-\s]?glen)/.test(s)) return 'residential';
  if (/(one[-\s]?day|dartmoor|yorkshire|woodland(?!.*walk)|cotswolds)/.test(s)) return 'one-day';
  if (/(half[-\s]?day|walk|evening|sunset|golden hour|oakley|coombe|warwick)/.test(s)) return 'half-day';
  return undefined;
}
function normaliseEventNode(node, pageUrl, today = new Date()) {
  const title = firstString(node.name || node.headline || node['@id']);
  const startRaw = node.startDate || node.startTime || node.start || '';
  const endRaw   = node.endDate   || node.endTime   || node.end   || '';
  const date_start = coerceFutureISODate(startRaw, today);
  const date_end   = endRaw ? coerceFutureISODate(endRaw, today) : undefined;
  const location   = normaliseLocation(node.location) || normaliseLocation(node['@location']) || '';
  const url = (isHttpUrl(node.url) && node.url)
           || (isHttpUrl(node['@id']) && node['@id'])
           || (isHttpUrl(pageUrl) && pageUrl) || '';

  const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type'] || ''];
  const event_type = mapEventType(types.join(','));
  const category = event_type === 'event' ? guessWorkshopCategory({ url, title }) : undefined;

  const out = {
    kind: 'event', event_type, category,
    title, date_start, date_end, location, url,
    source_url: pageUrl, last_seen: new Date().toISOString(),
    raw: { '@type': node['@type'], name: node.name || undefined, startDate: node.startDate || undefined }
  };
  if (!out.title || !out.date_start) return null;
  if (!isHttpUrl(out.url) && !isHttpUrl(out.source_url)) return null;
  return out;
}
export function extractEventItemsFromHtml(html, pageUrl, today = new Date()) {
  const items = [];
  extractJsonLdBlocks(html).forEach((txt, i) => {
    const data = tryParseJSON(txt, i); if (!data) return;
    (Array.isArray(data) ? data : [data]).forEach(root => {
      collectNodesByType(root, EVENT_TYPES, []).forEach(n => {
        const norm = normaliseEventNode(n, pageUrl, today);
        if (norm) items.push(norm);
      });
    });
  });
  const seen = new Set(), dedup = [];
  for (const it of items) {
    const k = `${it.title}|${it.date_start}|${it.url}`;
    if (!seen.has(k)) { seen.add(k); dedup.push(it); }
  }
  return dedup;
}
export async function extractEventItemsFromUrl(url, today = new Date()) {
  const res = await fetch(url, { headers: { 'User-Agent': 'alanranger-bot/1.0 (+content-extract)' } });
  const html = await res.text();
  return extractEventItemsFromHtml(html, url, today);
}

/* -------------------------------- Articles -------------------------------- */
function normaliseArticleNode(node, pageUrl) {
  const title = firstString(node.headline || node.name);
  const url = (isHttpUrl(node.url) && node.url)
           || (isHttpUrl(firstString(node.mainEntityOfPage)) && firstString(node.mainEntityOfPage))
           || (isHttpUrl(pageUrl) && pageUrl) || '';
  const date_published = firstString(node.datePublished || node.dateCreated);
  const date_modified  = firstString(node.dateModified);
  const author  = firstString(node.author || node.creator);
  const section = firstString(node.articleSection || node.section || node.genre);
  const keywords = Array.isArray(node.keywords)
    ? node.keywords.map(k => String(k))
    : (typeof node.keywords === 'string' ? node.keywords.split(',').map(s => s.trim()).filter(Boolean) : []);
  const image = firstString(node.image);

  const out = {
    kind: 'article',
    title, url,
    date_published: date_published || undefined,
    date_modified:  date_modified  || undefined,
    author: author || undefined,
    section: section || undefined,
    tags: keywords,
    image: isHttpUrl(image) ? image : undefined,
    source_url: pageUrl, last_seen: new Date().toISOString(),
    raw: { '@type': node['@type'], headline: node.headline || undefined }
  };
  if (!out.title) return null;
  if (!isHttpUrl(out.url) && !isHttpUrl(out.source_url)) return null;
  return out;
}
export function extractArticleItemsFromHtml(html, pageUrl) {
  const items = [];
  extractJsonLdBlocks(html).forEach((txt, i) => {
    const data = tryParseJSON(txt, i); if (!data) return;
    (Array.isArray(data) ? data : [data]).forEach(root => {
      collectNodesByType(root, ARTICLE_TYPES, []).forEach(n => {
        const norm = normaliseArticleNode(n, pageUrl);
        if (norm) items.push(norm);
      });
    });
  });
  const seen = new Set(), dedup = [];
  for (const it of items) {
    const k = `${it.title}|${it.url}`;
    if (!seen.has(k)) { seen.add(k); dedup.push(it); }
  }
  return dedup;
}
export async function extractArticleItemsFromUrl(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'alanranger-bot/1.0 (+content-extract)' } });
  const html = await res.text();
  return extractArticleItemsFromHtml(html, url);
}

/* -------------------------------- Products -------------------------------- */
function normaliseBrand(brand) {
  if (!brand) return undefined;
  if (typeof brand === 'string') return brand;
  if (typeof brand === 'object') return brand.name || brand['@id'] || undefined;
}
function pickBestOffer(node) {
  const offers = node.offers;
  if (!offers) return null;
  const arr = Array.isArray(offers) ? offers : [offers];
  let best = null;
  for (const o of arr) {
    const availability = firstString(o.availability);
    const price = Number(o.price || o.priceSpecification?.price || NaN);
    const currency = o.priceCurrency || o.priceSpecification?.priceCurrency || undefined;
    const url = firstString(o.url) || firstString(o.itemOffered?.url);
    const candidate = { price: isNaN(price) ? undefined : price, price_currency: currency, availability, offer_url: isHttpUrl(url) ? url : undefined };
    if (!best) best = candidate;
    // prefer in-stock; then lowest price
    const availScore = /instock/i.test(candidate.availability || '') ? 2 : /preorder|pre-sale/i.test(candidate.availability || '') ? 1 : 0;
    const bestAvailScore = /instock/i.test(best.availability || '') ? 2 : /preorder|pre-sale/i.test(best.availability || '') ? 1 : 0;
    if (availScore > bestAvailScore) best = candidate;
    else if (availScore === bestAvailScore) {
      if (candidate.price !== undefined && (best.price === undefined || candidate.price < best.price)) best = candidate;
    }
  }
  return best;
}
function normaliseProductNode(node, pageUrl) {
  const name = firstString(node.name);
  const url  = (isHttpUrl(node.url) && node.url) || (isHttpUrl(pageUrl) && pageUrl) || '';
  const out = {
    kind: 'product',
    name,
    description: firstString(node.description) || undefined,
    brand: normaliseBrand(node.brand),
    sku: firstString(node.sku) || undefined,
    gtin: firstString(node.gtin || node.gtin13 || node.gtin14 || node.gtin12) || undefined,
    url,
    image: isHttpUrl(firstString(node.image)) ? firstString(node.image) : undefined,
    category: firstString(node.category) || undefined,
    offers: pickBestOffer(node) || undefined,
    source_url: pageUrl,
    last_seen: new Date().toISOString(),
    raw: { '@type': node['@type'] }
  };
  if (!out.name) return null;
  if (!isHttpUrl(out.url) && !isHttpUrl(out.source_url)) return null;
  return out;
}
export function extractProductItemsFromHtml(html, pageUrl) {
  const items = [];
  extractJsonLdBlocks(html).forEach((txt, i) => {
    const data = tryParseJSON(txt, i); if (!data) return;
    (Array.isArray(data) ? data : [data]).forEach(root => {
      collectNodesByType(root, PRODUCT_TYPES, []).forEach(n => {
        const norm = normaliseProductNode(n, pageUrl);
        if (norm) items.push(norm);
      });
    });
  });
  const seen = new Set(), dedup = [];
  for (const it of items) {
    const k = `${it.name}|${it.url}`;
    if (!seen.has(k)) { seen.add(k); dedup.push(it); }
  }
  return dedup;
}
export async function extractProductItemsFromUrl(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'alanranger-bot/1.0 (+content-extract)' } });
  const html = await res.text();
  return extractProductItemsFromHtml(html, url);
}

/* -------------------------------- Services -------------------------------- */
function normaliseServiceNode(node, pageUrl) {
  const name = firstString(node.name);
  const url  = (isHttpUrl(node.url) && node.url) || (isHttpUrl(pageUrl) && pageUrl) || '';
  // price can be under offers similar to product; also serviceType/areaServed may be objects/arrays
  const offer = pickBestOffer(node);
  const areaServed = Array.isArray(node.areaServed)
    ? node.areaServed.map(firstString).filter(Boolean)
    : [firstString(node.areaServed)].filter(Boolean);
  const serviceType = firstString(node.serviceType);

  const out = {
    kind: 'service',
    name,
    description: firstString(node.description) || undefined,
    serviceType: serviceType || undefined,
    areaServed: areaServed,
    url,
    offers: offer || undefined,
    source_url: pageUrl,
    last_seen: new Date().toISOString(),
    raw: { '@type': node['@type'] }
  };
  if (!out.name) return null;
  if (!isHttpUrl(out.url) && !isHttpUrl(out.source_url)) return null;
  return out;
}
export function extractServiceItemsFromHtml(html, pageUrl) {
  const items = [];
  extractJsonLdBlocks(html).forEach((txt, i) => {
    const data = tryParseJSON(txt, i); if (!data) return;
    (Array.isArray(data) ? data : [data]).forEach(root => {
      collectNodesByType(root, SERVICE_TYPES, []).forEach(n => {
        const norm = normaliseServiceNode(n, pageUrl);
        if (norm) items.push(norm);
      });
    });
  });
  const seen = new Set(), dedup = [];
  for (const it of items) {
    const k = `${it.name}|${it.url}`;
    if (!seen.has(k)) { seen.add(k); dedup.push(it); }
  }
  return dedup;
}
export async function extractServiceItemsFromUrl(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'alanranger-bot/1.0 (+content-extract)' } });
  const html = await res.text();
  return extractServiceItemsFromHtml(html, url);
}

/* -------------------------- One-shot convenience API ---------------------- */
export async function extractAllFromUrl(url, today = new Date()) {
  const res = await fetch(url, { headers: { 'User-Agent': 'alanranger-bot/1.0 (+content-extract)' } });
  const html = await res.text();
  return {
    events:   extractEventItemsFromHtml(html, url, today),
    articles: extractArticleItemsFromHtml(html, url),
    products: extractProductItemsFromHtml(html, url),
    services: extractServiceItemsFromHtml(html, url),
  };
}
