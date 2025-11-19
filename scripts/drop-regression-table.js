import pg from 'pg';

// Construct connection config
let clientConfig;

if (process.env.SUPABASE_DB_URL) {
  clientConfig = {
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  };
} else {
  // Try to construct from individual components
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.PGPASSWORD;
  const projectRef = 'igzvwbvgvmzvvzoclufx'; // From SUPABASE_URL
  
  if (dbPassword) {
    // Construct connection string with URL-encoded password
    console.log('Constructing connection from SUPABASE_DB_PASSWORD');
    const encodedPassword = encodeURIComponent(dbPassword);
    const connectionString = `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`;
    clientConfig = {
      connectionString,
      ssl: { rejectUnauthorized: false },
    };
  } else {
    console.error('❌ Error: SUPABASE_DB_URL or SUPABASE_DB_PASSWORD environment variable is required');
    console.error('   SUPABASE_DB_URL format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres');
    process.exit(1);
  }
}

const client = new pg.Client({
  ...clientConfig,
  connectionTimeoutMillis: 10000, // 10 second timeout
});

async function run() {
  try {
    await client.connect();
    console.log("Connected.");

    console.log("Killing locks...");
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
        AND query ILIKE '%regression_test_runs%';
    `);

    console.log("Checking if table exists...");
    const checkResult = await client.query(`SELECT to_regclass('public.regression_test_runs');`);
    const tableExists = checkResult.rows[0]?.to_regclass !== null;
    
    if (tableExists) {
      console.log("Table exists. Truncating table...");
      await client.query(`TRUNCATE TABLE regression_test_runs;`);
    } else {
      console.log("Table does not exist, skipping truncate.");
    }

    console.log("Dropping table...");
    await client.query(`DROP TABLE IF EXISTS regression_test_runs;`);

    console.log("Verifying table removal...");
    const verifyResult = await client.query(`SELECT to_regclass('public.regression_test_runs');`);
    const stillExists = verifyResult.rows[0]?.to_regclass !== null;
    
    if (stillExists) {
      console.log("⚠️  WARNING: Table still exists!");
    } else {
      console.log("✓ Verified: Table does not exist");
    }

    console.log("DONE — regression_test_runs removed ✔️");
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();

