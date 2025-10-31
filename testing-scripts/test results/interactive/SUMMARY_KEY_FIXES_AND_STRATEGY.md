# Summary: Key Critical Fixes & Testing Strategy
**Date:** 2025-10-31  
**Baseline:** `baseline-40q-2025-10-31-interactive.csv`

## Current Status
- **Pass:** 8 questions (20%)
- **Fail:** 32 questions (80%)
- **Baseline Saved:** ✅ Complete

## 🔴 Priority 1: Critical Fixes (Week 1)

### 1. Missing Initial Responses
- **Q23:** "What is the exposure triangle" → No bot response
- **Q38:** "How do I subscribe to free course" → Empty response
- **Fix:** Ensure technical questions generate answers from article content

### 2. Wrong Routing (12+ Questions)
- Equipment queries not finding correct content (Q9, Q10, Q11)
- Service queries missing tiles (Q17)
- Technical queries routed incorrectly (Q22, Q25, Q26)
- **Fix:** Add pattern matches in `tryRagFirst()` for equipment, service, technical queries

### 3. Article Capping
- **Q7:** "What tripod do you recommend" → Should show ALL articles (currently capped at 6)
- **Fix:** Remove 6-article cap for equipment/technical questions (`chat.html:1899`)

### 4. Service/Landing Page Tiles Missing
- **7+ questions** missing service tiles or wrong content type
- Person queries showing articles instead of landing pages (Q27, Q28, Q34)
- **Fix:** Ensure services returned, add landing page retrieval for person queries

**Phase 1 Target:** 20+ Pass (50% improvement from 8)

## 🟡 Priority 2: High-Impact Fixes (Week 2)

### 5. Article Relevance
- Wrong articles shown, better matches exist
- **Fix:** Improve `pickArticles()` scoring algorithm

### 6. Course vs Workshop
- Course queries showing workshops instead
- **Fix:** Separate classification for courses vs workshops

### 7. Answer Quality
- Technical questions need conversational answers from content
- **Fix:** Generate summaries from article chunks

### 8. URL Cleanup
- Remove URLs from hardcoded responses (Q19, Q27, Q34)
- **Fix:** Clean up presentation, use tiles instead

**Phase 2 Target:** Article relevance ≥80%, conversational answer style

## 🟢 Priority 3: Edge Cases (Week 3)

### 9. Free Course Edge Case
- Special routing needed (Q12, Q14, Q36, Q38)
- **Fix:** Add exception handling for free online photography course

### 10. Event Selection
- Improve logging/transparency (Q4, Q18)
- **Fix:** Better event filtering criteria

**Phase 3 Target:** 30+ Pass (75% improvement from baseline)

## Testing & Validation Strategy

### Phase 1 Validation (Week 1)
1. Fix P1 issues individually
2. Test each fix with focused queries
3. Re-run 40Q interactive test
4. Compare against baseline
5. **Target:** 20+ Pass

### Phase 2 Validation (Week 2)
1. Improve article scoring
2. Test answer quality improvements
3. Verify course/workshop distinction
4. **Target:** Article relevance ≥80%

### Phase 3 Validation (Week 3)
1. Handle edge cases
2. Full 40Q regression testing
3. 430Q validation (after 40Q parity)
4. **Target:** 30+ Pass (75%)

## Key Files for Fixes

| Issue | File | Location |
|-------|------|----------|
| Article Cap | `public/chat.html` | Line 1899: `pickArticles()` |
| Routing | `api/chat.js` | `tryRagFirst()`, `classifyQuery()` |
| Article Retrieval | `api/chat.js` | `findArticles()` line 4121 |
| Service Retrieval | `api/chat.js` | `findServices()` line 3854 |
| Answer Generation | `api/chat.js` | `generateArticleAnswer()`, `generateEvidenceBasedAnswer()` |

## Success Metrics

| Metric | Target | Baseline |
|--------|--------|----------|
| 40Q Pass Rate (Phase 1) | ≥50% | 20% |
| 40Q Pass Rate (Phase 3) | ≥75% | 20% |
| Article Relevance | ≥80% | ~40% |
| Answer Quality | Conversational | Mixed |

## Next Steps

1. ✅ **Baseline Saved** → `baseline-40q-2025-10-31-interactive.csv`
2. ⏳ **Start P1 Fixes** → Missing responses, routing, article cap, service tiles
3. ⏳ **Incremental Testing** → Test each fix individually
4. ⏳ **Phase Validation** → Re-run 40Q after each phase

---

**Full Details:** See `CRITICAL_FIXES_AND_TESTING_STRATEGY.md`  
**Analysis:** See `analysis-40q-interactive-results.md`  
**Baseline:** `baseline-40q-2025-10-31-interactive.csv`

