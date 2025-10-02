-- DEBUG JSON-LD EXTRACTION FOR EVENTS
-- This script helps debug why Event JSON-LD isn't being extracted

-- STEP 1: Check what types of JSON-LD are being found
SELECT 
  'JSON-LD Types Found' as analysis_type,
  COUNT(*) as total_entities,
  COUNT(CASE WHEN kind = 'event' THEN 1 END) as event_entities,
  COUNT(CASE WHEN kind = 'article' THEN 1 END) as article_entities,
  COUNT(CASE WHEN kind = 'product' THEN 1 END) as product_entities,
  COUNT(CASE WHEN kind = 'service' THEN 1 END) as service_entities
FROM page_entities 
WHERE raw IS NOT NULL AND raw != '{}';

-- STEP 2: Check what @type values are being found in JSON-LD
SELECT 
  'JSON-LD @type Values' as analysis_type,
  raw->>'@type' as json_ld_type,
  COUNT(*) as count
FROM page_entities 
WHERE raw IS NOT NULL 
  AND raw != '{}'
  AND raw::text NOT LIKE '%v_event_catalog%'
GROUP BY raw->>'@type'
ORDER BY count DESC;

-- STEP 3: Check if there are any Event JSON-LD entities
SELECT 
  'Event JSON-LD Entities' as analysis_type,
  url,
  title,
  raw->>'@type' as json_ld_type,
  raw->>'startDate' as start_date,
  raw->>'endDate' as end_date,
  raw->'location'->>'name' as location_name,
  raw->'offers'->>'price' as price
FROM page_entities 
WHERE raw IS NOT NULL 
  AND raw != '{}'
  AND (raw->>'@type' ILIKE '%event%' OR raw->>'@type' ILIKE '%course%')
LIMIT 10;

-- STEP 4: Check what the scraper is actually finding in event pages
SELECT 
  'Event Page Content' as analysis_type,
  url,
  LENGTH(chunk_text) as chunk_length,
  CASE 
    WHEN chunk_text ILIKE '%@type%' THEN 'Contains @type'
    WHEN chunk_text ILIKE '%schema.org%' THEN 'Contains schema.org'
    WHEN chunk_text ILIKE '%json%' THEN 'Contains json'
    ELSE 'No structured data markers'
  END as structured_data_indicators
FROM page_chunks 
WHERE url ILIKE '%camera-courses%' OR url ILIKE '%fairy-glen%'
ORDER BY url, id
LIMIT 5;

-- STEP 5: Check if there are any script tags with JSON-LD in event pages
SELECT 
  'JSON-LD Script Tags' as analysis_type,
  url,
  CASE 
    WHEN chunk_text ILIKE '%<script%type="application/ld+json"%' THEN 'Found JSON-LD script tags'
    WHEN chunk_text ILIKE '%<script%type=''application/ld+json''%' THEN 'Found JSON-LD script tags (single quotes)'
    WHEN chunk_text ILIKE '%application/ld+json%' THEN 'Found ld+json reference'
    ELSE 'No JSON-LD script tags found'
  END as json_ld_detection
FROM page_chunks 
WHERE url ILIKE '%camera-courses%' OR url ILIKE '%fairy-glen%'
ORDER BY url, id
LIMIT 5;


