-- Create bloat_summary view for health monitoring
CREATE OR REPLACE VIEW bloat_summary AS
SELECT 
  schemaname,
  relname AS table_name,
  CASE
    WHEN n_live_tup + n_dead_tup = 0 THEN 0
    ELSE round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
  END AS dead_tuple_ratio
FROM pg_stat_user_tables;

-- Create table_stats view for health monitoring
CREATE OR REPLACE VIEW table_stats AS
SELECT 
  relname AS table_name,
  pg_total_relation_size(relid) AS total_bytes,
  CASE
    WHEN n_live_tup + n_dead_tup = 0 THEN 0
    ELSE round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
  END AS dead_row_pct,
  COALESCE(n_live_tup, 0) AS n_live_tup,
  COALESCE(n_dead_tup, 0) AS n_dead_tup
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

