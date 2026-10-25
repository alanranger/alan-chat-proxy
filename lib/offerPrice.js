/**
 * Resolve a single GBP price from a schema.org `offers` value.
 *
 * Squarespace product pages emit an AggregateOffer (lowPrice/highPrice, no
 * `price`). It is computed from the live variants, so it already honours the
 * On Sale flag — a stale Sale Price on a variant with On Sale = No is ignored.
 */
function positiveNumber(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function priceFromOffer(offer) {
  if (!offer || typeof offer !== 'object') return null;
  return positiveNumber(offer.price ?? offer.lowPrice);
}

export function resolveOfferPrice(offers) {
  if (Array.isArray(offers)) {
    for (const o of offers) {
      const p = priceFromOffer(o);
      if (p !== null) return p;
    }
    return null;
  }
  return priceFromOffer(offers);
}

/** Variant price from a products export row: Sale Price only when On Sale = Yes. */
export function effectiveVariantPrice({ price, salePrice, onSale }) {
  const base = Number(price) || 0;
  const sale = Number(salePrice) || 0;
  return onSale && sale > 0 ? sale : base;
}
