-- ENHANCED DATABASE SCHEMA FOR MULTI-SOURCE DATA PIPELINE
-- This script creates the complete database schema for handling all content types

-- STEP 1: CREATE ENRICHED CONTENT VIEWS
-- These views extract and categorize content from the page_entities table

-- Blog content view
CREATE OR REPLACE VIEW v_blog_content AS
SELECT 
  url,
  title,
  raw->>'headline' as headline,
  raw->>'datePublished' as publish_date,
  raw->>'keywords' as keywords,
  raw->>'articleSection' as article_section,
  raw->>'image' as image_url,
  (raw->'author'->>'name') as author,
  (raw->'publisher'->>'name') as publisher,
  'blog' as content_type,
  raw->>'keywords' as tags,
  raw->>'articleSection' as categories
FROM page_entities 
WHERE kind = 'article' 
  AND raw IS NOT NULL 
  AND raw != '{}'
  AND raw->>'@type' = 'BlogPosting';

-- Workshop content view
CREATE OR REPLACE VIEW v_workshop_content AS
SELECT 
  url,
  title,
  location,
  raw->>'eventType' as workshop_type,
  raw->>'keywords' as tags,
  raw->>'eventType' as categories,
  raw->>'image' as image_url,
  (raw->'organizer'->>'name') as organizer,
  'workshop' as content_type,
  CASE
    WHEN raw->>'eventType' = 'half-day' THEN 'Half Day Workshop'
    WHEN raw->>'eventType' = 'one-day' THEN 'One Day Workshop'
    WHEN raw->>'eventType' = 'weekend' THEN 'Weekend Workshop'
    ELSE 'Workshop'
  END as workshop_category
FROM page_entities 
WHERE kind = 'event' 
  AND raw IS NOT NULL 
  AND raw != '{}'
  AND raw->>'@type' = 'Event'
  AND url ILIKE '%photo-workshops-uk%';

-- Service content view
CREATE OR REPLACE VIEW v_service_content AS
SELECT 
  url,
  title,
  location,
  raw->>'serviceType' as service_type,
  raw->>'keywords' as tags,
  raw->>'serviceType' as categories,
  raw->>'image' as image_url,
  (raw->'provider'->>'name') as provider,
  'service' as content_type,
  CASE
    WHEN raw->>'serviceType' = 'course' THEN 'Photography Course'
    WHEN raw->>'serviceType' = 'private-lesson' THEN 'Private Lesson'
    WHEN raw->>'serviceType' = 'tuition' THEN 'Photography Tuition'
    WHEN raw->>'serviceType' = 'product' THEN 'Photography Product'
    ELSE 'Service'
  END as service_category
FROM page_entities 
WHERE kind = 'service' 
  AND raw IS NOT NULL 
  AND raw != '{}'
  AND raw->>'@type' = 'Service';

-- Product content view
CREATE OR REPLACE VIEW v_product_content AS
SELECT 
  url,
  title,
  description,
  sku,
  price,
  price_currency,
  availability,
  raw->>'keywords' as tags,
  raw->>'category' as categories,
  raw->>'image' as image_urls,
  (raw->'brand'->>'name') as brand,
  'product' as content_type,
  CASE
    WHEN price <= 10 THEN 'Low Cost'
    WHEN price <= 50 THEN 'Mid Range'
    WHEN price <= 200 THEN 'Premium'
    ELSE 'High End'
  END as price_tier
FROM page_entities 
WHERE kind = 'product' 
  AND raw IS NOT NULL 
  AND raw != '{}'
  AND raw->>'@type' = 'Product';

-- STEP 2: CREATE CONTENT-TO-PRODUCT MAPPINGS
-- These views create intelligent mappings between content and products

-- Blog to product mappings
CREATE OR REPLACE VIEW v_blog_product_mappings AS
SELECT 
  bc.url as blog_url,
  bc.title as blog_title,
  bc.tags as blog_tags,
  bc.categories as blog_categories,
  pc.url as product_url,
  pc.title as product_title,
  pc.price as product_price,
  pc.availability as product_availability,
  pc.tags as product_tags,
  pc.categories as product_categories,
  'content_recommendation' as mapping_type,
    CASE
      WHEN string_to_array(bc.tags, ',') && string_to_array(pc.tags, ',') THEN 90
      WHEN string_to_array(bc.categories, ',') && string_to_array(pc.categories, ',') THEN 80
      WHEN string_to_array(bc.tags, ',') && string_to_array(pc.categories, ',') THEN 70
      WHEN string_to_array(bc.categories, ',') && string_to_array(pc.tags, ',') THEN 70
      ELSE 50
    END as mapping_score
FROM v_blog_content bc
CROSS JOIN v_product_content pc
WHERE (
  string_to_array(bc.tags, ',') && string_to_array(pc.tags, ',') OR 
  string_to_array(bc.categories, ',') && string_to_array(pc.categories, ',') OR
  string_to_array(bc.tags, ',') && string_to_array(pc.categories, ',') OR
  string_to_array(bc.categories, ',') && string_to_array(pc.tags, ',')
);

-- Workshop to product mappings
CREATE OR REPLACE VIEW v_workshop_product_mappings AS
SELECT 
  wc.url as workshop_url,
  wc.title as workshop_title,
  wc.location as workshop_location,
  wc.tags as workshop_tags,
  wc.categories as workshop_categories,
  pc.url as product_url,
  pc.title as product_title,
  pc.price as product_price,
  pc.availability as product_availability,
  pc.tags as product_tags,
  pc.categories as product_categories,
  'workshop_related' as mapping_type,
    CASE
      WHEN string_to_array(wc.tags, ',') && string_to_array(pc.tags, ',') THEN 95
      WHEN string_to_array(wc.categories, ',') && string_to_array(pc.categories, ',') THEN 85
      WHEN wc.location IS NOT NULL AND string_to_array(pc.tags, ',') && ARRAY[wc.location] THEN 90
      ELSE 60
    END as mapping_score
FROM v_workshop_content wc
CROSS JOIN v_product_content pc
WHERE (
  string_to_array(wc.tags, ',') && string_to_array(pc.tags, ',') OR 
  string_to_array(wc.categories, ',') && string_to_array(pc.categories, ',') OR
  (wc.location IS NOT NULL AND string_to_array(pc.tags, ',') && ARRAY[wc.location])
);

-- Service to product mappings
CREATE OR REPLACE VIEW v_service_product_mappings AS
SELECT 
  sc.url as service_url,
  sc.title as service_title,
  sc.location as service_location,
  sc.tags as service_tags,
  sc.categories as service_categories,
  pc.url as product_url,
  pc.title as product_title,
  pc.price as product_price,
  pc.availability as product_availability,
  pc.tags as product_tags,
  pc.categories as product_categories,
  'service_related' as mapping_type,
    CASE
      WHEN string_to_array(sc.tags, ',') && string_to_array(pc.tags, ',') THEN 95
      WHEN string_to_array(sc.categories, ',') && string_to_array(pc.categories, ',') THEN 85
      WHEN sc.location IS NOT NULL AND string_to_array(pc.tags, ',') && ARRAY[sc.location] THEN 90
      ELSE 60
    END as mapping_score
FROM v_service_content sc
CROSS JOIN v_product_content pc
WHERE (
  string_to_array(sc.tags, ',') && string_to_array(pc.tags, ',') OR 
  string_to_array(sc.categories, ',') && string_to_array(pc.categories, ',') OR
  (sc.location IS NOT NULL AND string_to_array(pc.tags, ',') && ARRAY[sc.location])
);

-- STEP 3: CREATE ENRICHED CONTENT VIEW FOR AI TRAINING
-- This view combines all content types for comprehensive AI training

CREATE OR REPLACE VIEW v_enriched_content AS
SELECT 
  'blog' as content_type,
  url,
  title,
  headline as description,
  publish_date as content_date,
  tags,
  categories,
  image_url,
  author,
  publisher as provider,
  NULL as price,
  NULL as availability,
  NULL as location
FROM v_blog_content
UNION ALL
SELECT 
  'workshop' as content_type,
  url,
  title,
  NULL as description,
  NULL as content_date,
  tags,
  categories,
  image_url,
  organizer as author,
  organizer as provider,
  NULL as price,
  NULL as availability,
  location
FROM v_workshop_content
UNION ALL
SELECT 
  'service' as content_type,
  url,
  title,
  NULL as description,
  NULL as content_date,
  tags,
  categories,
  image_url,
  provider as author,
  provider as provider,
  NULL as price,
  NULL as availability,
  location
FROM v_service_content
  UNION ALL
SELECT 
  'product' as content_type,
  url,
  title,
  description,
  NULL as content_date,
  tags,
  categories,
  image_urls as image_url,
  brand as author,
  brand as provider,
  price::text,
  availability,
  NULL as location
FROM v_product_content;

-- STEP 4: CREATE LOCATION-BASED CONTENT VIEWS
-- These views organize content by location for location-based recommendations

CREATE OR REPLACE VIEW v_location_content AS
SELECT 
  location,
  content_type,
  COUNT(*) as content_count,
  ARRAY_AGG(DISTINCT url) as urls,
  ARRAY_AGG(DISTINCT title) as titles,
  ARRAY_AGG(DISTINCT tags) as all_tags,
  ARRAY_AGG(DISTINCT categories) as all_categories
FROM v_enriched_content
WHERE location IS NOT NULL
GROUP BY location, content_type
ORDER BY location, content_type;

-- STEP 5: CREATE CONTENT RECOMMENDATION ENGINE
-- This view provides intelligent content recommendations

CREATE OR REPLACE VIEW v_content_recommendations AS
WITH
-- Get all content with their tags and categories
content_with_metadata AS (
  SELECT 
    url,
    title,
    content_type,
    tags,
    categories,
    location,
    price,
    availability
  FROM v_enriched_content
),

-- Create recommendation scores based on content similarity
recommendations AS (
  SELECT 
    c1.url as source_url,
    c1.title as source_title,
    c1.content_type as source_type,
    c2.url as recommended_url,
    c2.title as recommended_title,
    c2.content_type as recommended_type,
    c2.location as recommended_location,
    c2.price as recommended_price,
    c2.availability as recommended_availability,
    CASE
      WHEN string_to_array(c1.tags, ',') && string_to_array(c2.tags, ',') THEN 90
      WHEN string_to_array(c1.categories, ',') && string_to_array(c2.categories, ',') THEN 80
      WHEN c1.location = c2.location THEN 85
      WHEN c1.content_type = c2.content_type THEN 70
      ELSE 50
    END as recommendation_score
  FROM content_with_metadata c1
  CROSS JOIN content_with_metadata c2
  WHERE c1.url != c2.url
)

SELECT 
  source_url,
  source_title,
  source_type,
  recommended_url,
  recommended_title,
  recommended_type,
  recommended_location,
  recommended_price,
  recommended_availability,
  recommendation_score
FROM recommendations
WHERE recommendation_score >= 70
ORDER BY source_url, recommendation_score DESC;

-- STEP 6: ANALYSIS QUERIES
-- These queries provide insights into the content ecosystem

-- Content overview
CREATE OR REPLACE VIEW v_content_overview AS
SELECT 
  content_type,
  COUNT(*) as total_content,
  COUNT(CASE WHEN location IS NOT NULL THEN 1 END) as with_location,
  COUNT(CASE WHEN price IS NOT NULL THEN 1 END) as with_price,
  COUNT(CASE WHEN tags IS NOT NULL THEN 1 END) as with_tags,
  COUNT(CASE WHEN categories IS NOT NULL THEN 1 END) as with_categories
FROM v_enriched_content
GROUP BY content_type
ORDER BY content_type;

-- Tag analysis
CREATE OR REPLACE VIEW v_tag_analysis AS
SELECT 
  tag,
  COUNT(*) as usage_count,
  ARRAY_AGG(DISTINCT content_type) as content_types,
  ARRAY_AGG(DISTINCT url) as urls
FROM (
  SELECT 
    unnest(string_to_array(tags, ',')) as tag,
    content_type,
    url
  FROM v_enriched_content
  WHERE tags IS NOT NULL
) t
GROUP BY tag
ORDER BY usage_count DESC;

-- Category analysis
CREATE OR REPLACE VIEW v_category_analysis AS
SELECT 
  category,
  COUNT(*) as usage_count,
  ARRAY_AGG(DISTINCT content_type) as content_types,
  ARRAY_AGG(DISTINCT url) as urls
FROM (
  SELECT 
    unnest(string_to_array(categories, ',')) as category,
    content_type,
    url
  FROM v_enriched_content
  WHERE categories IS NOT NULL
) c
GROUP BY category
ORDER BY usage_count DESC;
