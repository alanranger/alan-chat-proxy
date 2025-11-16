# Regression Testing Framework for Cron Jobs

## Overview

This framework automatically runs 40Q regression tests before and after risky cron jobs to detect any degradation in chat quality. It captures detailed information beyond just pass/fail, analyzing articles returned, answer quality, confidence scores, and content relevance.

## What Gets Tested

The framework uses the **same 40 questions** from `interactive-testing-data.json` that are used in `interactive-testing.html`. For each question, it captures:

### Detailed Response Data
- **Answer text** - Full answer content
- **Confidence score** - AI confidence in the response
- **Response type** - events, advice, service, etc.
- **Articles** - All articles returned with:
  - Article ID
  - Title
  - URL
  - Page URL
- **Events** - Event data if applicable
- **Services** - Service tiles if applicable
- **Structured data** - Complete structured response

### Analysis Performed

1. **Article Comparison**
   - Which articles were added/removed
   - Article count changes
   - Article ID matching to detect exact changes

2. **Answer Quality Analysis**
   - Answer length changes
   - Confidence score changes
   - Keyword coverage
   - Response type appropriateness

3. **Query-Specific Regressions**
   - Individual query analysis
   - Severity per query (severe/moderate/minor)
   - Equipment query focus (tripod, camera, etc.)

## Regression Detection Criteria

### Severe Regression
- >10% drop in success rate OR
- >0.15 drop in average confidence OR
- >5 queries with severe article changes (3+ articles changed) OR
- Multiple queries with >200 character answer degradation

### Moderate Regression
- 5-10% drop in success rate OR
- 0.10-0.15 drop in average confidence OR
- 3-5 queries with severe article changes OR
- >10 total queries with article changes

### Minor Regression
- 2-5% drop in success rate OR
- 0.05-0.10 drop in average confidence OR
- >5 queries with article changes

## Risky Jobs That Use This

Jobs that modify content, chunks, embeddings, or product data:

1. **Job 21**: Refresh product pricing (changes product data)
2. **Jobs 26, 27, 28**: Website pages refresh (changes content/chunks/embeddings)
3. **Job 31**: Cleanup orphaned records (could remove needed chunks)

## How It Works

### 1. Before Job Execution
- Runs 40Q test via Edge Function
- Stores baseline results in `regression_test_results` table
- Captures all articles, answers, confidence scores

### 2. Job Execution
- Executes the risky cron job normally

### 3. After Job Execution
- Runs 40Q test again
- Stores current results
- Compares baseline vs current using `compare_regression_test_results_detailed()`

### 4. Regression Analysis
- Detects article changes (added/removed articles per query)
- Analyzes answer quality degradation
- Calculates overall regression severity
- Flags queries with specific regressions

### 5. Rollback Decision
- **Severe or Moderate regressions** → Flag for rollback
- **Minor regressions** → Log but continue
- Rollback capability can be implemented per job type

## Database Tables

### `regression_test_results`
Stores individual test run results:
- Job ID and name
- Test phase (before/after)
- Success/failure counts
- Average confidence
- Full JSONB results with all response data

### `regression_test_runs`
Tracks complete test cycles:
- Links baseline and after test IDs
- Regression detection status
- Severity level
- Rollback status

## API Endpoints

### `POST /api/admin?action=run_regression_test`
Triggers a 40Q test run:
```json
{
  "job_id": 21,
  "job_name": "refresh-product-pricing-hourly",
  "test_phase": "before" // or "after"
}
```

Returns:
```json
{
  "ok": true,
  "test_result_id": 123,
  "successful_tests": 40,
  "failed_tests": 0,
  "avg_confidence": 0.85,
  "total_questions": 40,
  "duration": "45.2s"
}
```

### `POST /api/admin?action=compare_regression_tests`
Compares baseline vs current:
```json
{
  "baseline_test_id": 123,
  "current_test_id": 124
}
```

Returns detailed comparison with article changes, answer quality changes, and query-specific regressions.

## SQL Functions

### `compare_regression_test_results_detailed(baseline_id, current_id)`
Performs comprehensive comparison:
- Article ID matching
- Answer quality analysis
- Query-specific regression detection
- Returns detailed JSONB with all changes

### `analyze_regression_test_run(test_run_id)`
Analyzes a complete test cycle:
- Uses detailed comparison
- Determines if rollback needed
- Returns comprehensive analysis JSONB

## Edge Function

### `run-40q-regression-test`
Runs all 40 questions against the deployed chat API:
- Uses same questions as interactive testing
- Captures full response structure
- Stores results in database
- Returns test statistics

## Integration with Cron Jobs

To add regression testing to a risky job:

1. **Before job**: Call API to run baseline test
2. **Execute job**: Run the actual job
3. **After job**: Call API to run after test
4. **Compare**: Use SQL function to analyze results
5. **Flag**: If regression detected, flag for review/rollback

## Example Workflow

```sql
-- 1. Create test run record
INSERT INTO regression_test_runs (job_id, job_name) VALUES (21, 'refresh-product-pricing');

-- 2. Run baseline test (via API call)
-- POST /api/admin?action=run_regression_test
-- { "job_id": 21, "test_phase": "before" }

-- 3. Execute the job
SELECT refresh_v_products_unified();

-- 4. Run after test (via API call)
-- POST /api/admin?action=run_regression_test
-- { "job_id": 21, "test_phase": "after" }

-- 5. Analyze results
SELECT * FROM analyze_regression_test_run(test_run_id);
```

## Next Steps

1. **Implement cron job wrappers** that automatically run tests before/after
2. **Add rollback mechanisms** for specific job types
3. **Create dashboard view** to monitor regression test results
4. **Set up alerts** for severe regressions

## Notes

- Tests run against the **deployed API** (alan-chat-proxy.vercel.app)
- Full response data is stored for detailed analysis
- Article changes are tracked by ID for precise comparison
- Answer quality metrics go beyond simple pass/fail

