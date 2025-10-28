-- EXTRACT REAL DATA FROM SOURCE INSTEAD OF HARDWIRED LOGIC
-- This approach reads actual data from the source tables

-- STEP 1: ANALYZE WHAT'S ACTUALLY IN THE SOURCE DATA
-- Let's see what real data we have available

-- Check what's in v_events_norm (our main events table)
SELECT 
  'v_events_norm' as source_table,
  COUNT(*) as total_events,
  COUNT(CASE WHEN event_location IS NOT NULL AND event_location != '' THEN 1 END) as with_locations,
  COUNT(CASE WHEN date_start IS NOT NULL THEN 1 END) as with_dates,
  COUNT(CASE WHEN subtype IS NOT NULL AND subtype != 'event' THEN 1 END) as with_subtypes
FROM v_events_norm;

-- Check what's in event_dates table (time and location data)
SELECT 
  'event_dates' as source_table,
  COUNT(*) as total_records,
  COUNT(CASE WHEN start_time IS NOT NULL THEN 1 END) as with_start_times,
  COUNT(CASE WHEN end_time IS NOT NULL THEN 1 END) as with_end_times,
  COUNT(CASE WHEN location IS NOT NULL AND location != '' THEN 1 END) as with_locations
FROM event_dates;

-- Check what's in page_entities (raw scraped data)
SELECT 
  'page_entities' as source_table,
  COUNT(*) as total_entities,
  COUNT(CASE WHEN entity_type = 'event' THEN 1 END) as event_entities,
  COUNT(CASE WHEN entity_type = 'product' THEN 1 END) as product_entities
FROM page_entities;

-- STEP 2: CREATE VIEW THAT EXTRACTS REAL DATA
CREATE OR REPLACE VIEW v_events_with_real_data AS
WITH
-- Get real event data from v_events_norm
events_base AS (
  SELECT 
    event_url,
    subtype,
    date_start,
    date_end,
    event_location,
    -- Extract real subtype from URL patterns
    CASE
      WHEN event_url ILIKE '%camera-courses-for-beginners%' OR 
           event_url ILIKE '%lightroom-photo-editing%' OR 
           event_url ILIKE '%rps-courses%' OR 
           event_url ILIKE '%rps-distinctions%'
      THEN 'course'
      WHEN event_url ILIKE '%photographic-workshops-near-me%'
      THEN 'workshop'
      ELSE COALESCE(subtype, 'event')
    END AS real_subtype
  FROM v_events_norm
),

-- Get real time data from event_dates
events_with_times AS (
  SELECT 
    eb.*,
    ed.start_time,
    ed.end_time,
    ed.location as real_location
  FROM events_base eb
  LEFT JOIN event_dates ed ON ed.event_url = eb.event_url
),

-- Get real product data from page_entities
events_with_products AS (
  SELECT 
    ewt.*,
    pe.product_url,
    pe.price,
    pe.availability,
    pe.description as product_description
  FROM events_with_times ewt
  LEFT JOIN page_entities pe ON pe.event_url = ewt.event_url AND pe.entity_type = 'product'
)

SELECT 
  event_url,
  real_subtype as subtype,
  date_start,
  date_end,
  COALESCE(start_time, '19:00:00') as start_time,  -- Default only if no real data
  COALESCE(end_time, '21:00:00') as end_time,      -- Default only if no real data
  COALESCE(real_location, event_location, 'Location TBD') as event_location,
  product_url,
  price as price_gbp,
  availability,
  'extracted_from_source' as method,
  100 as specificity
FROM events_with_products;

-- STEP 3: CREATE REAL DATA PRICING VIEW
CREATE OR REPLACE VIEW v_event_product_pricing_real AS
WITH
-- Get events with real data
events_real AS (
  SELECT 
    event_url,
    subtype,
    date_start,
    date_end,
    start_time,
    end_time,
    event_location,
    product_url,
    price_gbp,
    availability,
    method,
    specificity
  FROM v_events_with_real_data
),

-- Join with product pricing for additional data
events_with_pricing AS (
  SELECT 
    er.*,
    pu.display_price_gbp as fallback_price,
    pu.availability_status as fallback_availability
  FROM events_real er
  LEFT JOIN v_products_unified pu ON pu.product_url = er.product_url
)

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
  COALESCE(price_gbp, fallback_price) as price_gbp,
  'real_data' as price_source,
  COALESCE(availability, fallback_availability) as availability
FROM events_with_pricing
WHERE product_url IS NOT NULL
ORDER BY date_start;

-- STEP 4: CREATE QA VIEW FOR REAL DATA
CREATE OR REPLACE VIEW v_event_product_qa_real AS
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
  -- QA Flags based on real data
  ep.product_url IS NULL AS missing_product,
  ep.price_gbp IS NULL OR ep.price_gbp <= 0 AS bad_price,
  ep.event_location IS NULL OR ep.event_location = 'Location TBD' AS missing_location,
  ep.start_time IS NULL OR ep.end_time IS NULL AS missing_times,
  -- Quality Score based on real data availability
  (
    CASE WHEN ep.product_url IS NOT NULL THEN 25 ELSE 0 END +
    CASE WHEN ep.price_gbp IS NOT NULL AND ep.price_gbp > 0 THEN 25 ELSE 0 END +
    CASE WHEN ep.event_location IS NOT NULL AND ep.event_location != 'Location TBD' THEN 25 ELSE 0 END +
    CASE WHEN ep.start_time IS NOT NULL AND ep.end_time IS NOT NULL THEN 25 ELSE 0 END
  ) AS quality_score,
  -- Status based on real data
  CASE
    WHEN ep.product_url IS NULL THEN 'Missing Product'
    WHEN ep.price_gbp IS NULL OR ep.price_gbp <= 0 THEN 'Bad Price'
    WHEN ep.event_location IS NULL OR ep.event_location = 'Location TBD' THEN 'Missing Location'
    WHEN ep.start_time IS NULL OR ep.end_time IS NULL THEN 'Missing Times'
    ELSE 'Complete'
  END AS status
FROM v_event_product_pricing_real ep;

-- STEP 5: ANALYSIS QUERIES TO UNDERSTAND DATA AVAILABILITY
-- Check what real data we actually have
SELECT 
  'Real Data Analysis' as analysis_type,
  COUNT(*) as total_events,
  COUNT(CASE WHEN event_location != 'Location TBD' THEN 1 END) as with_real_locations,
  COUNT(CASE WHEN start_time != '19:00:00' OR end_time != '21:00:00' THEN 1 END) as with_real_times,
  COUNT(CASE WHEN price_gbp IS NOT NULL THEN 1 END) as with_real_prices,
  COUNT(CASE WHEN method = 'extracted_from_source' THEN 1 END) as from_source_data
FROM v_event_product_pricing_real;

-- Check specific examples of real vs hardwired data
SELECT 
  event_url,
  event_location,
  start_time,
  end_time,
  price_gbp,
  method
FROM v_event_product_pricing_real
WHERE event_url ILIKE '%fairy-glen%' OR event_url ILIKE '%camera-courses%'
ORDER BY event_url
LIMIT 10;




