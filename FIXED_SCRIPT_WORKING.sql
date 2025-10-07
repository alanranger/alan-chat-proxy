-- ========================================
-- WORKING FIX SCRIPT - SIMPLIFIED VERSION
-- This script fixes the mapping issues without column conflicts
-- ========================================

-- STEP 1: CREATE CORRECTED EVENT-PRODUCT MAPPINGS
-- This fixes the backwards mapping logic with proper scoring

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

-- STEP 2: CREATE A SIMPLE CORRECTED PRICING VIEW
-- This uses the existing v_event_product_pricing but with corrected mappings

CREATE OR REPLACE VIEW v_event_product_pricing_corrected AS
WITH corrected_events AS (
  -- Get events with corrected product mappings
  SELECT 
    e.event_url,
    e.subtype,
    e.date_start,
    e.date_end,
    e.start_time,
    e.end_time,
    e.event_location,
    cpl.product_url,
    cpl.method,
    cpl.score as specificity
  FROM v_event_product_pricing e
  LEFT JOIN v_event_product_links_corrected cpl ON cpl.event_url = e.event_url
),

-- Join with product pricing
events_with_pricing AS (
  SELECT 
    ce.*,
    pu.display_price_gbp AS price_gbp,
    pu.availability_status AS availability
  FROM corrected_events ce
  LEFT JOIN v_products_unified pu ON pu.product_url = ce.product_url
)

-- Final result with corrected mappings
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
  'price_view' AS price_source,
  availability
FROM events_with_pricing
WHERE product_url IS NOT NULL
ORDER BY date_start;

-- STEP 3: CREATE QA VIEW FOR THE CORRECTED DATA
CREATE OR REPLACE VIEW v_event_product_qa_corrected AS
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
  
  -- QA Flags
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

FROM v_event_product_pricing_corrected;

-- STEP 4: VERIFICATION QUERIES
-- Check if backwards mappings are fixed
SELECT 
  'MAPPING_FIX_VERIFICATION' as check_type,
  COUNT(*) as total_events,
  COUNT(CASE WHEN mapping_type = 'CORRECT_CAMERA_TO_PHOTOGRAPHY' THEN 1 END) as correct_camera_mappings,
  COUNT(CASE WHEN mapping_type = 'CORRECT_LIGHTROOM_TO_LIGHTROOM' THEN 1 END) as correct_lightroom_mappings,
  COUNT(CASE WHEN mapping_type = 'WRONG_CAMERA_TO_LIGHTROOM' THEN 1 END) as wrong_camera_mappings,
  COUNT(CASE WHEN mapping_type = 'WRONG_LIGHTROOM_TO_PHOTOGRAPHY' THEN 1 END) as wrong_lightroom_mappings
FROM v_event_product_links_corrected;

-- Check the corrected pricing view
SELECT 
  'CORRECTED_PRICING_VIEW' as check_type,
  COUNT(*) as total_events,
  COUNT(CASE WHEN product_url IS NOT NULL THEN 1 END) as events_with_products,
  COUNT(CASE WHEN event_location IS NOT NULL THEN 1 END) as events_with_locations,
  COUNT(CASE WHEN start_time IS NOT NULL THEN 1 END) as events_with_times
FROM v_event_product_pricing_corrected;

-- Final quality summary
SELECT 
  'FINAL_QUALITY_SUMMARY' as summary_type,
  COUNT(*) as total_events,
  AVG(data_quality_score) as avg_quality_score,
  COUNT(CASE WHEN data_quality_score = 100 THEN 1 END) as perfect_events,
  COUNT(CASE WHEN data_quality_score >= 75 THEN 1 END) as good_events,
  COUNT(CASE WHEN data_quality_score < 50 THEN 1 END) as poor_events
FROM v_event_product_qa_corrected;




