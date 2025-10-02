-- SCALABLE MAPPING SYSTEM FOR FUTURE EVENTS AND PRODUCTS
-- This creates a rule-based system that can handle new events/products automatically

-- STEP 1: CREATE MAPPING RULES TABLE
CREATE TABLE IF NOT EXISTS event_product_mapping_rules (
  id SERIAL PRIMARY KEY,
  rule_name VARCHAR(255) NOT NULL,
  event_pattern TEXT NOT NULL,
  product_pattern TEXT NOT NULL,
  priority INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- STEP 2: INSERT INITIAL MAPPING RULES
INSERT INTO event_product_mapping_rules (rule_name, event_pattern, product_pattern, priority) VALUES
-- Course mappings
('Camera Courses', '%camera-courses-for-beginners%', '%photography-services-near-me/beginners-photography-course%', 100),
('Lightroom Courses', '%lightroom-photo-editing%', '%photography-services-near-me/lightroom-courses-for-beginners-coventry%', 100),
('RPS Courses', '%rps-courses%', '%photography-services-near-me/rps-mentoring-photography-course%', 100),
('RPS Distinctions', '%rps-distinctions%', '%photography-services-near-me/rps-mentoring-photography-course%', 100),

-- Workshop mappings by location
('Chesterton Workshops', '%chesterton%', '%photo-workshops-uk/photography-workshops-chesterton-windmill%', 90),
('Lake District Workshops', '%lake-district%', '%photo-workshops-uk/lake-district-photography-workshop%', 90),
('Devon Workshops', '%devon%', '%photo-workshops-uk/landscape-photography-devon-hartland-quay%', 90),
('Hartland Workshops', '%hartland%', '%photo-workshops-uk/landscape-photography-devon-hartland-quay%', 90),
('Exmoor Workshops', '%exmoor%', '%photo-workshops-uk/exmoor-photography-workshops-lynmouth%', 90),
('Woodland Workshops', '%woodland%', '%photo-workshops-uk/woodland-photography-walk-warwickshire%', 90),
('Bluebell Workshops', '%bluebell%', '%photo-workshops-uk/bluebell-woodlands-photography-workshops%', 90),
('Long Exposure Workshops', '%long-exposure%', '%photo-workshops-uk/long-exposure-photography-kenilworth%', 90),
('Abstract Macro Workshops', '%abstract%', '%photo-workshops-uk/abstract-and-macro-photography-workshops%', 90),
('Garden Workshops', '%garden-photography%', '%photo-workshops-uk/garden-photography-workshop%', 90),
('Lavender Workshops', '%lavender%', '%photo-workshops-uk/photography-workshops-lavender-fields%', 90),
('Urban Architecture Workshops', '%urban-architecture%', '%photo-workshops-uk/urban-architecture-photography-workshops-coventry%', 90),
('Somerset Workshops', '%somerset%', '%photo-workshops-uk/somerset-landscape-photography-workshops%', 90),
('Yorkshire Workshops', '%yorkshire%', '%photo-workshops-uk/north-yorkshire-landscape-photography%', 90),
('Wales Workshops', '%wales%', '%photo-workshops-uk/landscape-photography-workshops-anglesey%', 90),
('Anglesey Workshops', '%anglesey%', '%photo-workshops-uk/landscape-photography-workshops-anglesey%', 90),
('Snowdonia Workshops', '%snowdonia%', '%photo-workshops-uk/landscape-photography-workshops-anglesey%', 90),
('Fairy Glen Workshops', '%fairy-glen%', '%photo-workshops-uk/landscape-photography-workshops-anglesey%', 90),
('Dartmoor Workshops', '%dartmoor%', '%photo-workshops-uk/dartmoor-photography-landscape-workshop%', 90),
('Suffolk Workshops', '%suffolk%', '%photo-workshops-uk/suffolk-landscape-photography-workshops%', 90),
('Dorset Workshops', '%dorset%', '%photo-workshops-uk/dorset-landscape-photography-workshop%', 90),
('Norfolk Workshops', '%norfolk%', '%photo-workshops-uk/landscape-photography-workshop-norfolk%', 90),
('Northumberland Workshops', '%northumberland%', '%photo-workshops-uk/coastal-northumberland-photography-workshops%', 90),
('Ireland Workshops', '%ireland%', '%photo-workshops-uk/ireland-photography-workshops-dingle%', 90),
('Dingle Workshops', '%dingle%', '%photo-workshops-uk/ireland-photography-workshops-dingle%', 90),
('Kerry Workshops', '%kerry%', '%photo-workshops-uk/ireland-photography-workshops-dingle%', 90),
('Peak District Workshops', '%peak-district%', '%photo-workshops-uk/landscape-peak-district-photography-workshops-derbyshire%', 90),
('Batsford Workshops', '%batsford-arboretum%', '%photo-workshops-uk/batsford-arboretum-photography-workshops%', 90),
('Burnham Workshops', '%burnham-on-sea%', '%photo-workshops-uk/long-exposure-photography-workshops-burnham%', 90),

-- Fallback rules
('General Workshops', '%photographic-workshops-near-me%', '%photo-workshops-uk/landscape-photography-workshops%', 50);

-- STEP 3: CREATE SCALABLE MAPPING FUNCTION
CREATE OR REPLACE FUNCTION get_event_product_mapping(event_url TEXT)
RETURNS TABLE (
  product_url TEXT,
  method TEXT,
  score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN r.product_pattern LIKE '%photography-services-near-me%' THEN
        'https://www.alanranger.com/' || r.product_pattern
      WHEN r.product_pattern LIKE '%photo-workshops-uk%' THEN
        'https://www.alanranger.com/' || r.product_pattern
      ELSE r.product_pattern
    END as product_url,
    'rule_based' as method,
    r.priority as score
  FROM event_product_mapping_rules r
  WHERE r.is_active = true 
    AND event_url ILIKE r.event_pattern
  ORDER BY r.priority DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- STEP 4: CREATE SCALABLE EVENT-PRODUCT LINKS VIEW
CREATE OR REPLACE VIEW v_event_product_links_scalable AS
WITH
-- Get rule-based mappings
rule_mappings AS (
  SELECT 
    e.event_url,
    m.product_url,
    m.method,
    m.score
  FROM v_events_norm e
  CROSS JOIN LATERAL get_event_product_mapping(e.event_url) m
),
-- Fallback to existing best links for unmatched events
fallback_mappings AS (
  SELECT 
    e.event_url,
    bl.product_url,
    bl.method,
    bl.score
  FROM v_events_norm e
  LEFT JOIN rule_mappings rm ON e.event_url = rm.event_url
  LEFT JOIN v_event_product_links_best bl ON e.event_url = bl.event_url
  WHERE rm.event_url IS NULL
),
-- Combine all mappings
all_mappings AS (
  SELECT event_url, product_url, method, score FROM rule_mappings
  UNION ALL
  SELECT event_url, product_url, method, score FROM fallback_mappings
  WHERE product_url IS NOT NULL
)
SELECT DISTINCT ON (event_url)
  event_url,
  product_url,
  method,
  score
FROM all_mappings
ORDER BY event_url, score DESC;

-- STEP 5: CREATE SCALABLE PRICING VIEW
CREATE OR REPLACE VIEW v_event_product_pricing_scalable AS
WITH
-- Enhanced events with automatic classification
events_enhanced AS (
  SELECT
    e.event_url,
    -- Automatic subtype classification
    CASE
      WHEN e.event_url ILIKE '%camera-courses-for-beginners%' OR 
           e.event_url ILIKE '%lightroom-photo-editing%' OR 
           e.event_url ILIKE '%rps-courses%' OR 
           e.event_url ILIKE '%rps-distinctions%'
      THEN 'course'
      WHEN e.event_url ILIKE '%photographic-workshops-near-me%'
      THEN 'workshop'
      ELSE 'event'
    END AS subtype,
    e.date_start,
    e.date_end,
    -- Automatic time derivation
    CASE
      WHEN e.event_url ILIKE '%camera-courses-for-beginners%' OR 
           e.event_url ILIKE '%lightroom-photo-editing%' OR 
           e.event_url ILIKE '%rps-courses%'
      THEN '19:00:00'
      WHEN e.event_url ILIKE '%sunset%' OR e.event_url ILIKE '%sunrise%'
      THEN CASE
        WHEN e.event_url ILIKE '%sunrise%' THEN '06:00:00'
        ELSE '18:00:00'
      END
      WHEN e.event_url ILIKE '%landscape%' OR e.event_url ILIKE '%lake-district%' OR 
           e.event_url ILIKE '%yorkshire%' OR e.event_url ILIKE '%wales%' OR 
           e.event_url ILIKE '%devon%' OR e.event_url ILIKE '%dartmoor%' OR 
           e.event_url ILIKE '%exmoor%' OR e.event_url ILIKE '%suffolk%' OR 
           e.event_url ILIKE '%dorset%' OR e.event_url ILIKE '%norfolk%' OR 
           e.event_url ILIKE '%northumberland%' OR e.event_url ILIKE '%ireland%' OR 
           e.event_url ILIKE '%peak-district%'
      THEN '09:00:00'
      ELSE '19:00:00'
    END AS start_time,
    
    CASE
      WHEN e.event_url ILIKE '%camera-courses-for-beginners%' OR 
           e.event_url ILIKE '%lightroom-photo-editing%' OR 
           e.event_url ILIKE '%rps-courses%'
      THEN '21:00:00'
      WHEN e.event_url ILIKE '%sunset%' OR e.event_url ILIKE '%sunrise%'
      THEN CASE
        WHEN e.event_url ILIKE '%sunrise%' THEN '09:00:00'
        ELSE '21:00:00'
      END
      WHEN e.event_url ILIKE '%landscape%' OR e.event_url ILIKE '%lake-district%' OR 
           e.event_url ILIKE '%yorkshire%' OR e.event_url ILIKE '%wales%' OR 
           e.event_url ILIKE '%devon%' OR e.event_url ILIKE '%dartmoor%' OR 
           e.event_url ILIKE '%exmoor%' OR e.event_url ILIKE '%suffolk%' OR 
           e.event_url ILIKE '%dorset%' OR e.event_url ILIKE '%norfolk%' OR 
           e.event_url ILIKE '%northumberland%' OR e.event_url ILIKE '%ireland%' OR 
           e.event_url ILIKE '%peak-district%'
      THEN '17:00:00'
      ELSE '21:00:00'
    END AS end_time,
    
    -- Automatic location extraction
    CASE
      WHEN e.event_url ILIKE '%coventry%' THEN 'Coventry, West Midlands'
      WHEN e.event_url ILIKE '%devon%' OR e.event_url ILIKE '%hartland%' OR e.event_url ILIKE '%exmoor%' OR e.event_url ILIKE '%dartmoor%' THEN 'Devon, UK'
      WHEN e.event_url ILIKE '%lake-district%' THEN 'Lake District, Cumbria'
      WHEN e.event_url ILIKE '%yorkshire%' THEN 'Yorkshire, UK'
      WHEN e.event_url ILIKE '%wales%' OR e.event_url ILIKE '%anglesey%' OR e.event_url ILIKE '%snowdonia%' OR e.event_url ILIKE '%fairy-glen%' OR e.event_url ILIKE '%gower-peninsular%' OR e.event_url ILIKE '%vyrnwy%' OR e.event_url ILIKE '%pistyll-rhaeadr%' THEN 'Wales, UK'
      WHEN e.event_url ILIKE '%warwickshire%' OR e.event_url ILIKE '%chesterton%' OR e.event_url ILIKE '%windmill%' OR e.event_url ILIKE '%kenilworth%' THEN 'Warwickshire, UK'
      WHEN e.event_url ILIKE '%bluebell%' THEN 'Bluebell Woods, Warwickshire'
      WHEN e.event_url ILIKE '%garden-photography%' OR e.event_url ILIKE '%sezincote%' THEN 'Garden Photography, UK'
      WHEN e.event_url ILIKE '%lavender%' THEN 'Lavender Fields, UK'
      WHEN e.event_url ILIKE '%suffolk%' THEN 'Suffolk, UK'
      WHEN e.event_url ILIKE '%dorset%' THEN 'Dorset, UK'
      WHEN e.event_url ILIKE '%norfolk%' THEN 'Norfolk, UK'
      WHEN e.event_url ILIKE '%northumberland%' THEN 'Northumberland, UK'
      WHEN e.event_url ILIKE '%ireland%' OR e.event_url ILIKE '%dingle%' OR e.event_url ILIKE '%kerry%' THEN 'Ireland'
      WHEN e.event_url ILIKE '%peak-district%' THEN 'Peak District, Derbyshire'
      WHEN e.event_url ILIKE '%batsford-arboretum%' THEN 'Batsford Arboretum, Gloucestershire'
      WHEN e.event_url ILIKE '%burnham-on-sea%' THEN 'Burnham-on-Sea, Somerset'
      WHEN e.event_url ILIKE '%somerset%' THEN 'Somerset, UK'
      ELSE COALESCE(e.event_location, 'Location TBD')
    END AS event_location
  FROM v_events_norm e
),
-- Join with scalable mappings
events_with_mappings AS (
  SELECT
    ee.*,
    sm.product_url,
    sm.method,
    sm.score as specificity
  FROM events_enhanced ee
  LEFT JOIN v_event_product_links_scalable sm ON sm.event_url = ee.event_url
),
-- Join with product pricing
events_with_pricing AS (
  SELECT
    ewm.*,
    pu.display_price_gbp AS price_gbp,
    pu.availability_status AS availability
  FROM events_with_mappings ewm
  LEFT JOIN v_products_unified pu ON pu.product_url = ewm.product_url
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
  price_gbp,
  'price_view' AS price_source,
  availability
FROM events_with_pricing
WHERE product_url IS NOT NULL
ORDER BY date_start;

-- STEP 6: CREATE MANAGEMENT FUNCTIONS
CREATE OR REPLACE FUNCTION add_mapping_rule(
  rule_name TEXT,
  event_pattern TEXT,
  product_pattern TEXT,
  priority INTEGER DEFAULT 100
) RETURNS INTEGER AS $$
DECLARE
  rule_id INTEGER;
BEGIN
  INSERT INTO event_product_mapping_rules (rule_name, event_pattern, product_pattern, priority)
  VALUES (rule_name, event_pattern, product_pattern, priority)
  RETURNING id INTO rule_id;
  
  RETURN rule_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_mapping_rule(
  rule_id INTEGER,
  rule_name TEXT DEFAULT NULL,
  event_pattern TEXT DEFAULT NULL,
  product_pattern TEXT DEFAULT NULL,
  priority INTEGER DEFAULT NULL,
  is_active BOOLEAN DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE event_product_mapping_rules 
  SET 
    rule_name = COALESCE(update_mapping_rule.rule_name, rule_name),
    event_pattern = COALESCE(update_mapping_rule.event_pattern, event_pattern),
    product_pattern = COALESCE(update_mapping_rule.product_pattern, product_pattern),
    priority = COALESCE(update_mapping_rule.priority, priority),
    is_active = COALESCE(update_mapping_rule.is_active, is_active),
    updated_at = NOW()
  WHERE id = rule_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- STEP 7: CREATE AUDIT LOG FOR MAPPING CHANGES
CREATE TABLE IF NOT EXISTS mapping_audit_log (
  id SERIAL PRIMARY KEY,
  event_url TEXT NOT NULL,
  old_product_url TEXT,
  new_product_url TEXT,
  change_reason TEXT,
  changed_by TEXT DEFAULT 'system',
  changed_at TIMESTAMP DEFAULT NOW()
);

-- STEP 8: CREATE FUNCTION TO LOG MAPPING CHANGES
CREATE OR REPLACE FUNCTION log_mapping_change(
  p_event_url TEXT,
  p_old_product_url TEXT,
  p_new_product_url TEXT,
  p_change_reason TEXT DEFAULT 'rule_update'
) RETURNS VOID AS $$
BEGIN
  INSERT INTO mapping_audit_log (event_url, old_product_url, new_product_url, change_reason)
  VALUES (p_event_url, p_old_product_url, p_new_product_url, p_change_reason);
END;
$$ LANGUAGE plpgsql;


