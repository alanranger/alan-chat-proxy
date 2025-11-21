# Regression Test Analysis

## What the Regression Test Measures

Based on the database analysis of test result #877 (the current master baseline), the regression test measures:

### ✅ **ACTUAL RESPONSE QUALITY** (Not just superficial counts)

The regression test stores and compares:

1. **Full Response Data**:
   - Complete query text
   - HTTP status code
   - Response type (events, articles, products, etc.)
   - Confidence score (0.0-1.0)
   - Full answer text

2. **Source Data** (Actual content, not just counts):
   - **Events**: Full event objects with title, date, price, location, availability, etc.
   - **Articles**: Full article objects with title, href, content
   - **Products**: Full product objects with title, price, availability
   - **Services**: Full service objects

3. **Structured Data**:
   - Structured JSON representation of all sources
   - Intent classification
   - Entity extraction

4. **Quality Metrics**:
   - Success/failure status
   - Confidence scores
   - Number of sources found
   - Answer quality (length, completeness)

### Example from Test #877

**Query**: "whens the next bluebell workshops and whats the cost"

**Response**:
- Status: 200 (success)
- Type: "events"
- Confidence: 0.96 (96%)
- Found: 12 events
- Each event includes: title, date, price (£99), location, availability, equipment needed, experience level, etc.

### What Gets Compared

When comparing baseline vs current test:
- **Article Changes**: Which specific articles changed (not just count)
- **Severe Changes**: Significant quality degradations
- **Confidence Differences**: Changes in confidence scores
- **Success Rate**: Percentage of successful responses
- **Answer Quality**: Degradations in answer quality

## Current Master Baseline

- **Test ID**: #877
- **Date**: 21/11/2025 at 11:40:31
- **Job**: 26 (Website Pages Refresh Batch 0)
- **Status**: 40/40 successful (100%)
- **Average Confidence**: 80.9%
- **Total Questions**: 40

## Running a New Test

To verify the current baseline or run a new test:

```bash
# Set environment variables
export NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
export API_ENDPOINT="http://localhost:3000/api/chat"  # or your production URL

# Run the test
node testing-scripts/run-40q-test.js
```

The script will:
1. Run all 40 questions from `testing-scripts/interactive-testing-data.json`
2. Display results for each question
3. Show response quality metrics
4. Generate a detailed JSON report
5. Provide a summary with success rate, average confidence, and source counts

## Verifying Test #877

To verify if test #877 is the correct baseline, you can:

1. **Check the test date**: 21/11/2025 at 11:40:31 - was this when you last verified the responses were good?

2. **Run a new test** and compare:
   ```bash
   node testing-scripts/run-40q-test.js
   ```
   Then compare the results with test #877 to see if there are any regressions.

3. **View test details** in the database:
   ```sql
   SELECT 
     id,
     test_timestamp,
     successful_tests,
     failed_tests,
     avg_confidence,
     results->0 as first_result_sample
   FROM regression_test_results
   WHERE id = 877;
   ```

## Recommendation

**Run a new test now** to verify current response quality, then:
- If responses are good, set the new test as the master baseline
- If responses show regressions, investigate and fix before setting a new baseline

