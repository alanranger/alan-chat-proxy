// /api/json/content-extract.js
// Pure helpers for Article, Product, Service + a combined extractAllFromUrl.
// No DB writes here.

import { extractEventItemsFromUrl } from './events-extract.js';

function tryParseJSON(text, index = 0) {
  try { return JSON.parse(text); }
  catch {
    const cleaned = text.replace(/<!--.*?-->/gs, '').trim();
    try { return JSON.parse(cleaned); }
    catch (err) {
      console.error('[content-extract] JSON-LD parse error at block', index, err?.message);
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

function collectNodesByType(root, wantedTypes, out = []) {
  if (!root || typeof root !== 'object') return out;

  if (Array.isArray(root['@graph'])) {
    root['@graph'].forEach(n => collectNodesByType(n, wantedTypes, out));
  }

  const typeVal = root['@type'];
  if (typeVal) {
    const types = Array.isArray(typeVal) ? typeVal : [typeVal];
    if (types.some(t => wantedTypes.has(String(t)))) out.push(root);
  }

  if (Array.isArray(root)) {
    root.forEach(n => collectNodesByType(n, wantedTypes, out));
  } else {
    for (const k of Object.keys(root)) {
      if (k === '@graph') continue;
      const v = root[k];
      if (v && typeof v === 'object') collectNodesByType(v, wantedTypes, out);
    }
  }
  return out;
}

function firstString(...candidates) {
  for (const v of candidates) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/* -------------------- Article -------------------- */
const ARTICLE_TYPES = new Set(['Article', 'BlogPosting', 'NewsArticle']);

function normaliseArticle(node, pageUrl) {
  const title = firstString(node.headline, node.name, node.title);
  if (!title) return null;

  return {
    kind: 'article',
    title,
    description: firstString(node.description),
    author: node.author?.name || node.author || null,
    date_published: firstString(node.datePublished, node.date_published),
    date_modified: firstString(node.dateModified, node.date_modified),
    url: firstString(node.url, node['@id'], pageUrl),
    source_url: pageUrl,
    raw: { '@type': node['@type'], headline: node.headline || node.name || undefined, datePublished: node.datePublished || undefined }
  };
}

export function extractArticlesFromHtml(html, pageUrl) {
  const out = [];
  extractJsonLdBlocks(html).forEach((jsonText, i) => {
    const data = tryParseJSON(jsonText, i); if (!data) return;
    const roots = Array.isArray(data) ? data : [data];
    roots.forEach(r => {
      const nodes = collectNodesByType(r, ARTICLE_TYPES, []);
      nodes.forEach(n => { const a = normaliseArticle(n, pageUrl); if (a) out.push(a); });
    });
  });
  return out;
}

export async function extractArticlesFromUrl(url) {
  const res = await fetch(url); const html = await res.text();
  return extractArticlesFromHtml(html, url);
}

/* -------------------- Product -------------------- */
const PRODUCT_TYPES = new Set(['Product', 'Offer']);

function normaliseProduct(node, pageUrl) {
  const title = firstString(node.name, node.title);
  if (!title) return null;

  const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
  return {
    kind: 'product',
    title,
    description: firstString(node.description),
    sku: firstString(node.sku),
    price: offers?.price ?? node.price ?? null,
    priceCurrency: offers?.priceCurrency ?? node.priceCurrency ?? null,
    availability: offers?.availability ?? null,
    url: firstString(node.url, node['@id'], pageUrl),
    source_url: pageUrl,
    raw: { '@type': node['@type'], offers: !!node.offers }
  };
}

export function extractProductsFromHtml(html, pageUrl) {
  const out = [];
  extractJsonLdBlocks(html).forEach((jsonText, i) => {
    const data = tryParseJSON(jsonText, i); if (!data) return;
    const roots = Array.isArray(data) ? data : [data];
    roots.forEach(r => {
      const nodes = collectNodesByType(r, PRODUCT_TYPES, []);
      nodes.forEach(n => { const p = normaliseProduct(n, pageUrl); if (p) out.push(p); });
    });
  });
  return out;
}

export async function extractProductsFromUrl(url) {
  const res = await fetch(url); const html = await res.text();
  return extractProductsFromHtml(html, url);
}

/* -------------------- Service -------------------- */
const SERVICE_TYPES = new Set(['Service']);

function normaliseService(node, pageUrl) {
  const title = firstString(node.name, node.title);
  if (!title) return null;

  return {
    kind: 'service',
    title,
    description: firstString(node.description),
    provider: node.provider?.name || node.provider || null,
    areaServed: firstString(node.areaServed),
    serviceType: firstString(node.serviceType),
    url: firstString(node.url, node['@id'], pageUrl),
    source_url: pageUrl,
    raw: { '@type': node['@type'] }
  };
}

export function extractServicesFromHtml(html, pageUrl) {
  const out = [];
  extractJsonLdBlocks(html).forEach((jsonText, i) => {
    const data = tryParseJSON(jsonText, i); if (!data) return;
    const roots = Array.isArray(data) ? data : [data];
    roots.forEach(r => {
      const nodes = collectNodesByType(r, SERVICE_TYPES, []);
      nodes.forEach(n => { const s = normaliseService(n, pageUrl); if (s) out.push(s); });
    });
  });
  return out;
}

export async function extractServicesFromUrl(url) {
  const res = await fetch(url); const html = await res.text();
  return extractServicesFromHtml(html, url);
}

/* -------------------- Combined -------------------- */
export async function extractAllFromUrl(url) {
  const [events, articles, products, services] = await Promise.all([
    extractEventItemsFromUrl(url).catch(() => []),
    extractArticlesFromUrl(url).catch(() => []),
    extractProductsFromUrl(url).catch(() => []),
    extractServicesFromUrl(url).catch(() => []),
  ]);

  return {
    ok: true,
    url,
    events,
    articles,
    products,
    services,
    counts: {
      events: events.length,
      articles: articles.length,
      products: products.length,
      services: services.length,
    }
  };
}
