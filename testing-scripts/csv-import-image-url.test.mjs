// The CSV import keeps image URLs (Oct 2025 – Nov 2026 they went through cleanHTMLText, whose noise filter drops any
// line containing squarespace-cdn.com, so every image_url was stored as ''). Real 01/02/03/04/05/07 CSVs from
// alan-shared-resources, a fake Supabase client (records writes, never touches a database).
// Run: node --test testing-scripts/csv-import-image-url.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cleanImageUrl, __test } from '../api/csv-import.js';

const CSV = 'G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/csv';
const read = (f) => fs.readFileSync(`${CSV}/${f}`, 'utf8');

/** Every query resolves { data: [], error: null }; inserted / upserted rows are recorded. */
function fakeSupa() {
  const written = [];
  const chain = () => new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') return (res) => res({ data: [], error: null, count: 0 });
      return (...args) => {
        if (prop === 'insert' || prop === 'upsert') written.push(...[].concat(args[0]));
        return chain();
      };
    }
  });
  return { supa: { from: () => chain(), rpc: () => chain() }, written };
}

test('cleanImageUrl: keeps a Squarespace CDN URL; first entry of arrays / objects; anything else is null', () => {
  const url = 'https://images.squarespace-cdn.com/content/v1/5013f4b2c4aaa4752ac69b17/abc/photo.jpg';
  assert.equal(cleanImageUrl(url), url);
  assert.equal(cleanImageUrl(`  ${url}  https://second.example/x.jpg `), url);
  assert.equal(cleanImageUrl([url, 'https://x.example/2.jpg']), url);
  assert.equal(cleanImageUrl({ url }), url);
  assert.equal(cleanImageUrl([{ url }]), url);
  for (const bad of ['', '   ', null, undefined, 'photo.jpg', '//images.squarespace-cdn.com/x.jpg', 'Alan Ranger Photography', {}, []]) assert.equal(cleanImageUrl(bad), null, String(bad));
});

const CASES = [
  ['blog', '01-blog-posts.csv', 'importBlogMetadata'],
  ['course_events', '02-beginners-photography-lessons.csv', 'importCourseEventMetadata'],
  ['workshop_events', '03-photographic-workshops-near-me.csv', 'importWorkshopEventMetadata'],
  ['course_products', '04-photography-services-courses-mentoring.csv', 'importCourseProductMetadata'],
  ['workshop_products', '05-photo-workshops-uk-landscape.csv', 'importWorkshopProductMetadata'],
  ['product_schema', '07-product-schema-with-review-ratings.csv', 'importProductSchemaMetadata']
];

for (const [type, file, fn] of CASES) {
  test(`${type} (${file}): every row with an image cell keeps its URL; fields_found.image_url = those rows`, async () => {
    const rows = __test.parseCSV(read(file));
    const { supa, written } = fakeSupa();
    const out = await __test[fn](rows, supa);
    const mine = written.filter((r) => r.csv_type === type);
    assert.ok(mine.length > 0, 'rows were written');
    const withUrl = mine.filter((r) => /^https:\/\/images\.squarespace-cdn\.com\//.test(r.image_url || ''));
    assert.ok(withUrl.length / mine.length > 0.9, `${withUrl.length} of ${mine.length} rows kept a squarespace-cdn URL`);
    assert.ok(mine.every((r) => r.image_url === null || /^https?:\/\//.test(r.image_url)), 'never an empty string');
    if (out.field_stats) assert.equal(out.field_stats.fields_found.image_url, withUrl.length + mine.filter((r) => r.image_url && !withUrl.includes(r)).length);
  });
}
