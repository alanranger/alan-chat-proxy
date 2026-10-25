-- product_display_price held legacy slug-keyed rows ("batsford-arboretum-photography-workshops")
-- last written 2025-10-11, alongside the live full-URL rows that upsert_display_price_all
-- refreshes. v_products_unified (materialized) OR-joins both keys, so DISTINCT ON in
-- v_events_for_chat could pick the stale 2025 slug price (e.g. Batsford £99, Northumberland £995).
-- Back up then remove slug rows that duplicate a full-URL row. Slug-only rows (shop items with
-- no URL row) are kept.

CREATE TABLE IF NOT EXISTS public.product_display_price_slug_dupes_bak_20261025 AS
SELECT s.*
  FROM public.product_display_price s
 WHERE s.product_url !~* '^https?://'
   AND EXISTS (
     SELECT 1 FROM public.product_display_price u
      WHERE u.product_url ~* '^https?://'
        AND lower(u.product_url) LIKE '%/' || lower(s.product_url)
   );

DELETE FROM public.product_display_price s
 USING public.product_display_price_slug_dupes_bak_20261025 b
 WHERE s.product_url = b.product_url;
