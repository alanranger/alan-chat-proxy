# TESTING_MASTER_PLAN.md

> Consolidated from: COMPREHENSIVE_TESTING_PLAN.md, BASELINE_REGRESSION_SUITE.md, REFACTOR_TESTING_PROTOCOL.md, TESTING_FRAMEWORK.md, CORE_TASKS_TEST_CHECKLIST.md
> 
> _Last updated: 1 Nov 2025_

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
- Analysis: `analyze-40q-results.cjs` (automatic regression detection)
- Comparison: `make-40q-side-by-side-oct28.cjs` (generates CSV comparisons)

## 5. Baseline Regression Suite
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
- **40Q Test**: `node testing-scripts/test-40q-only.cjs`
- **Comprehensive Test**: `node testing-scripts/comprehensive-test.js`
- **Baseline Test**: `npm run test:baseline` (if configured)
- **Side-by-Side**: `node testing-scripts/make-40q-side-by-side-oct28.cjs`

## 8. Testing Workflow
1. Make code changes to `api/chat.js`
2. Run 40Q test: `node testing-scripts/test-40q-only.cjs`
3. Review automatic analysis output
4. Generate side-by-side comparison if needed
5. Update baseline if quality improvements achieved

## 9. Checklists
*(merged from CORE_TASKS_TEST_CHECKLIST.md)*