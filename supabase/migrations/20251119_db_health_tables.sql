create table if not exists db_health_snapshots (
  id bigint generated always as identity primary key,
  collected_at timestamptz default now(),
  db_size_mb numeric,
  table_count int,
  debug_log_count int,
  table_bloat_pct numeric,
  chunk_count int,
  largest_table text,
  largest_table_size_mb numeric,
  largest_table_dead_pct numeric,
  risk_total int,
  risk_debug int,
  risk_bloat int,
  risk_chunks int
);

create table if not exists db_health_alerts (
  id bigint generated always as identity primary key,
  alert_at timestamptz default now(),
  metric text,
  value numeric,
  severity text,
  message text
);

