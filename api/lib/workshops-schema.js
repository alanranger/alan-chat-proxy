// /api/lib/workshops-schema.js
export const isHttpUrl = (u) => /^https?:\/\/[^\s]+$/i.test(String(u || ''));

const z2 = (n) => String(n).padStart(2, '0');

/** Coerce e.g. "21 March" to the next future ISO date. Accepts ISO passthrough. */
export function coerceFutureISODate(input, today = new Date()) {
  if (!input) return null;
  const iso = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;

  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const m = String(input).toLowerCase().match(/(\d{1,2})\s+([a-z]+)/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monIdx = MONTHS.findIndex(abbr => m[2].startsWith(abbr));
  if (monIdx < 0) return null;

  const yearNow = today.getFullYear();
  let candidate = new Date(Date.UTC(yearNow, monIdx, day));
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  if (candidate < todayUTC) candidate = new Date(Date.UTC(yearNow + 1, monIdx, day));
  return `${candidate.getUTCFullYear()}-${z2(candidate.getUTCMonth() + 1)}-${z2(candidate.getUTCDate())}`;
}
