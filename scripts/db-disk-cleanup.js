/**
 * DB Disk Cleanup Script
 * ------------------------------------------
 * - Connects directly to Supabase Postgres
 * - Measures DB size BEFORE cleanup
 * - Runs VACUUM (ANALYZE) safely (not FULL)
 * - Measures DB size AFTER cleanup
 * - Prints results in a nice summary
 * ------------------------------------------
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

async function safeVacuum() {
  console.log("\n🔧 Running VACUUM (ANALYZE)... (safe, non-blocking)");

  try {
    await client.query("VACUUM (ANALYZE);");
    console.log("   ✓ VACUUM completed");
  } catch (err) {
    console.error("   ✗ VACUUM failed:", err.message);
  }
}

(async () => {
  console.log("------------------------------------------------------");
  console.log(" DB DISK CLEANUP – SAFE MODE");
  console.log("------------------------------------------------------");

  try {
    await client.connect();
    console.log("✓ Connected to database");

    console.log("\n📏 Checking database size BEFORE cleanup...");
    const before = await getDbSize();
    console.table(before);

    // Optional area for future deletions:
    // await client.query("DROP TABLE IF EXISTS your_table_name CASCADE");

    await safeVacuum();

    console.log("\n📏 Checking database size AFTER cleanup...");
    const after = await getDbSize();
    console.table(after);

    console.log("\n💡 SUMMARY");
    console.log("--------------------------------------");
    console.log(`Before: ${before.total_size}`);
    console.log(`After:  ${after.total_size}`);
    console.log("--------------------------------------");

    console.log("\n✨ Cleanup routine complete!");
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();

