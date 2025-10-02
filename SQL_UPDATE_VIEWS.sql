-- Run this in Supabase SQL editor (read/write) in this exact order.
-- Safely replace mapping views with stricter sources, alias rules and backfills.

-- 0) Helpers: URL normalization and slug cleaning (inlined in views)
--    - canonicalize URLs (scheme/domain, www, trailing slashes)
--    - restrict sources to event and product canonical paths only
--    - slug cleanup removes date/week suffixes to improve joins

-- 1) v_event_product_links_slug — slug-based mapping fallback (strict paths only)
DROP VIEW IF EXISTS v_event_product_links_slug CASCADE;
CREATE VIEW v_event_product_links_slug AS
WITH base AS (
  SELECT
    lower(regexp_replace(regexp_replace(pe.url, '^https?://(www\.)?alanranger\.com', '', 'i'), '/+$', '')) AS path,
    pe.url AS event_url,
    'event'::text AS kind
  FROM page_entities pe
  WHERE pe.kind = 'event'
    AND (
      pe.url ILIKE 'https://www.alanranger.com/photographic-workshops-near-me/%'
      OR pe.url ILIKE 'https://www.alanranger.com/beginners-photography-lessons/%'
    )
), prod AS (
  SELECT
    lower(regexp_replace(regexp_replace(pe.url, '^https?://(www\.)?alanranger\.com', '', 'i'), '/+$', '')) AS path,
    pe.url AS product_url
  FROM page_entities pe
  WHERE pe.kind = 'product'
    AND (
      pe.url ILIKE 'https://www.alanranger.com/photo-workshops-uk/%'
      OR pe.url ILIKE 'https://www.alanranger.com/photography-services-near-me/%'
    )
), tokens AS (
  SELECT
    b.event_url,
    b.path                           AS event_path,
    regexp_replace(b.path, '.*/', '') AS event_slug_raw,
    -- remove common date/week suffix noise (week-1/2/3, dd, ddmon, yyyy, variants)
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
            regexp_replace(regexp_replace(regexp_replace(regexp_replace(
              regexp_replace(lower(regexp_replace(b.path, '.*/', '')),
                '(week|wk)[-_]?\d+$', '', 'i'),
              '-\d{1,2}(st|nd|rd|th)$', '', 'i'),
            '-\d{1,2}[a-z]{3}$', '', 'i'),
          '-\d{4}$', '', 'i'),
        '-\d{1,2}$', '', 'i'),
      '-(spring|summer|autumn|winter)$', '', 'i'),
    '-(sunrise|sunset)$', '', 'i'),
  '-+$', '', 'g'),
  '-{2,}', '-', 'g'),
  '(^-|-$)', '', 'g') AS event_slug
  FROM base b
), ptokens AS (
  SELECT
    p.product_url,
    p.path                            AS product_path,
    regexp_replace(p.path, '.*/', '') AS product_slug_raw,
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
            regexp_replace(regexp_replace(regexp_replace(regexp_replace(
              regexp_replace(lower(regexp_replace(p.path, '.*/', '')),
                '(week|wk)[-_]?\d+$', '', 'i'),
              '-\d{1,2}(st|nd|rd|th)$', '', 'i'),
            '-\d{1,2}[a-z]{3}$', '', 'i'),
          '-\d{4}$', '', 'i'),
        '-\d{1,2}$', '', 'i'),
      '-(spring|summer|autumn|winter)$', '', 'i'),
    '-(sunrise|sunset)$', '', 'i'),
  '-+$', '', 'g'),
  '-{2,}', '-', 'g'),
  '(^-|-$)', '', 'g') AS product_slug
  FROM prod p
)
SELECT DISTINCT
  t.event_url,
  pt.product_url,
  'slug'::text AS link_source,
  0.60::numeric AS confidence
FROM tokens t
JOIN ptokens pt
  ON t.event_slug = pt.product_slug
WHERE t.event_slug <> '';

-- 2) v_event_product_links_best2 — prefer auto, then slug fallback
DROP VIEW IF EXISTS v_event_product_links_best2 CASCADE;
CREATE VIEW v_event_product_links_best2 AS
WITH auto_norm AS (
  SELECT DISTINCT
    lower(regexp_replace(regexp_replace(a.event_url,   '^https?://(www\.)?alanranger\.com', '', 'i'), '/+$', '')) AS event_path,
    lower(regexp_replace(regexp_replace(a.product_url, '^https?://(www\.)?alanranger\.com', '', 'i'), '/+$', '')) AS product_path,
    a.event_url,
    a.product_url,
    'auto'::text AS link_source,
    0.90::numeric AS confidence
  FROM event_product_links_auto a
  WHERE a.event_url ILIKE 'https://www.alanranger.com/photographic-workshops-near-me/%'
     OR a.event_url ILIKE 'https://www.alanranger.com/beginners-photography-lessons/%'
), slug AS (
  SELECT * FROM v_event_product_links_slug
)
SELECT DISTINCT ON (coalesce(an.event_url, s.event_url))
  coalesce(an.event_url, s.event_url)   AS event_url,
  coalesce(an.product_url, s.product_url) AS product_url,
  coalesce(an.link_source, s.link_source) AS link_source,
  coalesce(an.confidence, s.confidence)   AS confidence
FROM auto_norm an
FULL OUTER JOIN slug s
  ON an.event_url = s.event_url
ORDER BY coalesce(an.event_url, s.event_url),
         CASE WHEN an.event_url IS NOT NULL THEN 0 ELSE 1 END;

-- 3) v_events_for_chat — SSOT events + best links + backfills (strict sources)
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
)
SELECT
  e.canonical_event_url AS event_url,
  e.subtype,
  b.product_url,
  p.price_gbp,
  p.availability,
  e.date_start,
  e.date_end,
  coalesce(e.location_name, e.location_city, e.location_region, e.location_country) AS event_location,
  b.link_source AS map_method,
  b.confidence
FROM events e
LEFT JOIN best b
  ON e.canonical_event_url = b.event_url
LEFT JOIN prod p
  ON b.product_url = p.product_url;

-- Optional: quick sanity checks
-- SELECT count(*) FROM v_events_for_chat;
-- SELECT * FROM v_events_for_chat WHERE product_url IS NULL LIMIT 50;
-- SELECT * FROM v_events_for_chat ORDER BY map_method, confidence DESC LIMIT 50;


