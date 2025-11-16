# How to Test Each Risky Cron Job

This guide explains how to manually test each risky cron job to verify regression testing is working correctly.

## Overview

All risky jobs (21, 26-28, 31) now automatically run regression tests before and after execution. This guide shows you how to:
1. Establish baselines
2. Manually trigger jobs
3. Verify regression tests run
4. Review results
5. Test rollback if needed

---

## Prerequisites

1. **Establish Baselines First:**
   ```bash
   node testing-scripts/cron-regression-tests/run-baseline-regression-tests.cjs
   ```
   This creates baseline test results for all risky jobs in the database.

2. **Access Dashboard:**
   - Open `https://alan-chat-proxy.vercel.app/cron-dashboard.html`
   - Authenticate with your INGEST_TOKEN

---

## Job 21: Refresh Product Pricing

### What It Does
- Refreshes the `v_products_unified` materialized view
- Updates display prices for all products
- **Risk:** Changes product data that affects product-related queries

### How to Test

#### Step 1: Check Current State
```sql
-- Check when view was last refreshed
SELECT * FROM pg_stat_user_tables WHERE relname = 'v_products_unified';

-- Check current product count
SELECT COUNT(*) FROM v_products_unified;
```

#### Step 2: Run Baseline Test (if not done)
The baseline test should already be in the database from running `run-baseline-regression-tests.cjs`. Verify:
```sql
SELECT * FROM regression_test_runs 
WHERE job_id = 21 
ORDER BY run_started_at DESC 
LIMIT 1;
```

#### Step 3: Manually Trigger Job
**Option A: Via SQL (recommended for testing)**
```sql
SELECT refresh_v_products_unified_with_regression_test();
```

**Option B: Via Cron Dashboard**
- Go to cron dashboard
- Find Job 21
- Click "Edit Schedule"
- Temporarily set to run in 1 minute
- Wait for execution

#### Step 4: Monitor Execution
1. **Check Dashboard:**
   - Job 21 tile should show regression test summary
   - Look for "Regression test in progress..." or results

2. **Check Database:**
   ```sql
   -- Check test run status
   SELECT * FROM regression_test_runs 
   WHERE job_id = 21 
   ORDER BY run_started_at DESC 
   LIMIT 1;
   
   -- Check if both tests completed
   SELECT 
     id,
     job_id,
     status,
     baseline_test_id,
     after_test_id,
     run_started_at,
     notes
   FROM regression_test_runs 
   WHERE job_id = 21 
   ORDER BY run_started_at DESC 
   LIMIT 1;
   ```

3. **Check Logs:**
   - In dashboard, click "View Logs" for Job 21
   - Look for regression test messages
   - Check for warnings if regression detected

#### Step 5: Review Results
1. **Dashboard:**
   - Regression test summary shows:
     - Baseline vs Current success rates
     - Confidence scores
     - Article changes
     - Regression severity

2. **Database Analysis:**
   ```sql
   -- Get detailed comparison
   SELECT * FROM analyze_regression_test_run(
     (SELECT id FROM regression_test_runs WHERE job_id = 21 ORDER BY run_started_at DESC LIMIT 1)
   );
   ```

#### Step 6: Verify Job Executed
```sql
-- Check if view was refreshed
SELECT * FROM pg_stat_user_tables WHERE relname = 'v_products_unified';

-- Verify product count unchanged (should be same)
SELECT COUNT(*) FROM v_products_unified;
```

---

## Jobs 26, 27, 28: Light Refresh Batches

### What They Do
- Check URLs for content changes (Last-Modified headers)
- Re-ingest only changed URLs
- Update chunks, embeddings, page_entities
- **Risk:** Changes content/chunks/embeddings that affect all queries

### How to Test

#### Step 1: Check Current State
```sql
-- Check recent ingestions
SELECT url, last_ingested_at, content_hash 
FROM csv_metadata 
WHERE csv_type = 'site_urls'
ORDER BY last_ingested_at DESC 
LIMIT 10;
```

#### Step 2: Run Baseline Test (if not done)
```sql
SELECT * FROM regression_test_runs 
WHERE job_id IN (26, 27, 28)
ORDER BY run_started_at DESC 
LIMIT 3;
```

#### Step 3: Manually Trigger Job

**For Batch 0 (Job 26):**
```sql
SELECT light_refresh_batch_with_regression_test(0);
```

**For Batch 1 (Job 27):**
```sql
SELECT light_refresh_batch_with_regression_test(1);
```

**For Batch 2 (Job 28):**
```sql
SELECT light_refresh_batch_with_regression_test(2);
```

**Or via Dashboard:**
- Find Jobs 26, 27, or 28
- Temporarily adjust schedule to run soon
- Wait for execution

#### Step 4: Monitor Execution
1. **Check Dashboard:**
   - Job tiles show regression test summaries
   - All three batches should show results

2. **Check Database:**
   ```sql
   -- Check all three jobs
   SELECT 
     job_id,
     job_name,
     status,
     baseline_test_id,
     after_test_id,
     run_started_at
   FROM regression_test_runs 
   WHERE job_id IN (26, 27, 28)
   ORDER BY job_id, run_started_at DESC;
   ```

3. **Check Edge Function Logs:**
   - In Supabase dashboard, check Edge Function logs for `light-refresh`
   - Verify it was called with correct batch parameter

#### Step 5: Review Results
- Same as Job 21 - check dashboard and database
- Pay attention to article changes (these jobs affect content)

#### Step 6: Verify Job Executed
```sql
-- Check if any URLs were re-ingested
SELECT url, last_ingested_at, content_hash 
FROM csv_metadata 
WHERE csv_type = 'site_urls'
  AND last_ingested_at > NOW() - INTERVAL '1 hour'
ORDER BY last_ingested_at DESC;
```

---

## Job 31: Cleanup Orphaned Records

### What It Does
- Deletes page_chunks without valid page_entities
- Deletes page_entities without valid csv_metadata
- **Risk:** Might delete chunks/entities needed for queries

### How to Test

#### Step 1: Check Current State
```sql
-- Count orphaned records before cleanup
SELECT 
  (SELECT COUNT(*) FROM page_chunks pc 
   LEFT JOIN page_entities pe ON pc.page_entity_id = pe.id 
   WHERE pe.id IS NULL) as orphaned_chunks,
  (SELECT COUNT(*) FROM page_entities pe 
   LEFT JOIN csv_metadata cm ON pe.csv_metadata_id = cm.id 
   WHERE cm.id IS NULL) as orphaned_entities;
```

#### Step 2: Run Baseline Test (if not done)
```sql
SELECT * FROM regression_test_runs 
WHERE job_id = 31 
ORDER BY run_started_at DESC 
LIMIT 1;
```

#### Step 3: Manually Trigger Job
```sql
SELECT * FROM cleanup_orphaned_records_with_regression_test();
```

**Or via Dashboard:**
- Find Job 31
- Temporarily adjust schedule
- Wait for execution

#### Step 4: Monitor Execution
- Same process as other jobs
- Check dashboard and database

#### Step 5: Review Results
- **Important:** This job can cause regressions if it deletes needed chunks
- Check article changes carefully
- Verify queries still work after cleanup

#### Step 6: Verify Job Executed
```sql
-- Check orphaned records after cleanup
SELECT 
  (SELECT COUNT(*) FROM page_chunks pc 
   LEFT JOIN page_entities pe ON pc.page_entity_id = pe.id 
   WHERE pe.id IS NULL) as orphaned_chunks,
  (SELECT COUNT(*) FROM page_entities pe 
   LEFT JOIN csv_metadata cm ON pe.csv_metadata_id = cm.id 
   WHERE cm.id IS NULL) as orphaned_entities;

-- Should be 0 or significantly reduced
```

---

## Testing Regression Detection

### Test Severe Regression (Simulation)

1. **Manually modify content:**
   ```sql
   -- Temporarily delete some chunks (CAREFUL - test only!)
   DELETE FROM page_chunks WHERE id IN (
     SELECT id FROM page_chunks LIMIT 10
   );
   ```

2. **Run after test:**
   ```sql
   -- This will detect the regression
   SELECT * FROM cleanup_orphaned_records_with_regression_test();
   ```

3. **Verify detection:**
   - Dashboard should show severe regression
   - Check logs for warnings
   - Review affected queries

4. **Restore:**
   ```sql
   -- Restore from backup or re-ingest
   -- (Don't leave test data in production!)
   ```

### Test No Regression

1. **Run baseline:**
   ```bash
   node testing-scripts/cron-regression-tests/run-baseline-regression-tests.cjs
   ```

2. **Run job:**
   ```sql
   SELECT refresh_v_products_unified_with_regression_test();
   ```

3. **Verify:**
   - Dashboard shows "No Regression"
   - Success rates similar
   - No article changes

---

## Troubleshooting

### Regression Tests Not Running

1. **Check pg_net extension:**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_net';
   ```

2. **Check API endpoint:**
   ```bash
   curl -X POST "https://alan-chat-proxy.vercel.app/api/admin?action=run_regression_test" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"job_id": 21, "job_name": "test", "test_phase": "before"}'
   ```

3. **Check Edge Function:**
   - Verify `run-40q-regression-test` Edge Function exists
   - Check Edge Function logs in Supabase

### Tests Timing Out

- Baseline/after tests wait up to 5 minutes
- If timeout, check Edge Function logs
- Verify API is responding

### No Results in Dashboard

1. **Check database:**
   ```sql
   SELECT * FROM regression_test_runs ORDER BY run_started_at DESC LIMIT 5;
   ```

2. **Refresh dashboard:**
   - Click "Refresh Jobs" button
   - Check browser console for errors

---

## Best Practices

1. **Always establish baselines before testing**
2. **Test one job at a time** to isolate issues
3. **Review regression summaries** in dashboard
4. **Check logs** if regressions detected
5. **Test during low-traffic periods** if possible
6. **Document any acceptable regressions**

---

## Quick Reference

### SQL Commands

```sql
-- Check all regression test runs
SELECT * FROM regression_test_runs ORDER BY run_started_at DESC LIMIT 10;

-- Get latest test run for a job
SELECT * FROM regression_test_runs 
WHERE job_id = 21 
ORDER BY run_started_at DESC 
LIMIT 1;

-- Analyze a test run
SELECT * FROM analyze_regression_test_run(run_id);

-- Compare two test results
SELECT * FROM compare_regression_test_results_detailed(
  baseline_test_id, 
  current_test_id
);
```

### Dashboard URLs
- Cron Dashboard: `https://alan-chat-proxy.vercel.app/cron-dashboard.html`
- Supabase Dashboard: Check your Supabase project dashboard

### Scripts
- Baseline tests: `testing-scripts/cron-regression-tests/run-baseline-regression-tests.cjs`
- Compare results: `testing-scripts/cron-regression-tests/compare-40q-baseline-vs-current.cjs`
- Compare articles: `testing-scripts/cron-regression-tests/compare-40q-articles.cjs`

