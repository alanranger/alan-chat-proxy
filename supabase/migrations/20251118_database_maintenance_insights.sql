-- Database maintenance insight tables + wrapper
-- Safe to re-run (IF NOT EXISTS everywhere).

-- 1) Per-run summary
CREATE TABLE IF NOT EXISTS public.database_maintenance_run (
  id                        bigserial PRIMARY KEY,
  started_at                timestamptz NOT NULL DEFAULT now(),
  finished_at               timestamptz,
  total_tables              integer,
  total_dead_before         bigint,
  total_dead_after          bigint,
  total_est_bloat_before_bytes bigint,
  total_est_bloat_after_bytes  bigint
);

-- 2) Per-table stats for each run
CREATE TABLE IF NOT EXISTS public.database_maintenance_run_table (
  id                        bigserial PRIMARY KEY,
  run_id                    bigint NOT NULL REFERENCES public.database_maintenance_run(id) ON DELETE CASCADE,
  table_name                text   NOT NULL,
  size_before_bytes         bigint,
  size_after_bytes          bigint,
  dead_before               bigint,
  dead_after                bigint,
  est_bloat_before_bytes    bigint,
  est_bloat_after_bytes     bigint,
  index_bytes               bigint,
  last_autovacuum           timestamptz,
  last_autoanalyze          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_db_maint_run_table_run_id
  ON public.database_maintenance_run_table(run_id);

-- 3) Helper to list the tables we care about.
-- Keep in sync with the existing run_database_maintenance() table list.
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
    'csv_metadata',
    'event',
    'product',
    'event_product_links_auto'
  ];
$$;

-- 4) Wrapper that snapshots stats before/after and records insights.
CREATE OR REPLACE FUNCTION public.run_database_maintenance_with_stats()
RETURNS SETOF public.database_maintenance_run_table
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_run_id   bigint;
  v_tables   text[];
BEGIN
  v_tables := public.database_maintenance_tables();

  -- Create a run record
  INSERT INTO public.database_maintenance_run(started_at)
  VALUES (now())
  RETURNING id INTO v_run_id;

  -- Snapshot "before" stats
  INSERT INTO public.database_maintenance_run_table
    (run_id, table_name,
     size_before_bytes, dead_before,
     est_bloat_before_bytes,
     index_bytes,
     last_autovacuum, last_autoanalyze)
  SELECT
    v_run_id,
    st.relname AS table_name,
    pg_total_relation_size(quote_ident(st.relname)) AS size_before_bytes,
    COALESCE(st.n_dead_tup, 0) AS dead_before,
    COALESCE(st.n_dead_tup, 0)
      * GREATEST(
          (pg_total_relation_size(quote_ident(st.relname))
             / GREATEST(st.reltuples, 1)),
          1
        ) AS est_bloat_before_bytes,
    COALESCE((
      SELECT SUM(pg_total_relation_size(i.indexrelid))
      FROM pg_stat_user_indexes i
      WHERE i.schemaname = st.schemaname
        AND i.relname     = st.relname
    ), 0) AS index_bytes,
    st.last_autovacuum,
    st.last_autoanalyze
  FROM pg_stat_all_tables st
  WHERE st.schemaname = 'public'
    AND st.relname = ANY(v_tables);

  -- Run the existing maintenance (VACUUM / ANALYZE).
  PERFORM public.run_database_maintenance();

  -- Snapshot "after" stats into the same rows
  UPDATE public.database_maintenance_run_table t
  SET
    size_after_bytes = after_stats.size_after_bytes,
    dead_after       = after_stats.dead_after,
    est_bloat_after_bytes =
      COALESCE(after_stats.dead_after, 0)
      * GREATEST(
          (after_stats.size_after_bytes
             / GREATEST(after_stats.reltuples, 1)),
          1
        )
  FROM (
    SELECT
      st.relname AS table_name,
      pg_total_relation_size(quote_ident(st.relname)) AS size_after_bytes,
      COALESCE(st.n_dead_tup, 0) AS dead_after,
      GREATEST(st.reltuples, 1) AS reltuples
    FROM pg_stat_all_tables st
    WHERE st.schemaname = 'public'
      AND st.relname = ANY(v_tables)
  ) AS after_stats
  WHERE t.run_id = v_run_id
    AND t.table_name = after_stats.table_name;

  -- Update run summary fields
  UPDATE public.database_maintenance_run r
  SET
    finished_at = now(),
    total_tables = (
      SELECT COUNT(*) FROM public.database_maintenance_run_table t
      WHERE t.run_id = v_run_id
    ),
    total_dead_before = (
      SELECT COALESCE(SUM(dead_before), 0)
      FROM public.database_maintenance_run_table t
      WHERE t.run_id = v_run_id
    ),
    total_dead_after = (
      SELECT COALESCE(SUM(dead_after), 0)
      FROM public.database_maintenance_run_table t
      WHERE t.run_id = v_run_id
    ),
    total_est_bloat_before_bytes = (
      SELECT COALESCE(SUM(est_bloat_before_bytes), 0)
      FROM public.database_maintenance_run_table t
      WHERE t.run_id = v_run_id
    ),
    total_est_bloat_after_bytes = (
      SELECT COALESCE(SUM(est_bloat_after_bytes), 0)
      FROM public.database_maintenance_run_table t
      WHERE t.run_id = v_run_id
    )
  WHERE r.id = v_run_id;

  -- Return per-table rows for this run (for admin.js consumers)
  RETURN QUERY
  SELECT *
  FROM public.database_maintenance_run_table
  WHERE run_id = v_run_id
  ORDER BY table_name;
END;
$$;

