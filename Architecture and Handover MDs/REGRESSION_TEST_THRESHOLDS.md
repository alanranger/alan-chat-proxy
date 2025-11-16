# Regression Test Thresholds and Actions

## Overview

The regression testing framework automatically runs 40-question tests before and after risky cron jobs execute. This document explains the thresholds for detecting regressions and what actions are taken.

## Regression Detection Thresholds

### Severe Regression 🔴
**Triggers:**
- **>10% drop in success rate** (e.g., from 90% to <80%)
- **>0.15 drop in average confidence** (e.g., from 0.85 to <0.70)
- **>5 queries with severe article changes** (3+ articles changed per query)
- **Multiple queries with >200 character answer degradation**

**Example:**
- Baseline: 38/40 questions passed (95% success rate)
- After: 32/40 questions passed (80% success rate)
- **Result:** Severe regression detected (15% drop)

**Action:** **ROLLBACK RECOMMENDED** - The job's changes likely caused significant degradation in chat quality.

---

### Moderate Regression 🟡
**Triggers:**
- **5-10% drop in success rate** (e.g., from 90% to 80-85%)
- **0.10-0.15 drop in average confidence** (e.g., from 0.85 to 0.70-0.75)
- **3-5 queries with severe article changes** (3+ articles changed)
- **>10 total queries with article changes**

**Example:**
- Baseline: 38/40 questions passed (95% success rate)
- After: 35/40 questions passed (87.5% success rate)
- **Result:** Moderate regression detected (7.5% drop)

**Action:** **ROLLBACK RECOMMENDED** - The job's changes caused noticeable degradation. Review the specific queries affected before deciding.

---

### Minor Regression 🟠
**Triggers:**
- **2-5% drop in success rate** (e.g., from 90% to 85-88%)
- **0.05-0.10 drop in average confidence** (e.g., from 0.85 to 0.75-0.80)
- **>5 queries with article changes** (any number of articles changed)

**Example:**
- Baseline: 38/40 questions passed (95% success rate)
- After: 37/40 questions passed (92.5% success rate)
- **Result:** Minor regression detected (2.5% drop)

**Action:** **Review recommended** - The job's changes caused slight degradation. Review the affected queries to determine if the changes are acceptable.

---

### No Regression ✅
**Triggers:**
- Success rate drop <2%
- Confidence drop <0.05
- <5 queries with article changes
- No significant answer quality degradation

**Action:** **No action needed** - The job completed successfully without impacting chat quality.

---

## What Gets Analyzed

### 1. Success Rate
- Percentage of questions that passed (got valid answers)
- Baseline vs. current comparison
- Threshold: >2% drop triggers minor, >5% moderate, >10% severe

### 2. Average Confidence
- Average confidence score across all responses
- Baseline vs. current comparison
- Threshold: >0.05 drop triggers minor, >0.10 moderate, >0.15 severe

### 3. Article Changes
- Which articles (by ID) were returned for each query
- Articles added/removed compared to baseline
- Severe change: 3+ articles changed in a single query
- Threshold: >5 queries with changes triggers minor, >10 moderate, >5 severe changes triggers severe

### 4. Answer Quality
- Answer length (character count)
- Answer degradation: >50 chars shorter triggers minor, >100 moderate, >200 severe
- Confidence per answer
- Keyword coverage

### 5. Query-Specific Regressions
- Individual query analysis
- Equipment queries (tripod, camera, etc.) are tracked separately
- Each query gets a severity rating (severe/moderate/minor)

---

## Actions Taken

### Automatic Actions
1. **Test Execution**: Baseline test runs before job, after test runs after job
2. **Analysis**: Results are automatically compared using `compare_regression_test_results_detailed()`
3. **Logging**: All results stored in `regression_test_runs` and `regression_test_results` tables
4. **Warning**: If regression detected, a WARNING is logged in the cron job logs

### Manual Actions Required

#### For Severe Regressions:
1. **Review Dashboard**: Check the cron dashboard for regression test summary
2. **Review Details**: Query `regression_test_runs` table for detailed analysis
3. **Decide on Rollback**: 
   - If rollback needed: Manually undo the job's changes
   - For Job 21: Restore previous materialized view state
   - For Jobs 26-28: Revert to previous content/chunks
   - For Job 31: Restore deleted orphaned records (if possible)
4. **Investigate**: Review which queries were affected and why

#### For Moderate Regressions:
1. **Review Dashboard**: Check regression test summary
2. **Review Affected Queries**: Look at specific queries that regressed
3. **Decide**: Determine if the regression is acceptable or if rollback is needed
4. **Monitor**: Watch for patterns if this happens repeatedly

#### For Minor Regressions:
1. **Review Dashboard**: Check regression test summary
2. **Monitor**: Keep an eye on future runs to see if it's a pattern
3. **Document**: Note any acceptable trade-offs

---

## Risky Jobs That Use Regression Testing

1. **Job 21**: `refresh-product-pricing-hourly`
   - **Risk**: Changes product data that affects product-related queries
   - **Frequency**: Every 8 hours
   - **Rollback**: Restore previous materialized view

2. **Jobs 26, 27, 28**: `light_refresh_batch0/1/2`
   - **Risk**: Changes content, chunks, embeddings that affect all queries
   - **Frequency**: Every 4 hours (staggered)
   - **Rollback**: Revert to previous content/chunks/embeddings

3. **Job 31**: `cleanup-orphaned-records`
   - **Risk**: Deletes chunks/entities that might be needed for queries
   - **Frequency**: Weekly (Sunday 3 AM)
   - **Rollback**: Restore deleted records (if possible)

---

## Testing Baseline

Before risky jobs run, you should establish a baseline by running:

```bash
node testing-scripts/run-baseline-regression-tests.cjs
```

This runs baseline tests for all risky jobs and stores them in the database. These baselines will be used for comparison when the jobs actually execute.

---

## Monitoring

### Dashboard
The cron dashboard (`cron-dashboard.html`) shows:
- Regression test status for each risky job
- Before/after success rates
- Before/after confidence scores
- Article change counts
- Regression severity and recommended action

### Database Tables
- `regression_test_runs`: Test run metadata
- `regression_test_results`: Detailed test results (40 questions)
- Query `regression_test_runs` to see all test runs and their status

### SQL Functions
- `analyze_regression_test_run(run_id)`: Analyzes a specific test run
- `compare_regression_test_results_detailed(baseline_id, current_id)`: Detailed comparison
- `get_latest_regression_test_run(job_id)`: Get latest test run for a job

---

## Best Practices

1. **Run Baseline Tests**: Establish baselines before making changes
2. **Monitor Dashboard**: Check regression test results regularly
3. **Review Severe/Moderate Regressions**: Always investigate these
4. **Document Acceptable Trade-offs**: If you accept a minor regression, document why
5. **Rollback When Needed**: Don't hesitate to rollback severe regressions
6. **Test After Changes**: If you modify risky jobs, test them manually first

---

## Example Workflow

1. **Before Job Runs**: Baseline test automatically executes
2. **Job Executes**: Normal job execution
3. **After Job Runs**: After test automatically executes
4. **Analysis**: Results compared automatically
5. **Dashboard Updates**: Regression summary appears in dashboard
6. **If Regression Detected**: 
   - Check dashboard for details
   - Review affected queries
   - Decide on rollback
   - Investigate root cause

---

## Questions?

If you see a regression and aren't sure what to do:
1. Check the dashboard for the regression test summary
2. Review the detailed analysis in the database
3. Look at which specific queries were affected
4. Consider the severity and impact
5. Make an informed decision about rollback

