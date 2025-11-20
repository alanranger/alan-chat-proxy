-- Add missing problematic tables to database maintenance
-- These tables have high bloat/dead rows but weren't being vacuumed

-- Update database_maintenance_tables() to include problematic tables
CREATE OR REPLACE FUNCTION public.database_maintenance_tables()
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT ARRAY[
    'chat_sessions',
    'chat_interactions',
    'chat_events',
    'chat_analytics_daily',
    'page_entities',
    'page_chunks',
    'page_html',  -- Added: 4.5% bloat, 1161 MB (Warning)
    'csv_metadata',
    'event',
    'product',
    'event_product_links_auto',
    'job_run_details',  -- Added: 40% dead rows (Critical)
    'job_progress',  -- Added: 81.8% dead rows
    'database_maintenance_run_table'  -- Added: 12.5% dead rows (Warning)
  ];
$$;

-- Update run_database_maintenance() to include the same tables
CREATE OR REPLACE FUNCTION public.run_database_maintenance()
RETURNS TABLE(table_name text, vacuum_status text, analyze_status text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_table TEXT;
  v_tables TEXT[] := ARRAY[
    'chat_sessions',
    'chat_interactions',
    'chat_events',
    'chat_analytics_daily',
    'page_entities',
    'page_chunks',
    'page_html',  -- Added: 4.5% bloat, 1161 MB (Warning)
    'csv_metadata',
    'event',
    'product',
    'event_product_links_auto',
    'job_run_details',  -- Added: 40% dead rows (Critical)
    'job_progress',  -- Added: 81.8% dead rows
    'database_maintenance_run_table'  -- Added: 12.5% dead rows (Warning)
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables
  LOOP
    BEGIN
      -- VACUUM (best effort, may not work on all tables)
      EXECUTE format('VACUUM ANALYZE %I', v_table);
      RETURN QUERY SELECT v_table, 'success'::TEXT, 'success'::TEXT;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT v_table, 'error: ' || SQLERRM, 'skipped'::TEXT;
    END;
  END LOOP;
END;
$function$;

