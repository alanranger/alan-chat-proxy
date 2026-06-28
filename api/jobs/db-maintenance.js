// api/jobs/db-maintenance.js
// API endpoint to trigger database maintenance
// POST /api/jobs/db-maintenance

import pg from 'pg';

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;

const PURGE_BATCH_SIZE = 5000;
const PURGE_MAX_BATCHES = 500; // safety cap (5000 * 500 = 2.5M rows/run)

// Delete rows in small batches so a large backlog cannot exceed the function
// timeout (the single-shot DELETE was silently timing out, letting old rows
// accumulate for months). Returns total rows deleted.
async function purgeOldRows(pgClient, table, intervalText) {
  let totalDeleted = 0;
  for (let i = 0; i < PURGE_MAX_BATCHES; i++) {
    const result = await pgClient.query(
      `DELETE FROM ${table}
       WHERE ctid IN (
         SELECT ctid FROM ${table}
         WHERE created_at < NOW() - INTERVAL '${intervalText}'
         LIMIT ${PURGE_BATCH_SIZE}
       )`
    );
    const deleted = result.rowCount || 0;
    totalDeleted += deleted;
    if (deleted < PURGE_BATCH_SIZE) break;
  }
  return totalDeleted;
}

// Reclaim space after deletes. Plain VACUUM (not FULL) — no exclusive lock — so
// the bot keeps writing; it marks dead tuple space reusable and refreshes stats.
async function vacuumTable(pgClient, table) {
  await pgClient.query(`VACUUM (ANALYZE) ${table}`);
}

async function purgeTimeBasedTables(pgClient, results) {
  const targets = [
    { table: 'chat_sessions', key: 'chat_sessions_deleted' },
    { table: 'chat_interactions', key: 'chat_interactions_deleted' },
    { table: 'page_html', key: 'page_html_deleted' },
  ];
  for (const target of targets) {
    console.log(`[db-maintenance] Purging old ${target.table} (older than 30 days)...`);
    try {
      results[target.key] = await purgeOldRows(pgClient, target.table, '30 days');
      console.log(`[db-maintenance] Deleted ${results[target.key]} ${target.table} rows`);
    } catch (e) {
      const errorMsg = `Error purging ${target.table}: ${e.message}`;
      console.error(`[db-maintenance] ${errorMsg}`);
      results.errors.push(errorMsg);
    }
  }
}

// Keep last 30 days of regression data + the latest baseline per job; drop the rest.
async function purgeRegressionTestData(pgClient, results) {
  console.log('[db-maintenance] Purging old regression test data (keeping latest baseline per job)...');
  try {
    const deleteRunsResult = await pgClient.query(`
      WITH latest_baseline_runs AS (
        SELECT DISTINCT rtr.id
        FROM regression_test_runs rtr
        WHERE rtr.baseline_test_id IN (
          SELECT DISTINCT ON (job_id) id
          FROM regression_test_results
          WHERE test_phase = 'before'
          ORDER BY job_id, test_timestamp DESC
        )
      )
      DELETE FROM regression_test_runs
      WHERE run_started_at < NOW() - INTERVAL '30 days'
        AND id NOT IN (SELECT id FROM latest_baseline_runs);
    `);
    results.regression_test_runs_deleted = deleteRunsResult.rowCount || 0;

    const deleteResultsResult = await pgClient.query(`
      WITH latest_baselines AS (
        SELECT DISTINCT ON (job_id) id as baseline_id
        FROM regression_test_results
        WHERE test_phase = 'before'
        ORDER BY job_id, test_timestamp DESC
      ),
      referenced_results AS (
        SELECT DISTINCT baseline_test_id as test_id
        FROM regression_test_runs WHERE baseline_test_id IS NOT NULL
        UNION
        SELECT DISTINCT after_test_id as test_id
        FROM regression_test_runs WHERE after_test_id IS NOT NULL
      )
      DELETE FROM regression_test_results
      WHERE id NOT IN (SELECT baseline_id FROM latest_baselines)
        AND id NOT IN (SELECT test_id FROM referenced_results)
        AND test_timestamp < NOW() - INTERVAL '30 days';
    `);
    results.regression_test_results_deleted = deleteResultsResult.rowCount || 0;
    console.log(`[db-maintenance] Deleted ${results.regression_test_runs_deleted} regression_test_runs and ${results.regression_test_results_deleted} regression_test_results rows`);
  } catch (e) {
    const errorMsg = `Error purging regression test data: ${e.message}`;
    console.error(`[db-maintenance] ${errorMsg}`);
    results.errors.push(errorMsg);
  }
}

async function dropBackupTables(pgClient, results) {
  console.log('[db-maintenance] Dropping backup tables (page_entities_backup_*)...');
  try {
    const backupTablesResult = await pgClient.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name LIKE 'page_entities_backup_%'
    `);
    const backupTables = backupTablesResult.rows.map(r => r.table_name);
    for (const tableName of backupTables) {
      try {
        await pgClient.query(`DROP TABLE ${pgClient.escapeIdentifier(tableName)} CASCADE`);
        results.backup_tables_dropped.push(tableName);
        console.log(`[db-maintenance] Dropped table: ${tableName}`);
      } catch (e) {
        const errorMsg = `Error dropping table ${tableName}: ${e.message}`;
        console.error(`[db-maintenance] ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    }
  } catch (e) {
    const errorMsg = `Error dropping backup tables: ${e.message}`;
    console.error(`[db-maintenance] ${errorMsg}`);
    results.errors.push(errorMsg);
  }
}

async function vacuumPurgedTables(pgClient, results) {
  console.log('[db-maintenance] Vacuuming purged tables...');
  const tables = ['chat_sessions', 'chat_interactions', 'page_html', 'regression_test_runs', 'regression_test_results'];
  for (const table of tables) {
    try {
      await vacuumTable(pgClient, table);
    } catch (e) {
      const errorMsg = `Error vacuuming ${table}: ${e.message}`;
      console.error(`[db-maintenance] ${errorMsg}`);
      results.errors.push(errorMsg);
    }
  }
}

function newResults() {
  return {
    chat_sessions_deleted: 0,
    chat_interactions_deleted: 0,
    page_html_deleted: 0,
    regression_test_runs_deleted: 0,
    regression_test_results_deleted: 0,
    backup_tables_dropped: [],
    errors: []
  };
}

async function runMaintenanceTasks(pgClient, results) {
  console.log('[db-maintenance] Starting database maintenance...');
  await pgClient.connect();
  console.log('[db-maintenance] Connected to database');
  await purgeTimeBasedTables(pgClient, results);    // 1-3. chat_sessions / chat_interactions / page_html
  await purgeRegressionTestData(pgClient, results); // 4. regression test data
  await dropBackupTables(pgClient, results);         // 5. page_entities_backup_*
  await vacuumPurgedTables(pgClient, results);       // 6. reclaim space (no exclusive lock)
  logMaintenanceSummary(results);
}

function logMaintenanceSummary(results) {
  console.log('[db-maintenance] Database maintenance completed');
  console.log(`[db-maintenance] Summary: ${results.chat_sessions_deleted} chat_sessions, ${results.chat_interactions_deleted} chat_interactions, ${results.page_html_deleted} page_html, ${results.regression_test_runs_deleted} regression_test_runs, ${results.regression_test_results_deleted} regression_test_results deleted`);
  if (results.errors.length > 0) {
    console.error(`[db-maintenance] Errors encountered: ${results.errors.length}`);
    results.errors.forEach(err => console.error(`[db-maintenance]   - ${err}`));
  }
}

async function closeClient(pgClient) {
  try {
    await pgClient.end();
    console.log('[db-maintenance] Database connection closed');
  } catch (e) {
    console.warn(`[db-maintenance] Error closing connection: ${e.message}`);
  }
}

async function runMaintenance() {
  if (!SUPABASE_DB_URL) {
    throw new Error('SUPABASE_DB_URL environment variable is required');
  }
  const pgClient = new pg.Client({ connectionString: SUPABASE_DB_URL });
  const results = newResults();
  try {
    await runMaintenanceTasks(pgClient, results);
    return results;
  } catch (error) {
    const errorMsg = `Fatal error during maintenance: ${error.message}`;
    console.error(`[db-maintenance] ${errorMsg}`);
    console.error(`[db-maintenance] ${error.stack}`);
    results.errors.push(errorMsg);
    throw error;
  } finally {
    await closeClient(pgClient);
  }
}

// Cron jobs from Vercel don't send a token; only reject when a token IS
// provided and it doesn't match. Returns true when the request may proceed.
function isAuthorized(req) {
  const authToken = req.headers.authorization?.replace('Bearer ', '') ||
                    req.query.token ||
                    req.body.token;
  const expectedToken = process.env.INGEST_TOKEN || process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return !(authToken && expectedToken && authToken !== expectedToken);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are allowed'
    });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authentication token'
    });
  }

  try {
    // Run maintenance
    const results = await runMaintenance();

    // Return results
    return res.status(200).json({
      success: true,
      message: 'Database maintenance completed',
      results: {
        chat_sessions_deleted: results.chat_sessions_deleted,
        chat_interactions_deleted: results.chat_interactions_deleted,
        page_html_deleted: results.page_html_deleted,
        regression_test_runs_deleted: results.regression_test_runs_deleted,
        regression_test_results_deleted: results.regression_test_results_deleted,
        backup_tables_dropped: results.backup_tables_dropped,
        errors: results.errors,
        error_count: results.errors.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[db-maintenance] API error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Database maintenance failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
