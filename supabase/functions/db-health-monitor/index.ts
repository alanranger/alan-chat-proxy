import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const main = async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase.rpc("exec_sql", {
    query: `
      SELECT
         (pg_database_size(current_database())/1024/1024)::int AS db_size_mb,
         (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public') AS table_count,
         (SELECT COUNT(*) FROM debug_logs) AS debug_log_count,
         (SELECT dead_tuple_ratio FROM bloat_summary WHERE table_name='page_html') AS table_bloat_pct,
         (SELECT COUNT(*) FROM page_chunks) AS chunk_count,
         (SELECT table_name FROM table_stats ORDER BY total_bytes DESC LIMIT 1) AS largest_table,
         (SELECT (total_bytes/1024/1024) FROM table_stats ORDER BY total_bytes DESC LIMIT 1) AS largest_table_size_mb,
         (SELECT dead_row_pct FROM table_stats ORDER BY total_bytes DESC LIMIT 1) AS largest_table_dead_pct
    `
  });

  if (error) {
    console.error("Health SQL error:", error);
    return new Response("Error", { status: 500 });
  }

  const h = data[0];

  const risk_debug =
    h.debug_log_count > 20000 ? 40 :
    h.debug_log_count > 5000 ? 15 : 5;

  const risk_bloat =
    h.table_bloat_pct > 4 ? 50 :
    h.table_bloat_pct > 2.5 ? 25 : 10;

  const risk_chunks =
    h.chunk_count === 0 ? 80 :
    h.chunk_count < 5 ? 40 : 10;

  const risk_total = risk_debug + risk_bloat + risk_chunks;

  await supabase.from("db_health_snapshots").insert({
    db_size_mb: h.db_size_mb,
    table_count: h.table_count,
    debug_log_count: h.debug_log_count,
    table_bloat_pct: h.table_bloat_pct,
    chunk_count: h.chunk_count,
    largest_table: h.largest_table,
    largest_table_size_mb: h.largest_table_size_mb,
    largest_table_dead_pct: h.largest_table_dead_pct,
    risk_total,
    risk_debug,
    risk_bloat,
    risk_chunks
  });

  const alerts = [];

  if (risk_debug >= 40)
    alerts.push({
      metric: "debug_logs",
      value: h.debug_log_count,
      severity: "high",
      message: "Debug logs exceed 20k — ingestion or error spam possible."
    });

  if (risk_bloat >= 50)
    alerts.push({
      metric: "table_bloat",
      value: h.table_bloat_pct,
      severity: "critical",
      message: "page_html severe bloat — VACUUM FULL recommended."
    });

  if (risk_chunks >= 80)
    alerts.push({
      metric: "chunks",
      value: h.chunk_count,
      severity: "critical",
      message: "Chunking broken: 0 page_chunks."
    });

  if (h.db_size_mb > 4000)
    alerts.push({
      metric: "db_size",
      value: h.db_size_mb,
      severity: "warning",
      message: "Database > 4GB — clean-up recommended."
    });

  for (const a of alerts) {
    await supabase.from("db_health_alerts").insert(a);
  }

  return new Response("OK", { status: 200 });
};

Deno.serve(main);

