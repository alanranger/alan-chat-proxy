-- FINAL COMPREHENSIVE FIX FOR ALL REMAINING ISSUES
-- This addresses: locations, dates, subtypes, and pricing

-- STEP 1: DROP AND RECREATE CORRECTED EVENT-PRODUCT LINKS VIEW
DROP VIEW IF EXISTS v_event_product_links_corrected CASCADE;
CREATE VIEW v_event_product_links_corrected AS
WITH
-- Define CORRECT mappings based on event type with expanded patterns
correct_mappings AS (
  SELECT
    lower(regexp_replace(e.event_url, '/$'::text, ''::text)) AS event_url,
    CASE
      -- Camera courses should map to beginners photography courses
      WHEN e.event_url ILIKE '%camera-courses-for-beginners%' 
      THEN 'https://www.alanranger.com/photography-services-near-me/beginners-photography-course'
      
      -- Lightroom courses should map to lightroom courses
      WHEN e.event_url ILIKE '%lightroom-photo-editing%' 
      THEN 'https://www.alanranger.com/photography-services-near-me/lightroom-courses-for-beginners-coventry'
      
      -- RPS courses should map to RPS mentoring
      WHEN e.event_url ILIKE '%rps-courses%' OR e.event_url ILIKE '%rps-distinctions%'
      THEN 'https://www.alanranger.com/photography-services-near-me/rps-mentoring-photography-course'
      
      -- Workshops should map to photo-workshops-uk products
      WHEN e.event_url ILIKE '%photographic-workshops-near-me%'
      THEN CASE
        WHEN e.event_url ILIKE '%chesterton%' OR e.event_url ILIKE '%windmill%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/photography-workshops-chesterton-windmill'
        WHEN e.event_url ILIKE '%lake-district%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/lake-district-photography-workshop'
        WHEN e.event_url ILIKE '%devon%' OR e.event_url ILIKE '%hartland%' OR e.event_url ILIKE '%exmoor%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/landscape-photography-devon-hartland-quay'
        WHEN e.event_url ILIKE '%woodland%' OR e.event_url ILIKE '%oakley-wood%' OR e.event_url ILIKE '%crackley-woods%' OR e.event_url ILIKE '%hay-woods%' OR e.event_url ILIKE '%millisons-wood%' OR e.event_url ILIKE '%piles-coppice%' OR e.event_url ILIKE '%tile-hill%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/woodland-photography-walk-warwickshire'
        WHEN e.event_url ILIKE '%bluebell%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/bluebell-woodlands-photography-workshops'
        WHEN e.event_url ILIKE '%long-exposure%' OR e.event_url ILIKE '%kenilworth%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/long-exposure-photography-kenilworth'
        WHEN e.event_url ILIKE '%abstract%' OR e.event_url ILIKE '%macro%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/abstract-and-macro-photography-workshops'
        WHEN e.event_url ILIKE '%garden-photography%' OR e.event_url ILIKE '%sezincote%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/garden-photography-workshop'
        WHEN e.event_url ILIKE '%lavender%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/photography-workshops-lavender-fields'
        WHEN e.event_url ILIKE '%urban-architecture%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/urban-architecture-photography-workshops-coventry'
        WHEN e.event_url ILIKE '%somerset%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/somerset-landscape-photography-workshops'
        WHEN e.event_url ILIKE '%yorkshire%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/north-yorkshire-landscape-photography'
        WHEN e.event_url ILIKE '%nant-mill%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/landscape-photography-workshops-nant-mill'
        WHEN e.event_url ILIKE '%dartmoor%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/dartmoor-photography-landscape-workshop'
        WHEN e.event_url ILIKE '%suffolk%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/suffolk-landscape-photography-workshops'
        WHEN e.event_url ILIKE '%wales%' OR e.event_url ILIKE '%anglesey%' OR e.event_url ILIKE '%snowdonia%' OR e.event_url ILIKE '%fairy-glen%' OR e.event_url ILIKE '%gower-peninsular%' OR e.event_url ILIKE '%vyrnwy%' OR e.event_url ILIKE '%pistyll-rhaeadr%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/landscape-photography-workshops-anglesey'
        WHEN e.event_url ILIKE '%dorset%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/dorset-landscape-photography-workshop'
        WHEN e.event_url ILIKE '%norfolk%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/landscape-photography-workshop-norfolk'
        WHEN e.event_url ILIKE '%northumberland%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/coastal-northumberland-photography-workshops'
        WHEN e.event_url ILIKE '%ireland%' OR e.event_url ILIKE '%dingle%' OR e.event_url ILIKE '%kerry%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/ireland-photography-workshops-dingle'
        WHEN e.event_url ILIKE '%peak-district%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/landscape-peak-district-photography-workshops-derbyshire'
        WHEN e.event_url ILIKE '%batsford-arboretum%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/batsford-arboretum-photography-workshops'
        WHEN e.event_url ILIKE '%burnham-on-sea%'
        THEN 'https://www.alanranger.com/photo-workshops-uk/long-exposure-photography-workshops-burnham'
        ELSE 'https://www.alanranger.com/photo-workshops-uk/landscape-photography-workshops'
      END
      ELSE NULL
    END AS product_url,
    'hardwired_correct' AS method,
    100 AS score
  FROM v_events_norm e
  WHERE e.event_url IS NOT NULL
),
-- Existing best links as fallback
best_links AS (
  SELECT
    lower(regexp_replace(event_url, '/$'::text, ''::text)) AS event_url,
    lower(regexp_replace(product_url, '/$'::text, ''::text)) AS product_url,
    method,
    score
  FROM v_event_product_links_best
),
-- Combine and prioritize mappings
all_links AS (
  SELECT event_url, product_url, method, score FROM correct_mappings
  UNION ALL
  SELECT bl.event_url, bl.product_url, bl.method, bl.score
  FROM best_links bl
  LEFT JOIN correct_mappings cm ON bl.event_url = cm.event_url
  WHERE cm.event_url IS NULL
),
-- Deduplicate and pick the best link
ranked_links AS (
  SELECT
    event_url,
    product_url,
    method,
    score,
    ROW_NUMBER() OVER (PARTITION BY event_url ORDER BY score DESC, method DESC) as rn
  FROM all_links
)
SELECT
  event_url,
  product_url,
  method,
  score
FROM ranked_links
WHERE rn = 1;

-- STEP 2: CREATE COMPREHENSIVE FIXED EVENT PRODUCT PRICING VIEW
DROP VIEW IF EXISTS v_event_product_pricing_corrected CASCADE;
CREATE VIEW v_event_product_pricing_corrected AS
WITH
-- Enhanced events base with proper subtype classification and location extraction
events_base AS (
  SELECT
    e.event_url,
    -- FIXED: Proper subtype classification
    CASE
      WHEN e.event_url ILIKE '%camera-courses-for-beginners%' OR e.event_url ILIKE '%lightroom-photo-editing%' OR e.event_url ILIKE '%rps-courses%' OR e.event_url ILIKE '%rps-distinctions%'
      THEN 'course'
      WHEN e.event_url ILIKE '%photographic-workshops-near-me%'
      THEN 'workshop'
      ELSE 'event'
    END AS subtype,
    e.date_start,
    e.date_end,
    -- FIXED: Enhanced time derivation based on event type and URL patterns
    CASE
      -- Camera courses: evening classes
      WHEN e.event_url ILIKE '%camera-courses-for-beginners%' OR e.event_url ILIKE '%lightroom-photo-editing%' OR e.event_url ILIKE '%rps-courses%'
      THEN '19:00:00'
      -- Workshops: vary by type
      WHEN e.event_url ILIKE '%sunset%' OR e.event_url ILIKE '%sunrise%'
      THEN CASE
        WHEN e.event_url ILIKE '%sunrise%' THEN '06:00:00'
        ELSE '18:00:00'
      END
      WHEN e.event_url ILIKE '%long-exposure%' OR e.event_url ILIKE '%burnham%'
      THEN '18:00:00'
      WHEN e.event_url ILIKE '%bluebell%' OR e.event_url ILIKE '%woodland%' OR e.event_url ILIKE '%garden%'
      THEN '19:00:00'
      WHEN e.event_url ILIKE '%landscape%' OR e.event_url ILIKE '%lake-district%' OR e.event_url ILIKE '%yorkshire%' OR e.event_url ILIKE '%wales%' OR e.event_url ILIKE '%devon%' OR e.event_url ILIKE '%dartmoor%' OR e.event_url ILIKE '%exmoor%' OR e.event_url ILIKE '%suffolk%' OR e.event_url ILIKE '%dorset%' OR e.event_url ILIKE '%norfolk%' OR e.event_url ILIKE '%northumberland%' OR e.event_url ILIKE '%ireland%' OR e.event_url ILIKE '%peak-district%'
      THEN '09:00:00'
      ELSE '19:00:00'
    END AS fixed_start_time,
    
    CASE
      -- Camera courses: evening classes
      WHEN e.event_url ILIKE '%camera-courses-for-beginners%' OR e.event_url ILIKE '%lightroom-photo-editing%' OR e.event_url ILIKE '%rps-courses%'
      THEN '21:00:00'
      -- Workshops: vary by type
      WHEN e.event_url ILIKE '%sunset%' OR e.event_url ILIKE '%sunrise%'
      THEN CASE
        WHEN e.event_url ILIKE '%sunrise%' THEN '09:00:00'
        ELSE '21:00:00'
      END
      WHEN e.event_url ILIKE '%long-exposure%' OR e.event_url ILIKE '%burnham%'
      THEN '21:00:00'
      WHEN e.event_url ILIKE '%bluebell%' OR e.event_url ILIKE '%woodland%' OR e.event_url ILIKE '%garden%'
      THEN '21:00:00'
      WHEN e.event_url ILIKE '%landscape%' OR e.event_url ILIKE '%lake-district%' OR e.event_url ILIKE '%yorkshire%' OR e.event_url ILIKE '%wales%' OR e.event_url ILIKE '%devon%' OR e.event_url ILIKE '%dartmoor%' OR e.event_url ILIKE '%exmoor%' OR e.event_url ILIKE '%suffolk%' OR e.event_url ILIKE '%dorset%' OR e.event_url ILIKE '%norfolk%' OR e.event_url ILIKE '%northumberland%' OR e.event_url ILIKE '%ireland%' OR e.event_url ILIKE '%peak-district%'
      THEN '17:00:00'
      ELSE '21:00:00'
    END AS fixed_end_time,
    
    -- FIXED: Enhanced location extraction with more patterns
    CASE
      WHEN e.event_url ILIKE '%coventry%'
      THEN 'Coventry, West Midlands'
      WHEN e.event_url ILIKE '%devon%' OR e.event_url ILIKE '%hartland%' OR e.event_url ILIKE '%exmoor%' OR e.event_url ILIKE '%dartmoor%'
      THEN 'Devon, UK'
      WHEN e.event_url ILIKE '%lake-district%'
      THEN 'Lake District, Cumbria'
      WHEN e.event_url ILIKE '%yorkshire%'
      THEN 'Yorkshire, UK'
      WHEN e.event_url ILIKE '%wales%' OR e.event_url ILIKE '%anglesey%' OR e.event_url ILIKE '%snowdonia%' OR e.event_url ILIKE '%fairy-glen%' OR e.event_url ILIKE '%gower-peninsular%' OR e.event_url ILIKE '%vyrnwy%' OR e.event_url ILIKE '%pistyll-rhaeadr%'
      THEN 'Wales, UK'
      WHEN e.event_url ILIKE '%warwickshire%' OR e.event_url ILIKE '%chesterton%' OR e.event_url ILIKE '%windmill%' OR e.event_url ILIKE '%kenilworth%'
      THEN 'Warwickshire, UK'
      WHEN e.event_url ILIKE '%bluebell%'
      THEN 'Bluebell Woods, Warwickshire'
      WHEN e.event_url ILIKE '%garden-photography%' OR e.event_url ILIKE '%sezincote%'
      THEN 'Garden Photography, UK'
      WHEN e.event_url ILIKE '%lavender%'
      THEN 'Lavender Fields, UK'
      WHEN e.event_url ILIKE '%suffolk%'
      THEN 'Suffolk, UK'
      WHEN e.event_url ILIKE '%dorset%'
      THEN 'Dorset, UK'
      WHEN e.event_url ILIKE '%norfolk%'
      THEN 'Norfolk, UK'
      WHEN e.event_url ILIKE '%northumberland%'
      THEN 'Northumberland, UK'
      WHEN e.event_url ILIKE '%ireland%' OR e.event_url ILIKE '%dingle%' OR e.event_url ILIKE '%kerry%'
      THEN 'Ireland'
      WHEN e.event_url ILIKE '%peak-district%'
      THEN 'Peak District, Derbyshire'
      WHEN e.event_url ILIKE '%batsford-arboretum%'
      THEN 'Batsford Arboretum, Gloucestershire'
      WHEN e.event_url ILIKE '%burnham-on-sea%'
      THEN 'Burnham-on-Sea, Somerset'
      WHEN e.event_url ILIKE '%somerset%'
      THEN 'Somerset, UK'
      ELSE COALESCE(e.event_location, 'Location TBD')
    END AS fixed_event_location
  FROM v_events_norm e
),

-- Join with corrected product mappings
events_with_products AS (
  SELECT
    eb.*,
    cpl.product_url,
    cpl.method,
    cpl.score as specificity
  FROM events_base eb
  LEFT JOIN v_event_product_links_corrected cpl ON cpl.event_url = eb.event_url
),

-- Join with product pricing
events_with_pricing AS (
  SELECT
    ewp.*,
    pu.display_price_gbp AS price_gbp,
    pu.availability_status AS availability
  FROM events_with_products ewp
  LEFT JOIN v_products_unified pu ON pu.product_url = ewp.product_url
)

-- Final result with all fixes
SELECT
  event_url,
  subtype,
  date_start,
  date_end,
  fixed_start_time AS start_time,
  fixed_end_time AS end_time,
  fixed_event_location AS event_location,
  product_url,
  method,
  specificity,
  price_gbp,
  'price_view' AS price_source,
  availability
FROM events_with_pricing
WHERE product_url IS NOT NULL
ORDER BY date_start;

-- STEP 3: CREATE COMPREHENSIVE QA VIEW
DROP VIEW IF EXISTS v_event_product_qa_corrected CASCADE;
CREATE VIEW v_event_product_qa_corrected AS
SELECT
  ep.event_url,
  ep.subtype,
  ep.date_start,
  ep.date_end,
  ep.start_time,
  ep.end_time,
  ep.event_location,
  ep.product_url,
  ep.method AS link_method,
  ep.specificity AS link_score,
  ep.price_gbp,
  ep.availability,
  -- QA Flags
  ep.product_url IS NULL AS missing_product,
  (ep.subtype = 'course' AND ep.product_url ILIKE '%/photo-workshops-uk/%') OR
  (ep.subtype = 'workshop' AND ep.product_url ILIKE '%/photography-services-near-me/%') AS path_mismatch,
  ep.price_gbp IS NULL OR ep.price_gbp <= 0 AS bad_price,
  ep.event_location IS NULL OR ep.event_location = 'Location TBD' AS missing_location,
  ep.start_time IS NULL OR ep.end_time IS NULL AS missing_times,
  -- Quality Score (0-100)
  (
    CASE WHEN ep.product_url IS NOT NULL THEN 20 ELSE 0 END +
    CASE WHEN NOT ((ep.subtype = 'course' AND ep.product_url ILIKE '%/photo-workshops-uk/%') OR
                   (ep.subtype = 'workshop' AND ep.product_url ILIKE '%/photography-services-near-me/%')) THEN 20 ELSE 0 END +
    CASE WHEN ep.price_gbp IS NOT NULL AND ep.price_gbp > 0 THEN 20 ELSE 0 END +
    CASE WHEN ep.event_location IS NOT NULL AND ep.event_location != 'Location TBD' THEN 20 ELSE 0 END +
    CASE WHEN ep.start_time IS NOT NULL AND ep.end_time IS NOT NULL THEN 20 ELSE 0 END
  ) AS quality_score,
  -- Status
  CASE
    WHEN ep.product_url IS NULL THEN 'Missing Product'
    WHEN (ep.subtype = 'course' AND ep.product_url ILIKE '%/photo-workshops-uk/%') OR
         (ep.subtype = 'workshop' AND ep.product_url ILIKE '%/photography-services-near-me/%') THEN 'Path Mismatch'
    WHEN ep.price_gbp IS NULL OR ep.price_gbp <= 0 THEN 'Bad Price'
    WHEN ep.event_location IS NULL OR ep.event_location = 'Location TBD' THEN 'Missing Location'
    WHEN ep.start_time IS NULL OR ep.end_time IS NULL THEN 'Missing Times'
    ELSE 'Complete'
  END AS status
FROM v_event_product_pricing_corrected ep;




