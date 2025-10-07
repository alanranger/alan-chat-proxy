-- Complete Event Mappings and Data Fields
-- This script shows all event data with product mappings, pricing, and availability
-- Run this in Supabase SQL Editor to see the consolidated event data

WITH event_base AS (
  -- Get all events from the consolidated pricing view
  SELECT 
    event_url,
    subtype,
    date_start,
    date_end,
    start_time,
    end_time,
    event_location,
    product_url,
    method as link_method,
    specificity as link_score,
    price_gbp,
    price_source,
    availability
  FROM v_event_product_pricing
),

-- Add QA flags for data quality assessment
event_with_qa AS (
  SELECT 
    *,
    -- QA Flags
    (product_url IS NULL) AS missing_product,
    (subtype = 'course' AND (product_url ILIKE '%/photo-workshops-uk/%' OR product_url ILIKE '%/photographic-workshops-near-me/%') OR 
     subtype = 'workshop' AND product_url ILIKE '%/photography-services-near-me/%') AS path_mismatch,
    (price_gbp IS NULL OR price_gbp <= 0) AS bad_price,
    (event_location IS NULL) AS missing_location,
    (date_start IS NULL) AS missing_start_date,
    (date_end IS NULL) AS missing_end_date
  FROM event_base
),

-- Add data quality summary
event_with_quality AS (
  SELECT 
    *,
    -- Overall data quality score (0-100)
    CASE 
      WHEN missing_product AND missing_location AND bad_price THEN 0
      WHEN missing_product OR missing_location OR bad_price THEN 25
      WHEN path_mismatch THEN 50
      WHEN missing_location THEN 75
      ELSE 100
    END AS data_quality_score,
    
    -- Data completeness flags
    CASE 
      WHEN NOT missing_product AND NOT missing_location AND NOT bad_price AND NOT path_mismatch THEN 'Complete'
      WHEN NOT missing_product AND NOT bad_price AND NOT path_mismatch THEN 'Missing Location'
      WHEN NOT missing_product AND NOT bad_price THEN 'Path Mismatch'
      WHEN NOT missing_product THEN 'Bad Price'
      ELSE 'Missing Product'
    END AS data_status
  FROM event_with_qa
)

-- Final result with all fields and quality metrics
SELECT 
  -- Event Identification
  event_url,
  subtype,
  
  -- Date/Time Information
  date_start,
  date_end,
  start_time,
  end_time,
  
  -- Location Information
  event_location,
  
  -- Product Mapping
  product_url,
  link_method,
  link_score,
  
  -- Pricing Information
  price_gbp,
  price_source,
  availability,
  
  -- Data Quality Flags
  missing_product,
  path_mismatch,
  bad_price,
  missing_location,
  missing_start_date,
  missing_end_date,
  
  -- Quality Assessment
  data_quality_score,
  data_status,
  
  -- Additional computed fields
  CASE 
    WHEN date_start IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (date_start - NOW())) / 86400
    ELSE NULL 
  END AS days_until_event,
  
  CASE 
    WHEN price_gbp IS NOT NULL AND price_gbp > 0 THEN 
      CASE 
        WHEN price_gbp < 50 THEN 'Low'
        WHEN price_gbp < 200 THEN 'Medium'
        WHEN price_gbp < 500 THEN 'High'
        ELSE 'Premium'
      END
    ELSE 'Unknown'
  END AS price_tier

FROM event_with_quality
ORDER BY 
  data_quality_score DESC,
  date_start ASC;

-- Summary statistics
-- Uncomment the following to see summary statistics:

/*
SELECT 
  'Summary Statistics' as metric,
  COUNT(*) as total_events,
  COUNT(CASE WHEN NOT missing_product THEN 1 END) as events_with_products,
  COUNT(CASE WHEN NOT missing_location THEN 1 END) as events_with_locations,
  COUNT(CASE WHEN NOT bad_price THEN 1 END) as events_with_prices,
  COUNT(CASE WHEN data_status = 'Complete' THEN 1 END) as complete_events,
  ROUND(AVG(data_quality_score), 2) as avg_quality_score,
  COUNT(CASE WHEN subtype = 'course' THEN 1 END) as courses,
  COUNT(CASE WHEN subtype = 'workshop' THEN 1 END) as workshops
FROM event_with_quality;
*/




