-- One-off clean: product page_entities rows keyed by a bare Squarespace slug (written by the old
-- csv-import product path, Oct 2025). csv-import now builds the full URL from "Product Page".
CREATE TABLE IF NOT EXISTS public.page_entities_slug_products_bak_20261025 AS
SELECT pe.* FROM public.page_entities pe
 WHERE pe.kind = 'product'
   AND COALESCE(pe.page_url, pe.source_url, pe.url) !~* '^https?://';

DELETE FROM public.page_entities pe
 USING public.page_entities_slug_products_bak_20261025 b
 WHERE pe.id = b.id;
