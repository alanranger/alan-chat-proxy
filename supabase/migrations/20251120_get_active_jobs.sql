-- Surface currently running cron jobs by reading pg_stat_activity

CREATE OR REPLACE FUNCTION public.get_active_jobs()
RETURNS TABLE(
  pid integer,
  query text,
  state text,
  duration_seconds numeric,
  wait_event text,
  job_hint text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    psa.pid,
    psa.query,
    psa.state,
    EXTRACT(EPOCH FROM (NOW() - psa.query_start)) AS duration_seconds,
    COALESCE(psa.wait_event, ''),
    CASE
      WHEN psa.query ILIKE '%trigger_refresh_master_job%' THEN 'Job 26 • Website Pages Refresh Batch 0'
      WHEN psa.query ILIKE '%trigger_refresh_batch1_job%' THEN 'Job 27 • Batch 1'
      WHEN psa.query ILIKE '%trigger_refresh_batch2_job%' THEN 'Job 28 • Batch 2'
      WHEN psa.query ILIKE '%cleanup_orphaned_records_with_regression_test%' THEN 'Job 31 • Cleanup Orphaned Records'
      WHEN psa.query ILIKE '%cleanup_old_debug_logs%' THEN 'Job 30 • Cleanup Debug Logs'
      WHEN psa.query ILIKE '%cleanup_old_chat_data%' THEN 'Job 29 • Cleanup Old Chat Data'
      WHEN psa.query ILIKE '%refresh_v_products_unified_with_regression_test%' THEN 'Job 21 • Refresh Product Pricing'
      WHEN psa.query ILIKE '%db_health_monitor%' THEN 'Job 39 • DB Health Monitor'
      ELSE NULL
    END AS job_hint
  FROM pg_stat_activity psa
  WHERE psa.datname = current_database()
    AND psa.query IS NOT NULL
    AND psa.state <> 'idle'
    AND psa.application_name NOT LIKE 'psql%'
    AND psa.backend_type = 'client backend'
    -- Exclude queries that are just calling get_active_jobs itself (PostgREST wrapper queries)
    AND psa.query NOT ILIKE '%get_active_jobs%';
$function$;

