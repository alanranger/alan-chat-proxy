# Cron Regression Tests

This folder contains all regression testing scripts and tools related to cron job monitoring and validation.

## Purpose

These scripts ensure that risky cron jobs (those that modify database content, chunks, embeddings, or product data) don't cause regressions in chat quality and results.

## Files

### `run-baseline-regression-tests.cjs`
**Purpose:** Establishes baseline regression test results for all risky cron jobs.

**Usage:**
```bash
node run-baseline-regression-tests.cjs
```

**What it does:**
- Runs 40-question regression tests for all risky jobs (21, 26-28, 31)
- Stores baseline results in the database
- These baselines are used for comparison when jobs actually execute

**When to run:**
- Before deploying changes to risky jobs
- After major content/ingestion changes
- Periodically to refresh baselines

---

### `compare-40q-baseline-vs-current.cjs`
**Purpose:** Compares baseline test results against current test results.

**Usage:**
```bash
node compare-40q-baseline-vs-current.cjs
```

**What it does:**
- Compares 40Q deployed test results against a baseline
- Focuses on overall stats, equipment, and landscape queries
- Identifies regressions and improvements

---

### `compare-40q-articles.cjs`
**Purpose:** Compares articles returned by the bot between baseline and current test runs.

**Usage:**
```bash
node compare-40q-articles.cjs
```

**What it does:**
- Analyzes which articles (by ID) were returned for each query
- Identifies articles that were added/removed compared to baseline
- Helps detect content quality changes

---

## Risky Jobs That Use Regression Testing

1. **Job 21**: `refresh-product-pricing-hourly`
   - Changes product data that affects product-related queries
   - Frequency: Every 8 hours

2. **Jobs 26, 27, 28**: `light_refresh_batch0/1/2`
   - Changes content, chunks, embeddings that affect all queries
   - Frequency: Every 4 hours (staggered)

3. **Job 31**: `cleanup-orphaned-records`
   - Deletes chunks/entities that might be needed for queries
   - Frequency: Weekly (Sunday 3 AM)

---

## Regression Test Framework

The regression testing framework automatically:
1. Runs baseline 40Q test before job execution
2. Executes the risky cron job
3. Runs after 40Q test
4. Compares results and detects regressions
5. Flags severity (severe/moderate/minor)
6. Displays results in the cron dashboard

See `Architecture and Handover MDs/REGRESSION_TEST_THRESHOLDS.md` for detailed thresholds and actions.

---

## Workflow

1. **Establish Baseline:**
   ```bash
   node run-baseline-regression-tests.cjs
   ```

2. **Monitor Dashboard:**
   - Check `cron-dashboard.html` for regression test summaries
   - Review any detected regressions

3. **Compare Results:**
   ```bash
   node compare-40q-baseline-vs-current.cjs
   node compare-40q-articles.cjs
   ```

4. **Take Action:**
   - Review regression severity
   - Decide on rollback if needed
   - Investigate root cause

---

## Related Documentation

- `Architecture and Handover MDs/REGRESSION_TESTING_FRAMEWORK.md` - Framework overview
- `Architecture and Handover MDs/REGRESSION_TEST_THRESHOLDS.md` - Thresholds and actions
- `public/cron-dashboard.html` - Dashboard for monitoring

---

## Notes

- Baseline tests should be run when the system is in a known good state
- Regression tests use the same 40 questions as `interactive-testing-data.json`
- Results are stored in `regression_test_runs` and `regression_test_results` database tables
- The dashboard automatically displays regression summaries for risky jobs

