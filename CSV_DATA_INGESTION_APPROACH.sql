-- CSV DATA INGESTION APPROACH
-- This approach uses the real data from CSV files instead of web scraping

-- STEP 1: CREATE TABLES TO STORE CSV DATA
CREATE TABLE IF NOT EXISTS csv_events_data (
  id SERIAL PRIMARY KEY,
  event_title TEXT,
  start_date DATE,
  start_time TIME,
  end_date DATE,
  end_time TIME,
  category TEXT,
  tags TEXT,
  excerpt TEXT,
  location_business_name TEXT,
  location_address TEXT,
  location_city_state_zip TEXT,
  event_url TEXT UNIQUE,
  event_image TEXT,
  text_block TEXT,
  published_date TIMESTAMP,
  workflow_state TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- STEP 2: CREATE VIEW THAT USES REAL CSV DATA
CREATE OR REPLACE VIEW v_events_from_csv AS
WITH
-- Extract real data from CSV
csv_events AS (
  SELECT 
    event_url,
    -- Extract real subtype from event title and URL
    CASE
      WHEN event_title ILIKE '%camera courses%' OR 
           event_title ILIKE '%lightroom%' OR 
           event_title ILIKE '%rps%' OR
           event_url ILIKE '%beginners-photography-lessons%'
      THEN 'course'
      WHEN event_title ILIKE '%workshop%' OR 
           event_url ILIKE '%photographic-workshops-near-me%'
      THEN 'workshop'
      ELSE 'event'
    END AS real_subtype,
    
    -- Use real dates from CSV
    start_date as real_date_start,
    end_date as real_date_end,
    
    -- Use real times from CSV
    start_time as real_start_time,
    end_time as real_end_time,
    
    -- Use real locations from CSV
    COALESCE(
      location_address,
      location_business_name,
      location_city_state_zip,
      'Location TBD'
    ) as real_location,
    
    -- Extract real pricing from text_block or use default
    CASE
      WHEN text_block ILIKE '%£%' THEN 
        CAST(REGEXP_REPLACE(REGEXP_SUBSTR(text_block, '£[0-9,]+'), '[£,]', '', 'g') AS NUMERIC)
      ELSE NULL
    END as real_price,
    
    event_title as real_title,
    excerpt as real_description
  FROM csv_events_data
),

-- Join with existing product data
events_with_products AS (
  SELECT 
    ce.*,
    pe.product_url,
    pe.price as product_price,
    pe.availability as product_availability
  FROM csv_events ce
  LEFT JOIN page_entities pe ON pe.url = ce.event_url AND pe.kind = 'product'
)

SELECT 
  event_url,
  real_subtype as subtype,
  real_date_start as date_start,
  real_date_end as date_end,
  real_start_time as start_time,
  real_end_time as end_time,
  real_location as event_location,
  product_url,
  COALESCE(real_price, product_price) as price_gbp,
  product_availability as availability,
  'csv_data' as method,
  100 as specificity
FROM events_with_products
WHERE event_url IS NOT NULL;

-- STEP 3: CREATE PRICING VIEW FROM CSV DATA
CREATE OR REPLACE VIEW v_event_product_pricing_csv AS
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
  'csv_data' as price_source,
  availability
FROM v_events_from_csv
WHERE product_url IS NOT NULL
ORDER BY date_start;

-- STEP 4: CREATE QA VIEW FOR CSV DATA
CREATE OR REPLACE VIEW v_event_product_qa_csv AS
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
  -- QA Flags based on CSV data
  ep.product_url IS NULL AS missing_product,
  ep.price_gbp IS NULL OR ep.price_gbp <= 0 AS bad_price,
  ep.event_location IS NULL OR ep.event_location = 'Location TBD' AS missing_location,
  ep.start_time IS NULL OR ep.end_time IS NULL AS missing_times,
  -- Quality Score based on CSV data availability
  (
    CASE WHEN ep.product_url IS NOT NULL THEN 25 ELSE 0 END +
    CASE WHEN ep.price_gbp IS NOT NULL AND ep.price_gbp > 0 THEN 25 ELSE 0 END +
    CASE WHEN ep.event_location IS NOT NULL AND ep.event_location != 'Location TBD' THEN 25 ELSE 0 END +
    CASE WHEN ep.start_time IS NOT NULL AND ep.end_time IS NOT NULL THEN 25 ELSE 0 END
  ) AS quality_score,
  -- Status based on CSV data
  CASE
    WHEN ep.product_url IS NULL THEN 'Missing Product'
    WHEN ep.price_gbp IS NULL OR ep.price_gbp <= 0 THEN 'Bad Price'
    WHEN ep.event_location IS NULL OR ep.event_location = 'Location TBD' THEN 'Missing Location'
    WHEN ep.start_time IS NULL OR ep.end_time IS NULL THEN 'Missing Times'
    ELSE 'Complete'
  END AS status
FROM v_event_product_pricing_csv ep;

-- STEP 5: ANALYSIS QUERIES TO UNDERSTAND CSV DATA AVAILABILITY
-- Check what real data we have from CSV
SELECT 
  'CSV Data Analysis' as analysis_type,
  COUNT(*) as total_events,
  COUNT(CASE WHEN event_location != 'Location TBD' THEN 1 END) as with_real_locations,
  COUNT(CASE WHEN start_time IS NOT NULL THEN 1 END) as with_real_times,
  COUNT(CASE WHEN price_gbp IS NOT NULL THEN 1 END) as with_real_prices,
  COUNT(CASE WHEN method = 'csv_data' THEN 1 END) as from_csv_data
FROM v_event_product_pricing_csv;

-- Check specific examples from CSV data
SELECT 
  event_url,
  event_location,
  start_time,
  end_time,
  price_gbp,
  method
FROM v_event_product_pricing_csv
WHERE event_url ILIKE '%fairy-glen%' OR event_url ILIKE '%camera-courses%'
ORDER BY event_url
LIMIT 10;


