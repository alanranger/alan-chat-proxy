-- COMPREHENSIVE FIX FOR ALL EVENT MAPPING ISSUES
-- This script fixes backwards mappings, time issues, and location problems

-- 1. CREATE CORRECTED EVENT-PRODUCT MAPPINGS
-- Fix the backwards mapping logic with proper scoring

CREATE OR REPLACE VIEW v_event_product_links_corrected AS
WITH base_mappings AS (
  -- Get all current mappings
  SELECT 
    event_url,
    product_url,
    method,
    score,
    -- Add corrected scoring based on proper logic
    CASE 
      -- Camera courses should map to photography courses (HIGH SCORE)
      WHEN event_url ILIKE '%camera-courses-for-beginners%' 
           AND product_url ILIKE '%beginners-photography-course%'
      THEN 100
      
      -- Lightroom courses should map to lightroom courses (HIGH SCORE)
      WHEN event_url ILIKE '%lightroom-photo-editing%' 
           AND product_url ILIKE '%lightroom-courses-for-beginners%'
      THEN 100
      
      -- Workshop events should map to workshop products (HIGH SCORE)
      WHEN event_url ILIKE '%photographic-workshops-near-me%' 
           AND product_url ILIKE '%photo-workshops-uk%'
      THEN 100
      
      -- Course events should map to course products (HIGH SCORE)
      WHEN event_url ILIKE '%beginners-photography-lessons%' 
           AND product_url ILIKE '%photography-services-near-me%'
      THEN 100
      
      -- Penalize backwards mappings (LOW SCORE)
      WHEN event_url ILIKE '%camera-courses-for-beginners%' 
           AND product_url ILIKE '%lightroom-courses-for-beginners%'
      THEN 0
      
      WHEN event_url ILIKE '%lightroom-photo-editing%' 
           AND product_url ILIKE '%beginners-photography-course%'
      THEN 0
      
      -- Keep existing scores for other mappings
      ELSE score
    END AS corrected_score,
    
    -- Add mapping type for debugging
    CASE 
      WHEN event_url ILIKE '%camera-courses-for-beginners%' 
           AND product_url ILIKE '%beginners-photography-course%'
      THEN 'CORRECT_CAMERA_TO_PHOTOGRAPHY'
      
      WHEN event_url ILIKE '%lightroom-photo-editing%' 
           AND product_url ILIKE '%lightroom-courses-for-beginners%'
      THEN 'CORRECT_LIGHTROOM_TO_LIGHTROOM'
      
      WHEN event_url ILIKE '%camera-courses-for-beginners%' 
           AND product_url ILIKE '%lightroom-courses-for-beginners%'
      THEN 'WRONG_CAMERA_TO_LIGHTROOM'
      
      WHEN event_url ILIKE '%lightroom-photo-editing%' 
           AND product_url ILIKE '%beginners-photography-course%'
      THEN 'WRONG_LIGHTROOM_TO_PHOTOGRAPHY'
      
      ELSE 'OTHER'
    END AS mapping_type
  FROM v_event_product_links_best
),

-- Rank by corrected scores
ranked_mappings AS (
  SELECT 
    *,
    ROW_NUMBER() OVER (
      PARTITION BY event_url 
      ORDER BY corrected_score DESC, score DESC, product_url
    ) as rank
  FROM base_mappings
)

-- Select best mapping per event
SELECT 
  event_url,
  product_url,
  method,
  corrected_score as score,
  mapping_type
FROM ranked_mappings
WHERE rank = 1;

-- 2. CREATE CORRECTED EVENT PRICING VIEW WITH FIXED TIMES AND LOCATIONS
CREATE OR REPLACE VIEW v_event_product_pricing_fixed AS
WITH events_base AS (
  -- Get events with corrected mappings
  SELECT 
    e.event_url,
    e.subtype,
    e.date_start,
    e.date_end,
    e.event_location,
    -- Fix times based on event type
    CASE 
      WHEN e.event_url ILIKE '%camera-courses-for-beginners%' 
      THEN '19:00:00'  -- Evening classes
      WHEN e.event_url ILIKE '%lightroom-photo-editing%' 
      THEN '19:00:00'  -- Evening classes
      WHEN e.event_url ILIKE '%photographic-workshops-near-me%' 
      THEN '09:00:00'  -- Morning workshops
      ELSE e.start_time
    END AS start_time,
    
    CASE 
      WHEN e.event_url ILIKE '%camera-courses-for-beginners%' 
      THEN '21:00:00'  -- 2-hour evening classes
      WHEN e.event_url ILIKE '%lightroom-photo-editing%' 
      THEN '21:00:00'  -- 2-hour evening classes
      WHEN e.event_url ILIKE '%photographic-workshops-near-me%' 
      THEN '17:00:00'  -- Full day workshops
      ELSE e.end_time
    END AS end_time,
    
    -- Fix locations based on URL patterns
    CASE 
      WHEN e.event_url ILIKE '%coventry%' 
      THEN 'Coventry, West Midlands'
      WHEN e.event_url ILIKE '%warwickshire%' 
      THEN 'Warwickshire'
      WHEN e.event_url ILIKE '%devon%' 
      THEN 'Devon'
      WHEN e.event_url ILIKE '%yorkshire%' 
      THEN 'Yorkshire'
      WHEN e.event_url ILIKE '%wales%' 
      THEN 'Wales'
      WHEN e.event_url ILIKE '%lake-district%' 
      THEN 'Lake District'
      WHEN e.event_url ILIKE '%exmoor%' 
      THEN 'Exmoor, Devon'
      WHEN e.event_url ILIKE '%hartland%' 
      THEN 'Hartland Quay, Devon'
      WHEN e.event_url ILIKE '%chesterton%' 
      THEN 'Chesterton, Warwickshire'
      ELSE e.event_location
    END AS event_location_fixed
    
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
  start_time,
  end_time,
  event_location_fixed AS event_location,
  product_url,
  method,
  specificity,
  price_gbp,
  'price_view' AS price_source,
  availability
FROM events_with_pricing
WHERE product_url IS NOT NULL
ORDER BY date_start;

-- 3. CREATE COMPREHENSIVE QA VIEW
CREATE OR REPLACE VIEW v_event_product_qa_fixed AS
SELECT 
  event_url,
  subtype,
  date_start,
  date_end,
  start_time,
  end_time,
  event_location,
  product_url,
  method,
  specificity,
  price_gbp,
  availability,
  
  -- QA Flags (fixed)
  (product_url IS NULL) AS missing_product,
  
  -- Fixed path mismatch logic
  (subtype = 'course' AND (product_url ILIKE '%/photo-workshops-uk/%' OR product_url ILIKE '%/photographic-workshops-near-me/%') OR 
   subtype = 'workshop' AND product_url ILIKE '%/photography-services-near-me/%') AS path_mismatch,
  
  (price_gbp IS NULL OR price_gbp <= 0) AS bad_price,
  (event_location IS NULL) AS missing_location,
  (start_time IS NULL OR end_time IS NULL) AS missing_times,
  
  -- Data quality score
  CASE 
    WHEN product_url IS NULL THEN 0
    WHEN (subtype = 'course' AND (product_url ILIKE '%/photo-workshops-uk/%' OR product_url ILIKE '%/photographic-workshops-near-me/%') OR 
          subtype = 'workshop' AND product_url ILIKE '%/photography-services-near-me/%') THEN 25
    WHEN price_gbp IS NULL OR price_gbp <= 0 THEN 50
    WHEN event_location IS NULL THEN 75
    ELSE 100
  END AS data_quality_score

FROM v_event_product_pricing_fixed;


