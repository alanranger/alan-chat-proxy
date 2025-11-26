# Regression Investigation: "what is shutter speed"

## Query Details
- **Query**: "what is shutter speed"
- **Regression**: 3 articles (baseline 878) → 1 article (current 924)
- **Test IDs**: Baseline #878, Current #924

## Baseline Results (Test #878)
- **Article Count**: 3 articles in `structured.articles`
- **Response Type**: `advice` (handled by `handleTechnicalQueries`)
- **Articles**:
  1. "15 Camera Settings — Photography Field Checklists PDF Bundle" (2025-08-26) - Product
  2. "04 What is ISO in Photography: A Guide for Beginners." (2025-08-20) - Article (ISO, not shutter speed)
  3. "08 What is FOCUS in Photography: Key Concepts Explained" (2025-05-29) - Article (Focus, not shutter speed)

## Current Results (Test #924)
- **Article Count**: 1 article in `structured.articles`
- **Response Type**: `advice` (handled by `handleTechnicalQueries`)
- **Articles**:
  1. "Shutter Speed and Motion Photography Practice Assignment" (2025-11-23) - **NEW assignment article**

## Keyword Analysis
- **Extracted Keywords**: `["what","is","shutter","speed"]`
- **Filtered Keywords**: `["shutter"]` ✅ (filterArticleKeywords works, but "speed" is filtered out because it's not in the allow set)
- **Equipment Keyword Detection**: `true` ✅ ("shutter" is in equipmentKeywords)
- **Equipment Filtering Applied**: Yes (articles must contain "shutter" in title/URL)

## Key Findings

### 1. Same Pattern as "what is depth of field"
- Both queries are handled by `handleTechnicalQueries` (response type is `advice`)
- Both show only 1 article in current results
- Both have a new assignment article (published 2025-11-23) ranking #1
- Both had proper articles in baseline that are now missing

### 2. Baseline Articles Were Not About Shutter Speed
- Baseline had:
  - A product about camera settings checklists
  - An article about ISO (not shutter speed)
  - An article about Focus (not shutter speed)
- **This suggests the baseline itself may have been incorrect** - it didn't have a proper "what is shutter speed" article

### 3. New Assignment Article
- "Shutter Speed and Motion Photography Practice Assignment" (2025-11-23) is the only article in current results
- This is a NEW assignment article, same pattern as other regressions

### 4. Keyword Filtering Issue
- `filterArticleKeywords` returns only `["shutter"]` - "speed" is filtered out
- This is because "speed" is not in the `allow` set in `filterArticleKeywords`
- However, "shutter speed" as a phrase is in the `allow` set, but the function doesn't check for phrases

## Database Check Results
✅ **Found proper article**: ID 256379 "03 What is SHUTTER SPEED in photography: Guide for Beginners"
- Published: 2025-04-21
- URL: https://www.alanranger.com/blog-on-photography/what-is-shutter-speed
- **This article should have been in baseline but was missing**

## Questions to Investigate
1. ✅ **ANSWERED**: There IS a proper "what is shutter speed" article (ID: 256379) that should have been in baseline
2. Why did baseline return articles about ISO and Focus instead of shutter speed? **Baseline was incorrect**
3. Why is only 1 article showing (same as depth of field and aperture)?
4. Is the keyword filtering causing issues (only "shutter" is used, not "shutter speed" as a phrase)?

## Next Steps
1. Check database for "what is shutter speed" articles
2. Verify if baseline was correct or if it had a bug
3. Investigate why only 1 article is showing (same pattern as other queries)

