# TESTING_MASTER_PLAN.md

> Consolidated from: COMPREHENSIVE_TESTING_PLAN.md, BASELINE_REGRESSION_SUITE.md, REFACTOR_TESTING_PROTOCOL.md, TESTING_FRAMEWORK.md, CORE_TASKS_TEST_CHECKLIST.md

## 1. Purpose & Scope
Single source of truth for end-to-end testing of the alan-chat-proxy system.

## 2. Test Categories
- Unit
- Integration (RAG + scoring + extraction)
- End-to-end (API → UI)
- Regression (baseline suite)

## 3. Baseline Regression Suite (Legacy)
*(migrated summary from BASELINE_REGRESSION_SUITE.md)*

## 4. Test Data & Fixtures
- Location: `/testing-scripts/`
- Outputs: `/testing-scripts/test results/`

## 5. Protocols
- Refactor testing protocol (merged)
- Debug protocol cross-reference

## 6. CI/Local Commands
- `node testing-scripts/comprehensive-test.js`
- `npm run test:baseline`

## 7. Checklists
*(merged from CORE_TASKS_TEST_CHECKLIST.md)*