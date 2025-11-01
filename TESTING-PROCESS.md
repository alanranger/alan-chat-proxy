# Testing Process Documentation

## Overview
This document outlines the testing process to ensure code changes don't introduce regressions and that local and deployed environments produce consistent results.

## Key Principles

1. **Always test before deploying** - Verify changes work locally first
2. **Verify consistency** - Local and deployed should produce identical results
3. **Track regressions** - Use baseline comparisons to detect changes
4. **Test specific queries** - Use regression tests for critical queries

## Test Suites

### 1. Full 40Q Test Suite
The primary test suite with 40 representative questions covering all query types.

**Run:**
```bash
node testing-scripts/comprehensive-baseline-test.cjs --only=40
```

**Output:** Creates a JSON file in `testing-scripts/test results/` with timestamp

**Use for:**
- Full regression testing after code changes
- Baseline comparisons
- Detecting unexpected changes across all query types

### 2. Regression Test (Single Query)
Tests a specific query to ensure it works correctly.

**Run:**
```bash
node testing-scripts/test-personalised-feedback-regression.cjs
```

**Current regression tests:**
- `test-personalised-feedback-regression.cjs` - Tests "How do I get personalised feedback on my images"

**Use for:**
- Quick verification of specific fixes
- CI/CD checks before deployment
- Testing individual query patterns

**Creating new regression tests:**
1. Copy `test-personalised-feedback-regression.cjs` as template
2. Update `TEST_QUERY` and `EXPECTED_ANSWER_SNIPPET`
3. Update `EXPECTED_ANSWER_CONTAINS` array
4. Update `wrongContentIndicators` if needed

### 3. Side-by-Side Comparison
Compare current results against a baseline to see what changed.

**Run:**
```bash
node testing-scripts/make-40q-side-by-side-oct28.cjs
```

**Output:** CSV file showing baseline vs current for all 40 questions

**Use for:**
- Analyzing changes between baselines
- Identifying improvements/regressions
- Reporting on test results

## Testing Workflow

### Before Making Code Changes

1. **Run baseline test** to establish current state:
   ```bash
   node testing-scripts/comprehensive-baseline-test.cjs --only=40
   ```
   
2. **Note the baseline filename** for later comparison

### After Making Code Changes

1. **Restart local server** if running:
   - Ensure latest code is loaded
   - Check for any startup errors

2. **Run regression tests** for any queries you specifically fixed:
   ```bash
   node testing-scripts/test-personalised-feedback-regression.cjs
   ```

3. **Run full 40Q test** to check for regressions:
   ```bash
   node testing-scripts/comprehensive-baseline-test.cjs --only=40
   ```

4. **Generate side-by-side comparison** to analyze changes:
   ```bash
   node testing-scripts/make-40q-side-by-side-oct28.cjs
   ```

5. **Review changes:**
   - Check for unintended regressions
   - Verify expected improvements worked
   - Look for new failures

### Before Deploying

1. **Verify local tests pass:**
   - All regression tests pass
   - No unexpected failures in 40Q test
   - Review side-by-side comparison

2. **Test against deployed endpoint** (if available):
   ```bash
   node testing-scripts/test-all-40q-localhost-vs-deployed.cjs
   ```
   
   This ensures local and deployed produce identical results.

3. **Deploy with confidence** - Only deploy when tests pass

### After Deploying

1. **Verify deployed endpoint** works:
   - Test a few key queries manually
   - Run regression tests against deployed URL (if script exists)
   - Monitor for errors

2. **Create new baseline** from deployed results if needed

## Debug Logging

Debug logging is built into the code to trace query routing. Look for these in server console:

- `[DEBUG] handleServiceQueries called` - Service handler invoked
- `[DEBUG] getServiceAnswers: Pattern #X matched` - Pattern matching result
- `[DEBUG] handleServiceQueries: Pattern matched!` - Service pattern matched
- `[DEBUG] No pattern match, trying database lookup` - Pattern didn't match, using DB

**Using debug logs:**
1. Make your code change
2. Restart server
3. Send test query
4. Check server console for `[DEBUG]` messages
5. Trace the execution path to understand routing

## Common Issues and Solutions

### Issue: Local test passes but deployed fails

**Causes:**
- Deployed code not updated
- Different environment variables
- Caching on deployed endpoint
- Code not committed/pushed

**Solution:**
1. Verify deployment succeeded
2. Check git commits match local
3. Clear any caches
4. Compare environment variables

### Issue: Tests hang or timeout

**Causes:**
- Server not running
- Database connection issues
- Network problems

**Solution:**
1. Check server is running on localhost:3000
2. Verify database connection
3. Check network connectivity
4. Restart server

### Issue: Pattern matches in test but not in actual query

**Causes:**
- Server not restarted after code change
- Query preprocessing changing the text
- Pattern order issues (earlier pattern matches first)

**Solution:**
1. Restart server
2. Check debug logs to see actual query text
3. Verify pattern order in SERVICE_PATTERNS array
4. Test pattern matching with actual query text

## Test Result Files

### Baseline JSON Files
Location: `testing-scripts/test results/`

Format: `baseline-40-question-interactive-subset-{timestamp}.json`

Contains: Full test results with responses for all 40 questions

### Side-by-Side CSV Files
Location: `testing-scripts/test results/`

Format: `side-by-side-40q-oct28-baseline-vs-current-{timestamp}.csv`

Contains: Comparison of baseline vs current with status changes

## Creating New Regression Tests

1. **Identify the query** that needs protection
2. **Determine expected answer** format and key content
3. **Create test file:**
   ```bash
   cp testing-scripts/test-personalised-feedback-regression.cjs \
      testing-scripts/test-{query-name}-regression.cjs
   ```
4. **Update the constants:**
   - `TEST_QUERY` - The query to test
   - `EXPECTED_ANSWER_SNIPPET` - Expected start of answer
   - `EXPECTED_ANSWER_CONTAINS` - Required content in answer
   - `wrongContentIndicators` - Content that should NOT appear
5. **Test it:**
   ```bash
   node testing-scripts/test-{query-name}-regression.cjs
   ```
6. **Add to testing workflow** - Run before deploying

## Best Practices

1. **Always restart server** after code changes
2. **Run regression tests** for queries you specifically fix
3. **Run full 40Q test** before deploying
4. **Review side-by-side comparisons** to understand changes
5. **Document new patterns** or routing changes
6. **Add regression tests** for critical queries
7. **Verify deployed matches local** before considering work complete

## Quick Reference

```bash
# Full 40Q test
node testing-scripts/comprehensive-baseline-test.cjs --only=40

# Regression test (personalised feedback)
node testing-scripts/test-personalised-feedback-regression.cjs

# Side-by-side comparison (Oct 28 baseline)
node testing-scripts/make-40q-side-by-side-oct28.cjs

# Compare localhost vs deployed
node testing-scripts/test-all-40q-localhost-vs-deployed.cjs
```

## Notes

- Test results are timestamped to track changes over time
- Keep important baselines (like Oct 28) for long-term comparison
- Debug logging can be verbose - disable in production if needed
- Always verify both local and deployed work before closing an issue

