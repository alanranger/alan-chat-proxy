-- Fix VACUUM transaction issue by using dblink to run VACUUM outside transaction
-- VACUUM cannot run inside a transaction block, so we use dblink to run it in a separate connection

-- Enable dblink extension
CREATE EXTENSION IF NOT EXISTS dblink;

-- Create a function that runs VACUUM via dblink (outside transaction)
CREATE OR REPLACE FUNCTION public.run_vacuum_via_dblink(p_table_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_result text;
  v_conn_name text := 'vacuum_conn_' || p_table_name;
  v_db_url text;
BEGIN
  -- Get database connection string from environment or use current database
  -- For Supabase, we'll connect to the same database
  v_db_url := current_database();
  
  -- Run VACUUM ANALYZE via dblink (this runs outside the transaction)
  BEGIN
    PERFORM dblink_connect(v_conn_name, format('dbname=%s', v_db_url));
    
    PERFORM dblink_exec(v_conn_name, format('VACUUM ANALYZE %I', p_table_name));
    
    PERFORM dblink_disconnect(v_conn_name);
    
    v_result := 'success';
  EXCEPTION WHEN OTHERS THEN
    -- Clean up connection on error
    BEGIN
      PERFORM dblink_disconnect(v_conn_name);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    v_result := 'error: ' || SQLERRM;
  END;
  
  RETURN v_result;
END;
$function$;

-- Update run_database_maintenance() to use dblink for VACUUM
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
    'page_html',
    'csv_metadata',
    'event',
    'product',
    'event_product_links_auto',
    'job_run_details',
    'job_progress',
    'database_maintenance_run_table'
  ];
  v_vacuum_result text;
BEGIN
  FOREACH v_table IN ARRAY v_tables
  LOOP
    BEGIN
      -- Use dblink to run VACUUM outside transaction
      v_vacuum_result := public.run_vacuum_via_dblink(v_table);
      
      IF v_vacuum_result = 'success' THEN
        RETURN QUERY SELECT v_table, 'success'::TEXT, 'success'::TEXT;
      ELSE
        RETURN QUERY SELECT v_table, v_vacuum_result, 'skipped'::TEXT;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT v_table, 'error: ' || SQLERRM, 'skipped'::TEXT;
    END;
  END LOOP;
END;
$function$;

