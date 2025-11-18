// /api/db-health.js
// Database health metrics API endpoint
// Returns overall DB size, table stats, debug log stats, and page chunk stats

export const config = { runtime: 'nodejs' };

/* ========== utils ========== */
const need = (k) => {
  const v = process.env[k];
  if (!v || !String(v).trim()) throw new Error(`missing_env:${k}`);
  return v;
};

const asString = (e) => {
  if (!e) return '(unknown)';
  if (typeof e === 'string') return e;
  if (e.message && typeof e.message === 'string') return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
};

const sendJSON = (res, status, obj) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (obj && 'detail' in obj) obj.detail = asString(obj.detail);
  res.status(status).send(JSON.stringify(obj));
};

// SQL query to fetch database health metrics
const HEALTH_SQL = `
WITH db_size AS (
  SELECT
    pg_size_pretty(pg_database_size(current_database())) AS total_size_pretty,
    (SELECT COUNT(*) FROM pg_stat_user_tables)           AS table_count
),
table_stats AS (
  SELECT
    relname                                          AS table_name,
    pg_total_relation_size(relid)                   AS total_bytes,
    pg_size_pretty(pg_total_relation_size(relid))   AS total_size_pretty,
    n_live_tup                                      AS live_rows,
    n_dead_tup                                      AS dead_rows,
    CASE
      WHEN n_live_tup + n_dead_tup = 0 THEN 0
      ELSE round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 1)
    END                                             AS dead_row_pct
  FROM pg_stat_user_tables
),
debug_logs AS (
  SELECT
    COUNT(*)          AS log_count,
    MIN(timestamp)    AS oldest_log,
    MAX(timestamp)    AS newest_log
  FROM debug_logs
),
chunks AS (
  SELECT
    COUNT(*)                                   AS total_chunks,
    coalesce(AVG(octet_length(content::text)), 0) AS avg_chunk,
    coalesce(MAX(octet_length(content::text)), 0) AS max_chunk
  FROM page_chunks
)
SELECT json_build_object(
  'db_size',        (SELECT row_to_json(db_size)      FROM db_size),
  'largest_tables', (SELECT json_agg(table_stats ORDER BY total_bytes DESC LIMIT 10) FROM table_stats),
  'debug_logs',     (SELECT row_to_json(debug_logs)   FROM debug_logs),
  'chunks',         (SELECT row_to_json(chunks)       FROM chunks)
) AS result;
`;

async function fetchDbHealth() {
  const supabaseUrl = need('SUPABASE_URL');
  const serviceRoleKey = need('SUPABASE_SERVICE_ROLE_KEY');

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ text: HEALTH_SQL }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('exec_sql failed', res.status, text);
    throw new Error(`exec_sql failed with ${res.status}: ${text}`);
  }

  const rows = await res.json();
  const payload = rows[0]?.result ?? rows[0] ?? rows;
  return payload;
}

/* ========== handler ========== */
export default async function handler(req, res) {
  if (req.method !== 'GET') return sendJSON(res, 405, { error: 'method_not_allowed' });

  let stage = 'start';
  try {
    stage = 'auth';
    const token = req.headers['authorization']?.trim();
    const expectedToken = process.env.INGEST_TOKEN || process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (token !== `Bearer ${expectedToken}`) {
      return sendJSON(res, 401, { error: 'unauthorized', stage });
    }

    stage = 'fetch_health';
    const healthData = await fetchDbHealth();

    return sendJSON(res, 200, healthData);

  } catch (err) {
    console.error(`[db-health] Error at stage ${stage}:`, err);
    return sendJSON(res, 500, {
      error: 'internal_error',
      stage,
      detail: asString(err)
    });
  }
}
