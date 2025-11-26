# Regression Investigation Summary

## Completed Investigations

### 1. "what is depth of field"
- **Baseline**: Returned products (broken baseline)
- **Current**: Returns 1 assignment article (ID: 265306)
- **Missing**: Article 256968 "09 What is DEPTH OF FIELD in Photography"
- **Root Causes**:
  - `filterArticleKeywords` bug: Returns empty (multi-word phrase issue)
  - Equipment keyword detection bug: Doesn't detect "depth of field"
  - Database query too broad

### 2. "what is aperture"
- **Baseline**: Returned 1 product (broken baseline)
- **Current**: Returns 1 assignment article (ID: 265306)
- **Missing**: Article 256372 "02 What is APERTURE in photography"
- **Root Causes**:
  - `filterArticleKeywords` works (single word)
  - Equipment keyword detection works
  - **BUT**: Still shows same problem - only 1 article

## Common Pattern: Only 1 Article

Both queries show only 1 article in `structured.articles`, despite:
- `handleTechnicalQueries` should preserve all articles (tested)
- `findArticles` is called with limit 12
- `filterArticlesForSharpness` limits to 12

**Hypothesis**: `processAndSortResults` or `findArticles` is only returning 1 article, possibly due to:
1. Equipment keyword filtering removing all but 1
2. Scoring/filtering logic being too aggressive
3. Database query returning only 1 relevant article

## Identified Bugs

1. **`filterArticleKeywords`** (lines 4583-4591): Doesn't handle multi-word phrases
2. **Equipment keyword detection** (lines 4536-4542): Only checks individual words, not phrases
3. **Unknown filtering** causing only 1 article to appear (needs further investigation)

## Next Steps

1. ✅ Document findings
2. ⏳ Investigate `processAndSortResults` to see if it's filtering articles
3. ⏳ Check if equipment keyword filtering is removing articles incorrectly
4. ⏳ Fix bugs #1 and #2
5. ⏳ Re-run regression test


