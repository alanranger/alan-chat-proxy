// api/jobs/db-maintenance.js
// API endpoint to trigger database maintenance
// POST /api/jobs/db-maintenance

import pg from 'pg';

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;

async function runMaintenance() {
  if (!SUPABASE_DB_URL) {
    throw new Error('SUPABASE_DB_URL environment variable is required');
  }

  const pgClient = new pg.Client({
    connectionString: SUPABASE_DB_URL
  });

  const results = {
    chat_sessions_deleted: 0,
    chat_interactions_deleted: 0,
    page_html_deleted: 0,
    regression_test_runs_deleted: 0,
    regression_test_results_deleted: 0,
    backup_tables_dropped: [],
    errors: []
  };

  try {
    console.log('[db-maintenance] Starting database maintenance...');
    await pgClient.connect();
    console.log('[db-maintenance] Connected to database');

    // 1. Purge old chat_sessions
    console.log('[db-maintenance] Purging old chat_sessions (older than 30 days)...');
    try {
      const chatSessionsResult = await pgClient.query(`
        DELETE FROM chat_sessions 
        WHERE created_at < NOW() - INTERVAL '30 days'
      `);
      results.chat_sessions_deleted = chatSessionsResult.rowCount || 0;
      console.log(`[db-maintenance] Deleted ${results.chat_sessions_deleted} chat_sessions rows`);
    } catch (e) {
      const errorMsg = `Error purging chat_sessions: ${e.message}`;
      console.error(`[db-maintenance] ${errorMsg}`);
      results.errors.push(errorMsg);
    }

    // 2. Purge old chat_interactions
    console.log('[db-maintenance] Purging old chat_interactions (older than 30 days)...');
    try {
      const chatInteractionsResult = await pgClient.query(`
        DELETE FROM chat_interactions 
        WHERE created_at < NOW() - INTERVAL '30 days'
      `);
      results.chat_interactions_deleted = chatInteractionsResult.rowCount || 0;
      console.log(`[db-maintenance] Deleted ${results.chat_interactions_deleted} chat_interactions rows`);
    } catch (e) {
      const errorMsg = `Error purging chat_interactions: ${e.message}`;
      console.error(`[db-maintenance] ${errorMsg}`);
      results.errors.push(errorMsg);
    }

    // 3. Purge old page_html
    console.log('[db-maintenance] Purging old page_html (older than 30 days)...');
    try {
      const pageHtmlResult = await pgClient.query(`
        DELETE FROM page_html 
        WHERE created_at < NOW() - INTERVAL '30 days'
      `);
      results.page_html_deleted = pageHtmlResult.rowCount || 0;
      console.log(`[db-maintenance] Deleted ${results.page_html_deleted} page_html rows`);
    } catch (e) {
      const errorMsg = `Error purging page_html: ${e.message}`;
      console.error(`[db-maintenance] ${errorMsg}`);
      results.errors.push(errorMsg);
    }

    // 4. Purge old regression test data (keep last 30 days + latest baseline per job)
    console.log('[db-maintenance] Purging old regression test data (older than 30 days, keeping latest baseline per job)...');
    try {
      // Strategy: 
      // 1. Always keep the latest baseline for each job (for comparison)
      // 2. Keep all test runs from the last 30 days
      // 3. Delete everything else
      
      // Step 1: Delete old test runs (older than 30 days, but protect those with latest baselines)
      const deleteRunsResult = await pgClient.query(`
        WITH latest_baseline_runs AS (
          -- Find test runs that contain the latest baseline for each job
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
      
      // Step 2: Delete orphaned test results (not referenced by any test run, and not the latest baseline)
      const deleteResultsResult = await pgClient.query(`
        WITH latest_baselines AS (
          -- Get latest baseline ID for each job
          SELECT DISTINCT ON (job_id) id as baseline_id
          FROM regression_test_results
          WHERE test_phase = 'before'
          ORDER BY job_id, test_timestamp DESC
        ),
        referenced_results AS (
          -- Get all test result IDs that are still referenced by test runs
          SELECT DISTINCT baseline_test_id as test_id
          FROM regression_test_runs
          WHERE baseline_test_id IS NOT NULL
          UNION
          SELECT DISTINCT after_test_id as test_id
          FROM regression_test_runs
          WHERE after_test_id IS NOT NULL
        )
        DELETE FROM regression_test_results
        WHERE id NOT IN (SELECT baseline_id FROM latest_baselines)
          AND id NOT IN (SELECT test_id FROM referenced_results)
          AND test_timestamp < NOW() - INTERVAL '30 days';
      `);
      results.regression_test_results_deleted = deleteResultsResult.rowCount || 0;
      
      if (results.regression_test_runs_deleted > 0 || results.regression_test_results_deleted > 0) {
        console.log(`[db-maintenance] Deleted ${results.regression_test_runs_deleted} regression_test_runs and ${results.regression_test_results_deleted} regression_test_results rows`);
      } else {
        console.log('[db-maintenance] No old regression test data to purge');
      }
    } catch (e) {
      const errorMsg = `Error purging regression test data: ${e.message}`;
      console.error(`[db-maintenance] ${errorMsg}`);
      results.errors.push(errorMsg);
    }

    // 5. Drop backup tables
    console.log('[db-maintenance] Dropping backup tables (page_entities_backup_*)...');
    try {
      // First, get list of backup tables
      const backupTablesResult = await pgClient.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema='public'
          AND table_name LIKE 'page_entities_backup_%'
      `);
      
      const backupTables = backupTablesResult.rows.map(r => r.table_name);
      
      // Drop each backup table
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
      
      if (backupTables.length === 0) {
        console.log('[db-maintenance] No backup tables found to drop');
      }
    } catch (e) {
      const errorMsg = `Error dropping backup tables: ${e.message}`;
      console.error(`[db-maintenance] ${errorMsg}`);
      results.errors.push(errorMsg);
    }

    // Summary
    console.log('[db-maintenance] Database maintenance completed');
    console.log(`[db-maintenance] Summary: ${results.chat_sessions_deleted} chat_sessions, ${results.chat_interactions_deleted} chat_interactions, ${results.page_html_deleted} page_html, ${results.regression_test_runs_deleted} regression_test_runs, ${results.regression_test_results_deleted} regression_test_results deleted`);
    
    if (results.errors.length > 0) {
      console.error(`[db-maintenance] Errors encountered: ${results.errors.length}`);
      results.errors.forEach(err => console.error(`[db-maintenance]   - ${err}`));
    }

    return results;

  } catch (error) {
    const errorMsg = `Fatal error during maintenance: ${error.message}`;
    console.error(`[db-maintenance] ${errorMsg}`);
    console.error(`[db-maintenance] ${error.stack}`);
    results.errors.push(errorMsg);
    throw error;
  } finally {
    try {
      await pgClient.end();
      console.log('[db-maintenance] Database connection closed');
    } catch (e) {
      console.warn(`[db-maintenance] Error closing connection: ${e.message}`);
    }
  }
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are allowed'
    });
  }

  // Optional: Add authentication check for manual triggers
  // Cron jobs from Vercel don't need auth, but manual API calls can use it
  const authToken = req.headers.authorization?.replace('Bearer ', '') || 
                    req.query.token || 
                    req.body.token;

  const expectedToken = process.env.INGEST_TOKEN || process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  
  // Only check auth if token is provided (cron jobs won't provide one)
  if (authToken && expectedToken && authToken !== expectedToken) {
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
