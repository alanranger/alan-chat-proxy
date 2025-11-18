// scripts/db/verify-page-html-maintenance.js
// Read-only verification script for page_html maintenance cron jobs
// Checks table size, old rows, and cron job execution status

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { readFileSync } from 'fs';

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

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Please ensure these are set in your .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'public' }
});

// Use direct PostgreSQL connection for table size queries
const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
let pgClient = null;

if (SUPABASE_DB_URL) {
  pgClient = new pg.Client({
    connectionString: SUPABASE_DB_URL
  });
}

async function verifyMaintenance() {
  console.log('🔍 Verifying page_html Maintenance Status\n');
  console.log('=' .repeat(60));

  try {
    // 1. Get table size and row counts
    console.log('\n📊 Table Statistics:');
    
    let stats = {};
    
    // Try to use direct PostgreSQL connection for accurate table size
    if (pgClient) {
      try {
        await pgClient.connect();
        const result = await pgClient.query(`
          SELECT 
            pg_total_relation_size('page_html') as table_size_bytes,
            pg_size_pretty(pg_total_relation_size('page_html')) as table_size_pretty,
            COUNT(*) as total_rows,
            COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '30 days') as rows_older_than_30_days,
            MIN(created_at) as oldest_row,
            MAX(created_at) as newest_row
          FROM page_html
        `);
        stats = result.rows[0] || {};
        await pgClient.end();
      } catch (pgError) {
        console.warn('  ⚠️  Could not use direct DB connection, falling back to Supabase client');
        if (pgClient) {
          try {
            await pgClient.end();
          } catch (e) {
            // Ignore
          }
        }
      }
    }
    
    // Fallback: Use Supabase client for row counts if direct connection failed
    if (!stats.total_rows) {
      const { count: totalRows, error: countError } = await supabase
        .from('page_html')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.error('❌ Error fetching table statistics:', countError.message);
        return;
      }
      
      // Get sample of rows to estimate old rows (limited to avoid large queries)
      const { data: sampleRows, error: sampleError } = await supabase
        .from('page_html')
        .select('created_at')
        .order('created_at', { ascending: true })
        .limit(1000);
      
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oldRowsInSample = sampleRows?.filter(row => 
        row.created_at && new Date(row.created_at) < thirtyDaysAgo
      ).length || 0;
      
      // Estimate based on sample (rough approximation)
      const estimatedOldRows = sampleRows && sampleRows.length > 0
        ? Math.round((oldRowsInSample / sampleRows.length) * totalRows)
        : 0;
      
      stats = {
        total_rows: totalRows || 0,
        rows_older_than_30_days: estimatedOldRows,
        table_size_pretty: 'N/A (set SUPABASE_DB_URL for accurate size)'
      };
    }
    console.log(`  Table Size: ${stats.table_size_pretty || 'N/A'}`);
    console.log(`  Total Rows: ${(stats.total_rows || 0).toLocaleString()}`);
    console.log(`  Rows Older Than 30 Days: ${(stats.rows_older_than_30_days || 0).toLocaleString()}`);
    console.log(`  Oldest Row: ${stats.oldest_row ? new Date(stats.oldest_row).toLocaleString() : 'N/A'}`);
    console.log(`  Newest Row: ${stats.newest_row ? new Date(stats.newest_row).toLocaleString() : 'N/A'}`);

    // 2. Get cron job status
    console.log('\n⏰ Cron Job Status:');
    
    // Query cron.job table using direct SQL (Supabase client doesn't handle cross-schema well)
    let cronJobs = [];
    if (pgClient) {
      try {
        if (!pgClient._connected) {
          await pgClient.connect();
        }
        const cronResult = await pgClient.query(`
          SELECT jobid, jobname, schedule, active
          FROM cron.job
          WHERE jobname IN ('daily_page_html_cleanup', 'daily_page_html_analyze')
          ORDER BY jobid
        `);
        cronJobs = cronResult.rows || [];
      } catch (cronPgError) {
        console.warn('  ⚠️  Could not query cron jobs via direct connection');
      }
    }
    
    // Fallback: Try Supabase RPC if available
    if (cronJobs.length === 0) {
      try {
        const { data: allJobs, error: cronError } = await supabase.rpc('get_cron_jobs');
        if (!cronError && allJobs) {
          cronJobs = allJobs.filter(j => 
            j.jobname === 'daily_page_html_cleanup' || j.jobname === 'daily_page_html_analyze'
          );
        }
      } catch (e) {
        console.warn('  ⚠️  Could not fetch cron jobs via RPC');
      }
    }

    if (!cronJobs || cronJobs.length === 0) {
      console.log('  ⚠️  No cron jobs found!');
      return;
    }

    for (const job of cronJobs) {
      const status = job.active ? '✅ Active' : '❌ Inactive';
      console.log(`  ${status} - ${job.jobname} (ID: ${job.jobid})`);
      console.log(`    Schedule: ${job.schedule}`);
    }

    // 3. Get last run times
    console.log('\n📅 Last Execution Times:');
    const jobIds = cronJobs.map(j => j.jobid);
    let lastRuns = [];
    
    if (jobIds.length > 0) {
      // Try direct SQL query first
      if (pgClient && pgClient._connected) {
        try {
          const runsResult = await pgClient.query(`
            SELECT jobid, runid, job_pid, database, username, command, status, return_message, start_time, end_time
            FROM cron.job_run_details
            WHERE jobid = ANY($1::int[])
            ORDER BY start_time DESC
            LIMIT 10
          `, [jobIds]);
          lastRuns = runsResult.rows || [];
        } catch (runsPgError) {
          console.warn('  ⚠️  Could not query run details via direct connection');
        }
      }
      
      // Fallback: Try Supabase client (may not work for cron schema)
      if (lastRuns.length === 0) {
        try {
          const { data: runsData, error: runsError } = await supabase
            .from('job_run_details')
            .select('jobid, runid, status, return_message, start_time, end_time')
            .in('jobid', jobIds)
            .order('start_time', { ascending: false })
            .limit(10);
          
          if (!runsError && runsData) {
            lastRuns = runsData;
          }
        } catch (e) {
          // Ignore - will show no history
        }
      }

      if (lastRuns && lastRuns.length > 0) {
        // Group by jobid and get most recent for each
        const latestByJob = {};
        lastRuns.forEach(run => {
          if (!latestByJob[run.jobid] || new Date(run.start_time) > new Date(latestByJob[run.jobid].start_time)) {
            latestByJob[run.jobid] = run;
          }
        });

        cronJobs.forEach(job => {
          const lastRun = latestByJob[job.jobid];
          if (lastRun) {
            const status = lastRun.status === 'succeeded' ? '✅' : '❌';
            const runTime = new Date(lastRun.start_time).toLocaleString();
            console.log(`  ${status} ${job.jobname}: ${runTime}`);
            if (lastRun.status !== 'succeeded') {
              console.log(`    Error: ${lastRun.return_message || 'Unknown error'}`);
            }
          } else {
            console.log(`  ⚠️  ${job.jobname}: No execution history found`);
          }
        });
      } else {
        console.log('  ⚠️  No execution history found for these jobs');
      }
    }

    // 4. Health Summary
    console.log('\n💚 Health Summary:');
    const oldRowsCount = parseInt(stats.rows_older_than_30_days || 0);
    const totalRows = parseInt(stats.total_rows || 0);
    const oldRowsPercent = totalRows > 0 ? ((oldRowsCount / totalRows) * 100).toFixed(1) : 0;

    const allJobsActive = cronJobs.every(j => j.active);
    const hasOldRows = oldRowsCount > 0;

    if (allJobsActive && !hasOldRows) {
      console.log('  ✅ All systems healthy');
      console.log('  ✅ Cron jobs are active');
      console.log('  ✅ No rows older than 30 days (cleanup working)');
    } else {
      if (!allJobsActive) {
        console.log('  ⚠️  Some cron jobs are inactive');
      }
      if (hasOldRows) {
        console.log(`  ⚠️  ${oldRowsCount.toLocaleString()} rows (${oldRowsPercent}%) are older than 30 days`);
        console.log('     Cleanup job may need to run or may have failed');
      }
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Clean up database connection
    if (pgClient && pgClient._connected) {
      try {
        await pgClient.end();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

verifyMaintenance().catch(console.error);

