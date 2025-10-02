-- ========================================
-- COMPLETE EVENT MAPPINGS AND DATA FIELDS TABLE
-- This script shows all event data with corrected mappings, pricing, and QA flags
-- ========================================

-- Main query to show all event mappings and data fields
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
  method,
  specificity as link_score,
  
  -- Pricing Information
  price_gbp,
  price_source,
  availability,
  
  -- Data Quality Flags (calculated on the fly)
  (product_url IS NULL) AS missing_product,
  (subtype = 'course' AND (product_url ILIKE '%/photo-workshops-uk/%' OR product_url ILIKE '%/photographic-workshops-near-me/%') OR 
   subtype = 'workshop' AND product_url ILIKE '%/photography-services-near-me/%') AS path_mismatch,
  (price_gbp IS NULL OR price_gbp <= 0) AS bad_price,
  (event_location IS NULL) AS missing_location,
  (start_time IS NULL OR end_time IS NULL) AS missing_times,
  
  -- Quality Assessment (calculated on the fly)
  CASE 
    WHEN product_url IS NULL THEN 0
    WHEN (subtype = 'course' AND (product_url ILIKE '%/photo-workshops-uk/%' OR product_url ILIKE '%/photographic-workshops-near-me/%') OR 
          subtype = 'workshop' AND product_url ILIKE '%/photography-services-near-me/%') THEN 25
    WHEN price_gbp IS NULL OR price_gbp <= 0 THEN 50
    WHEN event_location IS NULL THEN 75
    ELSE 100
  END AS data_quality_score,
  
  -- Quality Status
  CASE 
    WHEN (CASE 
      WHEN product_url IS NULL THEN 0
      WHEN (subtype = 'course' AND (product_url ILIKE '%/photo-workshops-uk/%' OR product_url ILIKE '%/photographic-workshops-near-me/%') OR 
            subtype = 'workshop' AND product_url ILIKE '%/photography-services-near-me/%') THEN 25
      WHEN price_gbp IS NULL OR price_gbp <= 0 THEN 50
      WHEN event_location IS NULL THEN 75
      ELSE 100
    END) = 100 THEN 'Perfect'
    WHEN (CASE 
      WHEN product_url IS NULL THEN 0
      WHEN (subtype = 'course' AND (product_url ILIKE '%/photo-workshops-uk/%' OR product_url ILIKE '%/photographic-workshops-near-me/%') OR 
            subtype = 'workshop' AND product_url ILIKE '%/photography-services-near-me/%') THEN 25
      WHEN price_gbp IS NULL OR price_gbp <= 0 THEN 50
      WHEN event_location IS NULL THEN 75
      ELSE 100
    END) >= 75 THEN 'Good'
    WHEN (CASE 
      WHEN product_url IS NULL THEN 0
      WHEN (subtype = 'course' AND (product_url ILIKE '%/photo-workshops-uk/%' OR product_url ILIKE '%/photographic-workshops-near-me/%') OR 
            subtype = 'workshop' AND product_url ILIKE '%/photography-services-near-me/%') THEN 25
      WHEN price_gbp IS NULL OR price_gbp <= 0 THEN 50
      WHEN event_location IS NULL THEN 75
      ELSE 100
    END) >= 50 THEN 'Fair'
    ELSE 'Poor'
  END AS quality_status,
  
  -- Specific Issues
  CASE 
    WHEN (product_url IS NULL) THEN 'Missing Product'
    WHEN (subtype = 'course' AND (product_url ILIKE '%/photo-workshops-uk/%' OR product_url ILIKE '%/photographic-workshops-near-me/%') OR 
          subtype = 'workshop' AND product_url ILIKE '%/photography-services-near-me/%') THEN 'Path Mismatch'
    WHEN (price_gbp IS NULL OR price_gbp <= 0) THEN 'Bad Price'
    WHEN (event_location IS NULL) THEN 'Missing Location'
    WHEN (start_time IS NULL OR end_time IS NULL) THEN 'Missing Times'
    ELSE 'No Issues'
  END AS specific_issue,
  
  -- Days until event
  CASE 
    WHEN date_start IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (date_start - NOW())) / 86400
    ELSE NULL 
  END AS days_until_event,
  
  -- Price tier
  CASE 
    WHEN price_gbp IS NOT NULL AND price_gbp > 0 THEN 
      CASE 
        WHEN price_gbp < 50 THEN 'Low'
        WHEN price_gbp < 200 THEN 'Medium'
        WHEN price_gbp < 500 THEN 'High'
        ELSE 'Premium'
      END
    ELSE 'Unknown'
  END AS price_tier,
  
  -- Event type classification
  CASE 
    WHEN event_url ILIKE '%camera-courses-for-beginners%' THEN 'Camera Course'
    WHEN event_url ILIKE '%lightroom-photo-editing%' THEN 'Lightroom Course'
    WHEN event_url ILIKE '%photographic-workshops-near-me%' THEN 'Workshop'
    ELSE 'Other'
  END AS event_type,
  
  -- Location classification
  CASE 
    WHEN event_url ILIKE '%coventry%' THEN 'Coventry'
    WHEN event_url ILIKE '%devon%' THEN 'Devon'
    WHEN event_url ILIKE '%yorkshire%' THEN 'Yorkshire'
    WHEN event_url ILIKE '%wales%' THEN 'Wales'
    WHEN event_url ILIKE '%lake-district%' THEN 'Lake District'
    WHEN event_url ILIKE '%exmoor%' THEN 'Exmoor'
    WHEN event_url ILIKE '%hartland%' THEN 'Hartland'
    WHEN event_url ILIKE '%chesterton%' THEN 'Chesterton'
    ELSE 'Other'
  END AS location_classification

FROM v_event_product_pricing_corrected
ORDER BY 
  data_quality_score DESC,
  date_start ASC;

-- Summary Statistics
-- Uncomment the following to see summary statistics:

/*
SELECT 
  'SUMMARY_STATISTICS' as metric,
  COUNT(*) as total_events,
  COUNT(CASE WHEN NOT missing_product THEN 1 END) as events_with_products,
  COUNT(CASE WHEN NOT missing_location THEN 1 END) as events_with_locations,
  COUNT(CASE WHEN NOT bad_price THEN 1 END) as events_with_prices,
  COUNT(CASE WHEN data_quality_score = 100 THEN 1 END) as perfect_events,
  COUNT(CASE WHEN data_quality_score >= 75 THEN 1 END) as good_events,
  COUNT(CASE WHEN data_quality_score < 50 THEN 1 END) as poor_events,
  ROUND(AVG(data_quality_score), 2) as avg_quality_score,
  COUNT(CASE WHEN subtype = 'course' THEN 1 END) as courses,
  COUNT(CASE WHEN subtype = 'workshop' THEN 1 END) as workshops,
  COUNT(CASE WHEN event_type = 'Camera Course' THEN 1 END) as camera_courses,
  COUNT(CASE WHEN event_type = 'Lightroom Course' THEN 1 END) as lightroom_courses,
  COUNT(CASE WHEN event_type = 'Workshop' THEN 1 END) as workshops
FROM v_event_product_qa_corrected;
*/

-- Quality Issues Breakdown
-- Uncomment to see detailed quality issues:

/*
SELECT 
  'QUALITY_ISSUES_BREAKDOWN' as analysis_type,
  specific_issue,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM v_event_product_qa_corrected
GROUP BY specific_issue
ORDER BY count DESC;
*/

-- Mapping Quality Analysis
-- Uncomment to see mapping quality:

/*
SELECT 
  'MAPPING_QUALITY_ANALYSIS' as analysis_type,
  event_type,
  COUNT(*) as total_events,
  COUNT(CASE WHEN path_mismatch THEN 1 END) as path_mismatches,
  COUNT(CASE WHEN missing_product THEN 1 END) as missing_products,
  ROUND(COUNT(CASE WHEN NOT path_mismatch AND NOT missing_product THEN 1 END) * 100.0 / COUNT(*), 2) as correct_mapping_percentage
FROM v_event_product_qa_corrected
GROUP BY event_type
ORDER BY total_events DESC;
*/
