# TESTING_MASTER_PLAN.md

> Consolidated from: COMPREHENSIVE_TESTING_PLAN.md, BASELINE_REGRESSION_SUITE.md, REFACTOR_TESTING_PROTOCOL.md, TESTING_FRAMEWORK.md, CORE_TASKS_TEST_CHECKLIST.md
> 
> _Last updated: 15 Nov 2025_

## 1. Purpose & Scope
Single source of truth for end-to-end testing of the alan-chat-proxy system.

## 2. Current Baseline (1 Nov 2025)
- **Baseline File**: `baseline-40-question-interactive-subset-2025-11-01T13-32-45-780Z.json`
- **Test Success Rate**: 100% (40/40 questions return 200 status)
- **Quality Pass Rate**: 92.5% (3 routing issues, 5 expected generic fallbacks)
- **Key Fixes**: Q36 (subscribe to free course) ✅, Q27 (exposure triangle) ✅
- **Remaining Issues**: Q17, Q20 (course logistics routing to services instead of events)

## 3. Test Categories
- Unit
- Integration (RAG + scoring + extraction)
- End-to-end (API → UI)
- Regression (40Q baseline suite)

## 4. Test Data & Fixtures
- Location: `/testing-scripts/`
- Outputs: `/testing-scripts/test results/`
- Primary Test: `test-40q-only.cjs` (runs 40-question subset)
- **Deployed Regression Test**: `test-40q-deployed.cjs` (runs 40 questions against deployed API)
- **Comparison Script**: `compare-40q-baseline-vs-current.cjs` (compares baseline vs current results)
- Analysis: `analyze-40q-results.cjs` (automatic regression detection)
- Comparison: `make-40q-side-by-side-oct28.cjs` (generates CSV comparisons)

## 5. Baseline Regression Suite

### 5.1 40Q Deployed Regression Test (PRIMARY)
**Script**: `testing-scripts/test-40q-deployed.cjs`  
**Purpose**: Run 40 questions against deployed API to capture full response data for regression analysis  
**Baseline**: `deployed-analytics-test-2025-11-10T22-57-04-965Z.json` (Nov 10, 2025)  
**Comparison Script**: `testing-scripts/compare-40q-baseline-vs-current.cjs`

**Usage**:
```bash
# Run test against deployed API
node testing-scripts/test-40q-deployed.cjs

# Compare results with baseline
node testing-scripts/compare-40q-baseline-vs-current.cjs
```

**What it captures**:
- Full API responses (answer, confidence, type, structured data)
- Article counts and titles
- Event/service/product counts
- Success rate and average confidence
- Timestamp for each query

**When to use**:
- After deploying code changes to production
- Before/after major feature changes
- To verify fixes haven't introduced regressions
- To compare article filtering/scoring changes

**Output**: Saves to `testing-scripts/test results/deployed-analytics-test-{timestamp}.json`

### 5.2 40-Question Interactive Subset
- **40-Question Interactive Subset**: Comprehensive test covering all business categories
- **Automatic Analysis**: Detects wrong routing, generic fallbacks, regressions
- **Side-by-Side Comparison**: CSV output comparing current vs baseline
- **Detailed Analysis Reports**: Markdown documents with question-by-question breakdown

## 6. Protocols
- Refactor testing protocol (merged)
- Debug protocol cross-reference
- Regression testing: Always run 40Q test after code changes
- Analysis: Automatic analysis runs after each test completion

## 7. CI/Local Commands
- **40Q Local Test**: `node testing-scripts/test-40q-only.cjs` (localhost)
- **40Q Deployed Test**: `node testing-scripts/test-40q-deployed.cjs` (production API) ⭐ **PRIMARY REGRESSION TEST**
- **40Q Comparison**: `node testing-scripts/compare-40q-baseline-vs-current.cjs` (compare baseline vs current)
- **Comprehensive Test**: `node testing-scripts/comprehensive-test.js`
- **Baseline Test**: `npm run test:baseline` (if configured)
- **Side-by-Side**: `node testing-scripts/make-40q-side-by-side-oct28.cjs`

## 8. Testing Workflow

### 8.1 Local Development Workflow
1. Make code changes to `api/chat.js`
2. Run 40Q local test: `node testing-scripts/test-40q-only.cjs`
3. Review automatic analysis output
4. Generate side-by-side comparison if needed
5. Update baseline if quality improvements achieved

### 8.2 Production Regression Testing Workflow ⭐ **USE THIS FOR REGRESSION TESTS**
1. Deploy code changes to production
2. Run deployed regression test: `node testing-scripts/test-40q-deployed.cjs`
3. Compare with baseline: `node testing-scripts/compare-40q-baseline-vs-current.cjs`
4. Review comparison output:
   - Check overall stats (success rate, confidence)
   - Review equipment queries (tripod, camera, memory card, lenses)
   - Verify landscape queries still work
   - Check for article count changes
5. If regressions found, investigate and fix
6. If improvements confirmed, update baseline reference in comparison script

## 9. Checklists
*(merged from CORE_TASKS_TEST_CHECKLIST.md)*