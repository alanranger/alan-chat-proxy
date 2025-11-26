# Regression Investigation Summary - Patterns Identified

## Queries Investigated

### 1. "what is depth of field"
### 2. "what is aperture"

## Common Patterns Found

### Pattern #1: Baseline Was Broken
- **Both queries**: Baseline (878) returned products in articles array instead of actual articles
- **Impact**: Baseline cannot be trusted as reference point
- **Root cause**: Products were incorrectly placed in articles array at baseline time (38 products across all queries)

### Pattern #2: Assignment Articles Ranking #1
- **Both queries**: Current test shows assignment articles (published 2025-11-23) ranking #1
- **Missing**: Proper educational articles that should rank higher
- **Examples**:
  - "what is depth of field": Missing article 256968 (published 2025-02-20)
  - "what is aperture": Missing article 256372 (published 2025-05-05)

### Pattern #3: Only 1 Article in Results
- **Both queries**: Only 1 article appears in `structured.articles`
- **Expected**: Should return up to 12-15 articles (limit is 12-15)
- **Impact**: Users only see assignment articles, not proper educational content

### Pattern #4: Scoring Logic Works in Theory
- **Both queries**: Scoring tests show proper articles should rank #1
  - "what is depth of field": Article 256968 should score 12000 vs assignment's 8020
  - "what is aperture": Article 256372 should score 84000 vs assignment's 10020
- **Reality**: Assignment articles are ranking #1 instead
- **Conclusion**: Scoring logic is correct, but something is wrong in practice

## Differences Between Queries

### "what is depth of field"
- ❌ `filterArticleKeywords` bug: Returns empty (multi-word phrase issue)
- ❌ Equipment keyword detection bug: Doesn't detect "depth of field" phrase
- ❌ Database query is too broad (uses all keywords including "what", "is", "of")

### "what is aperture"
- ✅ `filterArticleKeywords` works: Returns `["aperture"]` (single word)
- ✅ Equipment keyword detection works: Detects "aperture"
- ✅ Database query is correct (uses just "aperture")

## Root Causes Identified

### Bug #1: `filterArticleKeywords` doesn't handle multi-word phrases
**Location**: `api/chat.js` lines 4583-4591
**Impact**: Affects queries with multi-word technical terms like "depth of field", "focal length", "white balance"
**Fix needed**: Check for phrases in addition to individual words

### Bug #2: Equipment keyword detection doesn't check multi-word phrases
**Location**: `api/chat.js` lines 4536-4542
**Impact**: Affects queries with multi-word equipment terms
**Fix needed**: Check full query string for multi-word equipment keywords

### Bug #3: Recency boost may still be too strong (needs verification)
**Location**: `api/chat.js` lines 4419-4445
**Impact**: New articles (within 7 days) get +20 boost, which may overcome proper articles' advantages
**Status**: Scoring tests show proper articles should still win, so this may not be the issue

### Bug #4: Only 1 article showing (unknown cause)
**Location**: Unknown - needs further investigation
**Possible causes**:
1. Articles being filtered out after `findArticles()` returns
2. Limit being applied incorrectly
3. Different code path being used
4. Articles not being retrieved from database (unlikely - we verified they exist)

## Next Steps

1. ✅ Document findings for both queries
2. ⏳ Investigate why only 1 article shows (both queries)
3. ⏳ Check if there's additional filtering after `findArticles()` returns
4. ⏳ Verify scoring is actually being applied in practice
5. ⏳ Fix bugs #1 and #2 (multi-word phrase handling)
6. ⏳ Re-run regression test after fixes
7. ⏳ Create new baseline (current baseline 878 is unreliable)

## Recommendations

**DO NOT make code changes yet**. We need to:
1. Investigate why only 1 article shows (this is the immediate blocker)
2. Verify if the same pattern appears in other regression queries
3. Only then make fixes that address root causes across all queries


