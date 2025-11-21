-- Fix risk calculation to use 0 as baseline for perfect health
-- When everything is healthy, risk should be 0, not 25
-- Previous calculation had minimum baseline scores (5+10+10=25) even when healthy
-- Now: 0 = perfect health, higher = worse

CREATE OR REPLACE FUNCTION public.db_health_extended()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  db_size_data jsonb;
  debug_logs_data jsonb;
  page_html_data jsonb;
  table_bloat_data jsonb;
  chunk_data jsonb;
  risk_scores jsonb;
  debug_log_risk integer;
  bloat_risk integer;
  chunk_risk integer;
  total_risk integer;
  max_dead_row_pct numeric;
  log_count bigint;
  chunk_count bigint;
BEGIN
  SELECT jsonb_build_object(
    'total_size_bytes', pg_database_size(current_database()),
    'total_size_pretty', pg_size_pretty(pg_database_size(current_database())),
    'table_count', (SELECT COUNT(*) FROM pg_stat_user_tables)
  ) INTO db_size_data;

  SELECT jsonb_build_object(
    'log_count', COUNT(*),
    'oldest_log', MIN(timestamp),
    'newest_log', MAX(timestamp),
    'avg_bytes_per_log', COALESCE(AVG(octet_length(data::text)), 0),
    'largest_log_bytes', COALESCE(MAX(octet_length(data::text)), 0)
  ) INTO debug_logs_data
  FROM debug_logs;

  SELECT (debug_logs_data->>'log_count')::bigint INTO log_count;

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

  WITH bloat_priority AS (
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
  ),
  worst_bloat AS (
    SELECT * FROM bloat_priority WHERE dead_row_pct > 2.5
  ),
  largest_tables AS (
    SELECT * FROM bloat_priority ORDER BY total_bytes DESC LIMIT 20
  ),
  combined_tables AS (
    SELECT DISTINCT ON (relname) *
    FROM (
      SELECT * FROM worst_bloat
      UNION ALL
      SELECT * FROM largest_tables
    ) combined
    ORDER BY relname, total_bytes DESC
  )
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
    SELECT * FROM combined_tables
    ORDER BY dead_row_pct DESC NULLS LAST, total_bytes DESC
    LIMIT 20
  ) t;

  -- Only consider tables >= 10MB for bloat risk calculation
  -- Small tables with high dead row % shouldn't drive the risk score
  SELECT COALESCE(MAX(
    CASE
      WHEN n_live_tup + n_dead_tup = 0 THEN 0
      ELSE round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
    END
  ), 0) INTO max_dead_row_pct
  FROM pg_stat_user_tables
  WHERE pg_total_relation_size(relid) >= 10485760;  -- >= 10MB

  SELECT jsonb_build_object(
    'chunk_count', COUNT(*),
    'avg_chunk_size', COALESCE(AVG(octet_length(content::text)), 0),
    'max_chunk_size', COALESCE(MAX(octet_length(content::text)), 0),
    'newest_chunk', MAX(created_at),
    'oldest_chunk', MIN(created_at)
  ) INTO chunk_data
  FROM page_chunks;

  SELECT (chunk_data->>'chunk_count')::bigint INTO chunk_count;

  -- Risk calculation: 0 = perfect health, higher = worse
  -- Debug logs: 0 when clean, increasing with log count
  debug_log_risk := CASE
    WHEN log_count > 20000 THEN 40
    WHEN log_count > 5000 THEN 15
    WHEN log_count > 1000 THEN 5
    ELSE 0  -- Perfect: no logs or very few
  END;

  -- Bloat: 0 when no bloat, increasing with bloat percentage
  bloat_risk := CASE
    WHEN max_dead_row_pct > 4 THEN 50
    WHEN max_dead_row_pct > 2.5 THEN 25
    WHEN max_dead_row_pct > 1 THEN 10
    ELSE 0  -- Perfect: no significant bloat
  END;

  -- Chunks: 0 when healthy, high when broken
  chunk_risk := CASE
    WHEN chunk_count = 0 THEN 80
    WHEN (chunk_data->>'max_chunk_size')::bigint > 50000000 THEN 30
    WHEN chunk_count < 5 THEN 10
    ELSE 0  -- Perfect: healthy chunking
  END;

  total_risk := debug_log_risk + bloat_risk + chunk_risk;

  risk_scores := jsonb_build_object(
    'debug_log_risk', debug_log_risk,
    'bloat_risk', bloat_risk,
    'chunk_risk', chunk_risk,
    'total_risk', total_risk
  );

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
$function$;

COMMENT ON FUNCTION public.db_health_extended() IS 
  'Extended database health check. Risk score: 0 = perfect health, higher = worse. Only considers tables >= 10MB for bloat risk calculation.';

