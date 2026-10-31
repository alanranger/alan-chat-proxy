import test from 'node:test';
import assert from 'node:assert/strict';
import { splitNonEventDuplicates } from '../lib/entity-dedupe.js';

const U = 'https://www.alanranger.com/photo-workshops-uk/long-exposure-photography-kenilworth';
const norm = (u) => u.replace(/\/+$/, '');

test('keeps the CSV-linked row and marks the stale site_urls row as extra (Kenilworth case)', () => {
  const rows = [
    { id: 256785, url: U, kind: 'product', csv_metadata_id: 179922, last_seen: '2026-10-31T08:59:01Z' },
    { id: 257675, url: U, kind: 'event', csv_metadata_id: 179922, last_seen: '2026-10-31T08:59:01Z' },
    { id: 273415, url: U, kind: 'product', csv_metadata_id: null, last_seen: '2026-10-25T15:10:27Z' }
  ];
  const { keep, extras } = splitNonEventDuplicates(rows, norm);
  assert.deepEqual(extras.map((r) => r.id), [273415]);
  assert.deepEqual(keep.map((r) => r.id), [256785]);
});

test('events are never touched; single rows and different kinds are kept', () => {
  const rows = [
    { id: 1, url: U, kind: 'event', last_seen: '2026-10-01' },
    { id: 2, url: U, kind: 'event', last_seen: '2026-10-02' },
    { id: 3, url: U, kind: 'product', csv_metadata_id: 9 },
    { id: 4, url: U, kind: 'article', csv_metadata_id: 9 }
  ];
  assert.deepEqual(splitNonEventDuplicates(rows, norm).extras, []);
});

test('slash twins count as the same page; newest wins when neither is CSV-linked', () => {
  const rows = [
    { id: 10, url: U, kind: 'product', last_seen: '2026-10-01' },
    { id: 11, url: `${U}/`, kind: 'product', last_seen: '2026-10-20' }
  ];
  assert.deepEqual(splitNonEventDuplicates(rows, norm).extras.map((r) => r.id), [10]);
});
