-- Enhanced v_events_for_chat view with session parsing
-- This view parses product descriptions to extract multiple session options
-- and generates separate rows for each session (early, late, full-day)

CREATE OR REPLACE VIEW v_events_for_chat AS
WITH session_parsed AS (
  SELECT 
    e.event_url,
    e.subtype,
    l.product_url,
    p.product_title,
    p.display_price_gbp AS price_gbp,
    p.availability_status AS availability,
    e.date_start,
    e.date_end,
    e.event_location,
    pe.participants,
    pe.fitness_level,
    pe.experience_level,
    pe.equipment_needed,
    pe.location_address,
    pe.time_schedule,
    pe.what_to_bring,
    pe.course_duration,
    pe.instructor_info,
    pe.availability_status,
    e.raw ->> 'name'::text AS event_title,
    ((e.raw -> 'offers'::text) -> 0) ->> 'price'::text AS json_price,
    ((e.raw -> 'offers'::text) -> 0) ->> 'availability'::text AS json_availability,
    ((e.raw -> 'offers'::text) -> 0) ->> 'priceCurrency'::text AS price_currency,
    pe.categories,
    -- Get product description for session parsing
    prod_pe.raw ->> 'description' AS product_description
  FROM v_events_norm e
    LEFT JOIN event_product_links_auto l ON l.event_url = e.event_url
    LEFT JOIN v_products_unified_open p ON p.product_url = l.product_url
    LEFT JOIN page_entities pe ON pe.url = e.event_url AND pe.kind = 'event'::text
    LEFT JOIN page_entities prod_pe ON prod_pe.url = l.product_url AND prod_pe.kind = 'product'::text
  WHERE e.date_start IS NOT NULL AND e.date_start >= CURRENT_DATE
)
-- Generate multiple rows for multi-session events
SELECT 
  event_url,
  subtype,
  product_url,
  product_title,
  price_gbp,
  availability,
  date_start,
  date_end,
  start_time,
  end_time,
  event_location,
  'auto'::text AS map_method,
  NULL::numeric AS confidence,
  participants,
  fitness_level,
  experience_level,
  equipment_needed,
  location_address,
  time_schedule,
  what_to_bring,
  course_duration,
  instructor_info,
  availability_status,
  event_title,
  json_price,
  json_availability,
  price_currency,
  categories
FROM (
  -- Multi-session events (like Bluebell workshops)
  SELECT 
    *,
    '05:45:00'::text AS start_time,
    '09:45:00'::text AS end_time,
    'early_4hr'::text AS session_type
  FROM session_parsed
  WHERE product_description ~* '4hrs.*5:45.*9:45.*10:30.*2:30.*1 day.*5:45.*2:30'
  
  UNION ALL
  
  SELECT 
    *,
    '10:30:00'::text AS start_time,
    '14:30:00'::text AS end_time,
    'late_4hr'::text AS session_type
  FROM session_parsed
  WHERE product_description ~* '4hrs.*5:45.*9:45.*10:30.*2:30.*1 day.*5:45.*2:30'
  
  UNION ALL
  
  SELECT 
    *,
    '05:45:00'::text AS start_time,
    '14:30:00'::text AS end_time,
    'full_day'::text AS session_type
  FROM session_parsed
  WHERE product_description ~* '4hrs.*5:45.*9:45.*10:30.*2:30.*1 day.*5:45.*2:30'
  
  UNION ALL
  
  -- Other multi-session events (2 sessions only)
  SELECT 
    *,
    '05:45:00'::text AS start_time,
    '09:45:00'::text AS end_time,
    'early_4hr'::text AS session_type
  FROM session_parsed
  WHERE product_description ~* '4hrs.*5:45.*9:45.*10:30.*2:30' 
    AND NOT (product_description ~* '4hrs.*5:45.*9:45.*10:30.*2:30.*1 day.*5:45.*2:30')
  
  UNION ALL
  
  SELECT 
    *,
    '10:30:00'::text AS start_time,
    '14:30:00'::text AS end_time,
    'late_4hr'::text AS session_type
  FROM session_parsed
  WHERE product_description ~* '4hrs.*5:45.*9:45.*10:30.*2:30' 
    AND NOT (product_description ~* '4hrs.*5:45.*9:45.*10:30.*2:30.*1 day.*5:45.*2:30')
  
  UNION ALL
  
  -- Single session events (use original times)
  SELECT 
    *,
    to_char(date_start, 'HH24:MI:SS') AS start_time,
    to_char(date_end, 'HH24:MI:SS') AS end_time,
    'single'::text AS session_type
  FROM session_parsed
  WHERE NOT (product_description ~* '4hrs.*5:45.*9:45.*10:30.*2:30')
) sessions
ORDER BY date_start, event_url, session_type;
