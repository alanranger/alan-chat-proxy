/**
 * Auto prep for bulk ingest: transform 04 RATINGS → 07 product_schema rows,
 * and normalise raw Squarespace product exports into workshop_products rows.
 */

function hasType(node, t) {
  return [node?.['@type']].flat().includes(t);
}

function parseLdJsonBlocks(html) {
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  const blocks = [];
  let m;
  while ((m = re.exec(String(html || ''))) !== null) {
    const inner = m[1].trim();
    if (!inner.startsWith('{') && !inner.startsWith('[')) continue;
    try { blocks.push(JSON.parse(inner)); } catch { /* skip */ }
  }
  return blocks;
}

function collectNodes(parsed) {
  const nodes = [];
  const push = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o['@graph'])) nodes.push(...o['@graph']);
    else nodes.push(o);
  };
  if (Array.isArray(parsed)) parsed.forEach(push);
  else push(parsed);
  return nodes;
}

function pickProductNode(parsed) {
  const nodes = collectNodes(parsed);
  return nodes.find((n) => hasType(n, 'Product'))
    || nodes.find((n) => hasType(n, 'Course'))
    || nodes.find((n) => hasType(n, 'Event'))
    || nodes.find((n) => n?.url)
    || null;
}

function extractJsonLd(html) {
  for (const parsed of parseLdJsonBlocks(html)) {
    const node = pickProductNode(parsed);
    if (node?.url) {
      return `<script type="application/ld+json">\n${JSON.stringify(node, null, 2)}\n</script>`;
    }
  }
  return null;
}

function rowKeys(row) {
  return Object.keys(row || {}).map((k) => k.replace(/^\uFEFF/, '').trim().toLowerCase());
}

/** True when uploaded CSV is 04 … RATINGS shape (needs transform to 07). */
export function isProductSchemaSource04(rows) {
  const keys = rowKeys(rows?.[0]);
  return keys.includes('product_name') && keys.includes('schema_html');
}

function titleAndHtml(row) {
  return {
    title: String(row.product_name || row.Product_Name || '').trim(),
    html: row.schema_html || row.Schema_Html || ''
  };
}

function as07Row(title, jsonLd) {
  return {
    Title: title,
    'JSON-LD Structured Data': jsonLd,
    title,
    'json-ld structured data': jsonLd
  };
}

/** Convert 04 rows → 07-shaped objects. */
export function transform04To07Rows(rows) {
  const out = [];
  let skipped = 0;
  for (const row of rows || []) {
    const { title, html } = titleAndHtml(row);
    const jsonLd = extractJsonLd(html);
    if (title && jsonLd) out.push(as07Row(title, jsonLd));
    else skipped += 1;
  }
  return { rows: out, skipped, source: '04_ratings' };
}

function getField(row, names) {
  for (const n of names) {
    if (row[n] != null && String(row[n]).trim() !== '') return row[n];
    const hit = Object.keys(row || {}).find((k) => k.replace(/^\uFEFF/, '').trim().toLowerCase() === n.toLowerCase());
    if (hit && row[hit] != null && String(row[hit]).trim() !== '') return row[hit];
  }
  return '';
}

/** Raw Squarespace export has Product Page / Product Url columns. */
export function isRawWorkshopProductExport(rows) {
  const keys = rowKeys(rows?.[0]);
  return keys.includes('product page') || keys.includes('product url');
}

function isHiddenVis(vis) {
  const v = String(vis || 'Yes').trim().toLowerCase();
  return v === 'no' || v === 'false' || v === 'hidden' || v === '0';
}

function fullUrlFromRaw(row) {
  const slug = String(getField(row, ['Product Url', 'product url', 'Url Id', 'url id'])).trim()
    .replace(/^\/+|\/+$/g, '');
  const full = String(getField(row, ['Full Url', 'full url', 'url'])).trim();
  if (full) return full;
  return slug ? `https://www.alanranger.com/photo-workshops-uk/${slug}` : '';
}

function toWorkshopProductRow(row, full) {
  const title = getField(row, ['Title', 'title']);
  const cats = getField(row, ['Categories', 'categories']);
  const tags = getField(row, ['Tags', 'tags']);
  const image = getField(row, ['Hosted Image Url', 'hosted image url', 'Image', 'image']);
  return {
    ...row,
    Title: title, title,
    'Full Url': full, 'full url': full, url: full,
    Categories: cats, categories: cats,
    Tags: tags, tags,
    Image: image, image,
    Visible: 'Yes', visible: 'Yes'
  };
}

function keepRawProductRow(row, seen) {
  const page = String(getField(row, ['Product Page', 'product page'])).trim();
  if (page && page !== 'photo-workshops-uk') return { skip: 'page' };
  if (isHiddenVis(getField(row, ['Visible', 'visible', 'Visibility']))) return { skip: 'hidden' };
  const full = fullUrlFromRaw(row);
  if (!full || seen.has(full)) return { skip: 'dup' };
  seen.add(full);
  return { row: toWorkshopProductRow(row, full) };
}

function filterRawProductRows(rows) {
  const out = [];
  const counts = { skipped_hidden: 0, skipped_page: 0 };
  const seen = new Set();
  for (const row of rows || []) {
    const r = keepRawProductRow(row, seen);
    if (r.skip === 'page') counts.skipped_page += 1;
    else if (r.skip === 'hidden') counts.skipped_hidden += 1;
    else if (!r.skip) out.push(r.row);
  }
  return { rows: out, ...counts, source: 'raw_export' };
}

/** Filter raw export → workshop_products; filtered 05 files pass through. */
export function normaliseWorkshopProductRows(rows) {
  if (!isRawWorkshopProductExport(rows)) {
    return { rows: rows || [], skipped_hidden: 0, skipped_page: 0, source: 'filtered_05' };
  }
  return filterRawProductRows(rows);
}
