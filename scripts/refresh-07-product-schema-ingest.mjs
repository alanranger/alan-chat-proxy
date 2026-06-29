/**
 * Refresh csv/07-product-schema-with-review-ratings.csv (chat ingest format)
 * from the freshly-generated product-schema source.
 *
 * Source : alan-shared-resources/csv processed/04 – ...FINAL_WITH_REVIEW_RATINGS.csv
 *          (columns: product_name, url, schema_html, review_count, average_rating, ...)
 * Output : alan-shared-resources/csv/07-product-schema-with-review-ratings.csv
 *          (columns: Title, JSON-LD Structured Data)
 *
 * Why: 07 is a generated ingest artifact, not a Squarespace export. When 04 is
 * regenerated (new products / review ratings), 07 must be rebuilt or the chat
 * ingest overwrites newer DB data with a stale March file.
 *
 * Usage: node scripts/refresh-07-product-schema-ingest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const SHARED = 'G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources';
const SRC_DIR = path.join(SHARED, 'csv processed');
const OUT_PATH = path.join(SHARED, 'csv', '07-product-schema-with-review-ratings.csv');

function resolveSourceFile() {
  const match = fs.readdirSync(SRC_DIR).find(n => /04.*RATINGS\.csv$/i.test(n));
  if (!match) throw new Error(`Could not find "04 … RATINGS.csv" in ${SRC_DIR}`);
  return path.join(SRC_DIR, match);
}

// Minimal RFC-4180 parser (handles quoted fields, escaped quotes, embedded newlines).
function parseCsv(text) {
  const rows = [];
  let record = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else if (c === '"') { inQuotes = true; }
    else if (c === ',') { record.push(field); field = ''; }
    else if (c === '\n') { record.push(field); rows.push(record); record = []; field = ''; }
    else { field += c; }
  }
  if (field !== '' || record.length > 0) { record.push(field); rows.push(record); }
  return rows;
}

// Parse every real JSON-LD <script> block (skips the suppressor JS, which only
// references the ld+json string inside a CSS selector, not a <script type=…> tag).
function parseLdJsonBlocks(html) {
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  const blocks = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const inner = m[1].trim();
    if (inner.startsWith('{') || inner.startsWith('[')) {
      try { blocks.push(JSON.parse(inner)); } catch { /* not the schema block */ }
    }
  }
  return blocks;
}

const hasType = (node, t) => [node?.['@type']].flat().includes(t);

// The 04 generator emits a unified @graph (Organization → LocalBusiness →
// BreadcrumbList → Product). The chat importer expects a FLAT object with a
// top-level url/image/description, so lift the Product (or Course/Event) node out.
function pickProductNode(parsed) {
  const nodes = [];
  const collect = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o['@graph'])) nodes.push(...o['@graph']);
    else nodes.push(o);
  };
  if (Array.isArray(parsed)) parsed.forEach(collect); else collect(parsed);
  return nodes.find(n => hasType(n, 'Product'))
    || nodes.find(n => hasType(n, 'Course'))
    || nodes.find(n => hasType(n, 'Event'))
    || nodes.find(n => n?.url)
    || null;
}

// Returns the flat Product node serialised as a JSON-LD <script> block (the exact
// shape the old 07 used, so the importer reads url/image/description and keeps
// aggregateRating/review in json_ld_data), or null if none found.
function extractJsonLd(html) {
  for (const parsed of parseLdJsonBlocks(html)) {
    const node = pickProductNode(parsed);
    if (node?.url) {
      return `<script type="application/ld+json">\n${JSON.stringify(node, null, 2)}\n</script>`;
    }
  }
  return null;
}

function csvField(value) {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function backupExisting() {
  if (!fs.existsSync(OUT_PATH)) return null;
  const stamp = new Date().toISOString().slice(0, 10);
  const backup = OUT_PATH.replace(/\.csv$/, `.backup-${stamp}.csv`);
  fs.copyFileSync(OUT_PATH, backup);
  return backup;
}

function buildRows(records) {
  const header = records[0].map(h => h.trim());
  const nameIdx = header.indexOf('product_name');
  const htmlIdx = header.indexOf('schema_html');
  if (nameIdx === -1 || htmlIdx === -1) {
    throw new Error(`Source missing product_name/schema_html columns. Got: ${header.join(', ')}`);
  }
  const out = [];
  let skipped = 0;
  for (let i = 1; i < records.length; i++) {
    const title = (records[i][nameIdx] || '').trim();
    const jsonLd = extractJsonLd(records[i][htmlIdx] || '');
    if (title && jsonLd) out.push([title, jsonLd]);
    else skipped++;
  }
  return { out, skipped };
}

function main() {
  const srcPath = resolveSourceFile();
  console.log(`Source: ${path.basename(srcPath)}`);
  const text = fs.readFileSync(srcPath, 'utf8').replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  const records = parseCsv(text);
  const { out, skipped } = buildRows(records);

  if (out.length === 0) throw new Error('No valid rows produced — aborting (would empty the ingest file).');

  const lines = ['Title,JSON-LD Structured Data'];
  for (const [title, jsonLd] of out) lines.push(`${csvField(title)},${csvField(jsonLd)}`);

  const backup = backupExisting();
  fs.writeFileSync(OUT_PATH, lines.join('\n') + '\n', 'utf8');

  console.log(`Backup : ${backup ? path.basename(backup) : '(none — no prior file)'}`);
  console.log(`Written: ${out.length} products → ${path.basename(OUT_PATH)}`);
  console.log(`Skipped: ${skipped} source rows (no parseable JSON-LD)`);
}

main();
