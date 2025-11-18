-- Extended database health monitoring function with risk scoring
-- Returns comprehensive metrics and risk scores for dashboard visualization

DROP FUNCTION IF EXISTS db_health_extended();

CREATE FUNCTION db_health_extended()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  db_size_data jsonb;
  debug_logs_data jsonb;
  page_html_data jsonb;
  table_bloat_data jsonb;
  chunk_data jsonb;
  risk_scores jsonb;
  
  -- Risk calculation variables
  debug_log_risk integer;
  bloat_risk integer;
  chunk_risk integer;
  total_risk integer;
  max_dead_row_pct numeric;
  log_count bigint;
  chunk_count bigint;
BEGIN
  -- 1. Database size summary
  SELECT jsonb_build_object(
    'total_size_bytes', pg_database_size(current_database()),
    'total_size_pretty', pg_size_pretty(pg_database_size(current_database())),
    'table_count', (SELECT COUNT(*) FROM pg_stat_user_tables)
  ) INTO db_size_data;

  -- 2. Debug logs metrics
  SELECT jsonb_build_object(
    'log_count', COUNT(*),
    'oldest_log', MIN(timestamp),
    'newest_log', MAX(timestamp),
    'avg_bytes_per_log', COALESCE(AVG(octet_length(data::text)), 0),
    'largest_log_bytes', COALESCE(MAX(octet_length(data::text)), 0)
  ) INTO debug_logs_data
  FROM debug_logs;

  -- Store log_count for risk calculation
  SELECT (debug_logs_data->>'log_count')::bigint INTO log_count;

  -- 3. Page HTML specific metrics
  SELECT jsonb_build_object(
    'page_html_size_bytes', pg_total_relation_size('page_html'),
    'page_html_size_pretty', pg_size_pretty(pg_total_relation_size('page_html')),
    'live_rows', COALESCE(n_live_tup, 0),
    'dead_rows', COALESCE(n_dead_tup, 0),
    'dead_row_pct', CASE
      WHEN n_live_tup + n_dead_tup = 0 THEN 0
      ELSE round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
    END
  ) INTO page_html_data
  FROM pg_stat_user_tables
  WHERE relname = 'page_html';

  -- 4. Table bloat alerts (top 20 tables by size)
  SELECT jsonb_agg(
    jsonb_build_object(
      'table_name', t.relname,
      'total_bytes', t.total_bytes,
      'total_pretty', pg_size_pretty(t.total_bytes),
      'dead_row_pct', t.dead_row_pct,
      'live_rows', t.n_live_tup,
      'dead_rows', t.n_dead_tup,
      'idx_scan', t.idx_scan,
      'seq_scan', t.seq_scan
    )
  ) INTO table_bloat_data
  FROM (
    SELECT 
      relname,
      pg_total_relation_size(relid) AS total_bytes,
      CASE
        WHEN n_live_tup + n_dead_tup = 0 THEN 0
        ELSE round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
      END AS dead_row_pct,
      COALESCE(n_live_tup, 0) AS n_live_tup,
      COALESCE(n_dead_tup, 0) AS n_dead_tup,
      COALESCE(idx_scan, 0) AS idx_scan,
      COALESCE(seq_scan, 0) AS seq_scan
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(relid) DESC
    LIMIT 20
  ) t;

  -- Find max dead_row_pct for risk calculation
  SELECT COALESCE(MAX(
    CASE
      WHEN n_live_tup + n_dead_tup = 0 THEN 0
      ELSE round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
    END
  ), 0) INTO max_dead_row_pct
  FROM pg_stat_user_tables;

  -- 5. Chunk issues
  SELECT jsonb_build_object(
    'chunk_count', COUNT(*),
    'avg_chunk_size', COALESCE(AVG(octet_length(content::text)), 0),
    'max_chunk_size', COALESCE(MAX(octet_length(content::text)), 0),
    'newest_chunk', MAX(created_at),
    'oldest_chunk', MIN(created_at)
  ) INTO chunk_data
  FROM page_chunks;

  -- Store chunk_count for risk calculation
  SELECT (chunk_data->>'chunk_count')::bigint INTO chunk_count;

  -- 6. Risk scoring
  -- Debug Logs Risk
  debug_log_risk := CASE
    WHEN log_count > 300000 THEN 90
    WHEN log_count > 100000 THEN 70
    WHEN log_count > 30000 THEN 40
    ELSE 10
  END;

  -- Table Bloat Risk (based on max dead_row_pct)
  bloat_risk := CASE
    WHEN max_dead_row_pct > 20 THEN 90
    WHEN max_dead_row_pct > 10 THEN 60
    WHEN max_dead_row_pct > 3 THEN 30
    ELSE 10
  END;

  -- Chunk Risk
  chunk_risk := CASE
    WHEN chunk_count = 0 THEN 80
    WHEN (chunk_data->>'max_chunk_size')::bigint < 20480 THEN 40  -- 20KB in bytes
    ELSE 10
  END;

  -- Total Risk (weighted average)
  total_risk := ROUND(
    0.5 * bloat_risk + 
    0.3 * debug_log_risk + 
    0.2 * chunk_risk
  );

  risk_scores := jsonb_build_object(
    'debug_log_risk', debug_log_risk,
    'bloat_risk', bloat_risk,
    'chunk_risk', chunk_risk,
    'total_risk', total_risk
  );

  -- Build final result
  result := jsonb_build_object(
    'db_size', db_size_data,
    'debug_logs', debug_logs_data,
    'page_html', page_html_data,
    'table_bloat', COALESCE(table_bloat_data, '[]'::jsonb),
    'chunks', chunk_data,
    'risk_scores', risk_scores
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION db_health_extended() TO service_role;

