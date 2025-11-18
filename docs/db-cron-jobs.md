# Database Cron Jobs Documentation

## Overview

This document describes the automated database maintenance cron jobs for the `page_html` table in Supabase Postgres.

## Purpose

The `page_html` table stores HTML content scraped from website pages. Over time, this table can grow significantly, consuming storage space and impacting query performance. These cron jobs automate cleanup and maintenance to keep the database healthy.

---

## Cron Jobs

### 1. Daily Cleanup Job (`daily_page_html_cleanup`)

**Job ID:** 41  
**Schedule:** Daily at 02:00 UTC (`0 2 * * *`)  
**Status:** Active

#### Purpose
Removes old HTML content from the `page_html` table that is older than 30 days. This prevents the table from growing indefinitely and helps maintain database performance.

#### SQL Command
```sql
DELETE FROM page_html
WHERE created_at < NOW() - INTERVAL '30 days';
```

#### What It Does
- Deletes all rows where `created_at` is more than 30 days old
- Runs automatically every day at 2:00 AM UTC
- Helps prevent table bloat and storage issues

#### Monitoring
- Check job execution in Supabase Dashboard → Database → Cron Jobs
- Monitor table size reduction after cleanup runs
- Review `cron.job_run_details` for execution history

---

### 2. Daily Analyze Job (`daily_page_html_analyze`)

**Job ID:** 42  
**Schedule:** Daily at 02:30 UTC (`30 2 * * *`)  
**Status:** Active

#### Purpose
Updates PostgreSQL query planner statistics for the `page_html` table. This ensures the query optimizer has accurate information about table size and data distribution, leading to better query performance.

#### SQL Command
```sql
ANALYZE page_html;
```

#### What It Does
- Updates table statistics used by the query planner
- Runs 30 minutes after cleanup (02:30 UTC) to analyze the table after cleanup
- Improves query performance by providing accurate statistics

#### Why It's Important
After the cleanup job removes old rows, the table statistics become stale. Running `ANALYZE` ensures PostgreSQL knows the current state of the table and can optimize queries accordingly.

---

## Supabase Dashboard Location

To view and manage these cron jobs:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Database** → **Cron Jobs**
4. Look for jobs with IDs 41 and 42, or search for:
   - `daily_page_html_cleanup`
   - `daily_page_html_analyze`

---

## Troubleshooting

### Timeouts

**Issue:** Job execution times out  
**Symptoms:** Job shows as failed in cron job history  
**Solutions:**
- Check table size - very large tables may need longer execution time
- Consider running cleanup during off-peak hours
- If table is extremely large, consider running cleanup in batches

### Table Bloat

**Issue:** Table size not decreasing after cleanup  
**Symptoms:** `pg_total_relation_size('page_html')` remains high  
**Solutions:**
- Run `VACUUM FULL page_html;` manually (requires downtime)
- Check if `created_at` column is properly indexed
- Verify cleanup job is actually deleting rows (check `cron.job_run_details`)

### Sequence Resets

**Issue:** Sequence values not reset after large deletions  
**Symptoms:** Sequence continues from high value even after cleanup  
**Solutions:**
- This is normal PostgreSQL behavior - sequences don't reset automatically
- If needed, manually reset: `SELECT setval('page_html_id_seq', (SELECT MAX(id) FROM page_html));`
- Only reset if you need to reclaim sequence number space (rarely necessary)

### Job Not Running

**Issue:** Cron job not executing  
**Symptoms:** No entries in `cron.job_run_details` for expected time  
**Solutions:**
- Verify job is active: `SELECT active FROM cron.job WHERE jobname = 'daily_page_html_cleanup';`
- Check pg_cron extension is enabled
- Verify schedule syntax is correct
- Check Supabase logs for errors

### Verification

Use the verification script to check job health:
```bash
node scripts/db/verify-page-html-maintenance.js
```

This script will show:
- Current table size
- Number of rows older than 30 days
- Last run time of both cron jobs
- Overall health status

---

## Related Files

- Verification Script: `/scripts/db/verify-page-html-maintenance.js`
- Main README: `/README.md` (Database Maintenance section)

---

## Notes

- Both jobs run during off-peak hours (02:00-02:30 UTC) to minimize impact
- Cleanup runs first, then analyze runs 30 minutes later
- The 30-day retention period can be adjusted if needed
- These jobs are read-only for monitoring purposes - they only delete old data and update statistics

