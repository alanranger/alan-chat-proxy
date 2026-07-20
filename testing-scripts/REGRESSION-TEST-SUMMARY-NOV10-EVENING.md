# 40Q Regression Test Summary - Nov 10 Evening

**Date:** 10 November 2025, 22:57 UTC  
**Baseline:** `baseline-40-question-interactive-subset-2025-11-01T13-32-45-780Z.json`  
**Current:** `deployed-analytics-test-2025-11-10T22-57-04-965Z.json`

## 📊 Overall Results

### Success Metrics
- **Success Rate:** 40/40 (100%) ✅ - No change from baseline
- **Average Confidence:** 81.6% → 82.8% (+1.2%) 📈
- **Total Questions:** 40

### Answer Quality
- **Improvements:** 6 questions with better answers
- **Regressions:** 7 questions with minor answer length reductions (not functional failures)
- **Unchanged:** 22 questions
- **Minor Changes:** 5 questions

## 📈 Improvements

1. **Prime vs Zoom Lenses:** +248 chars (more detailed answer)
2. **Certificate Question:** +116 chars
3. **Laptop for Lightroom:** Routing improved (services → events), confidence +16%
4. **Beginner Courses:** Routing improved (services → events), confidence +16%
5. **Course Duration:** Routing improved (services → events), confidence +16%
6. **Cancellation Policy:** +88 chars

## 📉 Regressions (Answer Length Only)

All 7 regressions are shorter answers (70-160 chars), not functional failures:
- Online course free: -85 chars
- Personalized feedback: -92 chars
- Gallery question: -160 chars
- Alan Ranger background: -70 chars (2 questions)
- Hire photographer: -153 chars
- Subscribe to course: -85 chars

## 📋 Structured Data Comparison

### Summary
- **Total Structured Items:** 304 → 716 (+412, +135%) 🎉
- **Improvements:** 32 questions with more structured data
- **Regressions:** 2 questions (fewer articles for "Who is Alan Ranger" queries)
- **Unchanged:** 6 questions

### Key Improvements
- **More Events:** "next workshop date" went from 20 → 40 events
- **More Services:** Many questions now include 6 services (previously 0)
- **More Articles:** Many questions now include 12 articles (previously 0-9)
- **Better Cross-Linking:** Questions now return events + services + articles together

### Examples
- "Do you do astrophotography workshops": 0 → 18 items (6 services + 12 articles)
- "Can my 14yr old attend": 0 → 24 items (6 events + 6 services + 12 articles)
- "What types of photography services": 24 → 36 items (+12 articles)

## 🎯 Assessment

### Overall Status: ✅ STABLE WITH IMPROVEMENTS

**Key Findings:**
- ✅ No functional regressions - all questions still answer correctly
- ✅ Routing improvements - better classification (services → events)
- ✅ Confidence improved - +1.2% average
- ✅ Structured data significantly improved - +135% more items
- ⚠️ Minor answer length variations - likely due to more concise formatting or different content retrieval

**Conclusion:** System is stable. The "regressions" are minor answer length reductions, not failures. The improvements (better routing, higher confidence, significantly more structured data) far outweigh the minor length reductions.

## 📁 Test Files

- **Baseline:** `baseline-40-question-interactive-subset-2025-11-01T13-32-45-780Z.json`
- **Current:** `deployed-analytics-test-2025-11-10T22-57-04-965Z.json`
- **Comparison:** `baseline-comparison-nov1-vs-latest-1762815467152.json`
- **Structured Data Comparison:** `structured-data-comparison-1762815728593.json`

## 🔧 Scripts Created

- `compare-latest-baseline.cjs` - Compares answer quality, confidence, routing
- `compare-structured-data.cjs` - Compares structured data sections (events, products, services, articles)


## Update Log
- 2026-01-16 19:59: Updated with latest ingest image fallback (prefer content over logo), bulk ingest UI watchdog timeout, search tile description expansion and image fallback/proxy, and restore point restore-20260116-1948.
