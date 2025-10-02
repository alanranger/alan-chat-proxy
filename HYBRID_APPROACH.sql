-- HYBRID APPROACH: Use calendar pages but deduplicate properly
-- This approach uses the calendar pages that contain all events but deduplicates them

-- STEP 1: CREATE VIEW USING CALENDAR PAGES WITH DEDUPLICATION
CREATE OR REPLACE VIEW v_events_hybrid AS
WITH
-- Get all event data from calendar pages
all_events AS (
  SELECT 
    url as event_url,
    raw->>'name' as event_name,
    -- Extract subtype from URL patterns
    CASE
      WHEN url ILIKE '%beginners-photography-lessons%' OR 
           url ILIKE '%camera-courses%' OR 
           url ILIKE '%lightroom%' OR 
           url ILIKE '%rps%'
      THEN 'course'
      WHEN url ILIKE '%photographic-workshops-near-me%' OR 
           url ILIKE '%workshop%'
      THEN 'workshop'
      ELSE 'event'
    END AS subtype,
    
    -- Use real dates from JSON-LD
    date_start,
    date_end,
    
    -- Extract real times from dates
    CASE
      WHEN date_start IS NOT NULL THEN
        TO_CHAR(date_start, 'HH24:MI:SS')
      ELSE NULL
    END AS start_time,
    
    CASE
      WHEN date_end IS NOT NULL THEN
        TO_CHAR(date_end, 'HH24:MI:SS')
      ELSE NULL
    END AS end_time,
    
    -- Use real location from JSON-LD
    location as event_location,
    
    -- Use real price from JSON-LD
    CASE
      WHEN price IS NOT NULL AND price > 0 THEN
        price
      ELSE NULL
    END AS price_gbp,
    
    -- Use real availability from JSON-LD
    availability,
    
    -- Mark as real data
    'hybrid_scraper' as method,
    95 as specificity
    
  FROM page_entities 
  WHERE kind = 'event' 
    AND raw IS NOT NULL 
    AND raw != '{}'
    AND raw->>'@type' = 'Event'
    AND date_start IS NOT NULL
    -- Include calendar pages that contain all events
    AND url IN (
      'https://www.alanranger.com/beginners-photography-classes',
      'https://www.alanranger.com/landscape-photography-workshops',
      'https://www.alanranger.com/one-day-landscape-photography-workshops',
      'https://www.alanranger.com/course-finder-photography-classes-near-me',
      'https://www.alanranger.com/photography-workshops-near-me',
      'https://www.alanranger.com/photo-editing-course-coventry',
      'https://www.alanranger.com/rps-courses-mentoring-distinctions'
    )
),

-- Deduplicate by event name, date, and location
deduplicated_events AS (
  SELECT 
    event_url,
    event_name,
    subtype,
    date_start,
    date_end,
    start_time,
    end_time,
    event_location,
    price_gbp,
    availability,
    method,
    specificity,
    ROW_NUMBER() OVER (
      PARTITION BY event_name, date_start, event_location
      ORDER BY event_url
    ) as rn
  FROM all_events
  WHERE event_name IS NOT NULL 
    AND event_name != ''
    AND date_start IS NOT NULL
)

SELECT 
  event_url,
  subtype,
  date_start,
  date_end,
  start_time,
  end_time,
  event_location,
  price_gbp,
  availability,
  method,
  specificity
FROM deduplicated_events
WHERE rn = 1;

-- STEP 2: CREATE PRODUCT MAPPING FOR HYBRID APPROACH
CREATE OR REPLACE VIEW v_event_product_links_hybrid AS
WITH
-- Get hybrid event data
hybrid_events AS (
  SELECT 
    event_url,
    subtype,
    date_start,
    date_end,
    start_time,
    end_time,
    event_location,
    method,
    specificity
  FROM v_events_hybrid
),

-- Map to products based on event type
event_product_mapping AS (
  SELECT 
    he.event_url,
    CASE
      -- Camera courses map to beginners photography course
      WHEN he.subtype = 'course' AND he.event_url ILIKE '%camera-courses%'
      THEN 'https://www.alanranger.com/photography-services-near-me/beginners-photography-course'
      
      -- Lightroom courses map to lightroom course
      WHEN he.subtype = 'course' AND he.event_url ILIKE '%lightroom%'
      THEN 'https://www.alanranger.com/photography-services-near-me/lightroom-courses-for-beginners-coventry'
      
      -- RPS courses map to RPS mentoring
      WHEN he.subtype = 'course' AND he.event_url ILIKE '%rps%'
      THEN 'https://www.alanranger.com/photography-services-near-me/rps-mentoring-photography-course'
      
      -- Workshops map to photo-workshops-uk products
      WHEN he.subtype = 'workshop' AND he.event_url ILIKE '%photographic-workshops-near-me%'
      THEN CASE
        WHEN he.event_url ILIKE '%norfolk%' THEN 'https://www.alanranger.com/photo-workshops-uk/landscape-photography-workshop-norfolk'
        WHEN he.event_url ILIKE '%peak-district%' THEN 'https://www.alanranger.com/photo-workshops-uk/landscape-peak-district-photography-workshops-derbyshire'
        WHEN he.event_url ILIKE '%poppy%' THEN 'https://www.alanranger.com/photo-workshops-uk/photography-workshops-lavender-fields'
        WHEN he.event_url ILIKE '%woodland%' THEN 'https://www.alanranger.com/photo-workshops-uk/woodland-photography-walk-warwickshire'
        WHEN he.event_url ILIKE '%yorkshire%' THEN 'https://www.alanranger.com/photo-workshops-uk/north-yorkshire-landscape-photography'
        WHEN he.event_url ILIKE '%wales%' OR he.event_url ILIKE '%nant-mill%' THEN 'https://www.alanranger.com/photo-workshops-uk/landscape-photography-workshops-anglesey'
        WHEN he.event_url ILIKE '%somerset%' THEN 'https://www.alanranger.com/photo-workshops-uk/somerset-landscape-photography-workshops'
        ELSE 'https://www.alanranger.com/photo-workshops-uk/landscape-photography-workshops'
      END
      
      ELSE 'https://www.alanranger.com/photo-workshops-uk/landscape-photography-workshops'
    END AS product_url,
    'hybrid_mapping' as method,
    90 as specificity
  FROM hybrid_events he
)

SELECT 
  event_url,
  product_url,
  method,
  specificity
FROM event_product_mapping
WHERE product_url IS NOT NULL;

-- STEP 3: CREATE FINAL PRICING VIEW FOR HYBRID APPROACH
CREATE OR REPLACE VIEW v_event_product_pricing_hybrid AS
SELECT 
  he.event_url,
  he.subtype,
  he.date_start,
  he.date_end,
  he.start_time,
  he.end_time,
  he.event_location,
  epl.product_url,
  he.method,
  he.specificity,
  he.price_gbp,
  'hybrid_json_ld' as price_source,
  he.availability
FROM v_events_hybrid he
LEFT JOIN v_event_product_links_hybrid epl ON epl.event_url = he.event_url
WHERE epl.product_url IS NOT NULL
ORDER BY he.date_start;

-- STEP 4: ANALYSIS OF HYBRID APPROACH
SELECT 
  'Hybrid Approach Analysis' as analysis_type,
  COUNT(*) as total_events,
  COUNT(CASE WHEN event_location IS NOT NULL THEN 1 END) as with_real_locations,
  COUNT(CASE WHEN start_time IS NOT NULL THEN 1 END) as with_real_times,
  COUNT(CASE WHEN price_gbp IS NOT NULL THEN 1 END) as with_real_prices,
  COUNT(CASE WHEN method = 'hybrid_scraper' THEN 1 END) as from_hybrid_scraper
FROM v_event_product_pricing_hybrid;
