# Fixed Baseline System for 40Q Regression Tests

## Overview

The 40Q regression test uses a **fixed baseline** (`baseline-40q-fixed.json`) that represents a known good state of the system. This prevents regressions from creeping in over time by always comparing against a stable reference point.

## Why Fixed Baseline?

**Problem with rolling baseline:**
- If each test uses the previous test as baseline, regressions can accumulate
- A 5% degradation each test would go unnoticed
- After 10 tests, you'd have 50% degradation but no alerts

**Solution: Fixed baseline**
- Always compares against a known good state
- Catches regressions immediately, even if they're small
- Only updates when you explicitly verify the system is good

## Files

- **`baseline-40q-fixed.json`** - The fixed baseline file (in `test results/`)
- **`compare-40q-baseline-vs-current.cjs`** - Comparison script (uses fixed baseline by default)
- **`update-baseline-40q.cjs`** - Script to update the baseline (use with caution!)

## Usage

### Running Regression Test

```bash
# Run the 40Q test (generates new test result)
node testing-scripts/test-40q-deployed.cjs

# Compare against fixed baseline (automatic)
node testing-scripts/cron-regression-tests/compare-40q-baseline-vs-current.cjs
```

The comparison script automatically:
- Uses `baseline-40q-fixed.json` as baseline
- Uses the most recent `deployed-analytics-test-*.json` as current
- Validates response types, entity counts, and product categorization

### Updating the Baseline

**⚠️ ONLY update the baseline when:**
1. All regressions have been fixed
2. System is verified to be in a good state
3. You've run the test and confirmed it passes all quality checks

**To update the baseline:**

```bash
# Option 1: Use most recent test result
node testing-scripts/cron-regression-tests/update-baseline-40q.cjs

# Option 2: Use a specific test result file
node testing-scripts/cron-regression-tests/update-baseline-40q.cjs deployed-analytics-test-2025-11-20T17-50-03-253Z.json
```

The update script will:
- Show summary of the test result
- Backup the existing baseline
- Copy the new test result to `baseline-40q-fixed.json`
- Add metadata about when it was established

## What Gets Validated

The comparison script checks:

1. **Response Types** - Ensures correct type (events vs advice)
2. **Entity Counts** - Articles, Products, Events, Services
3. **Product Categorization** - Products must be in `structured.products`, not `structured.articles`
4. **Quality Metrics** - Flags significant drops in entity counts (>50% reduction)
5. **Category Analysis** - Validates performance by query category

## Exit Codes

- **Exit 0** - No regressions detected
- **Exit 1** - Regressions found (for automation/CI)

## Current Baseline

- **File:** `baseline-40q-fixed.json`
- **Established:** 2025-11-15 (Nov 15 test result)
- **Status:** Known good state before product categorization fix

## When to Update Baseline

Update the baseline when:
- ✅ You've fixed all regressions
- ✅ System is verified working correctly
- ✅ All 40Q tests pass with good quality metrics
- ✅ Product categorization is working (products in `structured.products`)
- ✅ Response types are correct
- ✅ Entity counts are reasonable

**DO NOT update the baseline:**
- ❌ Just because a test passed (might have regressions)
- ❌ After making changes (wait to verify they work)
- ❌ If there are any warnings or issues

## Best Practices

1. **Run tests before updating baseline** - Always verify the system is good
2. **Review comparison results** - Don't just look at pass/fail
3. **Check for product categorization issues** - This is a common regression
4. **Document why you're updating** - Add a note about what was fixed
5. **Keep baseline in git** - So it's tracked and shared

