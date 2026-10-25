-- Dated event rows whose URL is no longer in the current Squarespace events exports
-- (csv_metadata workshop_events / course_events) — deleted/404 events such as
-- batsford-arboretum-autumn-photography-30oct / -1nov. Backed up, then removed with
-- their event_product_links_auto rows so they stop reaching v_events_for_chat.

CREATE TABLE IF NOT EXISTS public.page_entities_orphan_events_bak_20261025 AS
SELECT pe.* FROM public.page_entities pe
 WHERE pe.kind = 'event' AND pe.date_start IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.csv_metadata c WHERE c.csv_type IN ('workshop_events','course_events') AND c.url = pe.url);

CREATE TABLE IF NOT EXISTS public.event_product_links_auto_orphan_bak_20261025 AS
SELECT l.* FROM public.event_product_links_auto l
 WHERE l.event_url IN (SELECT url FROM public.page_entities_orphan_events_bak_20261025);

DELETE FROM public.event_product_links_auto l
 WHERE l.event_url IN (SELECT url FROM public.page_entities_orphan_events_bak_20261025);

DELETE FROM public.page_entities pe
 USING public.page_entities_orphan_events_bak_20261025 b
 WHERE pe.id = b.id;
