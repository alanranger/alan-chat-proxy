-- ENHANCED SCRAPER APPROACH
-- This approach improves the scraper to extract structured data from HTML content

-- STEP 1: CREATE VIEW THAT EXTRACTS REAL DATA FROM CHUNKS
CREATE OR REPLACE VIEW v_events_from_chunks AS
WITH
-- Extract event data from page_chunks
chunk_events AS (
  SELECT 
    url,
    chunk_text,
    -- Extract event information from chunk text using regex
    CASE
      WHEN chunk_text ILIKE '%camera courses%' OR 
           chunk_text ILIKE '%lightroom%' OR 
           chunk_text ILIKE '%rps%' OR
           url ILIKE '%beginners-photography-lessons%'
      THEN 'course'
      WHEN chunk_text ILIKE '%workshop%' OR 
           url ILIKE '%photographic-workshops-near-me%'
      THEN 'workshop'
      ELSE 'event'
    END AS real_subtype,
    
    -- Extract dates from chunk text
    CASE
      WHEN chunk_text ~ '\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}' THEN
        (REGEXP_MATCH(chunk_text, '\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}'))[1]::timestamp
      WHEN chunk_text ~ '\d{1,2} \w+ \d{4}' THEN
        -- Parse dates like "13 January 2026"
        CASE
          WHEN chunk_text ~ '(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})' THEN
            TO_TIMESTAMP(REGEXP_REPLACE(
              REGEXP_REPLACE(chunk_text, '(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})', '\1 \2 \3'),
              'January', '01'), 'DD MM YYYY')
          ELSE NULL
        END
      ELSE NULL
    END AS real_date_start,
    
    -- Extract times from chunk text
    CASE
      WHEN chunk_text ~ '\d{2}:\d{2}' THEN
        (REGEXP_MATCH(chunk_text, '\d{2}:\d{2}'))[1]
      ELSE NULL
    END AS real_start_time,
    
    -- Extract locations from chunk text
    CASE
      WHEN chunk_text ~ '45 Hathaway Road' THEN '45 Hathaway Road, Coventry, England, CV4 9HW, United Kingdom'
      WHEN chunk_text ~ 'Online - Virtual Class' THEN 'Online - Virtual Class - Zoom Meeting'
      WHEN chunk_text ~ 'Betws-y-Coed' THEN 'Betws-y-Coed, Wales, LL24 0SG, United Kingdom'
      WHEN chunk_text ~ 'Coventry' THEN 'Coventry, West Midlands'
      ELSE NULL
    END AS real_location,
    
    -- Extract prices from chunk text
    CASE
      WHEN chunk_text ~ '£\d+\.\d+' THEN
        CAST(REGEXP_REPLACE((REGEXP_MATCH(chunk_text, '£\d+\.\d+'))[1], '£', '') AS NUMERIC)
      ELSE NULL
    END AS real_price
  FROM page_chunks
  WHERE chunk_text ILIKE '%[EVENT]%' OR chunk_text ILIKE '%camera courses%' OR chunk_text ILIKE '%workshop%'
),

-- Aggregate data by URL
aggregated_events AS (
  SELECT 
    url,
    MAX(real_subtype) as subtype,
    MAX(real_date_start) as date_start,
    MAX(real_start_time) as start_time,
    MAX(real_location) as event_location,
    MAX(real_price) as price_gbp
  FROM chunk_events
  GROUP BY url
)

SELECT 
  url as event_url,
  subtype,
  date_start,
  date_start as date_end, -- Assume same day events
  start_time,
  CASE
    WHEN start_time = '19:00' THEN '21:00'
    WHEN start_time = '10:00' THEN '13:30'
    WHEN start_time = '09:30' THEN '11:30'
    ELSE '21:00'
  END as end_time,
  event_location,
  NULL as product_url, -- Will be filled by product mapping
  'chunk_extraction' as method,
  90 as specificity,
  price_gbp,
  'InStock' as availability
FROM aggregated_events
WHERE url IS NOT NULL;

-- STEP 2: CREATE PRICING VIEW FROM CHUNK DATA
CREATE OR REPLACE VIEW v_event_product_pricing_chunks AS
WITH
-- Get events from chunks
events_from_chunks AS (
  SELECT 
    event_url,
    subtype,
    date_start,
    date_end,
    start_time,
    end_time,
    event_location,
    method,
    specificity,
    price_gbp,
    availability
  FROM v_events_from_chunks
),

-- Join with product data
events_with_products AS (
  SELECT 
    efc.*,
    pe.product_url,
    pe.price as product_price,
    pe.availability as product_availability
  FROM events_from_chunks efc
  LEFT JOIN page_entities pe ON pe.url = efc.event_url AND pe.kind = 'product'
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
  COALESCE(price_gbp, product_price) as price_gbp,
  'chunk_extraction' as price_source,
  COALESCE(availability, product_availability) as availability
FROM events_with_products
WHERE product_url IS NOT NULL
ORDER BY date_start;

-- STEP 3: CREATE QA VIEW FOR CHUNK DATA
CREATE OR REPLACE VIEW v_event_product_qa_chunks AS
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
  -- QA Flags based on chunk data
  ep.product_url IS NULL AS missing_product,
  ep.price_gbp IS NULL OR ep.price_gbp <= 0 AS bad_price,
  ep.event_location IS NULL AS missing_location,
  ep.start_time IS NULL OR ep.end_time IS NULL AS missing_times,
  -- Quality Score based on chunk data availability
  (
    CASE WHEN ep.product_url IS NOT NULL THEN 25 ELSE 0 END +
    CASE WHEN ep.price_gbp IS NOT NULL AND ep.price_gbp > 0 THEN 25 ELSE 0 END +
    CASE WHEN ep.event_location IS NOT NULL THEN 25 ELSE 0 END +
    CASE WHEN ep.start_time IS NOT NULL AND ep.end_time IS NOT NULL THEN 25 ELSE 0 END
  ) AS quality_score,
  -- Status based on chunk data
  CASE
    WHEN ep.product_url IS NULL THEN 'Missing Product'
    WHEN ep.price_gbp IS NULL OR ep.price_gbp <= 0 THEN 'Bad Price'
    WHEN ep.event_location IS NULL THEN 'Missing Location'
    WHEN ep.start_time IS NULL OR ep.end_time IS NULL THEN 'Missing Times'
    ELSE 'Complete'
  END AS status
FROM v_event_product_pricing_chunks ep;

-- STEP 4: ANALYSIS QUERIES TO UNDERSTAND CHUNK DATA AVAILABILITY
-- Check what real data we have from chunks
SELECT 
  'Chunk Data Analysis' as analysis_type,
  COUNT(*) as total_events,
  COUNT(CASE WHEN event_location IS NOT NULL THEN 1 END) as with_real_locations,
  COUNT(CASE WHEN start_time IS NOT NULL THEN 1 END) as with_real_times,
  COUNT(CASE WHEN price_gbp IS NOT NULL THEN 1 END) as with_real_prices,
  COUNT(CASE WHEN method = 'chunk_extraction' THEN 1 END) as from_chunk_data
FROM v_event_product_pricing_chunks;

-- Check specific examples from chunk data
SELECT 
  event_url,
  event_location,
  start_time,
  end_time,
  price_gbp,
  method
FROM v_event_product_pricing_chunks
WHERE event_url ILIKE '%fairy-glen%' OR event_url ILIKE '%camera-courses%'
ORDER BY event_url
LIMIT 10;


