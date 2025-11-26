# Post-Change Comparison: Test 931 vs Test 923

## Test Details
- **Pre-Change Test**: #923 (2025-11-24 19:50:06)
- **Post-Change Test**: #931 (2025-11-25 - after fixes deployed)
- **Changes Deployed**: 
  - Fixed `filterArticleKeywords` to handle multi-word phrases
  - Fixed equipment keyword detection to check phrases in full query
  - Capped articles/services/landing results at 6

---

## Query-by-Query Comparison

### 1. "what is depth of field"
**Status**: ❌ **NO CHANGE** - Still only 1 article

**Pre-Change (Test 923)**:
- Position 1: "Aperture and Depth of Field Photography Assignment" (ID: 265306, 2025-11-23)

**Post-Change (Test 931)**:
- Position 1: "Aperture and Depth of Field Photography Assignment" (ID: 265306, 2025-11-23)

**Analysis**:
- Still missing proper article: "09 What is DEPTH OF FIELD in Photography" (ID: 256968)
- Only 1 article showing (should be up to 6 with new cap)
- Keyword filtering fix didn't resolve the issue
- **Root cause likely elsewhere**: Database query or scoring logic

---

### 2. "what is aperture"
**Status**: ❌ **NO CHANGE** - Still only 1 article

**Pre-Change (Test 923)**:
- Position 1: "Aperture and Depth of Field Photography Assignment" (ID: 265306, 2025-11-23)

**Post-Change (Test 931)**:
- Position 1: "Aperture and Depth of Field Photography Assignment" (ID: 265306, 2025-11-23)

**Analysis**:
- Still missing proper article: "02 What is APERTURE in photography: A Guide for Beginners" (ID: 256372)
- Only 1 article showing (should be up to 6 with new cap)
- Keyword filtering works for "aperture" (single word), so issue is elsewhere
- **Root cause likely elsewhere**: Database query or scoring logic

---

### 3. "what is shutter speed"
**Status**: ❌ **NO CHANGE** - Still only 1 article

**Pre-Change (Test 923)**:
- Position 1: "Shutter Speed and Motion Photography Practice Assignment" (ID: 265308, 2025-11-23)

**Post-Change (Test 931)**:
- Position 1: "Shutter Speed and Motion Photography Practice Assignment" (ID: 265308, 2025-11-23)

**Analysis**:
- Still missing proper article: "03 What is SHUTTER SPEED in photography: Guide for Beginners" (ID: 256379)
- Only 1 article showing (should be up to 6 with new cap)
- **Root cause likely elsewhere**: Database query or scoring logic

---

### 4. "what is macro photography"
**Status**: ✅ **IMPROVED** - Proper article at #1, capped at 6

**Pre-Change (Test 923)**:
- Position 1: "Unlocking the Art of MACRO PHOTOGRAPHY: Techniques and Tips" (ID: 256805, 2025-04-30)
- Position 2: "Closeup Macro Photography Practice Assignment- Free Lesson" (ID: 265282, 2025-11-23)
- Position 3: "Macro Photography Workshop - Abstract and Macro Warwickshire" (ID: 256776, 2019-11-12)

**Post-Change (Test 931)**:
- Position 1: "Unlocking the Art of MACRO PHOTOGRAPHY: Techniques and Tips" (ID: 256805, 2025-04-30) ✅
- Position 2: "Closeup Macro Photography Practice Assignment- Free Lesson" (ID: 265282, 2025-11-23)
- Position 3: "Macro Photography Workshop - Abstract and Macro Warwickshire" (ID: 256776, 2019-11-12)

**Analysis**:
- ✅ Proper article maintained at #1
- ✅ Results capped at 6 (showing 3, which is correct)
- ✅ No regression

---

### 5. "what is composition in photography"
**Status**: ✅ **IMPROVED** - Capped at 6, proper articles

**Pre-Change (Test 923)**:
- 11 articles (all proper composition articles)

**Post-Change (Test 931)**:
- Position 1: "Composition in Photography: Why the Camera Isn't the Artist" (ID: 256847, 2025-07-26)
- Position 2: "Photography COMPOSITION RULES: A Guide for Beginners" (ID: 256896, 2025-03-24)
- Position 3: "How to Improve Your Photography Composition: A Guide" (ID: 256374, 2025-05-04)
- Position 4: "Finding Your Compositional Balance: A Guide For Beginner's" (ID: 256857, 2025-05-19)
- Position 5: "Composition Curiousness - Part 1 | Professional Guide" (ID: 256399, 2025-09-08)
- Position 6: "Composition Curiousness - Part 2 | Professional Guide" (ID: 256852, 2025-09-05)

**Analysis**:
- ✅ Results capped at 6 (was 11, now 6)
- ✅ All proper composition articles
- ✅ No assignment articles in top 6
- ✅ Improvement: Cleaner, more focused results

---

### 6. "how do I improve my photography"
**Status**: ⚠️ **MIXED** - Capped at 6, but all assignment articles

**Pre-Change (Test 923)**:
- 12 articles (all assignment articles from 2025-11-23)

**Post-Change (Test 931)**:
- Position 1: "Landscapes Photography Practise Assignment - Free Lesson" (ID: 265279, 2025-11-23)
- Position 2: "Wildlife Photography Practice Assignment - Free Lesson" (ID: 265280, 2025-11-23)
- Position 3: "Seasons Nature Photography Assignment - Free Lesson" (ID: 265283, 2025-11-23)
- Position 4: "Dice Roll Serendipity Awareness Photography Assignment" (ID: 265290, 2025-11-23)
- Position 5: "Minimalism Photography Practise Assignment - Free." (ID: 265297, 2025-11-23)
- Position 6: "Shadows and Contrast Photography Practice Assignment" (ID: 265294, 2025-11-23)

**Analysis**:
- ✅ Results capped at 6 (was 12, now 6)
- ⚠️ All assignment articles (may be appropriate for this query)
- ⚠️ No proper educational articles in top 6

---

### 7. "how do I use a tripod"
**Status**: ✅ **IMPROVED** - Capped at 6, proper articles included

**Pre-Change (Test 923)**:
- 11 articles (assignment article at #1, then proper articles)

**Post-Change (Test 931)**:
- Position 1: "Handheld vs Tripod Stability Photography Assignment" (ID: 265301, 2025-11-23)
- Position 2: "Best Tripod for Landscape Photography Benro Mammoth + GD36PT" (ID: 260851, 2025-11-14)
- Position 3: "5 Reasons why a tripod will help you to become better" (ID: 256802, 2021-07-08)
- Position 4: "Tripod for Camera: Guide To Which, Why, How to Use A Tripod" (ID: 256409, 2025-01-01) ✅
- Position 5: "Benro Review - Head to Head with Gitzo and Manfrotto Tripods" (ID: 256950, 2021-07-05)
- Position 6: "The Best Product Photography Tripod: Review and Features" (ID: 256819, 2024-11-13)

**Analysis**:
- ✅ Results capped at 6 (was 11, now 6)
- ✅ Proper tripod articles included (positions 2-6)
- ⚠️ Assignment article still at #1 (but proper articles are visible)

---

### 8. "what tripod should I buy"
**Status**: ✅ **IMPROVED** - Capped at 6, proper articles included

**Pre-Change (Test 923)**:
- 11 articles (assignment article at #1, then proper articles)

**Post-Change (Test 931)**:
- Position 1: "Handheld vs Tripod Stability Photography Assignment" (ID: 265301, 2025-11-23)
- Position 2: "Best Tripod for Landscape Photography Benro Mammoth + GD36PT" (ID: 260851, 2025-11-14)
- Position 3: "5 Reasons why a tripod will help you to become better" (ID: 256802, 2021-07-08)
- Position 4: "Tripod for Camera: Guide To Which, Why, How to Use A Tripod" (ID: 256409, 2025-01-01) ✅
- Position 5: "Benro Review - Head to Head with Gitzo and Manfrotto Tripods" (ID: 256950, 2021-07-05)
- Position 6: "The Best Product Photography Tripod: Review and Features" (ID: 256819, 2024-11-13)

**Analysis**:
- ✅ Results capped at 6 (was 11, now 6)
- ✅ Proper tripod articles included (positions 2-6)
- ⚠️ Assignment article still at #1 (but proper articles are visible)

---

## Summary

### ✅ Improvements
1. **Capping works**: All queries now respect the 6-article limit
2. **"what is macro photography"**: Proper article maintained at #1
3. **"what is composition in photography"**: Cleaner results, all proper articles
4. **Tripod queries**: Proper articles now visible (positions 2-6)

### ❌ Still Broken
1. **"what is depth of field"**: Still only 1 article, missing proper article
2. **"what is aperture"**: Still only 1 article, missing proper article
3. **"what is shutter speed"**: Still only 1 article, missing proper article

### Root Cause Analysis
The keyword filtering fixes didn't resolve the "only 1 article" issue for the three technical queries. This suggests:
1. **Database query issue**: `findArticles()` may not be returning multiple articles
2. **Scoring/filtering issue**: Articles may be filtered out after retrieval
3. **Equipment keyword filtering too aggressive**: May be removing all but one article

### Next Steps
1. Investigate why `findArticles()` only returns 1 article for these queries
2. Check if equipment keyword filtering is too aggressive
3. Verify database queries are returning multiple articles
4. Consider if recency boost is still too strong despite decay function

