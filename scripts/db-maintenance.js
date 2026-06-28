// scripts/db-maintenance.js
// Database maintenance script for purging old data and backup tables
// Connects to Supabase via service role key and runs cleanup operations

import pg from 'pg';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
function loadEnv() {
  try {
    const envContent = readFileSync('.env', 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
          process.env[key.trim()] = value;
        }
      }
    });
  } catch (e) {
    console.warn('Could not load .env file:', e.message);
  }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!SUPABASE_DB_URL) {
  console.error('❌ Error: Missing SUPABASE_DB_URL (required for maintenance operations)');
  process.exit(1);
}

// Logging function
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}\n`;
  
  // Console output
  console.log(logMessage.trim());
  
  // File output
  try {
    const logDir = join(__dirname, '..', 'logs');
    mkdirSync(logDir, { recursive: true });
    const logFile = join(logDir, 'db-maintenance.log');
    writeFileSync(logFile, logMessage, { flag: 'a' });
  } catch (e) {
    console.warn('Could not write to log file:', e.message);
  }
}

const PURGE_BATCH_SIZE = 5000;
const PURGE_MAX_BATCHES = 500; // safety cap (5000 * 500 = 2.5M rows/run)

// Delete in small batches so a large backlog cannot exceed any timeout
// (the old single-shot DELETE silently timed out, letting rows pile up for months).
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

async function purgeTimeBasedTables(pgClient, results) {
  const targets = [
    { table: 'chat_sessions', key: 'chat_sessions_deleted' },
    { table: 'chat_interactions', key: 'chat_interactions_deleted' },
    { table: 'page_html', key: 'page_html_deleted' },
  ];
  for (const target of targets) {
    log(`Purging old ${target.table} (older than 30 days)...`);
    try {
      results[target.key] = await purgeOldRows(pgClient, target.table, '30 days');
      log(`Deleted ${results[target.key]} ${target.table} rows`);
    } catch (e) {
      const errorMsg = `Error purging ${target.table}: ${e.message}`;
      log(errorMsg, 'ERROR');
      results.errors.push(errorMsg);
    }
  }
}

// Plain VACUUM (no FULL = no exclusive lock) reclaims dead-tuple space + refreshes stats.
async function vacuumPurgedTables(pgClient, results) {
  log('Vacuuming purged tables...');
  for (const table of ['chat_sessions', 'chat_interactions', 'page_html']) {
    try {
      await pgClient.query(`VACUUM (ANALYZE) ${table}`);
    } catch (e) {
      const errorMsg = `Error vacuuming ${table}: ${e.message}`;
      log(errorMsg, 'ERROR');
      results.errors.push(errorMsg);
    }
  }
}

async function runMaintenance() {
  const pgClient = new pg.Client({
    connectionString: SUPABASE_DB_URL
  });

  const results = {
    chat_sessions_deleted: 0,
    chat_interactions_deleted: 0,
    page_html_deleted: 0,
    backup_tables_dropped: [],
    errors: []
  };

  try {
    log('Starting database maintenance...');
    await pgClient.connect();
    log('Connected to database');

    // 1-3. Purge old chat_sessions / chat_interactions / page_html (batched)
    await purgeTimeBasedTables(pgClient, results);

    // 4. Drop backup tables
    log('Dropping backup tables (page_entities_backup_*)...');
    try {
      const dropBackupTablesQuery = `
        DO $$
        DECLARE
          r record;
        BEGIN
          FOR r IN SELECT table_name 
                   FROM information_schema.tables 
                   WHERE table_schema='public'
                     AND table_name LIKE 'page_entities_backup_%'
          LOOP
            EXECUTE 'DROP TABLE ' || quote_ident(r.table_name) || ' CASCADE';
          END LOOP;
        END$$;
      `;
      
      await pgClient.query(dropBackupTablesQuery);
      
      // Get list of dropped tables
      const backupTablesResult = await pgClient.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema='public'
          AND table_name LIKE 'page_entities_backup_%'
      `);
      
      // Note: We can't get the list of dropped tables from the DO block,
      // so we'll check what's left and log accordingly
      const remainingBackups = backupTablesResult.rows.map(r => r.table_name);
      if (remainingBackups.length === 0) {
        log('All backup tables dropped successfully');
      } else {
        log(`Warning: ${remainingBackups.length} backup tables still exist: ${remainingBackups.join(', ')}`);
      }
    } catch (e) {
      const errorMsg = `Error dropping backup tables: ${e.message}`;
      log(errorMsg, 'ERROR');
      results.errors.push(errorMsg);
    }

    // 5. Reclaim space from the purged tables
    await vacuumPurgedTables(pgClient, results);

    // Summary
    log('Database maintenance completed');
    log(`Summary: ${results.chat_sessions_deleted} chat_sessions, ${results.chat_interactions_deleted} chat_interactions, ${results.page_html_deleted} page_html deleted`);
    
    if (results.errors.length > 0) {
      log(`Errors encountered: ${results.errors.length}`, 'ERROR');
      results.errors.forEach(err => log(`  - ${err}`, 'ERROR'));
    }

    return results;

  } catch (error) {
    const errorMsg = `Fatal error during maintenance: ${error.message}`;
    log(errorMsg, 'ERROR');
    log(error.stack, 'ERROR');
    results.errors.push(errorMsg);
    throw error;
  } finally {
    try {
      await pgClient.end();
      log('Database connection closed');
    } catch (e) {
      log(`Error closing connection: ${e.message}`, 'WARN');
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMaintenance()
    .then(results => {
      console.log('\n✅ Maintenance completed successfully');
      console.log(JSON.stringify(results, null, 2));
      process.exit(results.errors.length > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('\n❌ Maintenance failed');
      console.error(error);
      process.exit(1);
    });
}

export { runMaintenance, log };

