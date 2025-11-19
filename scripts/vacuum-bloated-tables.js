/**
 * Vacuum Bloated Tables
 * Runs VACUUM ANALYZE on tables with high bloat to reduce dead rows
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

let connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.PGPASSWORD;
  const projectRef = process.env.SUPABASE_PROJECT || 'igzvwbvgvmzvvzoclufx';
  if (dbPassword) {
    const encodedPassword = encodeURIComponent(dbPassword);
    connectionString = `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`;
  } else {
    console.error('❌ Error: SUPABASE_DB_URL or SUPABASE_DB_PASSWORD required');
    process.exit(1);
  }
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function vacuumBloatedTables() {
  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // Find tables with high bloat
    console.log('📊 Checking for tables with high bloat...\n');
    const bloatQuery = `
      SELECT 
        relname as table_name,
        n_live_tup as live_rows,
        n_dead_tup as dead_rows,
        CASE
          WHEN n_live_tup + n_dead_tup = 0 THEN 0
          ELSE round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
        END AS dead_row_pct
      FROM pg_stat_user_tables
      WHERE n_dead_tup > 0
      ORDER BY dead_row_pct DESC;
    `;

    const bloatResult = await client.query(bloatQuery);
    const bloatedTables = bloatResult.rows.filter(t => parseFloat(t.dead_row_pct) > 2.5);

    if (bloatedTables.length === 0) {
      console.log('✓ No tables with significant bloat found\n');
      return;
    }

    console.log(`Found ${bloatedTables.length} tables with bloat > 2.5%:\n`);
    bloatedTables.forEach(t => {
      console.log(`  - ${t.table_name}: ${t.dead_row_pct}% (${t.dead_rows} dead rows, ${t.live_rows} live rows)`);
    });
    console.log('');

    // Run VACUUM ANALYZE on each bloated table
    // Note: VACUUM cannot run in a transaction, so we need to use autocommit mode
    console.log('🧹 Running VACUUM ANALYZE on bloated tables...\n');
    
    for (const table of bloatedTables) {
      console.log(`Vacuuming ${table.table_name} (${table.dead_row_pct}% bloat)...`);
      try {
        // Set autocommit mode by ending any transaction
        await client.query('COMMIT');
        // Run VACUUM ANALYZE
        await client.query(`VACUUM ANALYZE ${table.table_name};`);
        console.log(`   ✓ Completed ${table.table_name}\n`);
      } catch (err) {
        console.error(`   ✗ Failed: ${err.message}\n`);
      }
    }

    // Check results after vacuum
    console.log('📊 Rechecking bloat after VACUUM...\n');
    const afterResult = await client.query(bloatQuery);
    const stillBloated = afterResult.rows.filter(t => parseFloat(t.dead_row_pct) > 2.5);

    if (stillBloated.length === 0) {
      console.log('✅ All bloat resolved!\n');
    } else {
      console.log(`⚠️  ${stillBloated.length} tables still have bloat:\n`);
      stillBloated.forEach(t => {
        console.log(`  - ${t.table_name}: ${t.dead_row_pct}%`);
      });
      console.log('\n💡 Consider running VACUUM FULL on these tables if bloat persists.');
    }

    // Run general VACUUM ANALYZE on entire database
    console.log('\n🧹 Running VACUUM ANALYZE on entire database...');
    try {
      await client.query('COMMIT');
      await client.query('VACUUM ANALYZE;');
      console.log('   ✓ Database-wide VACUUM ANALYZE completed\n');
    } catch (err) {
      console.error(`   ✗ Failed: ${err.message}\n`);
    }

    // Check final risk score
    console.log('📊 Checking final risk scores...\n');
    const riskQuery = `SELECT db_health_extended()->'risk_scores' as risk_scores;`;
    const riskResult = await client.query(riskQuery);
    const risks = riskResult.rows[0].risk_scores;
    
    console.log('Final Risk Scores:');
    console.log(`  Debug Log Risk: ${risks.debug_log_risk}`);
    console.log(`  Bloat Risk: ${risks.bloat_risk} (was 50)`);
    console.log(`  Chunk Risk: ${risks.chunk_risk}`);
    console.log(`  Total Risk: ${risks.total_risk} (was 135)\n`);

    console.log('✨ Cleanup complete!');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

vacuumBloatedTables();

