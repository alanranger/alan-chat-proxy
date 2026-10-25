-- Self-healing product pricing (2026-10-25).
-- 1) product_display_price only ever holds canonical full-URL keys; every refresh prunes
--    non-canonical keys and rows no longer produced by v_price_resolved.
-- 2) refresh_product_pricing() = upsert prices + refresh v_products_unified in one locked step.
--    Called by /api/admin?action=refresh, /api/tools?action=export and the 8-hourly cron.
-- 3) v_products_unified joins exactly ONE price row per product (exact full URL first,
--    then most recently updated), so a stale non-canonical row can never win.

CREATE OR REPLACE FUNCTION public.upsert_display_price_slice(p_slice text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  insert into public.product_display_price (product_url, product_title, display_price_gbp, preferred_source, updated_at)
  select r.product_url, r.product_title, r.display_price_gbp, r.preferred_source, now()
    from public.v_price_resolved r
   where right(md5(r.product_url), 1) = p_slice
     and r.product_url ~* '^https://www\.alanranger\.com/'
  on conflict (product_url) do update
    set display_price_gbp = excluded.display_price_gbp,
        preferred_source  = excluded.preferred_source,
        product_title     = excluded.product_title,
        updated_at        = now();
end;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_display_price_all()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  ch text;
begin
  foreach ch in array array['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f']
  loop
    perform public.upsert_display_price_slice(ch);
  end loop;

  delete from public.product_display_price p
   where p.product_url !~* '^https://www\.alanranger\.com/'
      or not exists (select 1 from public.v_price_resolved r where r.product_url = p.product_url);
end;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_product_pricing()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  lock_key bigint := hashtext('public.v_products_unified');
begin
  perform pg_advisory_lock(lock_key);
  begin
    perform public.upsert_display_price_all();
    refresh materialized view public.v_products_unified;
  exception when others then
    perform pg_advisory_unlock(lock_key);
    raise;
  end;
  perform pg_advisory_unlock(lock_key);
  return jsonb_build_object(
    'display_price_rows', (select count(*) from public.product_display_price),
    'non_canonical_rows', (select count(*) from public.product_display_price
                            where product_url !~* '^https://www\.alanranger\.com/'),
    'refreshed_at', now()
  );
end;
$function$;

DO $migration$
DECLARE
  d_open text := pg_get_viewdef('public.v_products_unified_open'::regclass, true);
  d_chat text := pg_get_viewdef('public.v_events_for_chat'::regclass, true);
  rel text;
BEGIN
  DROP MATERIALIZED VIEW public.v_products_unified CASCADE;

  CREATE MATERIALIZED VIEW public.v_products_unified AS
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
           SELECT base.id, base.kind, base.url_raw, base.product_title, base.description,
              base.price, base.location, base.last_seen, base.raw,
              lower(regexp_replace(split_part(base.url_raw, '?'::text, 1), '/$'::text, ''::text)) AS product_url
             FROM base
            WHERE base.url_raw IS NOT NULL
          ), dedup AS (
           SELECT DISTINCT ON (canon.product_url) canon.product_url,
              canon.product_title, canon.description, canon.price, canon.location, canon.last_seen, canon.raw
             FROM canon
            ORDER BY canon.product_url, (COALESCE(length(canon.description), 0) +
                  CASE WHEN canon.price IS NOT NULL THEN 1000 ELSE 0 END) DESC, canon.last_seen DESC
          ), joined AS (
           SELECT d.product_url, d.product_title, d.description, d.price, d.location, d.last_seen, d.raw,
              p.display_price_gbp,
              p.preferred_source AS price_source
             FROM dedup d
               LEFT JOIN LATERAL (
                 SELECT pdp.display_price_gbp, pdp.preferred_source
                   FROM product_display_price pdp
                  WHERE lower(pdp.product_url) = d.product_url
                     OR lower(pdp.product_url) = regexp_replace(d.product_url, '^https?://[^/]+/'::text, ''::text)
                     OR d.product_url = ('https://www.alanranger.com/photo-workshops-uk/'::text || pdp.product_url)
                     OR d.product_url = ('https://www.alanranger.com/photography-services-near-me/'::text || pdp.product_url)
                  ORDER BY (lower(pdp.product_url) = d.product_url) DESC, pdp.updated_at DESC NULLS LAST
                  LIMIT 1
               ) p ON true
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

  EXECUTE 'CREATE VIEW public.v_products_unified_open AS ' || d_open;
  EXECUTE 'CREATE VIEW public.v_events_for_chat AS ' || d_chat;

  FOREACH rel IN ARRAY ARRAY['v_products_unified', 'v_products_unified_open', 'v_events_for_chat']
  LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', rel);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO cursor_rw, cursor_writer', rel);
    EXECUTE format('GRANT SELECT ON public.%I TO cursor_reader', rel);
  END LOOP;
END
$migration$;

SELECT cron.alter_job(21, command := 'SELECT public.refresh_product_pricing();');
