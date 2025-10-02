const { Client } = require('pg');

async function main() {
  const password = process.env.PGPASSWORD;
  if (!password) {
    console.error('PGPASSWORD not set');
    process.exit(1);
  }

  const client = new Client({
    host: 'db.igzvwbvgvmzvvzoclufx.supabase.co',
    port: 5432,
    user: 'postgres',
    database: 'postgres',
    password,
    ssl: { rejectUnauthorized: false },
    application_name: 'mcp-rw-test',
  });

  await client.connect();

  const ro = await client.query("SHOW transaction_read_only");
  console.log('transaction_read_only:', ro.rows[0].transaction_read_only);

  await client.query('BEGIN');
  try {
    await client.query('SET TRANSACTION READ WRITE');
    await client.query('CREATE TEMP TABLE IF NOT EXISTS temp_write_test (id serial PRIMARY KEY, note text, created_at timestamptz default now())');
    const inserted = await client.query("INSERT INTO temp_write_test (note) VALUES ($1) RETURNING id, note, created_at", [
      `write test from Node at ${new Date().toISOString()}`,
    ]);
    console.log('inserted:', inserted.rows[0]);
    const read = await client.query('SELECT count(*)::int AS count FROM temp_write_test');
    console.log('rows in temp table this session:', read.rows[0]);
    await client.query('ROLLBACK');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('RW test failed:', err.message);
  process.exit(1);
});



