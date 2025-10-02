-- Fixed Event Mappings with Improved Logic
-- This script addresses the mapping issues and data quality problems

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

-- Fix the backwards product mappings with improved logic
event_with_fixed_mappings AS (
  SELECT 
    *,
    -- Improved product URL matching logic
    CASE 
      -- Camera courses should map to photography courses
      WHEN event_url ILIKE '%camera-courses-for-beginners%' 
           AND product_url ILIKE '%beginners-photography-course%' 
      THEN 'CORRECT_MAPPING'
      
      -- Lightroom courses should map to lightroom courses  
      WHEN event_url ILIKE '%lightroom-photo-editing%' 
           AND product_url ILIKE '%lightroom-courses-for-beginners%'
      THEN 'CORRECT_MAPPING'
      
      -- Workshop events should map to workshop products
      WHEN event_url ILIKE '%photographic-workshops-near-me%' 
           AND product_url ILIKE '%photo-workshops-uk%'
      THEN 'CORRECT_MAPPING'
      
      -- Course events should map to course products
      WHEN event_url ILIKE '%beginners-photography-lessons%' 
           AND product_url ILIKE '%photography-services-near-me%'
      THEN 'CORRECT_MAPPING'
      
      -- Check for backwards mappings (the problem cases)
      WHEN event_url ILIKE '%camera-courses-for-beginners%' 
           AND product_url ILIKE '%lightroom-courses-for-beginners%'
      THEN 'BACKWARDS_MAPPING'
      
      WHEN event_url ILIKE '%lightroom-photo-editing%' 
           AND product_url ILIKE '%beginners-photography-course%'
      THEN 'BACKWARDS_MAPPING'
      
      ELSE 'UNKNOWN_MAPPING'
    END AS mapping_status,
    
    -- Suggest correct product URL based on event URL pattern
    CASE 
      WHEN event_url ILIKE '%camera-courses-for-beginners%' 
      THEN 'https://www.alanranger.com/photography-services-near-me/beginners-photography-course'
      
      WHEN event_url ILIKE '%lightroom-photo-editing%' 
      THEN 'https://www.alanranger.com/photography-services-near-me/lightroom-courses-for-beginners-coventry'
      
      WHEN event_url ILIKE '%photographic-workshops-near-me%' 
      THEN 'https://www.alanranger.com/photo-workshops-uk/'
      
      ELSE product_url
    END AS suggested_product_url
  FROM event_base
),

-- Add time validation and fixes
event_with_time_fixes AS (
  SELECT 
    *,
    -- Detect problematic times (23:00 to 23:00, etc.)
    CASE 
      WHEN start_time = end_time AND start_time IS NOT NULL 
      THEN 'SAME_START_END_TIME'
      WHEN start_time = '23:00:00' AND end_time = '23:00:00'
      THEN 'MIDNIGHT_TIME_ISSUE'
      WHEN start_time IS NULL OR end_time IS NULL
      THEN 'MISSING_TIME'
      ELSE 'VALID_TIME'
    END AS time_status,
    
    -- Suggest better times based on event type
    CASE 
      WHEN event_url ILIKE '%camera-courses-for-beginners%' 
      THEN '19:00:00'  -- Evening classes
      WHEN event_url ILIKE '%lightroom-photo-editing%' 
      THEN '19:00:00'  -- Evening classes
      WHEN event_url ILIKE '%photographic-workshops-near-me%' 
      THEN '09:00:00'  -- Morning workshops
      ELSE start_time
    END AS suggested_start_time,
    
    CASE 
      WHEN event_url ILIKE '%camera-courses-for-beginners%' 
      THEN '21:00:00'  -- 2-hour evening classes
      WHEN event_url ILIKE '%lightroom-photo-editing%' 
      THEN '21:00:00'  -- 2-hour evening classes
      WHEN event_url ILIKE '%photographic-workshops-near-me%' 
      THEN '17:00:00'  -- Full day workshops
      ELSE end_time
    END AS suggested_end_time
  FROM event_with_fixed_mappings
),

-- Add location fixes
event_with_location_fixes AS (
  SELECT 
    *,
    -- Extract location from URL patterns
    CASE 
      WHEN event_url ILIKE '%coventry%' 
      THEN 'Coventry, West Midlands'
      WHEN event_url ILIKE '%warwickshire%' 
      THEN 'Warwickshire'
      WHEN event_url ILIKE '%devon%' 
      THEN 'Devon'
      WHEN event_url ILIKE '%yorkshire%' 
      THEN 'Yorkshire'
      WHEN event_url ILIKE '%wales%' 
      THEN 'Wales'
      WHEN event_url ILIKE '%lake-district%' 
      THEN 'Lake District'
      WHEN event_url ILIKE '%exmoor%' 
      THEN 'Exmoor, Devon'
      WHEN event_url ILIKE '%hartland%' 
      THEN 'Hartland Quay, Devon'
      WHEN event_url ILIKE '%chesterton%' 
      THEN 'Chesterton, Warwickshire'
      ELSE event_location
    END AS suggested_location,
    
    -- Location quality assessment
    CASE 
      WHEN event_location IS NULL 
      THEN 'MISSING_LOCATION'
      WHEN event_location = 'NULL' 
      THEN 'NULL_LOCATION'
      WHEN event_location ILIKE '%<<%' 
      THEN 'TEMPLATE_LOCATION'
      ELSE 'VALID_LOCATION'
    END AS location_status
  FROM event_with_time_fixes
),

-- Final quality assessment
event_with_quality AS (
  SELECT 
    *,
    -- Overall data quality score
    CASE 
      WHEN mapping_status = 'BACKWARDS_MAPPING' THEN 0
      WHEN mapping_status = 'UNKNOWN_MAPPING' THEN 25
      WHEN time_status IN ('SAME_START_END_TIME', 'MIDNIGHT_TIME_ISSUE') THEN 50
      WHEN location_status = 'MISSING_LOCATION' THEN 75
      WHEN mapping_status = 'CORRECT_MAPPING' AND time_status = 'VALID_TIME' AND location_status = 'VALID_LOCATION' THEN 100
      ELSE 50
    END AS data_quality_score,
    
    -- Priority for fixing
    CASE 
      WHEN mapping_status = 'BACKWARDS_MAPPING' THEN 'HIGH_PRIORITY'
      WHEN time_status IN ('SAME_START_END_TIME', 'MIDNIGHT_TIME_ISSUE') THEN 'HIGH_PRIORITY'
      WHEN location_status = 'MISSING_LOCATION' THEN 'MEDIUM_PRIORITY'
      ELSE 'LOW_PRIORITY'
    END AS fix_priority
  FROM event_with_location_fixes
)

-- Final result with all fixes and suggestions
SELECT 
  -- Event Identification
  event_url,
  subtype,
  
  -- Date/Time Information (with fixes)
  date_start,
  date_end,
  start_time,
  end_time,
  suggested_start_time,
  suggested_end_time,
  time_status,
  
  -- Location Information (with fixes)
  event_location,
  suggested_location,
  location_status,
  
  -- Product Mapping (with fixes)
  product_url,
  suggested_product_url,
  mapping_status,
  link_method,
  link_score,
  
  -- Pricing Information
  price_gbp,
  price_source,
  availability,
  
  -- Quality Assessment
  data_quality_score,
  fix_priority,
  
  -- Specific Issues
  CASE 
    WHEN mapping_status = 'BACKWARDS_MAPPING' THEN 'Product mapping is backwards'
    WHEN time_status = 'SAME_START_END_TIME' THEN 'Start and end times are identical'
    WHEN time_status = 'MIDNIGHT_TIME_ISSUE' THEN 'Times show 23:00 to 23:00'
    WHEN location_status = 'MISSING_LOCATION' THEN 'Location is missing'
    ELSE 'Data looks good'
  END AS specific_issue

FROM event_with_quality
ORDER BY 
  fix_priority DESC,
  data_quality_score ASC,
  date_start ASC;

-- Summary of issues found
-- Uncomment to see summary:

/*
SELECT 
  'ISSUE_SUMMARY' as metric,
  COUNT(*) as total_events,
  COUNT(CASE WHEN mapping_status = 'BACKWARDS_MAPPING' THEN 1 END) as backwards_mappings,
  COUNT(CASE WHEN time_status IN ('SAME_START_END_TIME', 'MIDNIGHT_TIME_ISSUE') THEN 1 END) as time_issues,
  COUNT(CASE WHEN location_status = 'MISSING_LOCATION' THEN 1 END) as missing_locations,
  COUNT(CASE WHEN fix_priority = 'HIGH_PRIORITY' THEN 1 END) as high_priority_fixes
FROM event_with_quality;
*/


