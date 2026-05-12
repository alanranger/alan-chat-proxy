/**
 * Squarespace header/nav noise that sometimes survives HTML extraction and pollutes embeddings.
 * Version bump when marketers change wording (audit trail for regression tests).
 */
export const SQUARESPACE_NAV_SIGNATURE_VERSION = 1;

export const KNOWN_NAV_SIGNATURE_PHRASES = [
  "sign in",
  "my account",
  "searchback",
  "which photography courses are best",
];

export function stripKnownSquarespaceNavNoise(text) {
  if (!text || typeof text !== "string") return text;
  let out = text;
  for (const phrase of KNOWN_NAV_SIGNATURE_PHRASES) {
    const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(esc, "gi"), " ");
  }
  return out.replace(/\s+/g, " ").trim();
}

export function chunkLooksLikeCollapsedSiteNav(text) {
  const raw = text || "";
  const low = raw.toLowerCase();
  let hits = 0;
  for (const phrase of KNOWN_NAV_SIGNATURE_PHRASES) {
    if (low.includes(phrase)) hits++;
  }
  const lotsOfSlashes = (raw.match(/\//g) || []).length > 20;
  return hits >= 2 || lotsOfSlashes;
}
