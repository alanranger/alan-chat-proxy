-- Create SQL function version of db-health-monitor
CREATE OR REPLACE FUNCTION db_health_monitor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h_record record;
  risk_debug int;
  risk_bloat int;
  risk_chunks int;
  risk_total int;
  db_size_mb int;
  table_count int;
  debug_log_count int;
  table_bloat_pct numeric;
  chunk_count int;
  largest_table text;
  largest_table_size_mb numeric;
  largest_table_dead_pct numeric;
BEGIN
  -- Collect health metrics
  SELECT 
    (pg_database_size(current_database())/1024/1024)::int INTO db_size_mb;
  
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables 
  WHERE table_schema = 'public';
  
  SELECT COUNT(*) INTO debug_log_count
  FROM debug_logs;
  
  SELECT COALESCE(dead_tuple_ratio, 0) INTO table_bloat_pct
  FROM bloat_summary 
  WHERE table_name = 'page_html'
  LIMIT 1;
  
  SELECT COUNT(*) INTO chunk_count
  FROM page_chunks;
  
  SELECT 
    table_name,
    (total_bytes/1024/1024)::numeric,
    dead_row_pct
  INTO largest_table, largest_table_size_mb, largest_table_dead_pct
  FROM table_stats
  ORDER BY total_bytes DESC
  LIMIT 1;

  -- Calculate risk scores
  risk_debug := CASE
    WHEN debug_log_count > 20000 THEN 40
    WHEN debug_log_count > 5000 THEN 15
    ELSE 5
  END;

  risk_bloat := CASE
    WHEN table_bloat_pct > 4 THEN 50
    WHEN table_bloat_pct > 2.5 THEN 25
    ELSE 10
  END;

  risk_chunks := CASE
    WHEN chunk_count = 0 THEN 80
    WHEN chunk_count < 5 THEN 40
    ELSE 10
  END;

  risk_total := risk_debug + risk_bloat + risk_chunks;

  -- Insert snapshot
  INSERT INTO db_health_snapshots (
    db_size_mb, table_count, debug_log_count, table_bloat_pct,
    chunk_count, largest_table, largest_table_size_mb, largest_table_dead_pct,
    risk_total, risk_debug, risk_bloat, risk_chunks
  ) VALUES (
    db_size_mb, table_count, debug_log_count, table_bloat_pct,
    chunk_count, largest_table, largest_table_size_mb, largest_table_dead_pct,
    risk_total, risk_debug, risk_bloat, risk_chunks
  );

  -- Create alerts if thresholds exceeded
  IF risk_debug >= 40 THEN
    INSERT INTO db_health_alerts (metric, value, severity, message)
    VALUES ('debug_logs', debug_log_count, 'high', 'Debug logs exceed 20k — ingestion or error spam possible.');
  END IF;

  IF risk_bloat >= 50 THEN
    INSERT INTO db_health_alerts (metric, value, severity, message)
    VALUES ('table_bloat', table_bloat_pct, 'critical', 'page_html severe bloat — VACUUM FULL recommended.');
  END IF;

  IF risk_chunks >= 80 THEN
    INSERT INTO db_health_alerts (metric, value, severity, message)
    VALUES ('chunks', chunk_count, 'critical', 'Chunking broken: 0 page_chunks.');
  END IF;

  IF db_size_mb > 4000 THEN
    INSERT INTO db_health_alerts (metric, value, severity, message)
    VALUES ('db_size', db_size_mb, 'warning', 'Database > 4GB — clean-up recommended.');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION db_health_monitor() TO service_role;

