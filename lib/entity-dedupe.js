/**
 * Non-event page_entities: one row per URL + kind. When a page already has more than one (e.g. an old
 * `site_urls` row next to the CSV-linked one), keep the CSV-linked, most recently seen row; the rest are extras
 * to delete. Events are handled per date elsewhere and are ignored here.
 */
const rankKey = (r) => [r.csv_metadata_id ? 1 : 0, String(r.last_seen || ''), Number(r.id) || 0];

function better(a, b) {
  const [ca, sa, ia] = rankKey(a);
  const [cb, sb, ib] = rankKey(b);
  if (ca !== cb) return cb - ca;
  if (sa !== sb) return sb.localeCompare(sa);
  return ib - ia;
}

const isNonEvent = (r) => Boolean(r?.url && r.kind && r.kind !== 'event');

function groupByPage(rows, normalizeUrl) {
  const groups = new Map();
  for (const r of rows.filter(isNonEvent)) {
    const key = `${normalizeUrl(r.url)}|${r.kind}`;
    groups.set(key, [...(groups.get(key) || []), r]);
  }
  return groups;
}

export function splitNonEventDuplicates(rows, normalizeUrl = (u) => u) {
  const groups = groupByPage(rows || [], normalizeUrl);
  const keep = [];
  const extras = [];
  for (const group of groups.values()) {
    group.sort(better);
    keep.push(group[0]);
    extras.push(...group.slice(1));
  }
  return { keep, extras };
}
