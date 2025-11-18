-- Weekly Cron Job - every Monday at 08:00 UTC
-- Note: This uses pg_net extension which may need to be enabled
-- If pg_net is not available, use the SQL function version instead
DO $$
BEGIN
  -- Check if pg_net extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM cron.schedule(
      'weekly-db-summary',
      '0 8 * * MON',
      $$
        SELECT
          net.http_post(
            url:='' || current_setting('app.supabase_url', true) || '/functions/v1/db-health-monitor',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer " || current_setting('app.supabase_service_role_key', true)}'::jsonb,
            body:='{}'::jsonb
          );
      $$
    );
  ELSE
    -- Fallback: Use SQL function directly
    PERFORM cron.schedule(
      'weekly-db-summary',
      '0 8 * * MON',
      $$ SELECT db_health_monitor(); $$
    );
  END IF;
END $$;

