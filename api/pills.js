// api/pills.js
// Builds the four orange pills on the server:
// Book Now / Event Listing / More Workshops / Photos

function urlSafe(u) {
  try { return u ? new URL(u) : null; } catch { return null; }
}

/** Derive the workshops index URL from a product/event URL (no hard-coding). */
function deriveWorkshopsIndex(productUrl, eventUrl) {
  const u = urlSafe(productUrl) ?? urlSafe(eventUrl);
  if (!u) return null;
  const segs = u.pathname.split('/').filter(Boolean);
  const idx = segs.findIndex((s) => /workshop/i.test(s));
  if (idx >= 0) {
    const path = '/' + segs.slice(0, idx + 1).join('/') + '/';
    return u.origin + path;
  }
  const base = u.pathname.endsWith('/') ? u.pathname.slice(0, -1) : u.pathname;
  const parent = base.substring(0, base.lastIndexOf('/') + 1);
  return u.origin + (parent || '/');
}

/** Helper to read strings out of Supabase selects. */
async function pickUrls(q) {
  const { data, error } = await q;
  if (error) return [];
  const out = [];
  for (const row of data || []) {
    for (const k of Object.keys(row)) {
      const v = row[k];
      if (typeof v === 'string' && v) out.push(v);
    }
  }
  return out;
}

/** Find best gallery landing URL; fallback to /search?query=gallery on same origin. */
async function getPhotosUrl(supabase, productUrl, eventUrl) {
  const origin = (urlSafe(productUrl) ?? urlSafe(eventUrl))?.origin || null;

  const buckets = await Promise.all([
    pickUrls(supabase.from('page_entities').select('url, page_url, source_url').ilike('url', '%/gallery%')),
    pickUrls(supabase.from('page_entities_clean').select('url, page_url, source_url').ilike('url', '%/gallery%')),
    pickUrls(supabase.from('page_entities_backup_utc').select('url, page_url, source_url').ilike('url', '%/gallery%')),
    pickUrls(supabase.from('page_chunks').select('url').ilike('url', '%/gallery%')),
    pickUrls(supabase.from('chunks').select('url, source_url').or('url.ilike.%/gallery%,source_url.ilike.%/gallery%')),
    pickUrls(supabase.from('events_enriched').select('url, page_url, source_url')
      .or('url.ilike.%/gallery%,page_url.ilike.%/gallery%,source_url.ilike.%/gallery%')),
  ]);

  const all = [...new Set(buckets.flat().filter(Boolean))];

  const sameOrigin = all.filter(u => !origin || urlSafe(u)?.origin === origin);
  sameOrigin.sort((a, b) => {
    const sa = scoreGallery(a), sb = scoreGallery(b);
    return sa - sb || a.length - b.length;
  });

  if (sameOrigin.length) return sameOrigin[0];
  if (origin) return `${origin}/search?query=gallery`;
  return 'https://www.alanranger.com/search?query=gallery';
}

function scoreGallery(u) {
  const s = u.toLowerCase();
  if (s.includes('gallery-image-portfolios')) return 0;     // your hub page
  if (/\/gallery(\/|$)/.test(s)) return 1;                  // clean /gallery root
  return 2;                                                 // other gallery paths
}

/** Main builder */
async function buildPills({ supabase, product, firstEvent }) {
  const productUrl = product?.url || product?.page_url || product?.source_url || null;
  const eventUrl   = firstEvent?.page_url || firstEvent?.source_url || null;

  const pills = [];
  if (productUrl) pills.push({ label: 'Book Now', url: productUrl, brand: true });
  if (eventUrl)   pills.push({ label: 'Event Listing', url: eventUrl, brand: true });

  const more = deriveWorkshopsIndex(productUrl, eventUrl);
  if (more) pills.push({ label: 'More Workshops', url: more });

  const photos = await getPhotosUrl(supabase, productUrl, eventUrl);
  if (photos) pills.push({ label: 'Photos', url: photos });

  // de-dup
  const seen = new Set();
  return pills.filter(p => (p.url && !seen.has(p.url) && seen.add(p.url))).slice(0, 4);
}

module.exports = {
  buildPills,
  deriveWorkshopsIndex, // exported for tests/debug
};
