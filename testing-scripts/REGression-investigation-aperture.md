# Regression Investigation: "what is aperture"

## Query
"what is aperture"

## Baseline (Test 878)
- **Date**: 2025-11-21
- **Result**: Returned 1 product in articles array (ID: 257003 - "15 Camera Settings PDF Bundle")
- **Issue**: Baseline was broken - product incorrectly placed in articles array
- **Missing**: Article 256372 "02 What is APERTURE in photography: A Guide for Beginners" (published 2025-05-05)

## Current (Test 924)
- **Date**: 2025-11-24
- **Result**: Returns 1 article - "Aperture and Depth of Field Photography Assignment" (ID: 265306, published 2025-11-23)
- **Missing**: Article 256372 "02 What is APERTURE in photography: A Guide for Beginners" (published 2025-05-05)

## Key Differences from "what is depth of field"

### ✅ What Works Correctly
1. **`filterArticleKeywords` works**: "aperture" is a single word in the allow set, so it passes through
   - Returns: `["aperture"]` ✅
   - Unlike "depth of field" which returns empty ❌

2. **Equipment keyword detection works**: "aperture" is detected as equipment keyword
   - `hasEquipmentKeyword`: TRUE ✅
   - `queryEquipmentKeywords`: `["aperture"]` ✅
   - Unlike "depth of field" which isn't detected ❌

### ❌ Same Problem
- **Scoring test shows article 256372 should rank #1**:
  - Article 256372: Score 84000 (base 84 × 1000 + 0 recency)
  - Assignment article 265306: Score 10020 (base 10 × 1000 + 20 recency)
  - **Article 256372 should win by a huge margin!**

- **But current test shows assignment article ranking #1**
- **Both articles match equipment keyword filter** (both contain "aperture" in title/URL)

## Root Cause Analysis

Since the keyword filtering and equipment detection work correctly for "aperture", the issue must be:

1. **Article 256372 not being retrieved from database** (unlikely - database query should return it)
2. **Article 256372 being filtered out after retrieval** (possible - but both articles match equipment filter)
3. **Scoring not working as expected in practice** (most likely - our test shows it should work)
4. **Different code path being used** (need to verify)

## Pattern Identified

Both "what is depth of field" and "what is aperture" show:
- ✅ Proper articles exist in database
- ✅ Proper articles should score much higher than assignment articles
- ❌ Assignment articles are ranking #1 instead
- ❌ Only 1 article showing in results (should be more)

## Next Steps
1. Verify article 256372 is being returned by database query
2. Check if there's additional filtering happening after `findArticles()` returns
3. Investigate why scoring isn't working as expected in practice


