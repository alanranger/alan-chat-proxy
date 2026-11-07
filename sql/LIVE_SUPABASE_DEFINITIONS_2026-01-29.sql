-- Exported: 2026-01-29
-- Supabase project ref: igzvwbvgvmzvvzoclufx
-- Source: Supabase SQL Editor pg_get_functiondef/pg_get_viewdef

-- FUNCTION: refresh_event_product_autolinks
CREATE OR REPLACE FUNCTION public.refresh_event_product_autolinks()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM event_product_links_auto WHERE method='auto';

  WITH events AS (
    SELECT 
      e.event_url,
      COALESCE(e.event_location,'') AS event_location,
      COALESCE(e.raw->>'name','') AS event_title,
      CASE
        WHEN e.event_url ILIKE '%/beginners-photography-lessons/%' THEN 'course'
        WHEN e.event_url ILIKE '%/photographic-workshops-near-me/%' THEN 'workshop'
        WHEN e.event_url ILIKE '%/photo-workshops-uk/%' THEN 'workshop'
        ELSE COALESCE(e.subtype,'event')
      END AS ev_subtype,
      -- Extract normalized tokens for better matching
      extract_key_tokens(COALESCE(e.raw->>'name','') || ' ' || e.event_url) AS event_tokens
    FROM v_events_norm e
  ), products AS (
    SELECT 
      p.product_url,
      p.product_title,
      COALESCE(p.product_kind_resolved,'') AS kind,
      LOWER(p.product_title || ' ' || p.product_url) AS p_hay,
      LOWER(p.product_title || ' ' || COALESCE(p.product_url,'')) AS p_desc,
      LOWER(COALESCE(p.location_hint,'')) AS p_loc,
      p.display_price_gbp,
      p.availability_status,
      -- Extract normalized tokens for better matching
      extract_key_tokens(p.product_title || ' ' || COALESCE(p.product_url,'')) AS product_tokens
    FROM v_products_unified_open p
  ), pairs AS (
    SELECT 
      ev.event_url,
      pr.product_url,
      pr.product_title,
      ev.event_tokens,
      pr.product_tokens,
      -- Calculate token-based similarity (new approach)
      calculate_token_overlap(ev.event_tokens, pr.product_tokens) AS token_similarity,
      -- Keep original similarity as fallback
      similarity(LOWER(ev.event_title || ' ' || ev.event_url), pr.p_hay) AS s_title_url,
      similarity(LOWER(ev.event_title), pr.p_desc) AS s_desc,
      CASE WHEN pr.p_loc <> '' AND LOWER(ev.event_location) <> '' AND pr.p_loc % LOWER(ev.event_location) THEN 1.0 ELSE 0.0 END AS s_loc,
      CASE WHEN pr.display_price_gbp IS NOT NULL AND pr.display_price_gbp > 0 THEN 1.0 ELSE 0.0 END AS s_price,
      CASE WHEN COALESCE(pr.availability_status,'') ILIKE 'instock' THEN 1.0 ELSE 0.0 END AS s_avail,
      ev.event_title AS e_title,
      ev.event_location,
      ev.ev_subtype,
      pr.kind,
      LOWER(ev.event_title || ' ' || ev.event_url) AS e_hay,
      pr.p_hay
    FROM events ev
    JOIN products pr ON TRUE
    WHERE (
      (ev.ev_subtype='workshop' AND pr.product_url ILIKE '%/photo-workshops-uk/%') OR
      (ev.ev_subtype='course' AND pr.product_url ILIKE '%/photography-services-near-me/%')
    )
  ), scored AS (
    SELECT 
      p.*,
      -- Improved scoring with stronger exact name matching
      (0.50 * p.token_similarity + 0.25 * p.s_title_url + 0.15 * p.s_desc + 0.05 * p.s_loc + 0.03 * p.s_price + 0.02 * p.s_avail)
        + CASE WHEN p.ev_subtype='workshop' AND p.kind='workshop' THEN 0.10 WHEN p.ev_subtype='course' AND p.kind='course' THEN 0.10 ELSE -0.20 END
        -- Enhanced topic-specific boosts with token awareness
        + CASE WHEN p.ev_subtype='course' AND (p.e_hay LIKE '%lightroom%' OR p.e_hay LIKE '%editing%') AND (p.p_hay LIKE '%lightroom%' OR p.p_hay LIKE '%editing%') THEN 0.50 ELSE 0 END
        + CASE WHEN p.ev_subtype='course' AND (p.e_hay LIKE '%camera%' OR p.e_hay LIKE '%beginner%') AND (p.p_hay LIKE '%beginner%' OR p.p_hay LIKE '%course%') AND NOT (p.p_hay LIKE '%lightroom%' OR p.p_hay LIKE '%editing%') THEN 0.50 ELSE 0 END
        + CASE WHEN p.ev_subtype='course' AND p.e_hay LIKE '%rps%' AND p.p_hay LIKE '%rps%' THEN 0.50 ELSE 0 END
        -- Stronger penalties for mismatched topics
        - CASE WHEN p.ev_subtype='course' AND (p.e_hay LIKE '%camera%' OR p.e_hay LIKE '%beginner%') AND NOT p.e_hay LIKE '%portrait%' AND p.p_hay LIKE '%portrait%' THEN 1.20 ELSE 0 END
        - CASE WHEN p.ev_subtype='course' AND NOT p.e_hay LIKE '%portrait%' AND p.p_hay LIKE '%portrait%' THEN 0.70 ELSE 0 END
        - CASE WHEN p.ev_subtype='course' AND NOT p.e_hay LIKE '%black%' AND NOT p.e_hay LIKE '%white%' AND p.p_hay LIKE '%black%' AND p.p_hay LIKE '%white%' THEN 0.70 ELSE 0 END
        -- Location-specific improvements with token normalization
        + CASE WHEN p.ev_subtype='workshop' AND p.e_hay LIKE '%peak district%' AND (p.e_hay LIKE '%heather%' OR p.e_hay LIKE '%heathers%') AND p.p_hay LIKE '%heather%' THEN 0.35 ELSE 0 END
        - CASE WHEN p.ev_subtype='workshop' AND p.e_hay LIKE '%peak district%' AND NOT (p.e_hay LIKE '%heather%' OR p.e_hay LIKE '%heathers%') AND p.p_hay LIKE '%heather%' THEN 0.30 ELSE 0 END
        + CASE WHEN p.ev_subtype='workshop' AND p.e_hay LIKE '%peak district%' AND NOT (p.e_hay LIKE '%heather%' OR p.e_hay LIKE '%heathers%') AND (p.p_hay LIKE '%landscape%' AND p.p_hay LIKE '%peak district%' AND p.p_hay LIKE '%derbyshire%') THEN 0.25 ELSE 0 END
        + CASE WHEN p.ev_subtype='workshop' AND (p.e_hay LIKE '%yorkshire coast%' OR p.e_hay LIKE '%coastlines%' OR p.e_hay LIKE '%whitby%' OR p.e_hay LIKE '%robin hood''s bay%' OR p.e_hay LIKE '%staithes%' OR p.e_hay LIKE '%filey%' OR p.e_hay LIKE '%scarborough%') AND (p.p_hay LIKE '%yorkshire coast%' OR p.p_hay LIKE '%north yorkshire%') THEN 0.45 ELSE 0 END
        - CASE WHEN p.ev_subtype='workshop' AND (p.e_hay LIKE '%yorkshire coast%' OR p.e_hay LIKE '%coastlines%' OR p.e_hay LIKE '%whitby%' OR p.e_hay LIKE '%robin hood''s bay%' OR p.e_hay LIKE '%staithes%' OR p.e_hay LIKE '%filey%' OR p.e_hay LIKE '%scarborough%') AND p.p_hay LIKE '%dales%' THEN 0.40 ELSE 0 END
        + CASE WHEN p.ev_subtype='workshop' AND (p.e_hay LIKE '%dales%' OR p.e_hay LIKE '%malham%' OR p.e_hay LIKE '%wensleydale%' OR p.e_hay LIKE '%swaledale%' OR p.e_hay LIKE '%ribblehead%') AND p.p_hay LIKE '%dales%' THEN 0.35 ELSE 0 END
        - CASE WHEN p.ev_subtype='workshop' AND (p.e_hay LIKE '%dales%' OR p.e_hay LIKE '%malham%' OR p.e_hay LIKE '%wensleydale%' OR p.e_hay LIKE '%swaledale%' OR p.e_hay LIKE '%ribblehead%') AND (p.p_hay LIKE '%yorkshire coast%' OR p.p_hay LIKE '%north yorkshire%') THEN 0.30 ELSE 0 END
        -- NEW: Strong penalty for Bluebell events mapping to non-Bluebell products
        - CASE WHEN p.ev_subtype='workshop' AND (p.e_hay LIKE '%bluebell%') AND NOT (p.p_hay LIKE '%bluebell%') THEN 1.50 ELSE 0 END
        -- NEW: Strong boost for Bluebell events mapping to Bluebell products
        + CASE WHEN p.ev_subtype='workshop' AND (p.e_hay LIKE '%bluebell%') AND (p.p_hay LIKE '%bluebell%') THEN 0.60 ELSE 0 END
        -- NEW: Strong penalty for Chesterton events mapping to non-Chesterton products
        - CASE WHEN p.ev_subtype='workshop' AND (p.e_hay LIKE '%chesterton%') AND NOT (p.p_hay LIKE '%chesterton%') THEN 1.50 ELSE 0 END
        -- NEW: Strong boost for Chesterton events mapping to Chesterton products
        + CASE WHEN p.ev_subtype='workshop' AND (p.e_hay LIKE '%chesterton%') AND (p.p_hay LIKE '%chesterton%') THEN 0.60 ELSE 0 END
        -- NEW: Strong penalty for Fairy Glen events mapping to non-Fairy Glen products
        - CASE WHEN p.ev_subtype='workshop' AND (p.e_hay LIKE '%fairy glen%') AND NOT (p.p_hay LIKE '%fairy glen%') THEN 1.50 ELSE 0 END
        -- NEW: Strong boost for Fairy Glen events mapping to Fairy Glen products
        + CASE WHEN p.ev_subtype='workshop' AND (p.e_hay LIKE '%fairy glen%') AND (p.p_hay LIKE '%fairy glen%') THEN 0.60 ELSE 0 END
        -- NEW: Strong penalty for Snowdonia events mapping to non-Snowdonia products
        - CASE WHEN p.ev_subtype='workshop' AND (p.e_hay LIKE '%snowdonia%') AND NOT (p.p_hay LIKE '%snowdonia%') THEN 1.50 ELSE 0 END
        -- NEW: Strong boost for Snowdonia events mapping to Snowdonia products
        + CASE WHEN p.ev_subtype='workshop' AND (p.e_hay LIKE '%snowdonia%') AND (p.p_hay LIKE '%snowdonia%') THEN 0.60 ELSE 0 END
        AS score
    FROM pairs p
  ), best AS (
    SELECT DISTINCT ON (s.event_url)
      s.event_url, s.product_url, GREATEST(0, LEAST(100, ROUND(s.score*100)))::int AS s
    FROM scored s
    WHERE s.score >= 0.30  -- Lowered threshold to allow more mappings with better scoring
    ORDER BY s.event_url, s.score DESC, s.product_url ASC
  )
  INSERT INTO event_product_links_auto(event_url, product_url, score, method)
  SELECT b.event_url, b.product_url, b.s, 'auto' FROM best b;
END;
$function$;

-- VIEW: v_events_norm
CREATE OR REPLACE VIEW public.v_events_norm AS
 SELECT url AS event_url,
    kind AS subtype,
    date_start,
    date_end,
    location AS event_location,
    price,
    availability,
    raw
   FROM page_entities pe
  WHERE kind = 'event'::text AND (url ~~ '%/beginners-photography-lessons/%'::text OR url ~~ '%/photographic-workshops-near-me/%'::text);

-- VIEW: v_products_unified
CREATE OR REPLACE VIEW public.v_products_unified AS
 WITH base AS (
         SELECT page_entities.id,
            page_entities.kind,
            COALESCE(NULLIF(page_entities.page_url, ''::text), NULLIF(page_entities.source_url, ''::text)) AS url_raw,
            page_entities.title AS product_title,
            page_entities.description,
            page_entities.price,
            page_entities.location,
            page_entities.last_seen,
            page_entities.raw
           FROM page_entities
          WHERE page_entities.kind = 'product'::text
        ), canon AS (
         SELECT base.id,
            base.kind,
            base.url_raw,
            base.product_title,
            base.description,
            base.price,
            base.location,
            base.last_seen,
            base.raw,
            lower(regexp_replace(split_part(base.url_raw, '?'::text, 1), '/$'::text, ''::text)) AS product_url
           FROM base
          WHERE base.url_raw IS NOT NULL
        ), dedup AS (
         SELECT DISTINCT ON (canon.product_url) canon.product_url,
            canon.product_title,
            canon.description,
            canon.price,
            canon.location,
            canon.last_seen,
            canon.raw
           FROM canon
          ORDER BY canon.product_url, (COALESCE(length(canon.description), 0) +
                CASE
                    WHEN canon.price IS NOT NULL THEN 1000
                    ELSE 0
                END) DESC, canon.last_seen DESC
        ), joined AS (
         SELECT d.product_url,
            d.product_title,
            d.description,
            d.price,
            d.location,
            d.last_seen,
            d.raw,
            p.display_price_gbp,
            p.preferred_source AS price_source
           FROM dedup d
             LEFT JOIN product_display_price p ON lower(p.product_url) = d.product_url OR lower(p.product_url) = regexp_replace(d.product_url, '^https?://[^/]+/'::text, ''::text) OR d.product_url = ('https://www.alanranger.com/photo-workshops-uk/'::text || p.product_url) OR d.product_url = ('https://www.alanranger.com/photography-services-near-me/'::text || p.product_url)
        )
 SELECT product_url,
    product_title,
        CASE
            WHEN product_url ~~ 'https://www.alanranger.com/photo-workshops-uk/%'::text THEN 'workshop'::text
            WHEN product_url ~~ 'https://www.alanranger.com/photography-services-near-me/%'::text THEN 'course'::text
            ELSE NULL::text
        END AS product_kind_resolved,
    display_price_gbp,
    price_source,
    NULLIF(regexp_replace(COALESCE((raw -> 'offers'::text) ->> 'availability'::text, raw ->> 'availability'::text, ''::text), '^https?://schema\.org/'::text, ''::text, 'i'::text), ''::text) AS availability_status,
        CASE
            WHEN product_url ~~* '%dartmoor%'::text OR location ~~* '%dartmoor%'::text OR product_title ~~* '%dartmoor%'::text THEN 'dartmoor'::text
            WHEN product_url ~~* '%devon%'::text OR location ~~* '%devon%'::text OR product_title ~~* '%devon%'::text THEN 'devon'::text
            WHEN product_url ~~* '%hartland%'::text OR location ~~* '%hartland%'::text OR product_title ~~* '%hartland%'::text THEN 'hartland'::text
            WHEN product_url ~~* '%kenilworth%'::text OR location ~~* '%kenilworth%'::text OR product_title ~~* '%kenilworth%'::text THEN 'kenilworth'::text
            WHEN product_url ~~* '%coventry%'::text OR location ~~* '%coventry%'::text OR product_title ~~* '%coventry%'::text THEN 'coventry'::text
            WHEN product_url ~~* '%warwickshire%'::text OR location ~~* '%warwickshire%'::text OR product_title ~~* '%warwickshire%'::text THEN 'warwickshire'::text
            WHEN product_url ~~* '%anglesey%'::text OR location ~~* '%anglesey%'::text OR product_title ~~* '%anglesey%'::text THEN 'anglesey'::text
            WHEN product_url ~~* '%yorkshire%'::text OR location ~~* '%yorkshire%'::text OR product_title ~~* '%yorkshire%'::text THEN 'yorkshire'::text
            WHEN product_url ~~* '%dales%'::text OR location ~~* '%dales%'::text OR product_title ~~* '%dales%'::text THEN 'dales'::text
            WHEN product_url ~~* '%wales%'::text OR location ~~* '%wales%'::text OR product_title ~~* '%wales%'::text THEN 'wales'::text
            WHEN product_url ~~* '%snowdonia%'::text OR location ~~* '%snowdonia%'::text OR product_title ~~* '%snowdonia%'::text THEN 'snowdonia'::text
            WHEN product_url ~~* '%northumberland%'::text OR location ~~* '%northumberland%'::text OR product_title ~~* '%northumberland%'::text THEN 'northumberland'::text
            WHEN product_url ~~* '%batsford%'::text OR location ~~* '%batsford%'::text OR product_title ~~* '%batsford%'::text THEN 'batsford'::text
            WHEN product_url ~~* '%gloucestershire%'::text OR location ~~* '%gloucestershire%'::text OR product_title ~~* '%gloucestershire%'::text THEN 'gloucestershire'::text
            WHEN product_url ~~* '%chesterton%'::text OR location ~~* '%chesterton%'::text OR product_title ~~* '%chesterton%'::text THEN 'chesterton'::text
            WHEN product_url ~~* '%windmill%'::text OR location ~~* '%windmill%'::text OR product_title ~~* '%windmill%'::text THEN 'windmill'::text
            WHEN product_url ~~* '%lynmouth%'::text OR location ~~* '%lynmouth%'::text OR product_title ~~* '%lynmouth%'::text THEN 'lynmouth'::text
            WHEN product_url ~~* '%exmoor%'::text OR location ~~* '%exmoor%'::text OR product_title ~~* '%exmoor%'::text THEN 'exmoor'::text
            ELSE NULL::text
        END AS location_hint,
    last_seen
   FROM joined j
  WHERE product_url IS NOT NULL;

-- VIEW: v_events_real_data
CREATE OR REPLACE VIEW public.v_events_real_data AS
 WITH all_events AS (
         SELECT page_entities.url AS event_url,
            page_entities.raw ->> 'name'::text AS event_name,
                CASE
                    WHEN page_entities.url ~~* '%beginners-photography-lessons%'::text OR page_entities.url ~~* '%camera-courses%'::text OR page_entities.url ~~* '%lightroom%'::text OR page_entities.url ~~* '%rps%'::text THEN 'course'::text
                    WHEN page_entities.url ~~* '%photographic-workshops-near-me%'::text OR page_entities.url ~~* '%workshop%'::text THEN 'workshop'::text
                    ELSE 'event'::text
                END AS subtype,
            page_entities.date_start,
            page_entities.date_end,
                CASE
                    WHEN page_entities.date_start IS NOT NULL THEN to_char(page_entities.date_start, 'HH24:MI:SS'::text)
                    ELSE NULL::text
                END AS start_time,
                CASE
                    WHEN page_entities.date_end IS NOT NULL THEN to_char(page_entities.date_end, 'HH24:MI:SS'::text)
                    ELSE NULL::text
                END AS end_time,
            page_entities.location AS event_location,
                CASE
                    WHEN page_entities.price IS NOT NULL AND page_entities.price > 0::numeric THEN page_entities.price
                    ELSE NULL::numeric
                END AS price_gbp,
            page_entities.availability,
            'json_ld_extraction'::text AS method,
            95 AS specificity
           FROM page_entities
          WHERE page_entities.kind = 'event'::text AND page_entities.raw IS NOT NULL AND page_entities.raw <> '{}'::jsonb AND (page_entities.raw ->> '@type'::text) = 'Event'::text AND page_entities.date_start IS NOT NULL
        ), deduplicated_events AS (
         SELECT all_events.event_url,
            all_events.event_name,
            all_events.subtype,
            all_events.date_start,
            all_events.date_end,
            all_events.start_time,
            all_events.end_time,
            all_events.event_location,
            all_events.price_gbp,
            all_events.availability,
            all_events.method,
            all_events.specificity,
            row_number() OVER (PARTITION BY all_events.event_name, all_events.date_start, all_events.event_location ORDER BY all_events.event_url) AS rn
           FROM all_events
        )
 SELECT event_url,
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

-- VIEW: v_events_for_chat
CREATE OR REPLACE VIEW public.v_events_for_chat AS
 WITH products_deduped AS (
         SELECT DISTINCT ON (v_products_unified_open.product_url) v_products_unified_open.product_url,
            v_products_unified_open.product_title,
            v_products_unified_open.display_price_gbp,
            v_products_unified_open.availability_status
           FROM v_products_unified_open
          ORDER BY v_products_unified_open.product_url, v_products_unified_open.product_title
        ), event_images AS (
         SELECT DISTINCT ON (pe_1.url) pe_1.url AS event_url,
            pe_1.image_url
           FROM page_entities pe_1
          WHERE pe_1.kind = 'event'::text AND pe_1.image_url IS NOT NULL
          ORDER BY pe_1.url, pe_1.last_seen DESC NULLS LAST
        ), product_images AS (
         SELECT DISTINCT ON (pe_1.url) pe_1.url AS product_url,
            pe_1.image_url
           FROM page_entities pe_1
          WHERE pe_1.kind = 'product'::text AND pe_1.image_url IS NOT NULL
          ORDER BY pe_1.url, pe_1.last_seen DESC NULLS LAST
        )
 SELECT DISTINCT ON (e.event_url, e.date_start) e.event_url,
    e.subtype,
    l.product_url,
    p.product_title,
    p.display_price_gbp AS price_gbp,
    p.availability_status AS availability,
    e.date_start,
    e.date_end,
    to_char(e.date_start, 'HH24:MI:SS'::text) AS start_time,
    to_char(e.date_end, 'HH24:MI:SS'::text) AS end_time,
    e.event_location,
    'auto'::text AS map_method,
    NULL::numeric AS confidence,
    pe.participants,
        CASE
            WHEN pe.fitness_level ~~ '%Experience Level:%'::text THEN TRIM(BOTH FROM SUBSTRING(pe.fitness_level FROM 1 FOR POSITION(('Experience Level:'::text) IN (pe.fitness_level)) - 1))
            ELSE pe.fitness_level
        END AS fitness_level,
        CASE
            WHEN pe.fitness_level ~~ '%Experience Level:%'::text THEN TRIM(BOTH FROM SUBSTRING(pe.fitness_level FROM POSITION(('Experience Level:'::text) IN (pe.fitness_level)) + length('Experience Level:'::text) FOR
            CASE
                WHEN pe.fitness_level ~~ '%Equipment Needed:%'::text THEN POSITION(('Equipment Needed:'::text) IN (pe.fitness_level)) - POSITION(('Experience Level:'::text) IN (pe.fitness_level)) - length('Experience Level:'::text)
                ELSE length(pe.fitness_level)
            END))
            ELSE pe.experience_level
        END AS experience_level,
        CASE
            WHEN pe.fitness_level ~~ '%Equipment Needed:%'::text THEN TRIM(BOTH FROM COALESCE((regexp_match(pe.fitness_level, 'Equipment Needed:(.*?)(?=Event Details:|Description:|Photography Workshops Event Details:|Photography Workshops[^E]|Northumberland Photography Workshops)'::text))[1], SUBSTRING(pe.fitness_level FROM POSITION(('Equipment Needed:'::text) IN (pe.fitness_level)) + length('Equipment Needed:'::text))))
            ELSE pe.equipment_needed
        END AS equipment_needed,
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
    prod_pe.raw ->> 'description'::text AS product_description,
    COALESCE(ei.image_url, pi.image_url) AS image_url,
    COALESCE(ei.image_url, pi.image_url) AS event_image_url
   FROM v_events_norm e
     LEFT JOIN event_product_links_auto l ON l.event_url = e.event_url
     LEFT JOIN products_deduped p ON p.product_url = l.product_url
     LEFT JOIN page_entities pe ON pe.url = e.event_url AND pe.kind = 'event'::text AND pe.date_start = e.date_start
     LEFT JOIN page_entities prod_pe ON prod_pe.url = l.product_url AND prod_pe.kind = 'product'::text
     LEFT JOIN event_images ei ON ei.event_url = e.event_url
     LEFT JOIN product_images pi ON pi.product_url = l.product_url
  WHERE e.date_start IS NOT NULL AND e.date_start >= CURRENT_DATE
  ORDER BY e.event_url, e.date_start;
