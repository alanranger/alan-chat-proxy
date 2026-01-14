-- Add image_url to v_events_for_chat view by joining with page_entities
-- This enables event cards to display thumbnails in search results

DROP VIEW IF EXISTS v_events_for_chat CASCADE;

CREATE VIEW v_events_for_chat AS
WITH events AS (
  SELECT * FROM v_events_real_data
  WHERE canonical_event_url ILIKE 'https://www.alanranger.com/photographic-workshops-near-me/%'
     OR canonical_event_url ILIKE 'https://www.alanranger.com/beginners-photography-lessons/%'
), best AS (
  SELECT * FROM v_event_product_links_best2
), prod AS (
  SELECT
    pe.url AS product_url,
    pe.title AS product_title,
    (pe.raw->>'price' )::numeric       AS price_gbp,
    nullif(trim(coalesce(pe.raw->>'availability', pe.raw->'offers'->>'availability')), '') AS availability
  FROM page_entities pe
  WHERE pe.kind='product'
    AND (pe.url ILIKE 'https://www.alanranger.com/photo-workshops-uk/%'
      OR pe.url ILIKE 'https://www.alanranger.com/photography-services-near-me/%')
), event_images AS (
  SELECT
    pe.url AS event_url,
    pe.image_url
  FROM page_entities pe
  WHERE pe.kind = 'event'
    AND (pe.url ILIKE 'https://www.alanranger.com/photographic-workshops-near-me/%'
      OR pe.url ILIKE 'https://www.alanranger.com/beginners-photography-lessons/%')
), event_times AS (
  SELECT
    pe.url AS event_url,
    -- Extract start_time and end_time from page_entities if available
    null AS start_time,
    null AS end_time
  FROM page_entities pe
  WHERE pe.kind = 'event'
    AND (pe.url ILIKE 'https://www.alanranger.com/photographic-workshops-near-me/%'
      OR pe.url ILIKE 'https://www.alanranger.com/beginners-photography-lessons/%')
)
SELECT
  e.canonical_event_url AS event_url,
  e.subtype,
  b.product_url,
  p.product_title,
  p.price_gbp,
  p.availability,
  e.date_start,
  e.date_end,
  et.start_time,
  et.end_time,
  coalesce(e.location_name, e.location_city, e.location_region, e.location_country) AS event_location,
  b.link_source AS map_method,
  b.confidence,
  ei.image_url,
  -- Also expose as event_image_url for backward compatibility
  ei.image_url AS event_image_url,
  -- Include other fields that may be needed
  e.participants,
  e.fitness_level,
  e.event_title,
  e.json_price,
  e.json_availability,
  e.price_currency,
  e.experience_level,
  e.equipment_needed
FROM events e
LEFT JOIN best b
  ON e.canonical_event_url = b.event_url
LEFT JOIN prod p
  ON b.product_url = p.product_url
LEFT JOIN event_images ei
  ON e.canonical_event_url = ei.event_url
LEFT JOIN event_times et
  ON e.canonical_event_url = et.event_url;
