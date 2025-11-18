// scripts/db-health-check.js
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL, // add this in .env
});

async function run() {
  await client.connect();

  console.log("=== DB HEALTH SUMMARY ===");
  const summary = await client.query("SELECT * FROM db_health_summary;");
  console.table(summary.rows);

  console.log("\n=== TABLE WATCHLIST ===");
  const watch = await client.query("SELECT * FROM db_table_watchlist;");
  console.table(watch.rows);

  await client.end();
}

run().catch(console.error);
