# Final Regression Investigation Summary

## Overview
- **Baseline Test**: #878 (2025-11-21)
- **Current Test**: #924 (2025-11-24)
- **Total Queries**: 40
- **Queries with Regressions**: 3 major regressions identified

## "what is ISO" - Not a Regression ✅
- **Change**: 3 articles → 4 articles (+1)
- **Status**: Working correctly
- **Key Finding**: Proper article (ID: 256346) ranks #1 in both baseline and current
- **Current Result**: Proper article #1, assignment article included but not dominating
- **Conclusion**: This is an improvement, not a regression

## Regression Queries Investigated

### 1. "what is depth of field" ✅
- **Regression**: 6 articles → 1 article (-5)
- **Status**: Investigated
- **Root Causes**:
  - `filterArticleKeywords` bug: Returns empty (multi-word phrase issue)
  - Equipment keyword detection bug: Doesn't detect "depth of field"
  - Database query too broad
- **Missing Article**: ID 256968 "09 What is DEPTH OF FIELD in Photography"
- **Current Result**: Only assignment article (ID: 265306, published 2025-11-23)
- **Document**: `REGression-investigation-depth-of-field.md`

### 2. "what is aperture" ✅
- **Regression**: 1 article → 1 article (0 change, but wrong article)
- **Status**: Investigated
- **Root Causes**:
  - `filterArticleKeywords` works correctly (single word)
  - Equipment keyword detection works correctly
  - **BUT**: Still shows same problem - only 1 article, wrong article ranking #1
- **Missing Article**: ID 256372 "02 What is APERTURE in photography"
- **Current Result**: Only assignment article (ID: 265306, published 2025-11-23)
- **Document**: `REGression-investigation-aperture.md`

### 3. "what is shutter speed" ✅
- **Regression**: 3 articles → 1 article (-2)
- **Status**: Investigated
- **Root Causes**:
  - `filterArticleKeywords` works (returns "shutter" but filters out "speed")
  - Equipment keyword detection works ("shutter" detected)
  - **BUT**: Baseline was incorrect (had ISO and Focus articles, not shutter speed)
  - **Missing Article**: ID 256379 "03 What is SHUTTER SPEED in photography" (should have been in baseline)
- **Current Result**: Only assignment article (ID: 265308, published 2025-11-23)
- **Document**: `REGression-investigation-shutter-speed.md`

### 4. "what is macro photography" ✅
- **Regression**: 12 articles → 3 articles (-9)
- **Status**: Investigated
- **Root Causes**:
  - NOT handled by `handleTechnicalQueries` (response type is `services`, not `technical_answer`)
  - Different code path than other "what is" queries
  - New assignment article appears in results
- **Current Result**: 3 articles including new assignment article (published 2025-11-23)
- **Document**: `REGression-investigation-macro-photography.md`

## Common Patterns Identified

### Pattern 1: Multi-Word Phrase Bugs
**Affected Queries**: "what is depth of field"
- `filterArticleKeywords` doesn't check for multi-word phrases
- Equipment keyword detection doesn't check for multi-word phrases
- **Impact**: Empty keyword array → broad database query → incorrect results

### Pattern 2: Only 1 Article Showing
**Affected Queries**: "what is depth of field", "what is aperture", "what is shutter speed"
- All three queries show only 1 article in current results
- All three have new assignment articles (published 2025-11-23) ranking #1
- All three have proper educational articles that should rank higher
- **Possible Causes**:
  1. `findArticles()` only returning 1 article (database query issue)
  2. Scoring/filtering removing other articles
  3. Equipment keyword filtering too aggressive
  4. Recency boost still too strong despite decay function

### Pattern 3: New Assignment Articles Ranking #1
**Affected Queries**: All regressed queries
- New assignment articles published 2025-11-23 are ranking #1
- Proper educational articles (published earlier) are missing or ranking lower
- **Possible Causes**:
  1. Recency boost still too strong (decay function may not be enough)
  2. Assignment articles matching keywords better
  3. Scoring algorithm favoring new content

### Pattern 4: Baseline Was Incorrect
**Affected Queries**: "what is depth of field", "what is aperture", "what is shutter speed"
- Baseline test 878 had products in `articles` array (38 products across all queries)
- Baseline didn't include proper educational articles that exist in database
- **Impact**: Makes regression detection less reliable

## Bugs Identified

### Bug #1: `filterArticleKeywords` Multi-Word Phrase Issue
**Location**: `api/chat.js` lines 4583-4591
**Problem**: Only checks individual words, not phrases
**Impact**: "depth of field" → empty array → broad database query
**Status**: Identified, not fixed

### Bug #2: Equipment Keyword Detection Multi-Word Phrase Issue
**Location**: `api/chat.js` lines 4536-4542
**Problem**: Only checks individual words, not phrases
**Impact**: "depth of field" not detected as equipment keyword
**Status**: Identified, not fixed

### Bug #3: Only 1 Article Showing
**Location**: Unknown (could be `findArticles`, `processAndSortResults`, or elsewhere)
**Problem**: Multiple queries show only 1 article when limit is 12-15
**Impact**: Missing relevant articles in results
**Status**: Identified, root cause not yet determined

### Bug #4: Assignment Articles Ranking Higher Than Educational Articles
**Location**: Scoring/ranking logic in `api/chat.js`
**Problem**: New assignment articles (2025-11-23) ranking #1 over proper educational articles
**Impact**: Incorrect articles shown to users
**Status**: Identified, may be related to recency boost or scoring

## Queries with No Regression

The following "what is" queries show no regression (same or better article counts):
- "what is composition in photography": 11 → 11 ✅
- "what is golden hour": 1 → 1 ✅
- "what is HDR photography": 12 → 12 ✅
- "what is long exposure photography": 12 → 12 ✅
- "what is the best camera for beginners": 12 → 12 ✅
- "what is the best lens for landscape photography": 12 → 12 ✅
- "what is the best time of day for landscape photography": 12 → 12 ✅
- "what is the difference between prime and zoom lenses": 4 → 4 ✅
- "what is the rule of thirds": 1 → 1 ✅
- "what is ISO": 3 → 4 ✅ (improvement)
- "what is portrait photography": 5 → 6 ✅ (improvement)
- "what is a histogram": 0 → 1 ✅ (improvement)

## Next Steps (Pending User Approval)

1. **Fix `filterArticleKeywords`** to handle multi-word phrases
2. **Fix equipment keyword detection** to check phrases in full query
3. **Investigate why only 1 article shows** for affected queries
4. **Review recency boost** - may need further adjustment
5. **Re-run regression test** after fixes
6. **Create new baseline** with proper articles (not products)

## Files Created

1. `REGression-investigation-depth-of-field.md` - Detailed investigation of "what is depth of field"
2. `REGression-investigation-aperture.md` - Detailed investigation of "what is aperture"
3. `REGression-investigation-shutter-speed.md` - Detailed investigation of "what is shutter speed"
4. `REGression-investigation-macro-photography.md` - Detailed investigation of "what is macro photography"
5. `REGRESSION-PATTERNS-SUMMARY.md` - Summary of common patterns
6. `WHY-ONLY-1-ARTICLE-FINDINGS.md` - Investigation into why only 1 article shows
7. `INVESTIGATION-SUMMARY.md` - Overall investigation summary
8. `FINAL-REGRESSION-SUMMARY.md` - This file

