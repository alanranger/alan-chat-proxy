# Critical Fixes and Testing Strategy
**Date:** 2025-10-31  
**Baseline:** `baseline-40q-2025-10-31-interactive.csv`  
**Current Status:** 8 Pass (20%), 32 Fail (80%)

## Executive Summary

The 40-question interactive testing has revealed critical routing, content retrieval, and answer generation issues affecting 80% of queries. This document outlines the prioritized fixes and validation strategy to restore baseline parity and improve overall quality.

## 🔴 Priority 1: Critical Fixes (Immediate)

### 1.1 Missing Initial Responses
**Impact:** 2 questions (Q23, Q38) return empty/no responses  
**Root Cause:** Technical concept questions not generating answers from article content  
**Fix:**
- Ensure `generateArticleAnswer()` extracts and summarizes key information for "what is" questions
- Add fallback answer generation from article chunks when direct answer unavailable
- Handle edge case: "free online photography course" queries

**Files:**
- `api/chat.js` - `generateArticleAnswer()`, `generateEvidenceBasedAnswer()`
- Test: Q23 ("What is the exposure triangle"), Q38 ("How do I subscribe to free course")

### 1.2 Wrong Routing (12+ Questions)
**Impact:** Equipment, service, and technical queries routed incorrectly  
**Root Cause:** Classification and early routing not catching specific patterns  
**Fix:**
- Add pattern matches for equipment questions (gear, memory card, prime/zoom lenses) in `tryRagFirst()`
- Add pattern match for "personalised feedback" → 1-2-1 service tile
- Fix "long exposure" routing to articles path
- Add professional hire routing with service filtering

**Files:**
- `api/chat.js` - `tryRagFirst()`, `classifyQuery()`
- Test: Q9, Q10, Q11, Q17, Q22, Q25, Q26, Q27, Q28, Q31, Q35, Q36

### 1.3 Article Capping Issue
**Impact:** Equipment/technical questions limited to 6 articles when should show all  
**Root Cause:** Hardcoded cap in `pickArticles()`  
**Fix:**
- Remove or make configurable the 6-article cap for equipment/technical questions
- Allow unlimited articles for equipment recommendation queries
- Keep cap for other query types to maintain UI performance

**Files:**
- `public/chat.html` - `pickArticles()` line 1899: `return result.slice(0,6);`
- Test: Q7 ("What tripod do you recommend") should show ALL related articles

### 1.4 Service/Landing Page Tiles Missing
**Impact:** 7+ questions should show service/landing tiles but don't  
**Root Cause:** Services not retrieved or landing pages not used for person queries  
**Fix:**
- Ensure services returned in structured data for service queries
- Add landing page retrieval for person queries (about-alan, ethics, testimonials)
- Filter services by category (professional vs tuition) for hire queries
- Fix gift voucher service tile display

**Files:**
- `api/chat.js` - `findServices()`, `generateEvidenceBasedAnswer()`
- Test: Q6, Q17, Q19, Q20, Q21, Q27, Q28, Q31, Q34

## 🟡 Priority 2: High-Impact Fixes (Short-term)

### 2.1 Article Selection & Relevance
**Impact:** Wrong articles shown, better articles exist but not matched  
**Root Cause:** Scoring algorithm not prioritizing best matches  
**Fix:**
- Improve `pickArticles()` scoring to better match query keywords
- Enhance keyword extraction for technical concepts
- Ensure fallback searches return relevant content

**Files:**
- `public/chat.html` - `pickArticles()` scoring algorithm
- `api/chat.js` - `findArticles()`, keyword extraction
- Test: Q5, Q10, Q24, Q25, Q26

### 2.2 Course vs Workshop Confusion
**Impact:** Course questions showing workshops instead  
**Root Cause:** Classification not distinguishing courses from workshops  
**Fix:**
- Add explicit course detection in classification
- Retrieve course data separately from workshop events
- Update event routing to handle course-specific queries

**Files:**
- `api/chat.js` - `classifyQuery()`, `handleEventsPipeline()`
- Test: Q15, Q16

### 2.3 Answer Quality - Conversational Responses
**Impact:** Technical questions need conversational answers from content, not raw data  
**Root Cause:** Answer generation not extracting/summarizing from retrieved content  
**Fix:**
- Generate conversational answers from article chunks for technical questions
- Extract key information from content rather than returning raw data
- Improve answer generation for "how to" and "what is" questions

**Files:**
- `api/chat.js` - `generateArticleAnswer()`, `generateRagAnswer()`
- Test: Q7, Q13, Q25, Q26, Q33, Q35, Q40

### 2.4 URLs in Responses (Presentation)
**Impact:** URLs appearing in responses where not needed  
**Root Cause:** Hardcoded answers including URLs  
**Fix:**
- Remove URLs from hardcoded responses
- Present cleaner, more natural responses
- Use tiles/pills for links instead of inline URLs

**Files:**
- `api/chat.js` - Hardcoded answers (Q22, Q23, Q31, etc.)
- Test: Q19, Q27, Q34

## 🟢 Priority 3: Edge Cases & Improvements (Medium-term)

### 3.1 Free Online Photography Course Edge Case
**Impact:** Special routing needed for free course queries  
**Root Cause:** Free course is landing page, not event  
**Fix:**
- Add special routing/display logic for "free online photography course" queries
- Show as event-style tile despite being landing page
- Handle subscribe/access queries for free course

**Files:**
- `api/chat.js` - Special case routing in `tryRagFirst()`
- Test: Q12, Q14, Q36, Q38

### 3.2 Event Selection Criteria
**Impact:** Unclear why specific events selected for duration/logistics queries  
**Root Cause:** Event filtering/scoring not transparent  
**Fix:**
- Improve event selection criteria/logging
- Ensure all relevant events shown (e.g., missing 2026 Batsford workshops)
- Clarify event deduplication logic

**Files:**
- `api/chat.js` - `findEvents()`, event scoring
- Test: Q4, Q18

## Testing & Validation Strategy

### Phase 1: P1 Fixes Validation (Week 1)
**Goal:** Fix critical routing and missing responses

1. **Unit Testing:**
   - Test each routing pattern match individually
   - Verify article cap removal for equipment questions
   - Validate service tile retrieval

2. **Regression Testing:**
   - Re-run 40Q interactive test
   - Compare against baseline-40q-2025-10-31-interactive.csv
   - Target: 20+ Pass (50% improvement)

3. **Focused Testing:**
   - Q7: Verify all tripod articles shown (no cap)
   - Q23: Verify exposure triangle generates answer
   - Q17: Verify 1-2-1 service tile shows
   - Q19: Verify gift voucher service tile shows

**Validation Criteria:**
- ✅ No empty responses
- ✅ All P1 routing fixes working
- ✅ Service tiles displaying correctly
- ✅ Article cap removed for equipment queries

### Phase 2: P2 Fixes Validation (Week 2)
**Goal:** Improve answer quality and content relevance

1. **Article Relevance Testing:**
   - Manually verify top 3 articles for each technical question
   - Compare against expected best matches
   - Adjust scoring algorithm based on results

2. **Answer Quality Testing:**
   - Verify conversational answers generated from content
   - Check technical questions have proper summaries
   - Ensure "how to" questions answered conversationally

3. **Course/Workshop Distinction:**
   - Verify course queries show courses, not workshops
   - Test course-specific queries (duration, requirements)

**Validation Criteria:**
- ✅ Article relevance improved (manual review)
- ✅ Answer quality improved (conversational style)
- ✅ Course vs workshop distinction working

### Phase 3: P3 Fixes & Full Regression (Week 3)
**Goal:** Handle edge cases and validate full 40Q suite

1. **Edge Case Testing:**
   - Free online photography course queries
   - Event selection for duration/logistics
   - Landing page queries for person queries

2. **Full 40Q Regression:**
   - Complete interactive testing suite
   - Compare against baseline
   - Target: 30+ Pass (75% improvement from baseline)

3. **430Q Validation (After 40Q Parity):**
   - Run full comprehensive test suite
   - Verify no regressions introduced
   - Identify any new issues

**Validation Criteria:**
- ✅ Edge cases handled correctly
- ✅ 40Q Pass rate ≥ 75%
- ✅ No regressions in previously passing questions

## Success Metrics

| Phase | Metric | Target | Baseline |
|-------|--------|--------|----------|
| Phase 1 | 40Q Pass Rate | ≥50% | 20% |
| Phase 2 | Article Relevance | ≥80% correct | ~40% |
| Phase 2 | Answer Quality | Conversational style | Mixed |
| Phase 3 | 40Q Pass Rate | ≥75% | 20% |
| Phase 3 | 430Q Pass Rate | Maintain current | Current |

## Risk Mitigation

1. **Backup Before Changes:**
   - Commit current state before each fix phase
   - Keep baseline-40q-2025-10-31-interactive.csv as reference

2. **Incremental Testing:**
   - Test each fix individually before moving to next
   - Use interactive testing for immediate feedback

3. **Regression Prevention:**
   - Verify passing questions still pass after each fix
   - Run focused tests on previously working queries

4. **Rollback Plan:**
   - Each fix in separate commit for easy rollback
   - Document which questions affected by each fix

## Next Steps

1. ✅ **Baseline Saved:** `baseline-40q-2025-10-31-interactive.csv`
2. ⏳ **P1 Fixes:** Start with missing responses and routing
3. ⏳ **Validation:** Test fixes incrementally
4. ⏳ **Documentation:** Update TODO lists and progress

---

**Document Owner:** Cursor AI  
**Last Updated:** 2025-10-31  
**Next Review:** After Phase 1 completion

