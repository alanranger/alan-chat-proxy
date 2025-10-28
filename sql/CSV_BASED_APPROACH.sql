-- CSV-BASED APPROACH: Use CSV data as source of truth for events
-- This approach uses the CSV files as the primary source for event data

-- STEP 1: CREATE VIEW USING CSV DATA AS SOURCE OF TRUTH
CREATE OR REPLACE VIEW v_events_csv_based AS
WITH
-- Import CSV data (this would need to be done via COPY commands)
csv_events AS (
  -- This is a placeholder - the actual data would come from CSV import
  SELECT 
    'https://www.alanranger.com/beginners-photography-lessons/camera-courses-for-beginners-coventry-oct1' as event_url,
    'course' as subtype,
    '2025-10-02T19:00:00+00:00'::timestamp as date_start,
    '2025-10-02T21:00:00+00:00'::timestamp as date_end,
    '19:00:00' as start_time,
    '21:00:00' as end_time,
    'Coventry, West Midlands' as event_location,
    150.00 as price_gbp,
    'InStock' as availability,
    'csv_source' as method,
    100 as specificity
  UNION ALL
  SELECT 
    'https://www.alanranger.com/photographic-workshops-near-me/fairy-glen-photography-wales',
    'workshop',
    '2025-10-04T10:00:00+00:00'::timestamp,
    '2025-10-04T13:30:00+00:00'::timestamp,
    '10:00:00',
    '13:30:00',
    'Betws-y-Coed, Wales, LL24 0SG, United Kingdom',
    150.00,
    'InStock',
    'csv_source',
    100
  -- Add more events from CSV files here
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
FROM csv_events;

-- STEP 2: CREATE PRODUCT MAPPING FOR CSV-BASED APPROACH
CREATE OR REPLACE VIEW v_event_product_links_csv_based AS
WITH
-- Get CSV event data
csv_events AS (
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
  FROM v_events_csv_based
),

-- Map to products based on event type
event_product_mapping AS (
  SELECT 
    ce.event_url,
    CASE
      -- Camera courses map to beginners photography course
      WHEN ce.subtype = 'course' AND ce.event_url ILIKE '%camera-courses%'
      THEN 'https://www.alanranger.com/photography-services-near-me/beginners-photography-course'
      
      -- Lightroom courses map to lightroom course
      WHEN ce.subtype = 'course' AND ce.event_url ILIKE '%lightroom%'
      THEN 'https://www.alanranger.com/photography-services-near-me/lightroom-courses-for-beginners-coventry'
      
      -- RPS courses map to RPS mentoring
      WHEN ce.subtype = 'course' AND ce.event_url ILIKE '%rps%'
      THEN 'https://www.alanranger.com/photography-services-near-me/rps-mentoring-photography-course'
      
      -- Workshops map to photo-workshops-uk products
      WHEN ce.subtype = 'workshop' AND ce.event_url ILIKE '%photographic-workshops-near-me%'
      THEN CASE
        WHEN ce.event_url ILIKE '%fairy-glen%' THEN 'https://www.alanranger.com/photo-workshops-uk/landscape-photography-workshops-anglesey'
        WHEN ce.event_url ILIKE '%norfolk%' THEN 'https://www.alanranger.com/photo-workshops-uk/landscape-photography-workshop-norfolk'
        WHEN ce.event_url ILIKE '%peak-district%' THEN 'https://www.alanranger.com/photo-workshops-uk/landscape-peak-district-photography-workshops-derbyshire'
        WHEN ce.event_url ILIKE '%poppy%' THEN 'https://www.alanranger.com/photo-workshops-uk/photography-workshops-lavender-fields'
        WHEN ce.event_url ILIKE '%woodland%' THEN 'https://www.alanranger.com/photo-workshops-uk/woodland-photography-walk-warwickshire'
        WHEN ce.event_url ILIKE '%yorkshire%' THEN 'https://www.alanranger.com/photo-workshops-uk/north-yorkshire-landscape-photography'
        WHEN ce.event_url ILIKE '%wales%' OR ce.event_url ILIKE '%nant-mill%' THEN 'https://www.alanranger.com/photo-workshops-uk/landscape-photography-workshops-anglesey'
        WHEN ce.event_url ILIKE '%somerset%' THEN 'https://www.alanranger.com/photo-workshops-uk/somerset-landscape-photography-workshops'
        ELSE 'https://www.alanranger.com/photo-workshops-uk/landscape-photography-workshops'
      END
      
      ELSE 'https://www.alanranger.com/photo-workshops-uk/landscape-photography-workshops'
    END AS product_url,
    'csv_mapping' as method,
    100 as specificity
  FROM csv_events ce
)

SELECT 
  event_url,
  product_url,
  method,
  specificity
FROM event_product_mapping
WHERE product_url IS NOT NULL;

-- STEP 3: CREATE FINAL PRICING VIEW FOR CSV-BASED APPROACH
CREATE OR REPLACE VIEW v_event_product_pricing_csv_based AS
SELECT 
  ce.event_url,
  ce.subtype,
  ce.date_start,
  ce.date_end,
  ce.start_time,
  ce.end_time,
  ce.event_location,
  epl.product_url,
  ce.method,
  ce.specificity,
  ce.price_gbp,
  'csv_source' as price_source,
  ce.availability
FROM v_events_csv_based ce
LEFT JOIN v_event_product_links_csv_based epl ON epl.event_url = ce.event_url
WHERE epl.product_url IS NOT NULL
ORDER BY ce.date_start;

-- STEP 4: ANALYSIS OF CSV-BASED APPROACH
SELECT 
  'CSV-Based Approach Analysis' as analysis_type,
  COUNT(*) as total_events,
  COUNT(CASE WHEN event_location IS NOT NULL THEN 1 END) as with_real_locations,
  COUNT(CASE WHEN start_time IS NOT NULL THEN 1 END) as with_real_times,
  COUNT(CASE WHEN price_gbp IS NOT NULL THEN 1 END) as with_real_prices,
  COUNT(CASE WHEN method = 'csv_source' THEN 1 END) as from_csv_source
FROM v_event_product_pricing_csv_based;



