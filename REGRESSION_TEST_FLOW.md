# Regression Test Flow - Master Baseline System

## Overview

All jobs now use a **single master baseline** for regression testing. Jobs skip the "before" test and compare the "after" test directly against the master baseline.

## Current Master Baseline

- **Test ID**: #878
- **Date**: 21/11/2025 at 12:35:45 UTC
- **Success Rate**: 100% (40/40)
- **Average Confidence**: 80.9%

## Job Execution Flow

### For All Jobs (21, 26, 31, 27, 28):

1. **Execute the Job**
   - Run the actual job logic (refresh products, cleanup records, refresh batches, etc.)

2. **Run "After" Regression Test**
   - Execute 40-question regression test after the job completes
   - Test phase: `'after'`

3. **Compare Against Master Baseline**
   - `analyze_regression_test_run()` automatically:
     - Gets the master baseline (test #878)
     - Compares the "after" test against the master baseline
     - Detects regressions with severity (severe/moderate/minor)
     - Tracks specific changes (articles, answers, confidence)

## Comprehensive Comparison

The `compare_regression_test_results_detailed()` function performs:

### ✅ Success Rate Comparison
- Baseline vs current success rate
- Detects drops in success rate

### ✅ Confidence Score Comparison
- Average confidence comparison
- Per-query confidence comparison
- Detects confidence degradation

### ✅ Article Changes (Actual Content, Not Just Counts)
- Tracks which specific articles were added/removed
- Identifies article ID changes
- Counts severe changes (3+ articles changed)

### ✅ Answer Quality Analysis
- Answer length comparison
- Answer completeness
- Detects answer degradation (>100 chars shorter = moderate, >200 = severe)

### ✅ Query-Specific Regressions
- Identifies which queries regressed
- Assigns severity per query
- Tracks article changes per query

### ✅ Source Data Comparison
- Events: Full comparison of event data (title, date, price, location, etc.)
- Products: Full product details comparison
- Articles: Full article content comparison

## Benefits

1. **Faster Execution**: No redundant "before" test (saves ~50 seconds per job)
2. **Consistent Comparison**: All jobs compare against the same master baseline
3. **Prevents Regression Creep**: Master baseline never changes, so regressions are always detected
4. **Comprehensive Analysis**: Tracks actual content changes, not just superficial counts

## Setting a New Master Baseline

To set a new master baseline:

1. Run a regression test manually or via a job
2. Review the results to ensure quality
3. Use the dashboard "Set as Master Baseline" button, or
4. Call `set_fixed_baseline(test_result_id, job_id)` SQL function

**Note**: Setting a new master baseline will automatically unset the old one (only one master baseline exists).

## Verification

All jobs are configured to:
- ✅ Skip "before" test
- ✅ Use master baseline for comparison
- ✅ Run comprehensive regression analysis
- ✅ Clean up old test results (keep master + latest)

