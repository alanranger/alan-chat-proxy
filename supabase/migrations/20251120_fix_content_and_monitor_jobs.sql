-- Fix content monitoring jobs: refresh SQL functions for jobs 33, 35, 37

CREATE OR REPLACE FUNCTION public.check_url_health()
RETURNS TABLE(total_urls bigint, broken_urls bigint, stale_urls bigint, healthy_urls bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_total BIGINT;
  v_broken BIGINT;
  v_stale BIGINT;
  v_healthy BIGINT;
  v_stale_days INTEGER := 90;
BEGIN
  SELECT COUNT(*) INTO v_total FROM csv_metadata WHERE url IS NOT NULL;

  SELECT COUNT(*) INTO v_broken
  FROM csv_metadata cm
  LEFT JOIN url_http_status uhs ON cm.url = uhs.url
  WHERE cm.url IS NOT NULL
    AND (
      (uhs.status_code >= 400 AND uhs.status_code < 600)
      OR (
        uhs.status_code IS NULL
        AND (uhs.checked_at IS NULL OR uhs.checked_at < CURRENT_TIMESTAMP - INTERVAL '7 days')
      )
    );

  SELECT COUNT(*) INTO v_stale
  FROM csv_metadata cm
  WHERE cm.url IS NOT NULL
    AND (
      COALESCE(cm.updated_at, cm.created_at) IS NULL
      OR COALESCE(cm.updated_at, cm.created_at) < CURRENT_TIMESTAMP - (v_stale_days || ' days')::INTERVAL
    );

  v_healthy := GREATEST(v_total - v_broken - v_stale, 0);

  RETURN QUERY SELECT v_total, v_broken, v_stale, v_healthy;
END;
$function$;


CREATE OR REPLACE FUNCTION public.check_content_freshness()
RETURNS TABLE(stale_content_count bigint, average_age_days numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_stale BIGINT;
  v_avg_age NUMERIC;
  v_stale_days INTEGER := 60;
BEGIN
  SELECT
    COUNT(*) AS stale_count,
    COALESCE(AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(updated_at, created_at, CURRENT_TIMESTAMP))) / 86400), 0) AS avg_age
  INTO v_stale, v_avg_age
  FROM csv_metadata
  WHERE url IS NOT NULL
    AND (
      COALESCE(updated_at, created_at) IS NULL
      OR COALESCE(updated_at, created_at) < CURRENT_TIMESTAMP - (v_stale_days || ' days')::INTERVAL
    );

  RETURN QUERY SELECT v_stale, v_avg_age;
END;
$function$;


DROP FUNCTION IF EXISTS public.monitor_cron_job_health();

CREATE OR REPLACE FUNCTION public.monitor_cron_job_health()
RETURNS TABLE(jobid bigint, jobname text, recent_failures bigint, last_success timestamp with time zone, health_status text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH job_stats AS (
    SELECT
      j.jobid,
      j.jobname,
      COUNT(*) FILTER (WHERE jrd.status = 'failed' AND jrd.start_time > CURRENT_TIMESTAMP - INTERVAL '24 hours')::BIGINT AS recent_failures,
      MAX(jrd.start_time) FILTER (WHERE jrd.status = 'succeeded') AS last_success
    FROM cron.job j
    LEFT JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
    WHERE j.active = true
    GROUP BY j.jobid, j.jobname
  )
  SELECT
    js.jobid,
    js.jobname,
    COALESCE(js.recent_failures, 0) AS recent_failures,
    js.last_success,
    CASE
      WHEN COALESCE(js.recent_failures, 0) > 3 THEN 'critical'
      WHEN COALESCE(js.recent_failures, 0) > 0 THEN 'warning'
      WHEN js.last_success IS NULL OR js.last_success < CURRENT_TIMESTAMP - INTERVAL '48 hours' THEN 'warning'
      ELSE 'healthy'
    END AS health_status
  FROM job_stats js
  WHERE COALESCE(js.recent_failures, 0) > 0
     OR js.last_success IS NULL
     OR js.last_success < CURRENT_TIMESTAMP - INTERVAL '48 hours'
  ORDER BY COALESCE(js.recent_failures, 0) DESC NULLS LAST;
END;
$function$;

