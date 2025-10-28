-- FOCUSED SCRAPER APPROACH
-- This approach focuses on primary source pages to avoid duplicates

-- STEP 1: CREATE VIEW USING ONLY PRIMARY SOURCE PAGES
CREATE OR REPLACE VIEW v_events_focused AS
SELECT 
  url as event_url,
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
  'focused_scraper' as method,
  95 as specificity
  
FROM page_entities 
WHERE kind = 'event' 
  AND raw IS NOT NULL 
  AND raw != '{}'
  AND raw->>'@type' = 'Event'
  AND date_start IS NOT NULL
  -- Only include primary source page patterns
  AND (url ILIKE '%photography-services-near-me%' OR 
       url ILIKE '%beginners-photography-lessons%' OR 
       url ILIKE '%photographic-workshops-near-me%' OR 
       url ILIKE '%photo-workshops-uk%');

-- STEP 2: CREATE PRODUCT MAPPING FOR FOCUSED APPROACH
CREATE OR REPLACE VIEW v_event_product_links_focused AS
WITH
-- Get focused event data
focused_events AS (
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
  FROM v_events_focused
),

-- Map to products based on event type
event_product_mapping AS (
  SELECT 
    fe.event_url,
    CASE
      -- Camera courses map to beginners photography course
      WHEN fe.subtype = 'course' AND fe.event_url ILIKE '%camera-courses%'
      THEN 'https://www.alanranger.com/photography-services-near-me/beginners-photography-course'
      
      -- Lightroom courses map to lightroom course
      WHEN fe.subtype = 'course' AND fe.event_url ILIKE '%lightroom%'
      THEN 'https://www.alanranger.com/photography-services-near-me/lightroom-courses-for-beginners-coventry'
      
      -- RPS courses map to RPS mentoring
      WHEN fe.subtype = 'course' AND fe.event_url ILIKE '%rps%'
      THEN 'https://www.alanranger.com/photography-services-near-me/rps-mentoring-photography-course'
      
      -- Workshops map to photo-workshops-uk products
      WHEN fe.subtype = 'workshop' AND fe.event_url ILIKE '%photographic-workshops-near-me%'
      THEN CASE
        WHEN fe.event_url ILIKE '%norfolk%' THEN 'https://www.alanranger.com/photo-workshops-uk/landscape-photography-workshop-norfolk'
        WHEN fe.event_url ILIKE '%peak-district%' THEN 'https://www.alanranger.com/photo-workshops-uk/landscape-peak-district-photography-workshops-derbyshire'
        WHEN fe.event_url ILIKE '%poppy%' THEN 'https://www.alanranger.com/photo-workshops-uk/photography-workshops-lavender-fields'
        WHEN fe.event_url ILIKE '%woodland%' THEN 'https://www.alanranger.com/photo-workshops-uk/woodland-photography-walk-warwickshire'
        WHEN fe.event_url ILIKE '%yorkshire%' THEN 'https://www.alanranger.com/photo-workshops-uk/north-yorkshire-landscape-photography'
        WHEN fe.event_url ILIKE '%wales%' OR fe.event_url ILIKE '%nant-mill%' THEN 'https://www.alanranger.com/photo-workshops-uk/landscape-photography-workshops-anglesey'
        WHEN fe.event_url ILIKE '%somerset%' THEN 'https://www.alanranger.com/photo-workshops-uk/somerset-landscape-photography-workshops'
        ELSE 'https://www.alanranger.com/photo-workshops-uk/landscape-photography-workshops'
      END
      
      ELSE 'https://www.alanranger.com/photo-workshops-uk/landscape-photography-workshops'
    END AS product_url,
    'focused_mapping' as method,
    90 as specificity
  FROM focused_events fe
)

SELECT 
  event_url,
  product_url,
  method,
  specificity
FROM event_product_mapping
WHERE product_url IS NOT NULL;

-- STEP 3: CREATE FINAL PRICING VIEW FOR FOCUSED APPROACH
CREATE OR REPLACE VIEW v_event_product_pricing_focused AS
SELECT 
  fe.event_url,
  fe.subtype,
  fe.date_start,
  fe.date_end,
  fe.start_time,
  fe.end_time,
  fe.event_location,
  epl.product_url,
  fe.method,
  fe.specificity,
  fe.price_gbp,
  'focused_json_ld' as price_source,
  fe.availability
FROM v_events_focused fe
LEFT JOIN v_event_product_links_focused epl ON epl.event_url = fe.event_url
WHERE epl.product_url IS NOT NULL
ORDER BY fe.date_start;

-- STEP 4: ANALYSIS OF FOCUSED APPROACH
SELECT 
  'Focused Approach Analysis' as analysis_type,
  COUNT(*) as total_events,
  COUNT(CASE WHEN event_location IS NOT NULL THEN 1 END) as with_real_locations,
  COUNT(CASE WHEN start_time IS NOT NULL THEN 1 END) as with_real_times,
  COUNT(CASE WHEN price_gbp IS NOT NULL THEN 1 END) as with_real_prices,
  COUNT(CASE WHEN method = 'focused_scraper' THEN 1 END) as from_focused_scraper
FROM v_event_product_pricing_focused;
