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

/** html-to-text selectors — skip SS mobile drawer + share blocks (2026-06-12). */
export const HTML_TO_TEXT_SKIP_SELECTORS = [
  { selector: "script", format: "skip" },
  { selector: "style", format: "skip" },
  { selector: "nav", format: "skip" },
  { selector: "footer", format: "skip" },
  { selector: "header", format: "skip" },
  { selector: "img", format: "skip" },
  { selector: ".navigation", format: "skip" },
  { selector: ".menu", format: "skip" },
  { selector: ".social", format: "skip" },
  { selector: ".Mobile", format: "skip" },
  { selector: ".ProductItem-details-share", format: "skip" },
  { selector: ".Share-buttons", format: "skip" },
];
