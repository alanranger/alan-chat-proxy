// /json/content-extract.js
// Generic JSON-LD extractors for Article, Product, and Service,
// plus a convenience `extractAllFromUrl`.
// Pure helpers — NO DB writes. Safe to import from /api routes.

//
// ---------- tiny utils ----------
//
function isHttpUrl(u) {
  try { const x = new URL(String(u)); return x.protocol === "http:" || x.protocol === "https:"; }
  catch { return false; }
}

function tryParseJSON(text, idx = 0) {
  try { return JSON.parse(text); }
  catch {
    try {
      const cleaned = text.replace(/<!--[\s\S]*?-->/g, "").trim();
      return JSON.parse(cleaned);
    } catch (e2) {
      console.error("[content-extract] JSON-LD parse failed at block", idx, e2?.message);
      return null;
    }
  }
}

function extractJsonLdBlocks(html) {
  const blocks = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) blocks.push(m[1]);
  return blocks;
}

function normaliseText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return "";
}

function asArray(x) { return Array.isArray(x) ? x : (x ? [x] : []); }

function fetchHtml(url) {
  return fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-GB,en;q=0.9",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Referer": (() => { try { return new URL(url).origin; } catch { return undefined; } })(),
    },
    redirect: "follow",
  }).then(async (r) => {
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      throw new Error(`fetch_failed:${r.status}:${body.slice(0, 240)}`);
    }
    return r.text();
  });
}

//
// ---------- collectors (generic) ----------
//
const TYPE = {
  ARTICLE: new Set(["Article", "NewsArticle", "BlogPosting"]),
  PRODUCT: new Set(["Product"]),
  SERVICE: new Set(["Service"]),
};

function hasAnyType(node, typeSet) {
  const t = node && node["@type"];
  const arr = Array.isArray(t) ? t : (t ? [t] : []);
  return arr.some((x) => typeSet.has(String(x)));
}

function collectNodesByType(root, typeSet, out = []) {
  if (!root || typeof root !== "object") return out;

  // handle @graph
  if (Array.isArray(root["@graph"])) {
    root["@graph"].forEach((n) => collectNodesByType(n, typeSet, out));
  }

  // this node
  if (hasAnyType(root, typeSet)) out.push(root);

  // recurse
  if (Array.isArray(root)) {
    root.forEach((n) => collectNodesByType(n, typeSet, out));
  } else {
    for (const k of Object.keys(root)) {
      if (k === "@graph") continue;
      const v = root[k];
      if (v && typeof v === "object") collectNodesByType(v, typeSet, out);
    }
  }
  return out;
}

//
// ---------- normalisers per type ----------
//
function normaliseUrlPref(node, pageUrl) {
  const cands = [
    node?.url,
    node?.["@id"],
    node?.mainEntityOfPage,
    node?.item?.["@id"],
    pageUrl,
  ];
  for (const c of cands) {
    const s = typeof c === "string" ? c : (typeof c === "object" ? c?.["@id"] : "");
    if (isHttpUrl(s)) return s.trim();
  }
  return pageUrl;
}

// Article / BlogPosting
function normaliseArticle(node, pageUrl) {
  const out = {
    kind: "article",
    title: normaliseText(node?.headline || node?.name || node?.title),
    url: normaliseUrlPref(node, pageUrl),
    description: normaliseText(node?.description),
    author: normaliseText(
      node?.author?.name ||
      (Array.isArray(node?.author) ? node.author.map(a => a?.name).filter(Boolean).join(", ") : "")
    ),
    date_published: normaliseText(node?.datePublished || node?.dateCreated),
    date_modified: normaliseText(node?.dateModified),
    source_url: pageUrl,
    raw: { "@type": node?.["@type"], headline: node?.headline, datePublished: node?.datePublished },
  };
  if (!out.title) out.title = normaliseText(node?.name) || "(untitled)";
  return out;
}

// Product
function normaliseProduct(node, pageUrl) {
  const offers = Array.isArray(node?.offers) ? node.offers[0] : node?.offers || {};
  const out = {
    kind: "product",
    title: normaliseText(node?.name),
    url: normaliseUrlPref(node, pageUrl),
    description: normaliseText(node?.description),
    sku: normaliseText(node?.sku),
    price: (offers && (offers.price || offers.lowPrice || offers.highPrice)) ?? undefined,
    priceCurrency: normaliseText(offers?.priceCurrency),
    availability: normaliseText(offers?.availability),
    source_url: pageUrl,
    raw: { "@type": node?.["@type"], offers: !!node?.offers },
  };
  if (!out.title) out.title = "(untitled product)";
  return out;
}

// Service
function normaliseService(node, pageUrl) {
  const areaServed = node?.areaServed;
  const area = typeof areaServed === "string"
    ? areaServed
    : (Array.isArray(areaServed) ? areaServed.map(a => a?.name || a).filter(Boolean).join(", ") : normaliseText(areaServed?.name));
  const out = {
    kind: "service",
    title: normaliseText(node?.name || node?.serviceType),
    url: normaliseUrlPref(node, pageUrl),
    description: normaliseText(node?.description),
    serviceType: normaliseText(node?.serviceType),
    areaServed: normaliseText(area),
    provider: normaliseText(node?.provider?.name),
    source_url: pageUrl,
    raw: { "@type": node?.["@type"] },
  };
  if (!out.title) out.title = "(service)";
  return out;
}

//
// ---------- extract from HTML ----------
//
function extractFromHtml(html, pageUrl) {
  const scripts = extractJsonLdBlocks(html);
  const articles = [];
  const products = [];
  const services = [];

  scripts.forEach((jsonText, idx) => {
    const data = tryParseJSON(jsonText, idx);
    if (!data) return;

    const roots = Array.isArray(data) ? data : [data];

    for (const root of roots) {
      const aNodes = collectNodesByType(root, TYPE.ARTICLE, []);
      const pNodes = collectNodesByType(root, TYPE.PRODUCT, []);
      const sNodes = collectNodesByType(root, TYPE.SERVICE, []);
      aNodes.forEach((n) => articles.push(normaliseArticle(n, pageUrl)));
      pNodes.forEach((n) => products.push(normaliseProduct(n, pageUrl)));
      sNodes.forEach((n) => services.push(normaliseService(n, pageUrl)));
    }
  });

  // Dedup by title+url to avoid repeats
  function dedup(arr) {
    const seen = new Set(); const out = [];
    for (const it of arr) {
      const key = `${it.title}|${it.url}`;
      if (!seen.has(key)) { seen.add(key); out.push(it); }
    }
    return out;
  }

  return {
    articles: dedup(articles),
    products: dedup(products),
    services: dedup(services),
  };
}

//
// ---------- public helpers (URL -> items) ----------
//
export async function extractArticleItemsFromUrl(url) {
  if (!isHttpUrl(url)) throw new Error("bad_url");
  const html = await fetchHtml(url);
  return extractFromHtml(html, url).articles;
}

export async function extractProductItemsFromUrl(url) {
  if (!isHttpUrl(url)) throw new Error("bad_url");
  const html = await fetchHtml(url);
  return extractFromHtml(html, url).products;
}

export async function extractServiceItemsFromUrl(url) {
  if (!isHttpUrl(url)) throw new Error("bad_url");
  const html = await fetchHtml(url);
  return extractFromHtml(html, url).services;
}

export async function extractAllFromUrl(url) {
  if (!isHttpUrl(url)) throw new Error("bad_url");
  const html = await fetchHtml(url);
  return extractFromHtml(html, url);
}
