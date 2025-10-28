-- Fix the Event-Product Mapping Logic
-- This script addresses the backwards mapping issues in the database views

-- 1. First, let's see what the current mapping logic looks like
SELECT 
  'CURRENT_MAPPINGS' as analysis_type,
  event_url,
  product_url,
  method,
  score,
  CASE 
    WHEN event_url ILIKE '%camera-courses-for-beginners%' 
         AND product_url ILIKE '%lightroom-courses-for-beginners%'
    THEN 'BACKWARDS_MAPPING'
    WHEN event_url ILIKE '%lightroom-photo-editing%' 
         AND product_url ILIKE '%beginners-photography-course%'
    THEN 'BACKWARDS_MAPPING'
    ELSE 'OTHER'
  END as mapping_issue
FROM v_event_product_links_best
WHERE event_url ILIKE '%camera-courses-for-beginners%' 
   OR event_url ILIKE '%lightroom-photo-editing%'
ORDER BY event_url;

-- 2. Check the scoring logic that's causing these issues
SELECT 
  'SCORING_ANALYSIS' as analysis_type,
  event_url,
  product_url,
  method,
  score,
  -- Analyze why these mappings are getting high scores
  CASE 
    WHEN method = 'tokens+date' THEN 'Token-based matching'
    WHEN method = 'auto' THEN 'Automatic matching'
    WHEN method = 'courses' THEN 'Course-specific matching'
    WHEN method = 'manual' THEN 'Manual override'
    ELSE 'Other method'
  END as matching_method
FROM v_event_product_links_best
WHERE event_url ILIKE '%camera-courses-for-beginners%' 
   OR event_url ILIKE '%lightroom-photo-editing%'
ORDER BY score DESC, event_url;

-- 3. Check what the correct mappings should be
SELECT 
  'SUGGESTED_CORRECT_MAPPINGS' as analysis_type,
  event_url,
  CASE 
    WHEN event_url ILIKE '%camera-courses-for-beginners%' 
    THEN 'https://www.alanranger.com/photography-services-near-me/beginners-photography-course'
    
    WHEN event_url ILIKE '%lightroom-photo-editing%' 
    THEN 'https://www.alanranger.com/photography-services-near-me/lightroom-courses-for-beginners-coventry'
    
    WHEN event_url ILIKE '%photographic-workshops-near-me%' 
    THEN 'https://www.alanranger.com/photo-workshops-uk/'
    
    ELSE 'NO_SUGGESTION'
  END as suggested_product_url,
  
  -- Check if the suggested product exists
  CASE 
    WHEN event_url ILIKE '%camera-courses-for-beginners%' 
         AND EXISTS (SELECT 1 FROM v_products_unified WHERE product_url ILIKE '%beginners-photography-course%')
    THEN 'SUGGESTED_PRODUCT_EXISTS'
    
    WHEN event_url ILIKE '%lightroom-photo-editing%' 
         AND EXISTS (SELECT 1 FROM v_products_unified WHERE product_url ILIKE '%lightroom-courses-for-beginners%')
    THEN 'SUGGESTED_PRODUCT_EXISTS'
    
    ELSE 'SUGGESTED_PRODUCT_NOT_FOUND'
  END as product_availability
FROM v_events_norm
WHERE event_url ILIKE '%camera-courses-for-beginners%' 
   OR event_url ILIKE '%lightroom-photo-editing%'
   OR event_url ILIKE '%photographic-workshops-near-me%'
ORDER BY event_url;

-- 4. Check the time issues
SELECT 
  'TIME_ISSUES' as analysis_type,
  event_url,
  date_start,
  date_end,
  start_time,
  end_time,
  CASE 
    WHEN start_time = end_time THEN 'SAME_START_END'
    WHEN start_time = '23:00:00' AND end_time = '23:00:00' THEN 'MIDNIGHT_ISSUE'
    WHEN start_time IS NULL OR end_time IS NULL THEN 'MISSING_TIME'
    ELSE 'VALID_TIME'
  END as time_issue
FROM v_event_product_pricing
WHERE start_time = end_time 
   OR (start_time = '23:00:00' AND end_time = '23:00:00')
   OR start_time IS NULL 
   OR end_time IS NULL
ORDER BY time_issue, event_url;

-- 5. Check location issues
SELECT 
  'LOCATION_ISSUES' as analysis_type,
  event_url,
  event_location,
  CASE 
    WHEN event_location IS NULL THEN 'MISSING_LOCATION'
    WHEN event_location = 'NULL' THEN 'NULL_LOCATION'
    WHEN event_location ILIKE '%<<%' THEN 'TEMPLATE_LOCATION'
    ELSE 'VALID_LOCATION'
  END as location_issue
FROM v_event_product_pricing
WHERE event_location IS NULL 
   OR event_location = 'NULL'
   OR event_location ILIKE '%<<%'
ORDER BY location_issue, event_url;




