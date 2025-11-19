/**
 * Safe VACUUM FULL for Supabase
 * -----------------------------------------------------
 * - Measures DB size BEFORE
 * - Kills all blocking connections
 * - Runs VACUUM FULL (entire database)
 * - Measures DB size AFTER
 * - Prints reclaimed space
 * -----------------------------------------------------
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Construct connection string
let connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.PGPASSWORD;
  const projectRef = process.env.SUPABASE_PROJECT || 'igzvwbvgvmzvvzoclufx'; // Extract from SUPABASE_URL if needed
  
  if (dbPassword) {
    const encodedPassword = encodeURIComponent(dbPassword);
    connectionString = `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`;
  } else {
    console.error('❌ Error: SUPABASE_DB_URL or SUPABASE_DB_PASSWORD environment variable is required');
    process.exit(1);
  }
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function getDbSize() {
  const sql = `
    SELECT
      pg_size_pretty(pg_database_size(current_database())) AS total_size,
      pg_size_pretty(sum(pg_relation_size(oid))) AS tables_only,
      pg_size_pretty(sum(pg_total_relation_size(oid))) AS tables_with_indexes
    FROM pg_class;
  `;
  const res = await client.query(sql);
  return res.rows[0];
}

// Kill every connection except our own
async function killConnections() {
  console.log("🔪 Killing all blocking sessions…");

  const sql = `
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE pid <> pg_backend_pid()
    AND state <> 'idle';
  `;

  const result = await client.query(sql);
  const killedCount = result.rows.filter(row => row.pg_terminate_backend === true).length;
  console.log(`   ✓ Terminated ${killedCount} blocking session(s)`);
}

// Check remaining blockers
async function checkLocks() {
  const sql = `
    SELECT pid, query, wait_event_type, wait_event
    FROM pg_stat_activity
    WHERE wait_event_type = 'Lock';
  `;
  const res = await client.query(sql);
  return res.rows;
}

async function vacuumFull() {
  console.log("\n🧹 Running VACUUM FULL (this may take a while)…");
  try {
    await client.query("VACUUM FULL;");
    console.log("   ✓ VACUUM FULL completed");
  } catch (err) {
    console.error("   ✗ VACUUM FULL failed:", err.message);
    throw err;
  }
}

(async () => {
  console.log("------------------------------------------------------");
  console.log(" SAFE VACUUM FULL — FULL STORAGE RECLAIM");
  console.log("------------------------------------------------------");

  try {
    await client.connect();
    console.log("✓ Connected to database");

    console.log("\n📏 Checking DB size BEFORE VACUUM FULL…");
    const before = await getDbSize();
    console.table(before);

    await killConnections();

    const locks = await checkLocks();
    if (locks.length > 0) {
      console.warn("⚠️  Still blocked by:", locks);
      console.warn("Cannot continue safely.");
      process.exit(1);
    }

    await vacuumFull();

    console.log("\n📏 Checking DB size AFTER VACUUM FULL…");
    const after = await getDbSize();
    console.table(after);

    console.log("\n📉 SPACE RECLAIMED");
    console.log("----------------------------------------");
    console.log(`Before: ${before.total_size}`);
    console.log(`After:  ${after.total_size}`);
    console.log("----------------------------------------");

    console.log("\n✨ VACUUM FULL completed safely");
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();

