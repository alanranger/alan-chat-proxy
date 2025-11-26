# Regression Investigation: "what is depth of field"

## Query
"what is depth of field"

## Baseline (Test 878)
- **Date**: 2025-11-21
- **Result**: Returned 6 products in articles array (NO actual articles)
- **Issue**: Baseline was broken - products were incorrectly placed in articles array (38 products across all queries)

## Current (Test 924)
- **Date**: 2025-11-24
- **Result**: Returns 1 article - "Aperture and Depth of Field Photography Assignment" (ID: 265306, published 2025-11-23)
- **Missing**: Article 256968 "09 What is DEPTH OF FIELD in Photography: A Beginners Guide" (published 2025-02-20)

## Root Causes Identified

### Bug #1: `filterArticleKeywords` filters out individual words from phrases
**Location**: `api/chat.js` lines 4583-4591

**Problem**:
- Query: "what is depth of field"
- Keywords extracted: ["what", "is", "depth", "of", "field"]
- `filterArticleKeywords` checks if individual words are in allow set
- "depth" and "field" are NOT in allow set individually
- "depth of field" IS in allow set as a phrase, but function doesn't check phrases
- **Result**: Returns EMPTY array

**Impact**: Falls back to using ALL keywords (including "what", "is", "of"), making database query very broad

### Bug #2: Equipment keyword detection doesn't check multi-word phrases
**Location**: `api/chat.js` lines 4536-4542

**Problem**:
- Equipment keywords set includes "depth of field" as a phrase
- Code only checks individual keywords: `equipmentKeywords.has(k)`
- "depth" and "field" individually don't match "depth of field" in the set
- **Result**: `hasEquipmentKeyword` is FALSE

**Impact**: Equipment keyword filtering doesn't work, articles aren't properly prioritized

### Bug #3: Why only 1 article shows
**Location**: `api/chat.js` lines 9886-9920 (`handleTechnicalQueries`)

**Findings**:
- Query routes to `handleTechnicalQueries()` (detected as technical query)
- `findArticles()` called with limit 12
- `filterArticlesForSharpness()` should return up to 12 articles
- But test result shows only 1 article

**Possible Causes**:
1. `findArticles()` only returning 1 article due to bugs #1 and #2
2. Scoring/filtering removing other articles
3. Article 256968 scoring too low (no recency boost vs assignment article's +20 boost)

## Expected Behavior
- Article 256968 should rank #1 (score: 12000 vs assignment article's 8020)
- Multiple articles should be returned (limit is 12)
- Proper articles should outrank assignment articles

## Next Steps
1. Fix `filterArticleKeywords` to handle multi-word phrases
2. Fix equipment keyword detection to check phrases in full query
3. Verify article 256968 appears after fixes
4. Re-run regression test to create new baseline


